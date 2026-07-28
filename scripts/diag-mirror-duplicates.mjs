// Diagnóstico read-only de DUPLICATA e ATRASO no espelhamento de mensagens.
//
// Contexto (RCA 2026-07): uma mensagem publicada UMA vez no grupo monitorado
// saiu 5x em staging (14:14, 18:41, 19:42, 19:52, 20:04) e saiu 5h atrasada em
// produção (14:13 -> 19:13). As causas possíveis são mutuamente excludentes e
// só os dados do ambiente separam entre elas:
//
//   A) o WhatsApp REOFERTOU a mesma mensagem (mesmo key.id) várias vezes
//      -> aparece no bot.log como várias linhas 'Mensagem aceita para
//         processamento' com o MESMO msgId;
//   B) a FONTE republicou (key.id diferente a cada vez)
//      -> msgId diferente em cada linha aceita;
//   C) a mensagem entrou UMA vez mas o ENVIO foi duplicado/re-enfileirado
//      -> um msgId só, várias linhas em MessageLog;
//   D) o envio ficou ADIADO pela preservação do destino (horário de
//      funcionamento, intervalo mínimo, burst cap, daily cap)
//      -> linha 'Defer longo' no bot.log e MessageLog com status queued +
//         errorMsg de espera; explica atraso de horas e a saída em rajada
//         espaçada quando a janela abre.
//
// Nada é escrito: só leitura de MessageLog/SendDedupKey/WaConnectionEvent/
// AnalyticsEvent/Group + leitura do bot.log.
//
// Uso (na VPS, DENTRO do diretório do ambiente — o .env define o banco certo):
//   cd ~/wabot-staging && node scripts/diag-mirror-duplicates.mjs <email> --since "2026-07-27 13:30" --until "2026-07-27 21:00"
//   cd ~/wabot         && node scripts/diag-mirror-duplicates.mjs <email> --since "2026-07-27 13:30" --until "2026-07-27 21:00"
//
// Filtros opcionais:
//   --grep "pedaço do texto da mensagem"   (filtra MessageLog por messageText)
//   --dest "1203...@g.us"                  (só um destino)
//   --log /caminho/para/bot.log            (default: BOT_LOG_DIR/bot.log)
import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const args = process.argv.slice(2)
const email = args[0] && !args[0].startsWith('--') ? args[0] : null
function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
if (!email) {
  console.error('uso: node scripts/diag-mirror-duplicates.mjs <email> [--since "YYYY-MM-DD HH:MM"] [--until "..."] [--grep texto] [--dest jid] [--log caminho]')
  process.exit(1)
}

// Datas sem timezone explícito são interpretadas na TZ do processo (a VPS roda
// em UTC por padrão; passe TZ=America/Sao_Paulo se quiser digitar hora local).
const parseWhen = (raw, fallbackMs) => {
  if (!raw) return new Date(fallbackMs)
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) {
    console.error(`data inválida: ${raw}`)
    process.exit(1)
  }
  return d
}
const until = parseWhen(flag('until'), Date.now())
const since = parseWhen(flag('since'), until.getTime() - 12 * 60 * 60_000)
const grep = flag('grep')
const destFilter = flag('dest')

const { default: db } = await import('../src/db.js')
const { getLogsBaseDir } = await import('../src/paths.js')

const line = (t) => console.log(`\n===== ${t} =====`)
const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '-')
const cut = (s, n = 70) => (s == null ? '' : String(s).replace(/\s+/g, ' ').slice(0, n))

const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } })
if (!user) {
  console.error(`usuária não encontrada: ${email}`)
  process.exit(1)
}
const userId = user.id

line('AMBIENTE')
console.log({
  cwd: process.cwd(),
  APP_ENV: process.env.APP_ENV || null,
  DATABASE_URL: process.env.DATABASE_URL || null,
  BOT_SUPERVISOR_MODE: process.env.BOT_SUPERVISOR_MODE || '(inline default)',
  janela: `${fmt(since)} -> ${fmt(until)}`,
  userId,
  // Janelas efetivas de dedup deste ambiente (defaults do bot-worker).
  DEDUP_MSGID_WINDOW_MS: process.env.DEDUP_MSGID_WINDOW_MS || '(default 24h)',
  DEDUP_LINK_WINDOW_MS: process.env.DEDUP_LINK_WINDOW_MS || '(default 120min)',
  COUPON_DEDUP_WINDOW_MS: process.env.COUPON_DEDUP_WINDOW_MS || '(default 5min)',
  PENDING_DEDUP_MAX_AGE_MS: process.env.PENDING_DEDUP_MAX_AGE_MS || '(default 24h)',
})

line('MESSAGELOG NA JANELA')
const logs = await db.messageLog.findMany({
  where: {
    userId,
    sentAt: { gte: since, lte: until },
    ...(destFilter ? { destGroup: destFilter } : {}),
    ...(grep ? { messageText: { contains: grep } } : {}),
  },
  orderBy: { sentAt: 'asc' },
})
console.log(`${logs.length} linha(s)`)
for (const l of logs) {
  console.log([
    fmt(l.sentAt),
    l.status.padEnd(7),
    `dedupHits=${l.dedupHits}`,
    `dest=${cut(l.destGroup, 30)}`,
    `src=${cut(l.sourceGroup, 30)}`,
    `orig=${cut(l.originalUrl, 45)}`,
    `conv=${cut(l.convertedUrl, 45)}`,
    l.errorMsg ? `err=${cut(l.errorMsg, 60)}` : '',
    `id=${l.id}`,
  ].filter(Boolean).join(' | '))
}

line('AGRUPAMENTO (destino + link) — DUPLICATA REAL = mais de 1 success')
const byKey = new Map()
for (const l of logs) {
  const key = `${l.destGroup} :: ${l.convertedUrl || l.originalUrl || cut(l.messageText, 40)}`
  if (!byKey.has(key)) byKey.set(key, [])
  byKey.get(key).push(l)
}
for (const [key, rows] of byKey) {
  const success = rows.filter(r => r.status === 'success')
  if (rows.length < 2 && success.length < 2) continue
  console.log(`\n# ${cut(key, 110)}`)
  console.log(`  linhas=${rows.length} success=${success.length} skipped=${rows.filter(r => r.status === 'skipped').length} queued/sending=${rows.filter(r => ['queued', 'sending'].includes(r.status)).length}`)
  for (const r of rows) console.log(`  - ${fmt(r.sentAt)} ${r.status} ${r.errorMsg ? cut(r.errorMsg, 55) : ''} (${r.id})`)
}

line('MESSAGELOG AINDA PENDENTE (queued/sending) — explica atraso/rajada')
const pending = await db.messageLog.findMany({
  where: { userId, status: { in: ['queued', 'sending'] } },
  orderBy: { sentAt: 'asc' },
  take: 100,
})
console.log(`${pending.length} pendente(s) (qualquer data)`)
for (const p of pending) {
  console.log(`  ${fmt(p.sentAt)} ${p.status} dest=${cut(p.destGroup, 30)} err=${cut(p.errorMsg, 70)} id=${p.id}`)
}

line('PRESERVAÇÃO DOS DESTINOS (horário/throttle/caps) — causa candidata do ATRASO')
const destGroups = await db.group.findMany({
  where: { userId, role: 'post' },
  select: {
    waJid: true, name: true, kind: true,
    operatingHoursEnabled: true, operatingHoursJson: true,
    throttleEnabled: true, minIntervalSec: true, burstCap: true, burstWindowSec: true, dailyCap: true,
    preservationPresetId: true,
    preservationPreset: { select: { name: true, operatingHoursEnabled: true, operatingHoursJson: true, throttleEnabled: true, minIntervalSec: true, burstCap: true, burstWindowSec: true, dailyCap: true } },
  },
})
for (const g of destGroups) {
  console.log({
    jid: g.waJid, nome: g.name, kind: g.kind,
    override: {
      operatingHoursEnabled: g.operatingHoursEnabled, operatingHoursJson: g.operatingHoursJson,
      throttleEnabled: g.throttleEnabled, minIntervalSec: g.minIntervalSec,
      burstCap: g.burstCap, burstWindowSec: g.burstWindowSec, dailyCap: g.dailyCap,
    },
    preset: g.preservationPreset || null,
  })
}
const defaultPreset = await db.preservationPreset.findFirst({ where: { userId, isDefault: true } }).catch(() => null)
console.log({ presetDefaultDaConta: defaultPreset ? { name: defaultPreset.name, operatingHoursEnabled: defaultPreset.operatingHoursEnabled, operatingHoursJson: defaultPreset.operatingHoursJson, minIntervalSec: defaultPreset.minIntervalSec, burstCap: defaultPreset.burstCap, burstWindowSec: defaultPreset.burstWindowSec, dailyCap: defaultPreset.dailyCap } : null })

line('SENDDEDUPKEY VIVOS (reservas que podem estar bloqueando/liberando)')
const reservations = await db.sendDedupKey.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  take: 30,
  select: { dedupKey: true, destGroup: true, createdAt: true, expiresAt: true, messageLogId: true },
})
for (const r of reservations) {
  console.log(`  ${fmt(r.createdAt)} exp=${fmt(r.expiresAt)} dest=${cut(r.destGroup, 28)} log=${r.messageLogId || '-'} key=${cut(r.dedupKey, 60)}`)
}

line('WACONNECTIONEVENT NA JANELA — quedas/reconexões (gatilho de reoferta)')
const conn = await db.waConnectionEvent.findMany({
  where: { userId, occurredAt: { gte: since, lte: until } },
  orderBy: { occurredAt: 'asc' },
  take: 200,
})
console.log(`${conn.length} evento(s)`)
for (const e of conn) console.log(`  ${fmt(e.occurredAt)} ${e.type}${e.code ? `|${e.code}` : ''} ${e.lifecycle || ''} ${cut(e.metadata, 90)}`)

line('ANALYTICSEVENT ops_* NA JANELA')
const ops = await db.analyticsEvent.findMany({
  where: { userId, createdAt: { gte: since, lte: until }, event: { startsWith: 'ops_' } },
  orderBy: { createdAt: 'asc' },
  take: 200,
}).catch(() => [])
for (const e of ops) console.log(`  ${fmt(e.createdAt)} ${e.event} ${cut(e.metadata, 90)}`)

line('BOT.LOG — linha do tempo da mensagem')
const logFile = flag('log') || join(getLogsBaseDir(), 'bot.log')
if (!existsSync(logFile)) {
  console.log(`bot.log não encontrado em ${logFile} (use --log <caminho>)`)
} else {
  // Marcadores que separam as hipóteses A/B/C/D descritas no topo.
  const MARKERS = [
    'Mensagem aceita para processamento',
    'Mensagem duplicada ignorada',
    'Duplicata ignorada',
    'Duplicata DB ignorada',
    'Duplicata reservada DB ignorada',
    'Duplicata global ignorada',
    'Defer longo',
    'Velocity scheduler',
    'Smart delay antes do envio',
    'Mensagem enviada',
    'Mensagem convertida rejeitada pela fila',
    'messages.upsert recebido',
  ]
  const raw = readFileSync(logFile, 'utf8').split('\n')
  let shown = 0
  const msgIdCount = new Map()
  for (const l of raw) {
    if (!l) continue
    if (!MARKERS.some(m => l.includes(m))) continue
    let rec = null
    try { rec = JSON.parse(l) } catch { continue }
    const t = Number(rec.time)
    if (!Number.isFinite(t) || t < since.getTime() || t > until.getTime()) continue
    if (rec.userId && rec.userId !== userId) continue
    if (rec.msg === 'Mensagem aceita para processamento' && rec.msgId) {
      msgIdCount.set(rec.msgId, (msgIdCount.get(rec.msgId) || 0) + 1)
    }
    shown++
    const extra = { ...rec }
    for (const k of ['time', 'level', 'pid', 'hostname', 'msg']) delete extra[k]
    console.log(`  ${fmt(t)} ${rec.msg} ${cut(JSON.stringify(extra), 190)}`)
  }
  console.log(`\n${shown} linha(s) relevantes em ${logFile}`)
  const repeated = [...msgIdCount.entries()].filter(([, n]) => n > 1)
  if (repeated.length) {
    console.log('\n>>> HIPÓTESE A CONFIRMADA: o WhatsApp reofertou o MESMO key.id mais de uma vez:')
    for (const [id, n] of repeated) console.log(`    ${id} aceito ${n}x`)
  } else if (msgIdCount.size) {
    console.log('\n>>> Nenhum key.id repetido na janela: duplicata NÃO veio de reoferta (ver hipóteses B/C/D acima).')
  } else {
    console.log('\n>>> Sem linhas "Mensagem aceita para processamento" na janela — versão do worker anterior ao fix de forense, ou janela errada.')
  }
}

await db.$disconnect()
