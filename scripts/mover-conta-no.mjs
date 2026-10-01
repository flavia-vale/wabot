#!/usr/bin/env node
// Move uma conta de WhatsApp de um servidor (nó) para outro. SIMULAÇÃO por padrão.
//
//   node scripts/mover-conta-no.mjs --email=cliente@x.com --para=n2                       # só mostra o plano
//   node scripts/mover-conta-no.mjs --email=... --para=n2 --aplicar --fase=parar [--host-origem=user@ip]
//   (rodar no servidor de DESTINO o rsync que o passo acima imprime)
//   node scripts/mover-conta-no.mjs --email=... --para=n2 --aplicar --fase=trocar --auth-copiado
//
// POR QUE EM DUAS FASES: o login do WhatsApp (auth_info) mora no disco do
// servidor. Dois robôs na mesma credencial derrubam a conta em loop (risco de
// bloqueio). Então: (1) PARAR e conferir que parou; (2) copiar o login (humano
// roda o rsync); (3) TROCAR o servidor no banco e religar, com volta
// automática se não religar. As decisões moram em src/supervisor/accountMove.js.
//
// Só funciona com SUPERVISOR_NODE_ROUTING ligado e BOT_SUPERVISOR_MODE=remote
// no .env do ambiente. NÃO é usado por nenhum fluxo automático.

import 'dotenv/config'
import db from '../src/db.js'
import { getAuthInfoDir } from '../src/paths.js'
import { createSupervisorClient } from '../src/supervisor/client.js'
import { isNodeRoutingEnabled } from '../src/supervisor/nodeRouting.js'
import { buildRsyncCommand, planAccountMove } from '../src/supervisor/accountMove.js'

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const flag = name => process.argv.includes(`--${name}`)
const email = arg('email')
const para = arg('para')
const fase = arg('fase')
const aplicar = flag('aplicar')

if (!email || !para) {
  console.error('Uso: node scripts/mover-conta-no.mjs --email=<email> --para=<nó> [--aplicar --fase=parar|trocar]')
  process.exit(2)
}
if (!isNodeRoutingEnabled(process.env) || process.env.BOT_SUPERVISOR_MODE !== 'remote') {
  console.error('Roteamento por servidor desligado neste ambiente (SUPERVISOR_NODE_ROUTING / BOT_SUPERVISOR_MODE=remote). Nada a fazer.')
  process.exit(2)
}
if (aplicar && !['parar', 'trocar'].includes(fase)) {
  console.error('Com --aplicar informe --fase=parar ou --fase=trocar.')
  process.exit(2)
}

const client = createSupervisorClient()
const sleep = ms => new Promise(r => setTimeout(r, ms))
const esperar = async (cond, ms = 60_000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await cond()) return true; await sleep(2_000) } return false }

async function medirNos() {
  const [counts, caps] = await Promise.all([client.listRunningBotsByNode(), client.getNodeCapacities()])
  return Promise.all(client.nodeIds.map(async nodeId => ({ nodeId, alive: await client.isSupervisorAlive(nodeId), running: counts[nodeId] ?? null, max: caps[nodeId] ?? null })))
}

let codigo = 0
try {
  const user = await db.user.findFirst({ where: { email }, select: { id: true } })
  if (!user) { console.error(`${email}: conta não encontrada`); process.exit(1) }
  const row = await db.waSession.findUnique({ where: { userId: user.id }, select: { nodeId: true, status: true, lifecycle: true } })
  const nos = await medirNos()
  const plano = planAccountMove({ userId: user.id, targetNode: para, sessionRow: row, nodes: nos })
  const authDir = getAuthInfoDir(user.id)

  console.log(`Conta ${email}: servidor atual "${plano.sourceNode}" → "${para}"`)
  for (const w of plano.warnings) console.log(`⚠️  ${w}`)
  for (const e of plano.errors) console.log(`❌ ${e}`)
  if (!plano.ok) { console.log('\nNÃO é seguro mover agora.'); process.exit(1) }

  console.log(`\nCopiar o login (rodar no servidor "${para}", DEPOIS de parar):\n  ${buildRsyncCommand({ authDir, sourceHost: arg('host-origem') })}`)
  if (!aplicar) { console.log('\n(simulação) nada foi alterado. Use --aplicar --fase=parar para começar.'); process.exit(0) }

  if (fase === 'parar') {
    // 'stopped_by_user' impede o supervisor de ressuscitar o robô na origem durante a cópia.
    await db.waSession.updateMany({ where: { userId: user.id }, data: { status: 'disconnected', lifecycle: 'stopped_by_user' } })
    await client.stopBot(user.id).catch(err => console.log(`aviso: stopBot falhou (${err.message}); conferindo se parou`))
    const parou = await esperar(async () => !(await client.isRunning(user.id).catch(() => true)))
    if (!parou) { console.error('❌ O robô NÃO parou na origem. Não copie nada. Investigue antes de seguir.'); process.exit(1) }
    console.log('✅ Robô parado na origem. Agora rode o rsync acima no servidor de destino e depois a fase "trocar".')
  } else {
    if (!flag('auth-copiado')) { console.error('Confirme com --auth-copiado que o rsync foi feito e conferido.'); process.exit(2) }
    if (await client.isRunning(user.id).catch(() => true)) { console.error('❌ O robô está ligado na origem. Rode a fase "parar" antes.'); process.exit(1) }
    const antes = row?.nodeId ?? null
    await db.waSession.updateMany({ where: { userId: user.id }, data: { nodeId: para } })
    const ligou = await client.startBot(user.id).then(Boolean).catch(() => false)
      && await esperar(async () => client.isRunning(user.id).catch(() => false))
    if (!ligou) {
      console.error('❌ Não religou no destino. VOLTANDO para a origem.')
      await db.waSession.updateMany({ where: { userId: user.id }, data: { nodeId: antes } })
      codigo = 1
    } else {
      console.log(`✅ Conta religada em "${para}". Confira o painel e os logs (nodeId=${para}). A origem guarda a pasta antiga: NÃO religue por lá.`)
    }
  }
} finally {
  try { await client.close() } catch {}
  try { await db.$disconnect() } catch {}
}
process.exit(codigo)
