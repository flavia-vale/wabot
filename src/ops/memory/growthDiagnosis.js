// Diagnóstico do CRESCIMENTO de memória dos robôs com a idade — módulo PURO.
//
// Por que existe (rodada 3 de RAM, 2026-09-19): depois das duas janelas de
// economia, a frota ficou em 92,8 MiB/robô com 2,5 h de vida e 122,6 MiB/robô
// com 11,6 h. Ninguém sabia se isso estabiliza, se é cache que o GC ainda não
// coletou ou se é vazamento lento — e as três hipóteses pedem ações opostas.
//
// O que separa as hipóteses NÃO é o total: é EM QUAL BALDE a memória cresce.
//
//   - cresce em `[heap]`/arena do glibc com o heap do V8 parado
//       → RETENÇÃO DO ALOCADOR: memória que o programa já liberou e o glibc
//         guarda (fragmentação). Não é vazamento; a alavanca é o alocador
//         (jemalloc / limiares do glibc), não o código.
//   - cresce em `heapUsed` do V8, e continua subindo
//       → VAZAMENTO EM JAVASCRIPT: alguma estrutura guarda referência para
//         sempre (Map sem poda, closure retida). A alavanca é achar a estrutura
//         (heap snapshot em staging), nunca o alocador.
//   - cresce em `arrayBuffers` (Buffers de imagem/HTML vivos)
//       → BUFFERS PRESOS NA FILA: jobs de envio adiados guardam a foto da
//         mensagem até saírem (buildPayload é lazy de propósito). Sobe e desce
//         com a fila; a alavanca é soltar o buffer quando o último destino sai.
//
// Tudo aqui recebe números e devolve números/frases. Sem /proc, sem IPC, sem
// banco — quem lê o sistema é `scripts/diag-memoria-crescimento.mjs`.

const MIB = 1024 * 1024
const HORA_MS = 3_600_000

export const GROWTH_VERDICTS = Object.freeze({
  SEM_DADO: 'sem_dado',
  ESTAVEL: 'estavel',
  RETENCAO_ALOCADOR: 'retencao_alocador',
  VAZAMENTO_JS: 'vazamento_js',
  BUFFERS_EM_FILA: 'buffers_em_fila',
  MISTO: 'misto',
})

const toMiB = (bytes) => (bytes === null || bytes === undefined || !Number.isFinite(bytes) ? null : Math.round((bytes / MIB) * 10) / 10)

/**
 * Junta as três fontes de um robô numa foto só, em MiB.
 *
 * @param {object} p
 * @param {object|null} p.smaps   retorno de `summarizeSmaps` (bytes)
 * @param {object|null} p.status  `{ rssAnon, rssFile, threads }` de /proc/<pid>/status (bytes)
 * @param {object|null} p.runtime `getRuntimeMemoryMetrics()` do worker (bytes) — só com IPC
 */
export function splitRobotMemory({ smaps = null, status = null, runtime = null } = {}) {
  const kind = (k) => smaps?.byKind?.find((b) => b.kind === k)?.pss ?? 0
  const pss = smaps ? smaps.totalPss : null
  // "glibc" = arena principal ([heap], brk) + arenas secundárias. É o balde da
  // retenção do alocador; com MALLOC_ARENA_MAX=2 quase tudo cai em [heap].
  const glibc = smaps ? kind('heap_principal') + (smaps.arenas?.pss ?? 0) : null
  const anon = smaps ? kind('anonimo') : null
  const rssAnon = status?.rssAnon ?? null
  const v8HeapUsed = runtime?.heapUsedBytes ?? null
  const v8HeapTotal = runtime?.heapTotalBytes ?? null
  const external = runtime?.externalBytes ?? null
  const arrayBuffers = runtime?.arrayBuffersBytes ?? null
  // O que a API do Node NÃO enxerga: RSS anônimo menos o que o V8 declara.
  const foraDoV8 = rssAnon !== null && v8HeapTotal !== null && external !== null ? Math.max(0, rssAnon - v8HeapTotal - external) : null
  return {
    pssMiB: toMiB(pss),
    glibcMiB: toMiB(glibc),
    anonMiB: toMiB(anon),
    arenas: smaps?.arenas?.count ?? null,
    threads: status?.threads ?? null,
    rssAnonMiB: toMiB(rssAnon),
    v8HeapUsedMiB: toMiB(v8HeapUsed),
    v8HeapTotalMiB: toMiB(v8HeapTotal),
    externalMiB: toMiB(external),
    arrayBuffersMiB: toMiB(arrayBuffers),
    foraDoV8MiB: toMiB(foraDoV8),
  }
}

// Inclinação (MiB por hora) por mínimos quadrados. Ignora pontos sem valor.
export function slopePerHour(samples, key) {
  const pts = samples.filter((s) => Number.isFinite(s?.[key]) && Number.isFinite(s?.atMs))
  if (pts.length < 2) return null
  const t0 = pts[0].atMs
  const xs = pts.map((p) => (p.atMs - t0) / HORA_MS)
  const ys = pts.map((p) => p[key])
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  return Math.round((num / den) * 100) / 100
}

/**
 * Classifica uma série de fotos do MESMO robô (ou da frota, por robô médio).
 *
 * @param {Array<{atMs:number, pssMiB?:number, glibcMiB?:number, v8HeapUsedMiB?:number, arrayBuffersMiB?:number}>} samples
 * @param {object} [opts]
 * @param {number} [opts.minSamples=3]
 * @param {number} [opts.minSpanMs=2h]     menos que isso é ruído de tráfego, não tendência
 * @param {number} [opts.flatMiBPerHour=1] abaixo disto o total é "estável"
 */
export function classifyGrowth(samples, { minSamples = 3, minSpanMs = 2 * HORA_MS, flatMiBPerHour = 1 } = {}) {
  const ordered = [...(samples ?? [])].filter((s) => Number.isFinite(s?.atMs)).sort((a, b) => a.atMs - b.atMs)
  const n = ordered.length
  const spanMs = n ? ordered[n - 1].atMs - ordered[0].atMs : 0
  const spanHours = Math.round((spanMs / HORA_MS) * 10) / 10
  const slopes = {
    pss: slopePerHour(ordered, 'pssMiB'),
    glibc: slopePerHour(ordered, 'glibcMiB'),
    v8HeapUsed: slopePerHour(ordered, 'v8HeapUsedMiB'),
    arrayBuffers: slopePerHour(ordered, 'arrayBuffersMiB'),
  }
  const base = { n, spanHours, slopes }

  if (n < minSamples || spanMs < minSpanMs) {
    return { ...base, verdict: GROWTH_VERDICTS.SEM_DADO, reason: n < minSamples ? `só ${n} medida(s); precisa de ${minSamples}` : `janela de ${spanHours} h; precisa de ${Math.round(minSpanMs / HORA_MS)} h` }
  }
  if (slopes.pss === null) return { ...base, verdict: GROWTH_VERDICTS.SEM_DADO, reason: 'sem PSS nas medidas' }
  if (slopes.pss < flatMiBPerHour) return { ...base, verdict: GROWTH_VERDICTS.ESTAVEL, reason: `PSS sobe ${slopes.pss} MiB/h (abaixo de ${flatMiBPerHour})` }

  const metade = slopes.pss / 2
  const v8Sobe = slopes.v8HeapUsed !== null && slopes.v8HeapUsed >= metade
  const bufSobe = slopes.arrayBuffers !== null && slopes.arrayBuffers >= metade
  const glibcSobe = slopes.glibc !== null && slopes.glibc >= metade

  // Ordem de propósito: vazamento em JS é o pior desfecho e o que mais custa
  // achar depois — se o heap do V8 explica metade do crescimento, é ele.
  if (v8Sobe) return { ...base, verdict: GROWTH_VERDICTS.VAZAMENTO_JS, reason: `heapUsed do V8 sobe ${slopes.v8HeapUsed} MiB/h de ${slopes.pss} do PSS` }
  if (bufSobe) return { ...base, verdict: GROWTH_VERDICTS.BUFFERS_EM_FILA, reason: `arrayBuffers sobem ${slopes.arrayBuffers} MiB/h de ${slopes.pss} do PSS` }
  if (glibcSobe) return { ...base, verdict: GROWTH_VERDICTS.RETENCAO_ALOCADOR, reason: `[heap]+arenas do glibc sobem ${slopes.glibc} MiB/h de ${slopes.pss} do PSS` }
  return { ...base, verdict: GROWTH_VERDICTS.MISTO, reason: 'nenhum balde explica metade do crescimento sozinho' }
}

export function describeGrowthVerdict(verdict) {
  switch (verdict) {
    case GROWTH_VERDICTS.SEM_DADO:
      return 'Ainda não dá para dizer: poucas medidas ou janela curta demais. Continue medindo (1x por hora) antes de concluir qualquer coisa.'
    case GROWTH_VERDICTS.ESTAVEL:
      return 'Estabilizou: o total não sobe de forma sustentada. O que se vê é tráfego, não crescimento.'
    case GROWTH_VERDICTS.RETENCAO_ALOCADOR:
      return 'Retenção do alocador: a memória cresce no [heap]/arena do glibc com o heap do V8 parado. Não é vazamento do código — é memória já liberada que o glibc não devolve. A alavanca é o alocador (jemalloc com purga em segundo plano, ou limiares fixos de mmap/trim), não procurar bug em JavaScript.'
    case GROWTH_VERDICTS.VAZAMENTO_JS:
      return 'Vazamento em JavaScript: o heapUsed do V8 sobe junto com o total e não volta. Alguma estrutura guarda referência para sempre. Trocar alocador NÃO resolve; o caminho é heap snapshot em staging para achar quem retém.'
    case GROWTH_VERDICTS.BUFFERS_EM_FILA:
      return 'Buffers presos na fila: são as fotos/HTML das mensagens ainda não enviadas (buildPayload guarda a imagem até o último destino sair). Sobe e desce com a fila do robô. A alavanca é soltar o buffer quando o último job da mensagem termina, ou limitar a espera na fila.'
    default:
      return 'Crescimento misto: nenhum balde explica sozinho. Vale medir mais tempo e separar por robô — provavelmente há dois mecanismos somados.'
  }
}
