// Diagnóstico read-only de "hoje nenhum disparo foi feito no meu espelhamento".
//
// Reclamação recorrente. Em vez de investigar caso a caso, este script varre as
// causas mais comuns em ordem (da mais barata/provável para a mais rara) e no
// fim imprime um VEREDITO com as causas que o dado confirmou.
//
// Causas verificadas (cada uma vira ✅ ok / ⚠️ suspeita / ❌ confirmada):
//   1. Conta bloqueada / acesso vencido / status != active
//   2. Sessão WhatsApp desconectada, sem batimento recente ou em loop de queda
//   3. Nenhuma origem (monitor) ou nenhum destino (post) cadastrado
//   4. Origem sem destino escolhido (targetsMode explícito com 0 vínculos)
//   5. Destino pausado pela saúde do canal (ChannelHealth.pausedUntil / red)
//   6. Destino com horário de funcionamento / teto diário / rajada travando
//   7. Nenhuma mensagem chegou das origens (cegueira de recepção / fonte parada)
//   8. Chegou mas foi descartada: MessageLog com skip:* (qual motivo domina)
//   9. Ficou na fila (queued/sending) ou falhou (error/failed)
//  10. Credencial de afiliado ausente (skip:no_valid_conversions)
//
// Nada é escrito. Só leitura de User/WaSession/WaConnectionEvent/Group/
// GroupTarget/ChannelHealth/ChannelThrottle/BotConfig/MessageLog + bot.log.
//
// Uso (na VPS, DENTRO do diretório do ambiente — o .env define o banco certo):
//   cd ~/wabot && node scripts/diag-sem-disparos.mjs <email>
//   cd ~/wabot && node scripts/diag-sem-disparos.mjs <email> --horas 48
//   cd ~/wabot && TZ=America/Sao_Paulo node scripts/diag-sem-disparos.mjs <email> --hoje
//
// Opções:
//   --horas N     janela em horas (default 24)
//   --hoje        janela = desde 00:00 do dia (na TZ do processo)
//   --log CAMINHO bot.log (default: getLogsBaseDir()/bot.log)
import 'dotenv/config'
import { createReadStream, existsSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'

const args = process.argv.slice(2)
const email = args[0] && !args[0].startsWith('--') ? args[0] : null
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
if (!email) {
  console.error('uso: node scripts/diag-sem-disparos.mjs <email> [--horas N | --hoje] [--log caminho]')
  process.exit(1)
}

const now = new Date()
const since = args.includes('--hoje')
  ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
  : new Date(now.getTime() - Number(flag('horas', 24)) * 3_600_000)

const { default: db } = await import('../src/db.js')
const { getLogsBaseDir } = await import('../src/paths.js')

const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '-')
const ago = (d) => {
  if (!d) return 'nunca'
  const min = Math.round((now - new Date(d)) / 60_000)
  return min < 120 ? `${min} min atrás` : `${Math.round(min / 60)} h atrás`
}
const cut = (s, n = 60) => (s == null ? '' : String(s).replace(/\s+/g, ' ').slice(0, n))
const section = (t) => console.log(`\n===== ${t} =====`)
const verdicts = []
const flagIt = (level, text) => {
  verdicts.push({ level, text })
  console.log(`${level === 'ok' ? '✅' : level === 'warn' ? '⚠️ ' : '❌'} ${text}`)
}

const user = await db.user.findUnique({
  where: { email },
  select: { id: true, email: true, status: true, plan: true, accessExpiresAt: true, blockedReason: true, blockedAt: true, lastActivityAt: true },
})
if (!user) {
  console.error(`usuária não encontrada: ${email}`)
  process.exit(1)
}
const userId = user.id

section('AMBIENTE')
console.log({
  cwd: process.cwd(),
  APP_ENV: process.env.APP_ENV || null,
  BOT_SUPERVISOR_MODE: process.env.BOT_SUPERVISOR_MODE || '(inline default)',
  janela: `${fmt(since)} -> ${fmt(now)}`,
  userId,
})

// 1. Conta -------------------------------------------------------------------
section('1. CONTA')
console.log({ status: user.status, plan: user.plan, acessoAte: fmt(user.accessExpiresAt), ultimaAtividade: ago(user.lastActivityAt) })
if (user.status !== 'active') {
  flagIt('bad', `conta com status="${user.status}"${user.blockedReason ? ` (motivo: ${cut(user.blockedReason, 80)})` : ''} — robô não deveria enviar`)
} else if (user.accessExpiresAt && user.accessExpiresAt < now) {
  flagIt('bad', `acesso VENCIDO em ${fmt(user.accessExpiresAt)} (plan=${user.plan}) — sem acesso o robô para`)
} else {
  flagIt('ok', 'conta ativa e dentro da validade')
}

// 2. Sessão WhatsApp ---------------------------------------------------------
section('2. SESSÃO WHATSAPP')
const session = await db.waSession.findUnique({ where: { userId } })
if (!session) {
  flagIt('bad', 'não existe WaSession — a conta nunca conectou um número')
} else {
  console.log({
    status: session.status,
    lifecycle: session.lifecycle,
    phone: session.phone,
    ownerInstance: session.ownerInstance,
    ultimoBatimento: `${fmt(session.lastHeartbeatAt)} (${ago(session.lastHeartbeatAt)})`,
    ultimoCodigoQueda: session.lastDisconnectCode,
    avisoBloqueio: session.blockNotice ? cut(session.blockNotice, 100) : null,
  })
  const stale = !session.lastHeartbeatAt || now - session.lastHeartbeatAt > 10 * 60_000
  if (session.blockNotice) flagIt('bad', `conexão recusada por regra nossa (blockNotice): ${cut(session.blockNotice, 100)}`)
  if (session.status !== 'connected') {
    flagIt('bad', `sessão status="${session.status}" lifecycle="${session.lifecycle}" (último código de queda: ${session.lastDisconnectCode ?? '-'}) — sem conexão não há disparo`)
  } else if (stale) {
    flagIt('bad', `status "connected" mas SEM batimento há ${ago(session.lastHeartbeatAt)} — processo do robô provavelmente morto (conferir pm2 / bot-supervisor)`)
  } else {
    flagIt('ok', 'sessão conectada com batimento recente')
  }
}
const events = await db.waConnectionEvent.findMany({
  where: { userId, occurredAt: { gte: since } },
  orderBy: { occurredAt: 'desc' },
  take: 200,
})
const evCount = new Map()
for (const e of events) {
  const k = `${e.type}${e.code ? `/${e.code}` : ''}`
  evCount.set(k, (evCount.get(k) || 0) + 1)
}
console.log(`eventos de conexão na janela: ${events.length}`)
for (const [k, n] of [...evCount].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(n).padStart(3)}x ${k}`)
console.log('  últimos 5:')
for (const e of events.slice(0, 5)) console.log(`   ${fmt(e.occurredAt)} ${e.type} ${e.code ?? ''} ${e.lifecycle ?? ''}`)
if (events.length >= 15) flagIt('warn', `${events.length} eventos de conexão na janela — sessão instável/reconectando em loop (ver docs/rca/whatsapp-sessao.md)`)

// 3-4. Origens e destinos ----------------------------------------------------
section('3-4. ORIGENS E DESTINOS')
const groups = await db.group.findMany({
  where: { userId },
  include: { monitorTargets: true, channelHealth: true, channelThrottle: true, preservationPreset: true },
})
const monitors = groups.filter((g) => g.role === 'monitor')
const posts = groups.filter((g) => g.role === 'post')
const postById = new Map(posts.map((p) => [p.id, p]))
console.log(`origens (monitor)=${monitors.length} destinos (post)=${posts.length}`)
if (!monitors.length) flagIt('bad', 'NENHUMA origem (monitor) cadastrada — nada para espelhar')
if (!posts.length) flagIt('bad', 'NENHUM destino (post) cadastrado — nada recebe')
for (const m of monitors) {
  const vinculos = m.monitorTargets.filter((t) => postById.has(t.postId))
  const efetivos = m.targetsMode === 'explicit' ? vinculos.length : posts.length
  console.log(`  origem "${cut(m.name, 40)}" kind=${m.kind} rede=${m.deliveryNetwork ?? 'whatsapp'} targetsMode=${m.targetsMode} -> destinos efetivos=${efetivos}`)
  if (m.targetsMode === 'explicit' && vinculos.length === 0) {
    flagIt('bad', `origem "${cut(m.name, 40)}" está em modo explícito com 0 destinos escolhidos — nada sai dela`)
  }
}

// 5-6. Saúde / limites dos destinos -----------------------------------------
section('5-6. DESTINOS: PAUSA, HORÁRIO E TETOS')
const cfg = await db.botConfig.findUnique({ where: { userId } })
for (const p of posts) {
  const h = p.channelHealth
  const t = p.channelThrottle
  const paused = h?.pausedUntil && h.pausedUntil > now
  const horario = p.operatingHoursEnabled ?? p.preservationPreset?.operatingHoursEnabled
  const horarioJson = p.operatingHoursJson ?? p.preservationPreset?.operatingHoursJson
  const dailyCap = p.dailyCap ?? p.preservationPreset?.dailyCap ?? cfg?.channelDailyCap ?? null
  const minInt = p.minIntervalSec ?? p.preservationPreset?.minIntervalSec ?? cfg?.channelMinIntervalSec
  console.log(`  destino "${cut(p.name, 40)}" kind=${p.kind}`)
  console.log(`    saúde=${h?.status ?? '(sem registro)'} falhasSeguidas=${h?.consecutiveFailures ?? 0} pausadoAté=${fmt(h?.pausedUntil)} últimoErro=${cut(h?.lastError, 60)} últimoPost=${ago(h?.lastPostedAt)}`)
  console.log(`    horárioFuncionamento=${horario ? horarioJson : 'desligado'} tetoDiário=${dailyCap ?? '-'} postsHoje=${t?.postsToday ?? 0} intervaloMín=${minInt}s filaMaxMin=${p.queueMaxAgeMin ?? p.preservationPreset?.queueMaxAgeMin ?? '-'}`)
  if (paused) flagIt('bad', `destino "${cut(p.name, 40)}" PAUSADO pela saúde do canal até ${fmt(h.pausedUntil)} (último erro: ${cut(h.lastError, 60)})`)
  else if (h && h.status !== 'green') flagIt('warn', `destino "${cut(p.name, 40)}" com saúde "${h.status}" (${h.consecutiveFailures} falhas seguidas)`)
  if (dailyCap != null && (t?.postsToday ?? 0) >= dailyCap) flagIt('bad', `destino "${cut(p.name, 40)}" bateu o teto diário (${t.postsToday}/${dailyCap})`)
  if (horario) flagIt('warn', `destino "${cut(p.name, 40)}" tem horário de funcionamento ligado — fora dele a oferta é adiada/descartada (${horarioJson})`)
}

// 7-9. Movimento real: MessageLog -------------------------------------------
section('7-9. MESSAGELOG NA JANELA')
const logs = await db.messageLog.findMany({
  where: { userId, sentAt: { gte: since } },
  select: { status: true, errorMsg: true, destGroup: true, sourceGroup: true, sentAt: true, platform: true },
  orderBy: { sentAt: 'desc' },
  take: 5000,
})
const byStatus = new Map()
for (const l of logs) byStatus.set(l.status, (byStatus.get(l.status) || 0) + 1)
console.log(`linhas: ${logs.length}`, Object.fromEntries(byStatus))
const lastSuccess = await db.messageLog.findFirst({ where: { userId, status: 'success' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } })
console.log(`último success (qualquer data): ${fmt(lastSuccess?.sentAt)} (${ago(lastSuccess?.sentAt)})`)

const success = byStatus.get('success') || 0
const motivos = new Map()
for (const l of logs.filter((x) => x.status !== 'success')) {
  const k = `${l.status}:${cut(l.errorMsg, 50) || '(sem motivo)'}`
  motivos.set(k, (motivos.get(k) || 0) + 1)
}
console.log('motivos das linhas que NÃO são success (top 10):')
for (const [k, n] of [...motivos].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(4)}x ${k}`)

const pending = await db.messageLog.count({ where: { userId, status: { in: ['queued', 'sending'] } } })
const oldPending = await db.messageLog.findFirst({ where: { userId, status: { in: ['queued', 'sending'] } }, orderBy: { sentAt: 'asc' }, select: { sentAt: true, errorMsg: true } })
console.log(`pendentes (queued/sending): ${pending}${oldPending ? ` — mais antigo ${fmt(oldPending.sentAt)} err=${cut(oldPending.errorMsg, 60)}` : ''}`)

if (success > 0) {
  flagIt('ok', `${success} envio(s) com sucesso na janela — o robô ENVIOU (conferir se a cliente olhou o destino certo)`)
} else if (logs.length === 0) {
  flagIt('bad', 'ZERO linhas no MessageLog na janela — nenhuma mensagem chegou a ser processada (ver cegueira de recepção abaixo)')
} else {
  flagIt('bad', `${logs.length} linha(s) no MessageLog mas NENHUM success — veja o motivo dominante acima`)
}
const dominante = [...motivos].sort((a, b) => b[1] - a[1])[0]
if (dominante && success === 0) flagIt('warn', `motivo dominante: ${dominante[0]} (${dominante[1]}x)`)
if (pending > 0 && oldPending && now - oldPending.sentAt > 30 * 60_000) flagIt('bad', `fila PARADA: ${pending} pendente(s), a mais antiga há ${ago(oldPending.sentAt)} (rodar diag-fila-parada.mjs)`)
const semConv = [...motivos].filter(([k]) => k.includes('no_valid_conversions')).reduce((a, [, n]) => a + n, 0)
if (semConv > 0) flagIt('bad', `${semConv} oferta(s) descartada(s) por falta de conta/credencial de afiliado (skip:no_valid_conversions) — rodar diag-sem-etiqueta.mjs ${email}`)
const manyOf = (needle) => [...motivos].filter(([k]) => k.includes(needle)).reduce((a, [, n]) => a + n, 0)
for (const [needle, msg] of [
  ['outside_send_window', 'fora do horário de funcionamento do destino'],
  ['queue_expired', 'fila expirou (oferta velha demais descartada)'],
  ['blocked_keyword', 'palavra bloqueada pela cliente'],
  ['dedup', 'considerada repetida (dedup)'],
  ['dest_unlinked', 'destino desvinculado da origem'],
  ['source_unlinked', 'origem desvinculada'],
  ['decrypt_failed', 'falha ao decifrar a mensagem (sessão cega — ver whatsapp-sessao.md)'],
  ['policy', 'barrada por política de envio/plano'],
]) {
  const n = manyOf(needle)
  if (n > 0 && success === 0) flagIt('warn', `${n}x skip por: ${msg}`)
}

// 7. bot.log: a mensagem sequer chegou? -------------------------------------
section('7. BOT.LOG — MENSAGENS RECEBIDAS DAS ORIGENS')
const logFile = flag('log') || join(getLogsBaseDir(), 'bot.log')
if (!existsSync(logFile)) {
  console.log(`bot.log não encontrado em ${logFile} (use --log <caminho>)`)
} else {
  const jids = new Map(monitors.map((m) => [m.waJid, m.name]))
  const aceitas = new Map([...jids.keys()].map((j) => [j, 0]))
  const ultima = new Map()
  let retryReceipt = 0
  let decryptFail = 0
  const sinceMs = since.getTime()
  const rl = createInterface({ input: createReadStream(logFile, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const ln of rl) {
    if (ln.includes('Mensagem aceita para processamento')) {
      for (const j of jids.keys()) {
        if (ln.includes(j)) {
          const ts = Number((ln.match(/"time":(\d{13})/) || [])[1] || 0)
          if (ts && ts < sinceMs) continue
          aceitas.set(j, aceitas.get(j) + 1)
          if (ts) ultima.set(j, ts)
        }
      }
    } else if (ln.includes(userId)) {
      if (ln.includes('retry-receipt')) retryReceipt++
      if (/decrypt|Bad MAC|No session/i.test(ln)) decryptFail++
    }
  }
  let total = 0
  for (const [j, n] of aceitas) {
    total += n
    console.log(`  origem "${cut(jids.get(j), 40)}" (${j}): ${n} msg aceita(s) na janela${ultima.get(j) ? `, última ${fmt(ultima.get(j))}` : ''}`)
  }
  console.log(`  linhas desta conta com retry-receipt=${retryReceipt} decrypt/Bad MAC=${decryptFail}`)
  if (monitors.length && total === 0) {
    flagIt('bad', 'bot.log: NENHUMA mensagem aceita das origens na janela — a fonte ficou parada OU a sessão está cega (conectada sem receber). Pergunte se a origem postou hoje; senão rodar diag-frota-cega.mjs')
  } else if (total > 0 && success === 0) {
    flagIt('warn', `bot.log: ${total} msg aceita(s) mas nenhum success — o filtro está no pipeline (veja motivos da seção 7-9)`)
  }
  if (decryptFail >= 5) flagIt('warn', `${decryptFail} linha(s) de decrypt/Bad MAC nesta conta — sessão com chaves ruins (docs/rca/whatsapp-sessao.md)`)
}

// Veredito -------------------------------------------------------------------
section('VEREDITO (causas por ordem de gravidade)')
const bad = verdicts.filter((v) => v.level === 'bad')
const warn = verdicts.filter((v) => v.level === 'warn')
if (!bad.length && !warn.length) {
  console.log('Nenhuma causa comum encontrada — o robô parece saudável. Conferir se há envios (success) e se a cliente olhou o destino certo.')
}
for (const v of bad) console.log(`❌ ${v.text}`)
for (const v of warn) console.log(`⚠️  ${v.text}`)
console.log('\nPróximos passos conforme a causa: sessão → diag-nao-conecta.mjs / diag-frota-cega.mjs; fila → diag-fila-parada.mjs / diag-fila-grupo.mjs; descarte → diag-oferta-descartada.mjs; credencial → diag-sem-etiqueta.mjs.')

await db.$disconnect?.()
