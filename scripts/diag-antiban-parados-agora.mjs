#!/usr/bin/env node
/**
 * READ-ONLY. Rode a qualquer momento (manual ou num cron de hora em hora)
 * para ver, AGORA, quem está com envio SEGURADO pelo Anti-banimento — e, o
 * mais importante, se algum desses casos só existe porque o PISO
 * (antiBanFloor.js) voltou a agir sozinho num destino que tem os limites
 * DESLIGADOS por escolha. Com ANTI_BAN_FLOOR=off isso NUNCA deveria
 * acontecer; se acontecer, é sinal de regressão (alguém religou o piso, ou o
 * .env errado está sendo lido — ver pegadinha #1/#9 do AGENTS.md).
 *
 * "Segurado agora" = MessageLog com status='queued' cujo errorMsg é uma das
 * frases do Anti-banimento (deferSendJob → deferReasonMessage em
 * bot-worker.js), dentro da janela de --horas (default 6). Isso é a
 * fotografia do momento — não tenta reconstruir o histórico (pra isso existe
 * scripts/diag-quem-parou-antiban.mjs).
 *
 * Uso (no VPS, dentro de ~/wabot):
 *   node scripts/diag-antiban-parados-agora.mjs
 *   node scripts/diag-antiban-parados-agora.mjs --horas=24
 */
import 'dotenv/config'
import db from '../src/db.js'
import { resolveDestinationPreservation } from '../src/core/preservationConfig.js'
import { isAntiBanFloorEnabled } from '../src/core/antiBanFloor.js'

const args = process.argv.slice(2)
const opt = (nome, padrao) => {
  const hit = args.find((a) => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
const horas = Number(opt('horas', '6')) || 6
const desde = new Date(Date.now() - horas * 3600 * 1000)

// Mesmo texto de deferReasonMessage em bot-worker.js — se aquelas frases
// mudarem, atualizar aqui junto (é comparação por trecho, não igualdade
// exata, pra não quebrar por causa de um detalhe de pontuação).
const TRECHOS_ANTIBAN = [
  'ritmo de segurança do Anti-banimento',
  'limite diário de ofertas configurado no Anti-banimento',
  'intervalo mínimo entre uma oferta e outra',
  'horário de envio configurado',
  'pausou os envios para este grupo/canal por segurança',
  'intervalo entre destinos que você definiu no Anti-banimento',
  'vez certa de enviar',
]

async function main() {
  console.log('='.repeat(72))
  console.log('Anti-banimento — quem está sendo segurado AGORA')
  console.log(`Piso (ANTI_BAN_FLOOR) neste ambiente: ${isAntiBanFloorEnabled(process.env) ? 'LIGADO' : 'desligado (env=off)'}`)
  console.log(`Janela: últimas ${horas}h (desde ${desde.toISOString()})`)
  console.log('='.repeat(72))

  let presos
  try {
    presos = await db.messageLog.findMany({
      where: { status: 'queued', sentAt: { gte: desde }, errorMsg: { not: null } },
      select: { id: true, userId: true, destGroup: true, errorMsg: true, sentAt: true, user: { select: { email: true } } },
      orderBy: { sentAt: 'asc' },
    })
  } catch (err) {
    console.error('\nFALHA ao consultar MessageLog:', err?.message || err)
    process.exitCode = 1
    return
  }

  const doAntiban = presos.filter((p) => TRECHOS_ANTIBAN.some((t) => p.errorMsg?.includes(t)))
  console.log(`\nLinhas 'queued' na janela: ${presos.length}`)
  console.log(`Delas, seguradas pelo Anti-banimento: ${doAntiban.length}`)
  if (doAntiban.length === 0) {
    console.log('\nNinguém sendo segurado pelo Anti-banimento agora.')
    return
  }

  // Junta com a config GRAVADA do destino pra separar "config própria da
  // cliente" de "isso só faz sentido se o piso religou sozinho".
  let destinos = []
  try {
    destinos = await db.group.findMany({
      where: { role: 'post', OR: doAntiban.map((p) => ({ userId: p.userId, waJid: p.destGroup })) },
      select: { userId: true, waJid: true, name: true, kind: true, throttleEnabled: true, preservationPreset: true },
    })
  } catch (err) {
    console.error('\nFALHA ao consultar os destinos (seguindo só com a lista de presos, sem cruzar config):', err?.message || err)
  }
  const destinoPorChave = new Map(destinos.map((d) => [`${d.userId}:${d.waJid}`, d]))

  const suspeitos = []
  console.log('\n' + '-'.repeat(72))
  const porConta = new Map()
  for (const p of doAntiban) {
    const email = p.user?.email || `(userId ${p.userId})`
    if (!porConta.has(email)) porConta.set(email, [])
    porConta.get(email).push(p)
    const destino = destinoPorChave.get(`${p.userId}:${p.destGroup}`)
    if (destino?.throttleEnabled === false) suspeitos.push({ email, destino: destino.name || p.destGroup, logId: p.id, sentAt: p.sentAt })
  }
  for (const [email, itens] of porConta) {
    console.log(`\n${email} — ${itens.length} envio(s) seguro(s)`)
    for (const it of itens.slice(0, 5)) {
      console.log(`  - ${it.destGroup} · ${it.sentAt.toISOString()} · ${it.errorMsg}`)
    }
    if (itens.length > 5) console.log(`  ... e mais ${itens.length - 5}`)
  }

  console.log('\n' + '='.repeat(72))
  if (suspeitos.length > 0) {
    console.log(`⚠️  ${suspeitos.length} caso(s) em destino com limites DESLIGADOS por escolha — isso não deveria`)
    console.log('    acontecer com o piso desligado. Confira ANTI_BAN_FLOOR no .env e se o bot-supervisor')
    console.log('    foi reiniciado depois da última mudança.')
    for (const s of suspeitos) console.log(`    - ${s.email} · ${s.destino} · logId=${s.logId} · ${s.sentAt.toISOString()}`)
  } else {
    console.log('Nenhum caso em destino com limites desligados — quem está sendo segurado, é pela própria config.')
  }
}

main()
  .catch((err) => {
    console.error('\nFALHA inesperada:', err?.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    try { await db.$disconnect() } catch {}
  })
