#!/usr/bin/env node
/**
 * Varre TODA a frota e responde: "alguma cliente está conectada e CEGA?"
 *
 * Nasceu do RCA 2026-09-14 (viviloppes@gmail.com), que levou uma tarde de
 * investigação para uma conta só: o robô dela ficou DOIS DIAS sem receber
 * absolutamente nada — espelhamento de 1.099 envios/dia para zero — com o
 * painel dizendo "conectado" e nenhum alarme disparando. Ver a seção "Cega e
 * caindo" no AGENTS.md para o porquê de nenhuma rede de segurança ter visto.
 *
 * Este script responde a MESMA pergunta para as 38 contas de uma vez, e roda
 * com o que existe HOJE no VPS (não depende do conserto estar no ar):
 *
 *   1. mapeia cada processo de robô → conta (BOT_USER_ID em /proc/<pid>/environ)
 *   2. conta as linhas "mensagem recebida" DAQUELE processo no bot.log
 *      (o log é compartilhado por todas as contas; o pid é o que separa)
 *   3. cruza com o banco: a conta espelhava antes? quantas quedas em 24h?
 *
 * O cruzamento é o que evita alarme falso: conta que nunca espelhou e conta de
 * madrugada parecem iguais olhando só o log. "Cega" aqui exige as duas coisas —
 * **espelhava antes** e **não recebe nada agora**.
 *
 * Read-only: não grava nada, não envia nada, não imprime segredo.
 *
 * Uso (no VPS, DENTRO do diretório do ambiente — o .env define o banco certo):
 *   cd ~/wabot && node scripts/diag-frota-cega.mjs
 *   cd ~/wabot && node scripts/diag-frota-cega.mjs --dias=7 --log-mb=80
 */
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { readFileSync, openSync, readSync, fstatSync, closeSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (nome, padrao) => {
  const hit = args.find((a) => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
const dias = Math.max(1, Number(opt('dias', 7)) || 7)
// Quanto do fim do bot.log ler. O arquivo passa de 60MB e é compartilhado por
// toda a frota; o que importa é a janela recente, não o histórico.
const logMb = Math.max(5, Number(opt('log-mb', 60)) || 60)
// Um robô recém-nascido legitimamente ainda não recebeu nada.
const minUptimeMin = Math.max(1, Number(opt('min-uptime-min', 30)) || 30)

const db = (await import('../src/db.js')).default

const linha = (t) => console.log(`\n===== ${t} =====`)
const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) + 'Z' : '—')

// ---------------------------------------------------------------- processos
function robosVivos() {
  let saida = ''
  try {
    saida = execFileSync('pgrep', ['-f', 'src/bot-worker'], { encoding: 'utf8' })
  } catch {
    return []
  }
  const ehStaging = String(process.env.APP_ENV || '') === 'staging'
  const robos = []
  for (const pid of saida.split('\n').map((s) => s.trim()).filter(Boolean)) {
    let env = ''
    let cmd = ''
    try {
      env = readFileSync(`/proc/${pid}/environ`, 'utf8')
      cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
    } catch {
      continue // morreu entre o pgrep e a leitura
    }
    // O mesmo host roda prod e staging; o caminho do script separa os dois.
    const doStaging = cmd.includes('-staging')
    if (doStaging !== ehStaging) continue
    const userId = (env.split('\0').find((l) => l.startsWith('BOT_USER_ID=')) || '').slice(12)
    if (!userId) continue
    let uptimeSeg = null
    try {
      uptimeSeg = Number(execFileSync('ps', ['-o', 'etimes=', '-p', pid], { encoding: 'utf8' }).trim())
    } catch { /* segue sem uptime */ }
    robos.push({ pid: Number(pid), userId, uptimeSeg: Number.isFinite(uptimeSeg) ? uptimeSeg : null })
  }
  return robos
}

// ------------------------------------------------------------------ bot.log
// Conta, por pid, quantas mensagens o worker ACEITOU e quantas ele descartou.
// Lê só o fim do arquivo: o começo é histórico e não muda o veredito.
function lerCaudaDoLog(caminho, maxBytes) {
  let fd
  try {
    fd = openSync(caminho, 'r')
  } catch {
    return null
  }
  try {
    const tamanho = fstatSync(fd).size
    const ler = Math.min(tamanho, maxBytes)
    const buf = Buffer.allocUnsafe(ler)
    readSync(fd, buf, 0, ler, tamanho - ler)
    return { texto: buf.toString('utf8'), tamanho, lido: ler }
  } finally {
    closeSync(fd)
  }
}

function contarPorPid(texto) {
  const porPid = new Map()
  const marca = (pid, campo) => {
    if (!porPid.has(pid)) porPid.set(pid, { aceitas: 0, descartadas: 0 })
    porPid.get(pid)[campo] += 1
  }
  // Varredura por linha: o log é JSON por linha (pino).
  for (const l of texto.split('\n')) {
    if (l.length < 20) continue
    const mPid = l.match(/"pid":(\d+)/)
    if (!mPid) continue
    const pid = Number(mPid[1])
    if (l.includes('"msg":"mensagem recebida"')) marca(pid, 'aceitas')
    else if (l.includes('"msg":"Mensagem descartada')) marca(pid, 'descartadas')
  }
  return porPid
}

// -------------------------------------------------------------------- banco
async function fotoDoBanco(userIds, desde) {
  const vazio = { users: new Map(), sessoes: new Map(), espelhos: new Map(), quedas: new Map() }
  if (!userIds.length) return vazio
  const [users, sessoes, envios, quedas] = await Promise.all([
    db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, status: true, plan: true, accessExpiresAt: true },
    }).catch((e) => { console.error('  ! falha ao ler contas:', e.message); return [] }),
    db.waSession.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, status: true, lifecycle: true, lastHeartbeatAt: true, lastDisconnectCode: true },
    }).catch((e) => { console.error('  ! falha ao ler sessões:', e.message); return [] }),
    // Espelhamento = envio com destino de GRUPO. A fila/garimpo grava
    // destGroup='broadcast' e continua saindo mesmo com a recepção morta —
    // contá-la junto esconderia exatamente o caso que procuramos.
    db.messageLog.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, sentAt: { gte: desde }, status: 'success', destGroup: { not: 'broadcast' } },
      _count: { _all: true },
      _max: { sentAt: true },
    }).catch((e) => { console.error('  ! falha ao ler envios:', e.message); return [] }),
    db.waConnectionEvent.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        type: { in: ['disconnect', 'disconnect_terminal'] },
        occurredAt: { gte: new Date(Date.now() - 24 * 3600e3) },
      },
      _count: { _all: true },
    }).catch((e) => { console.error('  ! falha ao ler quedas:', e.message); return [] }),
  ])
  return {
    users: new Map(users.map((u) => [u.id, u])),
    sessoes: new Map(sessoes.map((s) => [s.userId, s])),
    espelhos: new Map(envios.map((e) => [e.userId, { total: e._count._all, ultimo: e._max.sentAt }])),
    quedas: new Map(quedas.map((q) => [q.userId, q._count._all])),
  }
}

// ------------------------------------------------------------------ veredito
// Fail-safe igual ao do produto: sem evidência dos DOIS lados (espelhava antes
// E não recebe agora), não acusa. Silêncio sozinho continua sendo silêncio.
function avaliar({ sessao, aceitas, espelho, uptimeSeg }) {
  const conectada = sessao?.status === 'connected'
  const novinha = uptimeSeg != null && uptimeSeg < minUptimeMin * 60
  const jaEspelhou = (espelho?.total ?? 0) > 0

  if (!conectada) return { nivel: 'ok', texto: 'não está conectada (o status normal já cobre)' }
  if (novinha) return { nivel: 'ok', texto: `robô subiu faz pouco (${Math.round(uptimeSeg / 60)}min)` }
  if (aceitas > 0) return { nivel: 'ok', texto: `recebendo (${aceitas} mensagens na janela do log)` }
  if (!jaEspelhou) return { nivel: 'atencao', texto: `sem receber, mas também não espelhava em ${dias} dias — pode ser conta parada` }
  return { nivel: 'cega', texto: `CEGA: espelhou ${espelho.total}x em ${dias} dias e NÃO recebe nada agora` }
}

// ---------------------------------------------------------------------- run
linha('AMBIENTE')
const logDir = process.env.BOT_LOG_DIR || '/home/deploy/BOTinho-shared/logs'
const logPath = join(logDir, 'bot.log')
console.log({ cwd: process.cwd(), APP_ENV: process.env.APP_ENV, logPath, janelaDias: dias })

const robos = robosVivos()
if (!robos.length) {
  console.log('\nNenhum robô deste ambiente está rodando neste host. Nada a avaliar.')
  process.exit(0)
}

const cauda = lerCaudaDoLog(logPath, logMb * 1024 * 1024)
if (!cauda) {
  console.error(`\n! Não consegui ler ${logPath}. Sem o log não dá para saber quem está recebendo — abortando em vez de dar veredito errado.`)
  process.exit(1)
}
const porPid = contarPorPid(cauda.texto)
console.log(`  bot.log: ${(cauda.tamanho / 1048576).toFixed(1)} MB no disco, últimos ${(cauda.lido / 1048576).toFixed(0)} MB lidos`)
console.log(`  robôs deste ambiente: ${robos.length}`)

const desde = new Date(Date.now() - dias * 86400e3)
const { users, sessoes, espelhos, quedas } = await fotoDoBanco(robos.map((r) => r.userId), desde)

const avaliados = robos.map((r) => {
  const contagem = porPid.get(r.pid) || { aceitas: 0, descartadas: 0 }
  const sessao = sessoes.get(r.userId)
  const espelho = espelhos.get(r.userId)
  const veredito = avaliar({ sessao, aceitas: contagem.aceitas, espelho, uptimeSeg: r.uptimeSeg })
  return {
    ...r,
    user: users.get(r.userId),
    sessao,
    espelho,
    quedas24h: quedas.get(r.userId) ?? 0,
    aceitas: contagem.aceitas,
    descartadas: contagem.descartadas,
    veredito,
  }
})

const ordem = { cega: 0, atencao: 1, ok: 2 }
avaliados.sort((a, b) => ordem[a.veredito.nivel] - ordem[b.veredito.nivel] || a.aceitas - b.aceitas)

linha('FROTA (pior primeiro)')
for (const a of avaliados) {
  const icone = a.veredito.nivel === 'cega' ? '🔴' : a.veredito.nivel === 'atencao' ? '🟡' : '  '
  const quem = a.user ? `${a.user.email}` : `(conta ${a.userId} não encontrada no banco)`
  console.log(
    `${icone} ${quem.padEnd(38)} recebidas=${String(a.aceitas).padStart(5)} ` +
    `descartadas=${String(a.descartadas).padStart(4)} quedas24h=${String(a.quedas24h).padStart(3)} ` +
    `espelhou${dias}d=${String(a.espelho?.total ?? 0).padStart(5)} ultimo=${fmt(a.espelho?.ultimo)} ` +
    `| ${a.veredito.texto}`
  )
}

const cegas = avaliados.filter((a) => a.veredito.nivel === 'cega')
const atencao = avaliados.filter((a) => a.veredito.nivel === 'atencao')

linha('VEREDITO')
console.log(`  ${cegas.length} conta(s) CEGA(S) | ${atencao.length} em atenção | ${avaliados.length - cegas.length - atencao.length} recebendo normalmente`)
if (cegas.length) {
  console.log('\n  Conectadas, o painel diz que está tudo bem, e NADA chega ao robô:')
  for (const c of cegas) {
    console.log(`   - ${c.user?.email ?? c.userId} (${c.user?.name ?? '?'}) | plano ${c.user?.plan ?? '?'} | ${c.quedas24h} quedas em 24h`)
    console.log(`     investigar: node scripts/diag-envios-vazios.mjs ${c.user?.email ?? c.userId} --hours=48`)
  }
} else {
  console.log('\n  Nenhuma conta no quadro da Viviane (conectada, espelhava antes e parou de receber).')
}
if (atencao.length) {
  console.log('\n  Em atenção (não recebem nada, mas também não espelhavam — provavelmente conta parada, confirme antes de agir):')
  for (const a of atencao) console.log(`   - ${a.user?.email ?? a.userId} | plano ${a.user?.plan ?? '?'} | acesso até ${fmt(a.user?.accessExpiresAt)}`)
}

console.log('\n  Lembre: "recebidas" conta só a janela do log lida acima. Robô com uptime alto e ZERO recebidas é o sinal forte.')
process.exit(0)
