#!/usr/bin/env node
/**
 * Diagnóstico: por que a FILA de ofertas não está enviando para um grupo.
 *
 * Nasceu do chamado de 2026-09-11 ("em um grupo específico as mensagens das
 * filas não estão enviando"). Lê só o banco (`OfferQueue`, `OfferQueueItem`,
 * `MessageLog`, `Group`, `WaSession`) — não grava nada, não envia nada, não
 * imprime segredo.
 *
 * O que ele separa, que é onde o diagnóstico costuma travar:
 *
 *   1. o grupo NÃO está na lista de destinos da fila  -> configuração
 *   2. está na lista, mas entrou faz pouco            -> não é defeito, é idade
 *   3. está na lista faz tempo e parou num dia         -> aí sim é defeito
 *   4. a fila está travada por limite/horário/bot      -> `blockReason`
 *   5. o envio saiu e o motivo do descarte tem nome    -> `errorMsg` no histórico
 *
 * Lembre que `status='success'` significa "entreguei ao WhatsApp", NÃO "apareceu
 * no grupo". Se o histórico mostra envio e a cliente não vê nada, compare com o
 * espelhamento: se ele chega no mesmo grupo, o robô está lá e com permissão.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot         && node scripts/diag-fila-grupo.mjs <email> [jid|nome] [--dias=7]
 *   cd ~/wabot-staging && node scripts/diag-fila-grupo.mjs <email> "Maternidade #5"
 */

import 'dotenv/config'
import db from '../src/db.js'

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const [email, alvoArg] = positional
const diasArg = process.argv.find((arg) => arg.startsWith('--dias='))
const dias = Math.max(1, Number(diasArg?.split('=')[1]) || 7)

if (!email) {
  console.error('uso: node scripts/diag-fila-grupo.mjs <email> [jid|nome do grupo] [--dias=7]')
  process.exit(1)
}

const desde = new Date(Date.now() - dias * 86400000)
const fmt = (value) => (value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-')
// Dia em America/Sao_Paulo sem depender de lib de fuso: UTC-3 fixo é suficiente
// para agrupar envios num relatório operacional.
const dia = (value) => new Date(new Date(value).getTime() - 10800000).toISOString().slice(0, 10)

const user = await db.user.findFirst({ where: { email } })
if (!user) {
  console.error(`conta não encontrada: ${email}`)
  process.exit(1)
}

console.log(`\n=== CONTA ===`)
console.log(`${user.email}  id=${user.id}  plano=${user.plan}  acesso até ${fmt(user.accessExpiresAt)}`)

const sessao = await db.waSession.findFirst({ where: { userId: user.id } }).catch(() => null)
if (sessao) console.log(`WhatsApp: status=${sessao.status} lifecycle=${sessao.lifecycle} atualizado=${fmt(sessao.updatedAt)}`)

const destinos = await db.group.findMany({ where: { userId: user.id, role: 'post' }, orderBy: { name: 'asc' } })
console.log(`\n=== DESTINOS (role=post): ${destinos.length} ===`)
for (const grupo of destinos) {
  console.log(`- ${grupo.name}`)
  console.log(`    jid=${grupo.waJid} kind=${grupo.kind} preset=${grupo.preservationPresetId ?? '-'} minInterval=${grupo.minIntervalSec ?? '-'}s burst=${grupo.burstCap ?? '-'}/${grupo.burstWindowSec ?? '-'}s dailyCap=${grupo.dailyCap ?? '-'} queueMaxAgeMin=${grupo.queueMaxAgeMin ?? '-'}`)
}

const alvo = alvoArg
  ? destinos.find((grupo) => grupo.waJid === alvoArg || grupo.name.toLowerCase().includes(alvoArg.toLowerCase()))
  : null
if (alvoArg && !alvo) console.log(`\n!! "${alvoArg}" não está cadastrado como destino (role=post) desta conta.`)
if (alvo) console.log(`\n=== GRUPO ALVO: ${alvo.name} (${alvo.waJid}) ===`)

const filas = await db.offerQueue.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
const jidsCobertos = new Set()
let algumaFilaCobreTodos = false

console.log(`\n=== FILAS: ${filas.length} ===`)
for (const fila of filas) {
  let alvosDaFila = []
  try { const parsed = JSON.parse(fila.targetJids || '[]'); alvosDaFila = Array.isArray(parsed) ? parsed : [] } catch {}
  // Lista vazia = todos os grupos de postagem (comportamento legado).
  if (!alvosDaFila.length) algumaFilaCobreTodos = true
  for (const jid of alvosDaFila) jidsCobertos.add(jid)

  console.log(`\n- ${fila.name}  id=${fila.id}  ativa=${fila.enabled}  último envio=${fmt(fila.lastSentAt)}`)
  console.log(`    horário próprio=${fila.operatingHoursEnabled} ${fila.operatingHoursStart ?? ''}-${fila.operatingHoursEnd ?? ''} | intervalo=${fila.intervalEnabled}/${fila.intervalMinutes}min | hora=${fila.hourlyCapEnabled}/${fila.hourlyCap} | dia=${fila.dailyCapEnabled}/${fila.dailyCap}`)
  console.log(`    destinos (${alvosDaFila.length || 'todos'}): ${alvosDaFila.join(', ') || '[] = todos os grupos de postagem'}`)
  if (alvo) console.log(`    >> o grupo alvo está nos destinos desta fila? ${alvosDaFila.length ? (alvosDaFila.includes(alvo.waJid) ? 'SIM' : 'NÃO') : 'SIM (lista vazia = todos)'}`)

  const porStatus = await db.offerQueueItem.groupBy({ by: ['status'], where: { queueId: fila.id }, _count: { _all: true } })
  console.log(`    itens: ${porStatus.map((linha) => `${linha.status}=${linha._count._all}`).join(' ') || 'nenhum'}`)

  if (alvo) {
    // A lista de destinos fica CONGELADA dentro de cada item no momento em que
    // ele entra na fila: marcar o grupo agora não alcança item já enfileirado.
    const pendentes = await db.offerQueueItem.findMany({ where: { queueId: fila.id, status: { in: ['pending', 'queued'] } }, select: { targetJids: true } })
    const comAlvo = pendentes.filter((item) => String(item.targetJids || '').includes(alvo.waJid)).length
    console.log(`    itens pendentes que já incluem o grupo alvo: ${comAlvo} de ${pendentes.length}`)

    const primeiro = await db.messageLog.findFirst({
      where: { userId: user.id, destGroup: alvo.waJid, sourceGroup: `offerQueue:${fila.id}` },
      orderBy: { sentAt: 'asc' },
      select: { sentAt: true },
    })
    console.log(`    primeiro envio desta fila para o grupo alvo: ${primeiro ? fmt(primeiro.sentAt) : 'NUNCA'}`)
  }

  const comErro = await db.offerQueueItem.findMany({ where: { queueId: fila.id, NOT: { lastError: null } }, orderBy: { createdAt: 'desc' }, take: 5 })
  for (const item of comErro) {
    console.log(`    erro item ${item.id} status=${item.status} tentativas=${item.attemptCount} próxima=${fmt(item.nextAttemptAt)} :: ${String(item.lastError).slice(0, 180)}`)
  }
}

const foraDeTodasAsFilas = algumaFilaCobreTodos || !filas.length
  ? []
  : destinos.filter((grupo) => !jidsCobertos.has(grupo.waJid))
if (foraDeTodasAsFilas.length) {
  console.log(`\n!! DESTINOS FORA DE TODAS AS FILAS (não recebem nada das filas):`)
  for (const grupo of foraDeTodasAsFilas) console.log(`   - ${grupo.name} [${grupo.waJid}]`)
}

console.log(`\n=== ENVIOS DAS FILAS por destino (últimos ${dias} dias) ===`)
const envios = await db.messageLog.findMany({
  where: { userId: user.id, sourceGroup: { startsWith: 'offerQueue:' }, sentAt: { gte: desde } },
  select: { destGroup: true, status: true, errorMsg: true, sentAt: true },
})
const nomePorJid = new Map(destinos.map((grupo) => [grupo.waJid, grupo.name]))
const porDestino = new Map()
for (const linha of envios) {
  const chave = `${linha.destGroup}|${linha.status}|${linha.errorMsg ?? '-'}`
  const atual = porDestino.get(chave) ?? { n: 0, ultimo: null }
  atual.n++
  if (!atual.ultimo || linha.sentAt > atual.ultimo) atual.ultimo = linha.sentAt
  porDestino.set(chave, atual)
}
if (!porDestino.size) console.log('NENHUM envio de fila registrado na janela.')
for (const [chave, valor] of [...porDestino.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const [jid, status, motivo] = chave.split('|')
  console.log(`${String(valor.n).padStart(5)}  ${status.padEnd(8)} ${motivo.padEnd(34)} ${nomePorJid.get(jid) ?? '(fora do painel)'} [${jid}] último=${fmt(valor.ultimo)}`)
}

if (alvo) {
  console.log(`\n=== GRUPO ALVO, dia a dia e por origem (últimos ${dias} dias) ===`)
  const doAlvo = await db.messageLog.findMany({
    where: { userId: user.id, destGroup: alvo.waJid, sentAt: { gte: desde } },
    orderBy: { sentAt: 'asc' },
    select: { sourceGroup: true, status: true, errorMsg: true, sentAt: true },
  })
  const porDia = new Map()
  for (const linha of doAlvo) {
    const chave = `${dia(linha.sentAt)}|${linha.sourceGroup}|${linha.status}|${linha.errorMsg ?? '-'}`
    porDia.set(chave, (porDia.get(chave) ?? 0) + 1)
  }
  if (!porDia.size) console.log('NENHUMA linha para este grupo na janela — nem de fila, nem de espelhamento.')
  for (const [chave, n] of porDia) {
    const [data, origem, status, motivo] = chave.split('|')
    console.log(`${data}  ${String(n).padStart(4)}x  ${status.padEnd(8)} ${origem.padEnd(32)} ${motivo}`)
  }
  console.log(`\n(origem começando com 'offerQueue:' = veio de fila; um jid de grupo = veio do espelhamento.`)
  console.log(` Espelhamento chegando e fila não = problema na fila. Nada chegando de origem nenhuma = o robô`)
  console.log(` não está conseguindo publicar nesse grupo, e aí o assunto não é fila.)`)
}

await db.$disconnect()
