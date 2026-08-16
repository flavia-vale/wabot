#!/usr/bin/env node
/**
 * Diagnóstico read-only: "não aparece NADA em Envios".
 *
 * A tela de Envios só mostra linhas de `MessageLog`. Uma tela vazia pode vir de
 * QUALQUER elo da cadeia, e cada elo tem correção diferente:
 *
 *   1. worker do usuário não está rodando  -> nada é recebido
 *   2. sessão WhatsApp não está conectada  -> nada é recebido
 *   3. nenhum grupo monitorado / monitorado sem destino -> nada a espelhar
 *   4. canal monitorado + plano sem canais -> o grupo some da config (silencioso)
 *   5. o grupo monitorado simplesmente não publicou nada na janela
 *   6. mensagem chegou mas foi descartada ANTES de virar linha (reentrega/velha,
 *      fora do escopo monitorado, sem link de loja)
 *   7. tem linha no banco mas o painel não mostra (aí o problema é API/tela)
 *
 * Este script olha os 7 elos no ambiente em que for executado e imprime um
 * veredito dizendo em qual deles a cadeia para. Não escreve nada; não imprime
 * credencial, cookie nem token.
 *
 * Uso (na VPS, DENTRO do diretório do ambiente — o .env define o banco certo):
 *   cd ~/wabot-staging && node scripts/diag-envios-vazios.mjs
 *   cd ~/wabot-staging && node scripts/diag-envios-vazios.mjs <email|telefone|nome> --hours=6
 *   cd ~/wabot         && node scripts/diag-envios-vazios.mjs flavia.vale@usp.br
 *
 * Sem identificador, usa a conta com sessão WhatsApp mais recentemente ativa.
 */
import 'dotenv/config'
import { execFileSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const args = process.argv.slice(2)
const who = args.find(a => !a.startsWith('--')) || null
function opt(name, fallback) {
  const hit = args.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const hours = Number(opt('hours', 6)) || 6
const sinceMs = Date.now() - hours * 3600_000
const logPathArg = opt('log', null)

const { default: db } = await import('../src/db.js')
const { getLogsBaseDir, getAuthInfoDir } = await import('../src/paths.js')
const { getPlanEntitlements } = await import('../src/billing/plans.js')

const line = (t) => console.log(`\n===== ${t} =====`)
const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '-')
const ago = (d) => (d ? `${Math.round((Date.now() - new Date(d).getTime()) / 60000)}min atrás` : '-')
const problems = []
const flag = (msg) => { problems.push(msg); console.log(`  ⚠ ${msg}`) }

// ---------------------------------------------------------------- 0. ambiente
line('AMBIENTE')
console.log({
  cwd: process.cwd(),
  APP_ENV: process.env.APP_ENV || null,
  NODE_ENV: process.env.NODE_ENV || null,
  DATABASE_URL: process.env.DATABASE_URL || null,
  BOT_SUPERVISOR_MODE: process.env.BOT_SUPERVISOR_MODE || '(ausente = inline)',
  REDIS_URL: process.env.REDIS_URL || null,
  AUTH_INFO_DIR: process.env.AUTH_INFO_DIR || null,
  BOT_LOG_DIR: process.env.BOT_LOG_DIR || null,
  janela: `últimas ${hours}h (desde ${fmt(sinceMs)})`,
})
const isStaging = String(process.env.APP_ENV || '').toLowerCase() === 'staging'
if (isStaging && String(process.env.BOT_SUPERVISOR_MODE || 'inline').toLowerCase() !== 'inline') {
  flag('staging fora do modo canônico `inline` — em `remote` a api-staging só manda comando pro bot-supervisor-staging; se ele estiver parado/no diretório errado, nada roda (pegadinha #9 do AGENTS.md)')
}

// ------------------------------------------------------------------- 1. conta
line('CONTA')
let user = null
if (who) {
  user = await db.user.findFirst({
    where: {
      OR: [
        { email: who },
        { contactPhone: who },
        { name: { contains: who } },
      ],
    },
    select: { id: true, name: true, email: true, plan: true, status: true, accessExpiresAt: true },
  })
  if (!user) {
    console.error(`  conta não encontrada para "${who}"`)
    process.exit(1)
  }
} else {
  const session = await db.waSession.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { userId: true },
  })
  if (!session) {
    console.error('  nenhuma sessão WhatsApp neste banco — passe o e-mail da conta como argumento')
    process.exit(1)
  }
  user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, plan: true, status: true, accessExpiresAt: true },
  })
  console.log('  (nenhum identificador passado — usando a conta com sessão mais recente)')
}
const userId = user.id
const entitlements = getPlanEntitlements(user)
console.log({
  id: userId,
  nome: user.name,
  email: user.email,
  status: user.status,
  plano: user.plan,
  acessoExpiraEm: fmt(user.accessExpiresAt),
  podeUsarCanais: entitlements.canUseChannels,
})
if (user.status !== 'active') flag(`conta com status "${user.status}" (não "active")`)

// ------------------------------------------------------- 2. processo do worker
line('PROCESSO DO BOT (worker)')
let workerLines = []
try {
  const ps = execFileSync('ps', ['-eo', 'pid,etime,args'], { encoding: 'utf8' })
  workerLines = ps.split('\n').filter(l => l.includes('bot-worker'))
  const mine = workerLines.filter(l => l.includes(userId))
  console.log(`  bot-workers vivos neste host: ${workerLines.length}`)
  for (const l of workerLines.slice(0, 12)) console.log(`    ${l.trim().slice(0, 160)}`)
  if (!mine.length) {
    console.log('  (o userId não aparece na linha de comando — normal: vai por env BOT_USER_ID. Confirme com o AUTH_INFO_DIR abaixo.)')
  }
} catch {
  console.log('  não foi possível rodar `ps` aqui')
}
const authDir = getAuthInfoDir(userId)
console.log({ authDir, existe: existsSync(authDir), credsJson: existsSync(join(authDir, 'creds.json')) })
if (!existsSync(join(authDir, 'creds.json'))) {
  flag('sem creds.json no AUTH_INFO_DIR desta conta — a sessão nunca foi pareada NESTE ambiente (staging e prod têm auth separado)')
}
if (workerLines.length === 0) {
  flag('nenhum processo bot-worker rodando neste host — nada é recebido nem enviado')
}

// ------------------------------------------------------------- 3. sessão do WA
line('SESSÃO WHATSAPP')
const session = await db.waSession.findUnique({ where: { userId } })
if (!session) {
  flag('sem linha em WaSession — a conta nunca conectou neste ambiente')
} else {
  console.log({
    status: session.status,
    lifecycle: session.lifecycle,
    telefone: session.phone,
    ultimoHeartbeat: `${fmt(session.lastHeartbeatAt)} (${ago(session.lastHeartbeatAt)})`,
    ultimoCodigoDeQueda: session.lastDisconnectCode,
  })
  if (session.status !== 'connected') flag(`sessão em "${session.status}" — enquanto não estiver "connected" nada chega do WhatsApp`)
  const hbAge = session.lastHeartbeatAt ? Date.now() - new Date(session.lastHeartbeatAt).getTime() : Infinity
  if (hbAge > 5 * 60_000) flag(`heartbeat parado há ${Math.round(hbAge / 60000)}min — worker provavelmente morto ou travado`)
}
const events = await db.waConnectionEvent.findMany({
  where: { userId, occurredAt: { gte: new Date(sinceMs) } },
  orderBy: { occurredAt: 'desc' },
  take: 10,
  select: { type: true, code: true, lifecycle: true, occurredAt: true },
})
console.log(`  eventos de conexão nas últimas ${hours}h: ${events.length}`)
for (const e of events) console.log(`    ${fmt(e.occurredAt)}  ${e.type}${e.code ? ` code=${e.code}` : ''}${e.lifecycle ? ` (${e.lifecycle})` : ''}`)

// -------------------------------------------------------------- 4. os grupos
line('GRUPOS CONFIGURADOS')
const groups = await db.group.findMany({
  where: { userId },
  select: { id: true, waJid: true, name: true, role: true, kind: true, forwardMode: true, blockedKeywords: true, allowedPlatforms: true },
})
const targets = await db.groupTarget.findMany({
  where: { userId },
  select: { monitorId: true, postId: true },
})
const monitors = groups.filter(g => g.role === 'monitor')
const posts = groups.filter(g => g.role === 'post')
const postById = new Map(posts.map(g => [g.id, g]))
// Mesma normalização do bot-worker (`normalizeJidForMatch`): tira o sufixo de
// device (`:12@`) antes de comparar. Sem isso, um jid com device parece "não
// monitorado" aqui e o diagnóstico apontaria a causa errada.
const normJid = (j) => (typeof j === 'string' ? j.trim().replace(/:\d+(?=@)/, '') : '')
const monitorJids = new Set(monitors.map(g => normJid(g.waJid)))
const nameByJid = new Map(groups.map(g => [normJid(g.waJid), g.name]))
console.log(`  monitorados: ${monitors.length} | destinos: ${posts.length} | pares monitor→destino: ${targets.length}`)
for (const m of monitors) {
  const dests = targets.filter(t => t.monitorId === m.id).map(t => postById.get(t.postId)?.name || t.postId)
  const canalBloqueado = m.kind === 'channel' && !entitlements.canUseChannels
  console.log(`    [monitor] ${m.name} (${m.kind}) ${m.waJid} → ${dests.length ? dests.join(', ') : '(NENHUM DESTINO)'}${canalBloqueado ? '  ⚠ canal bloqueado pelo plano' : ''}`)
  if (!dests.length) flag(`grupo monitorado "${m.name}" não tem nenhum destino ligado — nada sai dele`)
  if (canalBloqueado) flag(`"${m.name}" é canal e o plano atual não libera canais — ele é removido da config do robô em silêncio`)
}
for (const p of posts) {
  const bloqueado = p.kind === 'channel' && !entitlements.canUseChannels
  console.log(`    [destino] ${p.name} (${p.kind}) ${p.waJid}${bloqueado ? '  ⚠ canal bloqueado pelo plano' : ''}`)
}
if (!monitors.length) flag('nenhum grupo monitorado cadastrado nesta conta/ambiente')
if (!posts.length) flag('nenhum grupo de destino cadastrado nesta conta/ambiente')

// ---------------------------------------------------------- 5. o que o banco tem
line('ENVIOS NO BANCO (é isso que a tela mostra)')
const logs = await db.messageLog.findMany({
  where: { userId, sentAt: { gte: new Date(sinceMs) } },
  orderBy: { sentAt: 'desc' },
  select: { sentAt: true, status: true, errorMsg: true, platform: true, sourceGroup: true, destGroup: true, messageText: true },
})
const byStatus = {}
for (const l of logs) byStatus[l.status] = (byStatus[l.status] || 0) + 1
console.log(`  linhas nas últimas ${hours}h: ${logs.length}`, byStatus)
for (const l of logs.slice(0, 15)) {
  console.log(`    ${fmt(l.sentAt)}  ${l.status.padEnd(8)} ${(l.platform || '-').padEnd(14)} ${(l.errorMsg || '').slice(0, 48).padEnd(48)} ${String(l.messageText || '').replace(/\s+/g, ' ').slice(0, 40)}`)
}
const last = await db.messageLog.findFirst({ where: { userId }, orderBy: { sentAt: 'desc' }, select: { sentAt: true, status: true } })
console.log(`  último envio registrado de todos os tempos: ${last ? `${fmt(last.sentAt)} (${ago(last.sentAt)}) status=${last.status}` : 'NENHUM'}`)

// ------------------------------------------------------- 6. o que o socket viu
line('BOT.LOG (mensagens que chegaram do WhatsApp)')
const logFile = logPathArg || join(getLogsBaseDir(), 'bot.log')
const counters = { upsert: 0, aceita: 0, descartada: 0, foraDoEscopo: 0, erroTimeout: 0 }
const amostra = []
const aceitasPorJid = new Map()
const aceitasTs = []
let logDisponivel = true
if (!existsSync(logFile)) {
  logDisponivel = false
  console.log(`  arquivo não encontrado: ${logFile}`)
  flag('bot.log não encontrado — confira BOT_LOG_DIR no .env deste ambiente')
} else {
  const size = statSync(logFile).size
  // Lê só o fim do arquivo (ele passa de 1GB em produção).
  const TAIL = 40 * 1024 * 1024
  const raw = readFileSync(logFile)
  const text = raw.slice(Math.max(0, raw.length - TAIL)).toString('utf8')
  console.log(`  arquivo: ${logFile} (${(size / 1048576).toFixed(1)} MB, lendo os últimos ${Math.min(size, TAIL) / 1048576 | 0} MB)`)
  for (const l of text.split('\n')) {
    if (!l.includes('"time"')) continue
    let t = null
    const m = l.match(/"time":(\d+)/)
    if (m) t = Number(m[1])
    if (t && t < sinceMs) continue
    if (l.includes('messages.upsert recebido')) counters.upsert++
    else if (l.includes('Mensagem aceita para processamento')) {
      counters.aceita++
      const j = l.match(/"jid":"([^"]+)"/)
      if (j) {
        const key = normJid(j[1])
        aceitasPorJid.set(key, (aceitasPorJid.get(key) || 0) + 1)
        if (t) aceitasTs.push({ ts: t, jid: key })
      }
      if (amostra.length < 4) amostra.push(l.slice(0, 200))
    }
    else if (l.includes('Mensagem descartada: reentrega')) counters.descartada++
    else if (l.includes('fora do escopo monitorado')) counters.foraDoEscopo++
    else if (l.includes('Mensagem descartada após erro/timeout')) counters.erroTimeout++
  }
  console.log(`  nas últimas ${hours}h:`, counters)
  console.log('  (o bot.log é compartilhado por TODAS as contas do ambiente — em staging normalmente é só a sua)')
  for (const a of amostra) console.log(`    ${a}`)
}

// Cruzamento decisivo: "Mensagem aceita para processamento" é logada para
// QUALQUER chat que o socket recebe — inclusive conversa que o robô não
// monitora. Se o jid não for de um grupo monitorado, processIncomingMessage
// retorna em silêncio (sem linha em MessageLog), e a tela de Envios fica vazia
// com o robô 100% saudável. Só a comparação abaixo separa esse caso de um bug.
line('DE ONDE VIERAM AS MENSAGENS ACEITAS')
let aceitasMonitoradas = 0
let aceitasForaDoMonitor = 0
if (!aceitasPorJid.size) {
  console.log('  nenhuma mensagem aceita na janela')
} else {
  const ordenado = [...aceitasPorJid.entries()].sort((a, b) => b[1] - a[1])
  for (const [jid, n] of ordenado) {
    const monitorado = monitorJids.has(jid)
    if (monitorado) aceitasMonitoradas += n; else aceitasForaDoMonitor += n
    const nome = nameByJid.get(jid)
    console.log(`    ${String(n).padStart(4)}x  ${jid}  ${monitorado ? '✔ MONITORADO' : '✗ não monitorado por esta conta'}${nome ? ` (${nome})` : ''}`)
  }
  console.log(`  total: ${aceitasMonitoradas} de grupo monitorado | ${aceitasForaDoMonitor} de outros chats`)
  if (aceitasMonitoradas === 0) {
    flag('TODAS as mensagens aceitas vieram de chats que esta conta NÃO monitora — o robô ignora em silêncio e nada aparece em Envios')
  }
}

// Toda reconexão/pareamento dispara uma rajada de mensagens de SISTEMA
// (senderKeyDistribution, protocolMessage, sync) que chegam como 'notify'
// fresquinhas e contam como "aceitas" — mas não têm texto nem link, então
// processIncomingMessage as ignora em silêncio DE PROPÓSITO (comentário em
// bot-worker.js: sem isso um reconnect polui o painel com dezenas de 'nolink').
// Confundir essa rajada com "mensagem real que sumiu" foi o que travou o
// diagnóstico nesta investigação — por isso a checagem virou parte do script.
const RAJADA_MS = 5 * 60_000
const marcosReconexao = events
  .filter(e => ['reconnect_success', 'reconnect_attempt', 'manual_pairing_requested'].includes(e.type))
  .map(e => new Date(e.occurredAt).getTime())
if (aceitasTs.length && marcosReconexao.length) {
  const naRajada = aceitasTs.filter(({ ts }) => marcosReconexao.some(m => ts >= m && ts - m <= RAJADA_MS))
  const pct = Math.round((naRajada.length / aceitasTs.length) * 100)
  const monitoradasNaRajada = naRajada.filter(({ jid }) => monitorJids.has(jid)).length
  console.log(`  ${naRajada.length}/${aceitasTs.length} (${pct}%) chegaram até 5min depois de uma reconexão/pareamento`)
  if (monitoradasNaRajada > 0 && monitoradasNaRajada === aceitasMonitoradas) {
    flag(`as ${aceitasMonitoradas} mensagens do grupo monitorado chegaram TODAS logo após uma reconexão — quase certamente tráfego de sistema do re-pareamento, não mensagem de verdade. Publique uma oferta AGORA no grupo e rode com --hours=1`)
  }
}

// ------------------------------------------------------------------ veredito
line('VEREDITO')
if (!logDisponivel) {
  console.log('  Sem o bot.log não dá pra saber se o robô recebeu mensagem. Ajuste BOT_LOG_DIR')
  console.log('  ou passe --log=/caminho/bot.log e rode de novo.')
  console.log(`  O que dá pra afirmar: ${logs.length} linha(s) de envio no banco na janela de ${hours}h.`)
} else if (counters.upsert === 0 && counters.aceita === 0) {
  console.log('  O robô NÃO RECEBEU nenhuma mensagem do WhatsApp na janela.')
  console.log('  Ou seja: o problema está ANTES do espelhamento (sessão/worker/grupo sem publicação).')
  console.log('  Olhe as seções PROCESSO DO BOT e SESSÃO WHATSAPP acima.')
} else if (counters.aceita === 0) {
  console.log('  Mensagens chegaram no socket mas NENHUMA foi aceita para processamento.')
  console.log('  Suspeitos: reentrega/mensagem velha (descartada) ou chat fora dos grupos monitorados.')
} else if (logs.length === 0 && aceitasMonitoradas === 0) {
  console.log('  O robô recebeu mensagem, mas NENHUMA veio de um grupo que esta conta monitora.')
  console.log('  Não é bug: mensagem de chat não monitorado é ignorada em silêncio, sem linha em Envios.')
  console.log('  Para testar, publique no grupo listado como [monitor] acima — o JID tem que bater.')
} else if (logs.length === 0) {
  console.log(`  ${aceitasMonitoradas} mensagem(ns) de grupo MONITORADO foram aceitas e mesmo assim`)
  console.log('  nenhuma linha foi gravada em Envios.')
  console.log('  Se o aviso de rajada pós-reconexão apareceu acima, provavelmente eram mensagens')
  console.log('  de sistema (não de verdade) — publique uma oferta e rode com --hours=1 pra confirmar.')
  console.log('  Se NÃO apareceu, é problema no pipeline: mensagem sem link de loja reconhecível,')
  console.log('  convite de grupo removido do texto, ou erro antes da gravação.')
} else {
  console.log(`  Existem ${logs.length} linhas no banco na janela. Se a tela está vazia, o problema é da`)
  console.log('  API/tela (login em outro ambiente, filtro de período, erro no /api/logs), não do robô.')
}
if (problems.length) {
  console.log('\n  Pontos marcados com ⚠ nesta rodada:')
  for (const p of problems) console.log(`   - ${p}`)
} else {
  console.log('\n  Nenhum alerta estrutural encontrado.')
}

await db.$disconnect()
