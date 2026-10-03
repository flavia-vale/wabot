#!/usr/bin/env node
/**
 * Conta "conectada" e cega: a mensagem de GRUPO sequer chega ao socket?
 * (RCA 2026-10-03 — docs/rca/whatsapp-sessao.md "Conectada e cega depois do
 * ciclo de quedas: onde a mensagem de grupo some")
 *
 * Para UMA conta: acha o processo do robô (BOT_USER_ID em /proc/<pid>/environ),
 * lê a cauda do bot.log só daquele pid e separa as hipóteses pelo censo de
 * entrada do socket (src/core/inboundNodeCensus.js):
 *   nada_chega     → o WhatsApp não entrega grupo a este aparelho → parear de novo
 *   descartada     → chega e uma regra nossa descarta antes de abrir
 *   nao_abre       → chega e falha ao decifrar (chave de grupo)
 *   filtro_worker  → chega, abre e o worker não aceita
 * Em robô sem o censo (código antigo) responde com o que o log já tinha e avisa.
 *
 * Read-only. Uso (no VPS, dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-cega-pid.mjs <email>
 *   cd ~/wabot && node scripts/diag-cega-pid.mjs <email> --log-mb=200
 *   cd ~/wabot && node scripts/diag-cega-pid.mjs --pid=12345 --log-mb=200   (sem banco)
 */
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { readFileSync, openSync, readSync, fstatSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import { scanPidLog, verdictFromScan } from '../src/core/blindPidLogScan.js'
import { getLogsBaseDir } from '../src/paths.js'

const args = process.argv.slice(2)
const opt = (nome, padrao) => {
  const hit = args.find((a) => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
const email = args.find((a) => !a.startsWith('--'))
const pidArg = Number(opt('pid', 0)) || null
const logMb = Math.max(5, Number(opt('log-mb', 120)) || 120)
const fmt = (ms) => (ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—')
const horas = (ms) => (ms == null ? '—' : `${(ms / 3_600_000).toFixed(1)} h`)

if (!email && !pidArg) {
  console.error('uso: node scripts/diag-cega-pid.mjs <email> [--log-mb=120]  |  --pid=N')
  process.exit(2)
}

function pidsDoRobo(userId) {
  let saida = ''
  try { saida = execFileSync('pgrep', ['-f', 'src/bot-worker'], { encoding: 'utf8' }) } catch { return [] }
  const ehStaging = String(process.env.APP_ENV || '') === 'staging'
  const pids = []
  for (const pid of saida.split('\n').map((s) => s.trim()).filter(Boolean)) {
    let env = ''
    let cmd = ''
    try {
      env = readFileSync(`/proc/${pid}/environ`, 'utf8')
      cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
    } catch { continue }
    if (cmd.includes('-staging') !== ehStaging) continue
    if (!env.split('\0').includes(`BOT_USER_ID=${userId}`)) continue
    let uptimeSeg = null
    try { uptimeSeg = Number(execFileSync('ps', ['-o', 'etimes=', '-p', pid], { encoding: 'utf8' }).trim()) } catch {}
    pids.push({ pid: Number(pid), uptimeSeg })
  }
  return pids
}

function lerCauda(caminho, maxBytes) {
  let fd
  try { fd = openSync(caminho, 'r') } catch { return null }
  try {
    const tamanho = fstatSync(fd).size
    const ler = Math.min(tamanho, maxBytes)
    const buf = Buffer.allocUnsafe(ler)
    readSync(fd, buf, 0, ler, tamanho - ler)
    return { texto: buf.toString('utf8'), tamanho, lido: ler }
  } finally { closeSync(fd) }
}

let conta = null
let sessao = null
let espelho = null
let pids = pidArg ? [{ pid: pidArg, uptimeSeg: null }] : []
if (email) {
  const db = (await import('../src/db.js')).default
  try {
    conta = await db.user.findUnique({ where: { email }, select: { id: true, name: true, plan: true } })
    if (!conta) { console.error(`conta ${email} não encontrada`); process.exit(1) }
    sessao = await db.waSession.findUnique({ where: { userId: conta.id }, select: { status: true, lifecycle: true, lastHeartbeatAt: true, lastDisconnectCode: true } })
    const desde = new Date(Date.now() - 7 * 86400e3)
    const [espelhados, ultimo, quedas24h] = await Promise.all([
      db.messageLog.count({ where: { userId: conta.id, status: 'success', sentAt: { gte: desde }, NOT: { destGroup: 'broadcast' } } }),
      db.messageLog.findFirst({ where: { userId: conta.id, status: 'success', NOT: { destGroup: 'broadcast' } }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
      db.waConnectionEvent.count({ where: { userId: conta.id, type: 'disconnect', code: '500', occurredAt: { gte: new Date(Date.now() - 86400e3) }, metadata: { contains: '"stuckMsg":true' } } }),
    ])
    espelho = { espelhados7d: espelhados, ultimo: ultimo?.sentAt ?? null, quedasStuck24h: quedas24h }
    if (!pidArg) pids = pidsDoRobo(conta.id)
  } finally {
    await db.$disconnect().catch(() => {})
  }
}

console.log(`\n===== CONTA =====`)
if (conta) {
  console.log(`  ${email} | ${conta.name ?? '-'} | plano=${conta.plan} | sessão=${sessao?.status ?? '-'}/${sessao?.lifecycle ?? '-'} | heartbeat=${fmt(sessao?.lastHeartbeatAt && new Date(sessao.lastHeartbeatAt).getTime())}`)
  console.log(`  espelhou 7d=${espelho.espelhados7d} | último espelhamento=${fmt(espelho.ultimo && new Date(espelho.ultimo).getTime())} | quedas 500 com mensagem travada 24h=${espelho.quedasStuck24h}`)
}
if (!pids.length) {
  console.log('\n  Nenhum processo de robô desta conta neste host (modo remote: o supervisor roda noutro nó? ou a sessão está parada).')
  process.exit(0)
}

const logPath = join(getLogsBaseDir(), 'bot.log')
const cauda = lerCauda(logPath, logMb * 1024 * 1024)
if (!cauda) { console.error(`! não consegui ler ${logPath} (use BOT_LOG_DIR)`); process.exit(1) }
console.log(`  bot.log: ${(cauda.tamanho / 1048576).toFixed(0)} MB, lidos os últimos ${(cauda.lido / 1048576).toFixed(0)} MB`)

for (const { pid, uptimeSeg } of pids) {
  const r = scanPidLog(cauda.texto, pid)
  console.log(`\n===== PID ${pid}${uptimeSeg != null ? ` (vivo há ${horas(uptimeSeg * 1000)})` : ''} — ${r.linhas} linha(s), de ${fmt(r.primeiraTs)} a ${fmt(r.ultimaTs)} =====`)
  console.log(`  filtros no boot: ${r.filtros ? JSON.stringify(r.filtros) : '(linha de boot fora da cauda lida)'}`)
  console.log(`  aceitas=${r.aceitas} upserts=${r.upserts} (ao vivo=${r.upsertsNotify}) decrypt-fail=${r.decryptFails} (grupo=${r.decryptFailsGrupo}) retry-receipt=${r.retryReceipts}`)
  console.log(`  DM de outro aparelho: chegou=${r.outroAparelhoChegou} descartada=${r.dmOutroAparelhoDescartada} | escopo descartou (amostras)=${r.escopoDescartes} | freio=${r.freioEmergencia}`)
  if (r.outroAparelhoChegou) console.log(`  destinos das cópias de outro aparelho: ${JSON.stringify(Object.fromEntries(Object.entries(r.outroAparelhoRecipients).sort((a, b) => b[1] - a[1]).slice(0, 3)))} | fila offline encerrada pelo servidor=${r.offlineHandled}x`)
  console.log(`  stream:error=${r.streamErrors} por tipo de ack=${JSON.stringify(r.streamErrorAcks)}`)
  if (r.censoLinhas) {
    console.log(`  CENSO (${r.censoLinhas} resumo(s)): grupo chegou=${r.censoGrupoChegou} descartado=${r.censoGrupoDescartado} falhou=${r.censoGrupoFalhou} abriu=${r.censoGrupoUpsert} | amostras de grupo=${r.amostrasGrupo}`)
    console.log(`  último resumo: ${JSON.stringify(r.censoUltimo)}`)
  } else {
    console.log('  CENSO: nenhum resumo deste pid (robô sem o censo, ou resumo ainda não rodou — intervalo padrão 30 min)')
  }
  if (r.cegueiraSinais) console.log(`  sinal "SEM receber": ${r.cegueiraSinais}x, último=${JSON.stringify(r.cegueiraUltima)}`)
  for (const p of r.offlinePreviews) console.log(`  offline_preview ${fmt(p.time)}: ${p.msg}`)
  for (const f of r.filaOffline) console.log(`  fila offline ${fmt(f.time)}: ${JSON.stringify(f)}`)
  const v = verdictFromScan(r, { conectado: sessao?.status === 'connected', espelhavaAntes: (espelho?.espelhados7d ?? 0) > 0 })
  console.log(`\n  VEREDITO [${v.nivel}]: ${v.texto}`)
  for (const l of v.linhas) console.log(`   - ${l}`)
}
