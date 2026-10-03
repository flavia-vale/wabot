#!/usr/bin/env node
// Move uma conta de WhatsApp de um servidor (nó) para outro. SIMULAÇÃO por padrão.
//
//   node scripts/mover-conta-no.mjs --email=cliente@x.com --para=n2                       # só mostra o plano
//   node scripts/mover-conta-no.mjs --email=... --para=n2 --aplicar --fase=parar [--host-origem=user@ip]
//   (rodar no servidor de DESTINO o rsync que o passo acima imprime)
//   node scripts/mover-conta-no.mjs --email=... --para=n2 --aplicar --fase=trocar --auth-copiado
//   (caiu no meio do "trocar"? rode o mesmo comando de novo; se a origem não era
//    n1, informe --origem=<nó>)
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
import { MOVING_NODE_LIFECYCLE, buildRsyncCommand, planAccountMove } from '../src/supervisor/accountMove.js'

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
  const plano = planAccountMove({ userId: user.id, targetNode: para, sessionRow: row, nodes: nos, resuming: fase === 'trocar' })
  const authDir = getAuthInfoDir(user.id)

  console.log(`Conta ${email}: servidor atual "${plano.sourceNode}" → "${para}"`)
  for (const w of plano.warnings) console.log(`⚠️  ${w}`)
  for (const e of plano.errors) console.log(`❌ ${e}`)
  if (!plano.ok) { console.log('\nNÃO é seguro mover agora.'); process.exit(1) }

  console.log(`\nCopiar o login (rodar no servidor "${para}", DEPOIS de parar):\n  ${buildRsyncCommand({ authDir, sourceHost: arg('host-origem') })}`)
  if (!aplicar) { console.log('\n(simulação) nada foi alterado. Use --aplicar --fase=parar para começar.'); process.exit(0) }

  const rodando = async () => {
    client.forgetNode(user.id)
    return client.isRunning(user.id).catch(() => true)
  }

  if (fase === 'parar') {
    // 'moving_node' (revisão C6): o supervisor não ressuscita, e a rota de ligar
    // / pedir código recusa com mensagem clara enquanto o login é copiado.
    await db.waSession.updateMany({ where: { userId: user.id }, data: { status: 'disconnected', lifecycle: MOVING_NODE_LIFECYCLE } })
    await client.stopBot(user.id).catch(err => console.log(`aviso: stopBot falhou (${err.message}); conferindo se parou`))
    const parou = await esperar(async () => !(await rodando()))
    if (!parou) { console.error('❌ O robô NÃO parou na origem. Não copie nada. Investigue antes de seguir.'); process.exit(1) }
    console.log('✅ Robô parado na origem. Agora rode o rsync acima no servidor de destino e depois a fase "trocar".')
  } else {
    if (!flag('auth-copiado')) { console.error('Confirme com --auth-copiado que o rsync foi feito e conferido.'); process.exit(2) }
    // Servidor de origem: o gravado no banco; numa RETOMADA (o banco já diz o
    // destino) vem de --origem (padrão n1). `antes` é o valor a regravar (n1 = nulo).
    const antes = row?.nodeId === para ? (arg('origem') && arg('origem') !== 'n1' ? arg('origem') : null) : (row?.nodeId ?? null)
    const origem = antes ?? 'n1'
    if (row?.lifecycle !== MOVING_NODE_LIFECYCLE) { console.error('❌ A conta não está marcada como "em mudança". Rode a fase "parar" antes.'); process.exit(1) }
    if (await client.isRunning(user.id, { nodeId: origem }).catch(() => true)) { console.error(`❌ O robô está ligado na origem (${origem}). Rode a fase "parar" antes.`); process.exit(1) }
    // Retomada: se uma execução anterior já gravou o destino, não regrava.
    if (row?.nodeId !== para) await db.waSession.updateMany({ where: { userId: user.id }, data: { nodeId: para } })
    client.forgetNode(user.id)
    const ligou = await client.startBot(user.id).then(Boolean).catch(() => false)
      && await esperar(async () => client.isRunning(user.id, { nodeId: para }).catch(() => false))
    if (ligou) {
      console.log(`✅ Conta religada em "${para}". Confira o painel e os logs (nodeId=${para}). A origem guarda a pasta antiga: NÃO religue por lá.`)
    } else {
      // Desfazer COMPLETO (revisão C6): 1) garantir que NADA ficou ligado no
      // destino; 2) voltar o servidor; 3) religar na origem. Sem o (1), uma
      // subida lenta no destino + religar na origem = robô em dois servidores.
      console.error('❌ Não religou no destino. Desfazendo: parando no destino, voltando e religando na origem.')
      codigo = 1
      await client.stopBot(user.id, { nodeId: para }).catch(() => {})
      const destinoParou = await esperar(async () => !(await client.isRunning(user.id, { nodeId: para }).catch(() => true)))
      if (!destinoParou) {
        console.error(`❌ NÃO consegui confirmar que o destino (${para}) parou. A conta fica marcada "em mudança" (não religa sozinha). Investigue antes de rodar de novo.`)
      } else {
        await db.waSession.updateMany({ where: { userId: user.id }, data: { nodeId: antes, lifecycle: 'manual_start' } })
        client.forgetNode(user.id)
        const voltou = await client.startBot(user.id).then(Boolean).catch(() => false)
          && await esperar(async () => client.isRunning(user.id).catch(() => false))
        console.error(voltou ? `↩️  Conta religada na origem (${origem}).` : `❌ Não religou na origem (${origem}). Religue pelo painel ou pelo admin.`)
      }
    }
  }
} finally {
  try { await client.close() } catch {}
  try { await db.$disconnect() } catch {}
}
process.exit(codigo)
