#!/usr/bin/env node
/**
 * Mede o custo de memória de um processo de shard, degrau por degrau.
 *
 * Responde a ÚNICA pergunta que decide a POC de shard:
 *   - quanto custa o processo VAZIO (custo fixo compartilhado, `F`);
 *   - quanto cada sessão ADICIONA de fato dentro dele (`S`).
 *
 * A economia de um shard com N sessões é `(N-1)*F / (N*D)`, onde `D` é o RSS de
 * um worker dedicado com uma sessão. Ou seja: tudo depende de `F`. Se `F` for
 * pequeno, não existe economia a extrair e a POC deve ser encerrada antes de
 * qualquer troca de posse de credencial.
 *
 * ⚠️ NÃO É READ-ONLY. Subir uma sessão aqui abre o socket WhatsApp de verdade e
 * grava `WaSession` (inclusive `ownerInstance='shard:<id>'`). Leia o cabeçalho
 * "Cuidados" abaixo antes de rodar.
 *
 * Cuidados:
 *  1. NUNCA rodar para uma conta cujo worker dedicado está vivo — seriam dois
 *     sockets na mesma credencial (440/replaced, risco de ban). O script
 *     verifica isso e aborta, mas confira também:
 *       ps -eo pid,cmd | grep bot-worker | grep -v grep
 *  2. Preferir STAGING com números descartáveis. Em produção, mover conta de
 *     cliente é trabalho do painel/supervisor, não deste script.
 *  3. Ao terminar, `ownerInstance` fica marcado como `shard:<id>`. O supervisor
 *     só reverte isso no próprio boot, e o monitor de saúde PULA sessões com
 *     esse owner — ou seja, a conta não volta sozinha. Reverter antes de sair:
 *       sqlite3 prisma/staging.db "UPDATE WaSession SET ownerInstance='0' WHERE ownerInstance LIKE 'shard:%';"
 *
 * Uso:
 *   node scripts/diag-shard-rss.mjs --usuarios=<id1>,<id2>[,<id3>,<id4>] \
 *        [--minutos=30] [--intervalo=10] [--vazio=5] [--saida=<arquivo.csv>]
 *
 * Sem `--usuarios` ele mede SÓ o processo vazio (`F`) — que é a medição de
 * risco zero e já elimina ou justifica a POC sozinha.
 */
import { fork } from 'node:child_process'
import { readFileSync, appendFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const shardWorkerPath = join(__dirname, '..', 'src', 'session-shard-worker.js')

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const [key, ...rest] = item.replace(/^--/, '').split('=')
  return [key, rest.length ? rest.join('=') : 'true']
}))

const users = String(args.usuarios || '').split(',').map(value => value.trim()).filter(Boolean)
const minutosPorDegrau = Math.max(1, Number(args.minutos || 30))
const intervaloSegundos = Math.max(2, Number(args.intervalo || 10))
const minutosVazio = Math.max(1, Number(args.vazio || 5))
const shardId = String(args.shard || 'medicao-1')
const saida = resolve(String(args.saida || `/tmp/shard-rss-${new Date().toISOString().replace(/[:.]/g, '')}.csv`))

const mib = bytes => bytes == null ? null : Math.round((bytes / 1048576) * 10) / 10

/** VmRSS do /proc, em MiB — é o número que o sistema operacional cobra. */
function rssMib(pid) {
  try { return Math.round((Number(readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)?.[1] || 0) / 1024) * 10) / 10 }
  catch { return null }
}

/**
 * PSS divide páginas compartilhadas entre quem as usa. É o número honesto para
 * somar processos — somar RSS conta a mesma página várias vezes.
 */
function pssMib(pid) {
  try { return Math.round((Number(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8').match(/^Pss:\s+(\d+)/m)?.[1] || 0) / 1024) * 10) / 10 }
  catch { return null }
}

/** Recusa subir uma sessão que já tem worker dedicado vivo (dupla posse). */
function dedicatedWorkerPidFor(userId) {
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    let cmdline = ''
    try { cmdline = readFileSync(`/proc/${entry}/cmdline`, 'utf8') } catch { continue }
    if (!cmdline.includes('bot-worker')) continue
    try {
      const env = readFileSync(`/proc/${entry}/environ`, 'utf8')
      if (env.split('\0').includes(`BOT_USER_ID=${userId}`)) return Number(entry)
    } catch { /* processo de outro usuário: não dá para conferir, segue */ }
  }
  return null
}

for (const userId of users) {
  const pid = dedicatedWorkerPidFor(userId)
  if (pid) {
    console.error(`ABORTADO: a conta ${userId} já tem worker dedicado vivo (pid ${pid}).`)
    console.error('Dois sockets na mesma credencial derrubam a sessão e arriscam ban. Pare o dedicado antes.')
    process.exit(1)
  }
}

const child = fork(shardWorkerPath, [], { env: { ...process.env, SHARD_ID: shardId } })
const pending = new Map()
let ready = false
let sequence = 0

child.on('message', message => {
  if (message?.type === 'SHARD_READY') ready = true
  if (message?.type !== 'SHARD_RESULT' || !message.requestId) return
  const waiter = pending.get(message.requestId)
  if (!waiter) return
  pending.delete(message.requestId)
  if (message.error) waiter.reject(new Error(message.error)); else waiter.resolve(message.data)
})
child.on('error', error => { console.error('Processo do shard falhou:', error?.message); process.exit(1) })
child.on('exit', code => { console.error(`Processo do shard saiu (código ${code}).`); process.exit(code || 0) })

const send = (type, userId = null, payload = {}, timeoutMs = 120_000) => new Promise((resolve, reject) => {
  const requestId = `medicao-${Date.now()}-${++sequence}`
  const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timeout ${type}`)) }, timeoutMs)
  pending.set(requestId, {
    resolve: value => { clearTimeout(timer); resolve(value) },
    reject: error => { clearTimeout(timer); reject(error) },
  })
  child.send({ protocolVersion: 1, requestId, shardId, userId, type, payload })
})

const sleep = ms => new Promise(done => setTimeout(done, ms))
async function esperarPronto() {
  const limite = Date.now() + 30_000
  while (Date.now() < limite) { if (ready) return; await sleep(50) }
  throw new Error('Shard não confirmou READY em 30s')
}

const amostras = []
appendFileSync(saida, 'ts,fase,sessoes,rss_mib,pss_mib,heap_usado_mib,heap_total_mib,external_mib,arraybuffers_mib,loop_p95_ms\n')

async function coletar(fase, sessoes, minutos) {
  const fim = Date.now() + minutos * 60_000
  console.log(`\n== ${fase} (${sessoes} sessão/ões) — coletando por ${minutos} min ==`)
  while (Date.now() < fim) {
    let metrics = null
    try { metrics = await send('GET_SHARD_METRICS', null, {}, 15_000) } catch { /* segue com /proc */ }
    const proc = metrics?.process || {}
    const linha = {
      ts: new Date().toISOString(),
      fase,
      sessoes,
      rss: rssMib(child.pid),
      pss: pssMib(child.pid),
      heapUsado: mib(proc.heapUsedBytes),
      heapTotal: mib(proc.heapTotalBytes),
      external: mib(proc.externalBytes),
      arrayBuffers: mib(proc.arrayBuffersBytes),
      loopP95: proc.eventLoopDelayMs?.p95 ?? null,
    }
    amostras.push(linha)
    appendFileSync(saida, `${linha.ts},${fase},${sessoes},${linha.rss},${linha.pss},${linha.heapUsado},${linha.heapTotal},${linha.external},${linha.arrayBuffers},${linha.loopP95}\n`)
    process.stdout.write(`\r  rss ${linha.rss} MiB | pss ${linha.pss} MiB | heap ${linha.heapUsado} MiB | external ${linha.external} MiB   `)
    await sleep(intervaloSegundos * 1000)
  }
  process.stdout.write('\n')
}

const p50 = values => {
  const ordenado = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b)
  if (!ordenado.length) return null
  return ordenado[Math.floor(ordenado.length / 2)]
}
const p50Da = fase => p50(amostras.filter(linha => linha.fase === fase).map(linha => linha.rss))

async function encerrar() {
  try { await send('SHUTDOWN_SHARD', null, {}, 60_000) } catch { /* o exit já vem pelo listener */ }
}
process.once('SIGINT', () => { console.log('\nInterrompido — encerrando o shard.'); void encerrar() })

await esperarPronto()
console.log(`Shard ${shardId} no ar (pid ${child.pid}). CSV: ${saida}`)

await coletar('vazio', 0, minutosVazio)
for (const [indice, userId] of users.entries()) {
  console.log(`\nSubindo sessão ${indice + 1} (${userId})…`)
  await send('START_SESSION', userId, {}, 120_000)
  await sleep(60_000) // deixa o handshake e o sync inicial assentarem antes de medir
  await coletar(`sessoes_${indice + 1}`, indice + 1, minutosPorDegrau)
}

const F = p50Da('vazio')
console.log('\n===== RESULTADO (mediana de RSS por degrau) =====')
console.log(`Custo fixo do processo (F, shard vazio): ${F} MiB`)
let anterior = F
for (const [indice, userId] of users.entries()) {
  const atual = p50Da(`sessoes_${indice + 1}`)
  console.log(`${indice + 1} sessão(ões): ${atual} MiB  |  incremento desta sessão: ${atual != null && anterior != null ? Math.round((atual - anterior) * 10) / 10 : '—'} MiB  (${userId})`)
  anterior = atual
}

const D = Number(args.dedicado || 0)
if (F && D) {
  console.log(`\nProjeção com D=${D} MiB (RSS medido de um worker dedicado):`)
  for (const N of [2, 4, 6, 8]) console.log(`  ${N} sessões por shard → economia estimada ${Math.round(((N - 1) * F) / (N * D) * 1000) / 10}%`)
  console.log('\nRegra de decisão do plano: abaixo de 25% de economia p50 a POC não deve ser aprovada.')
}

await encerrar()
