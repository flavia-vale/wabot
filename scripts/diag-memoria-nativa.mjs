#!/usr/bin/env node
//
// Diagnóstico da MEMÓRIA NATIVA dos bot-workers — SOMENTE LEITURA.
//
// Responde a pergunta que ficou aberta em 2026-09-16: a sessão custa ~243 MiB e
// só ~14 MiB aparecem em `process.memoryUsage()`. **De que é feito o resto?**
//
// Não reinicia nada, não escreve em lugar nenhum, não lê `.env` nem banco. Lê
// apenas `/proc/<pid>/{smaps,status,cmdline}` dos processos já em execução.
//
// Uso (no VPS):
//   node ~/wabot/scripts/diag-memoria-nativa.mjs                 # todos os workers de produção
//   node ~/wabot/scripts/diag-memoria-nativa.mjs --pid=12345     # um processo só
//   node ~/wabot/scripts/diag-memoria-nativa.mjs --padrao=supervisor
//   node ~/wabot/scripts/diag-memoria-nativa.mjs --top=5 > /tmp/wabot-memoria.txt
//
// COMO LER O RESULTADO (o bloco final já diz isto em uma frase):
//
//   * "arena_glibc" com PSS alto  → fragmentação do alocador. É a hipótese mais
//     barata de testar: `MALLOC_ARENA_MAX` é variável de ambiente, não mexe em
//     nenhuma linha do caminho de sessão. Sinal forte: muitas arenas com pouco
//     PSS cada (memória liberada que nunca voltou ao sistema operacional).
//   * "anonimo" dominando        → heap do V8, buffers e pilhas de thread. Aí o
//     caminho é reduzir trabalho (imagens, log, cache), não trocar alocador.
//   * "biblioteca" alto em RSS e baixo em PSS → normal: as 42 cópias do mesmo
//     `.so` dividem as mesmas páginas. É a razão de RSS não servir para somar.
//   * Threads muito acima de ~12  → alguém abriu pool de threads (libvips do
//     Sharp usa o número de CPUs; o transporte do pino usa uma worker thread,
//     que carrega um isolate inteiro do V8 invisível em `heapUsed`).
//
// Os valores são em MiB. PSS é a métrica honesta para somar processos.

import { readFileSync, readdirSync } from 'fs'
import { summarizeSmaps, GLIBC_ARENA_SIZE_BYTES } from '../src/ops/memory/smapsBreakdown.js'

const MIB = 1024 * 1024
const mib = (bytes) => (bytes / MIB).toFixed(1)

function arg(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const pidArg = arg('pid')
const padrao = arg('padrao', 'bot-worker')
const top = Number(arg('top', '3'))

function readProc(pid, file) {
  try {
    return readFileSync(`/proc/${pid}/${file}`, 'utf8')
  } catch {
    return null
  }
}

function listPids() {
  if (pidArg) return [Number(pidArg)]
  const out = []
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    const cmd = readProc(entry, 'cmdline')
    if (!cmd) continue
    const flat = cmd.replace(/\0/g, ' ')
    if (!flat.includes(padrao)) continue
    // Descarta o próprio diagnóstico e qualquer grep/editor que case com o padrão.
    if (flat.includes('diag-memoria-nativa')) continue
    out.push({ pid: Number(entry), cmd: flat.trim() })
  }
  return out
}

function statusInfo(pid) {
  const text = readProc(pid, 'status')
  if (!text) return {}
  const grab = (key) => {
    const m = new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(text)
    return m ? Number(m[1]) : null
  }
  return {
    threads: grab('Threads'),
    vmRss: (grab('VmRSS') ?? 0) * 1024,
    rssAnon: (grab('RssAnon') ?? 0) * 1024,
    rssFile: (grab('RssFile') ?? 0) * 1024,
  }
}

function etimes(pid) {
  const stat = readProc(pid, 'stat')
  if (!stat) return null
  // campo 22 (starttime) em clock ticks desde o boot; o fechamento do comm pode
  // conter espaços, então cortamos a partir do último ')'.
  const tail = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const startTicks = Number(tail[19])
  if (!Number.isFinite(startTicks)) return null
  let uptime
  try {
    uptime = Number(readFileSync('/proc/uptime', 'utf8').split(' ')[0])
  } catch {
    return null
  }
  if (!Number.isFinite(uptime)) return null
  return Math.max(0, Math.round(uptime - startTicks / 100))
}

const alvos = listPids()
if (!alvos.length) {
  console.log(`Nenhum processo casando com "${padrao}". Use --padrao= ou --pid=.`)
  process.exit(0)
}

const rotuloAlvo = pidArg ? `pid ${pidArg}` : `processo(s) casando com "${padrao}"`
console.log(`\n=== MEMÓRIA NATIVA — ${alvos.length} ${rotuloAlvo} ===\n`)
console.log('Todos os valores em MiB. PSS é o que vale para somar processos.\n')

const linhas = []
const detalhados = []

for (const alvo of alvos) {
  const pid = alvo.pid ?? alvo
  const smaps = readProc(pid, 'smaps')
  if (!smaps) continue
  const resumo = summarizeSmaps(smaps)
  const st = statusInfo(pid)
  const idade = etimes(pid)
  linhas.push({ pid, resumo, st, idade })
}

if (!linhas.length) {
  console.log('Não foi possível ler /proc/<pid>/smaps. Rode como o usuário dono dos processos (deploy) ou com sudo.')
  process.exit(0)
}

console.log('pid      idade   threads   PSS     RSS    arenas  PSS(arenas)  PSS(anon)')
for (const l of linhas.sort((a, b) => b.resumo.totalPss - a.resumo.totalPss)) {
  const anon = l.resumo.byKind.find((k) => k.kind === 'anonimo')?.pss ?? 0
  console.log(
    [
      String(l.pid).padEnd(8),
      (l.idade === null ? '?' : `${Math.round(l.idade / 60)}min`).padEnd(7),
      String(l.st.threads ?? '?').padEnd(9),
      mib(l.resumo.totalPss).padStart(6),
      mib(l.resumo.totalRss).padStart(7),
      String(l.resumo.arenas.count).padStart(7),
      mib(l.resumo.arenas.pss).padStart(12),
      mib(anon).padStart(10),
    ].join(' ')
  )
}

const somaPss = linhas.reduce((a, l) => a + l.resumo.totalPss, 0)
const somaArenas = linhas.reduce((a, l) => a + l.resumo.arenas.pss, 0)
const somaAnon = linhas.reduce((a, l) => a + (l.resumo.byKind.find((k) => k.kind === 'anonimo')?.pss ?? 0), 0)
const somaLibs = linhas.reduce((a, l) => a + (l.resumo.byKind.find((k) => k.kind === 'biblioteca')?.pss ?? 0), 0)
const somaHeap = linhas.reduce((a, l) => a + (l.resumo.byKind.find((k) => k.kind === 'heap_principal')?.pss ?? 0), 0)

console.log(`\n-- Soma dos ${linhas.length} processos: PSS ${mib(somaPss)} MiB`)
console.log(`   arena_glibc ${mib(somaArenas)} | anonimo ${mib(somaAnon)} | heap_principal ${mib(somaHeap)} | biblioteca ${mib(somaLibs)}`)

const maiores = linhas.slice(0, Math.max(1, top))
for (const l of maiores) {
  console.log(`\n-- Detalhe do pid ${l.pid} (PSS ${mib(l.resumo.totalPss)} MiB, ${l.st.threads ?? '?'} threads)`)
  for (const k of l.resumo.byKind) {
    console.log(`   ${k.kind.padEnd(16)} regioes=${String(k.count).padStart(5)}  PSS=${mib(k.pss).padStart(7)}  RSS=${mib(k.rss).padStart(7)}  reservado=${mib(k.size).padStart(8)}`)
  }
  if (l.resumo.arenas.count) {
    const media = l.resumo.arenas.pss / l.resumo.arenas.count
    console.log(
      `   arenas: ${l.resumo.arenas.count} x 64 MiB reservados (${mib(l.resumo.arenas.reserved)} virtuais), ` +
        `PSS medio por arena ${mib(media)} MiB`
    )
  }
  console.log('   bibliotecas mais caras (PSS):')
  for (const lib of l.resumo.topLibs) {
    console.log(`     ${lib.name.padEnd(42)} PSS=${mib(lib.pss).padStart(7)}  RSS=${mib(lib.rss).padStart(7)}`)
  }
}

console.log('\n=== O QUE ISSO DIZ ===\n')
const fracaoArena = somaPss > 0 ? somaArenas / somaPss : 0
const arenasTotais = linhas.reduce((a, l) => a + l.resumo.arenas.count, 0)
const arenaMedia = arenasTotais ? somaArenas / arenasTotais : 0
if (fracaoArena >= 0.15) {
  console.log(
    `As arenas do alocador respondem por ${(fracaoArena * 100).toFixed(0)}% do PSS ` +
      `(${mib(somaArenas)} MiB de ${mib(somaPss)} MiB), com ${arenasTotais} arenas e média de ${mib(arenaMedia)} MiB cada.`
  )
  console.log('Arena com pouco PSS cada é memória já liberada que nunca voltou ao sistema: é fragmentação,')
  console.log('e o próximo teste é MALLOC_ARENA_MAX num único worker (nenhuma linha do caminho de sessão muda).')
} else {
  console.log(
    `As arenas do alocador respondem por apenas ${(fracaoArena * 100).toFixed(0)}% do PSS — ` +
      'trocar a configuração do alocador NÃO vai resolver.'
  )
  console.log('O peso está em "anonimo" (heap do V8, buffers, pilhas de thread): o caminho é reduzir trabalho')
  console.log('(imagem, log, cache), não trocar alocador.')
}
const threadsMax = Math.max(...linhas.map((l) => l.st.threads ?? 0))
if (threadsMax > 12) {
  console.log(
    `\nAtenção: até ${threadsMax} threads num único worker. Cada pool nativo (libvips do Sharp, transporte do pino)`
  )
  console.log('custa pilha + arena próprias e não aparece em heapUsed. Vale conferir sharp.concurrency e o transporte do log.')
}
console.log(`\n(uma arena do glibc reserva ${mib(GLIBC_ARENA_SIZE_BYTES)} MiB virtuais; virtual não é memória gasta)`)
console.log('')
