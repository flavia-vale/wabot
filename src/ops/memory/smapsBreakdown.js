// Decomposição da memória de um processo a partir de `/proc/<pid>/smaps`.
//
// POR QUE ESTE MÓDULO EXISTE (medição de 2026-09-16): a sessão de WhatsApp
// custa ~243 MiB de PSS, e apenas ~14 MiB aparecem em `process.memoryUsage()`
// (heap + `external`). **94% do custo é memória nativa que a API do Node não
// enxerga.** Qualquer painel construído sobre `heapUsed`/`external` mostra uma
// frota saudável enquanto a memória do servidor acaba — foi exatamente o que a
// POC de shard demonstrou.
//
// `smaps_rollup` dá só o total. O que decide a próxima ação é **de que tipo** é
// essa memória nativa, e isso só o `smaps` completo responde:
//
//   - arena secundária do glibc (bloco anônimo de 64 MiB alinhado em 64 MiB,
//     sem caminho de arquivo) → fragmentação do alocador; tratável por env
//     (`MALLOC_ARENA_MAX`), sem tocar em código de sessão;
//   - `[heap]` (brk) → arena principal;
//   - anônimo grande fora de arena → heap do V8, buffers, pilhas de thread;
//   - biblioteca compartilhada (`.so`/`.node`) → código; quase todo compartilhado
//     entre os 42 workers, então pesa pouco em PSS e MUITO em RSS (é uma das
//     razões de RSS não servir para somar processos).
//
// Módulo PURO de propósito: recebe o texto do `smaps` e devolve o resumo. Sem
// leitura de disco, sem `/proc`, sem rede — o script `scripts/diag-memoria-nativa.mjs`
// é quem lê o sistema. Assim a classificação é testável sem VPS.

// HEAP_MAX_SIZE do glibc em 64 bits: cada arena secundária é um mmap de 64 MiB
// alinhado em 64 MiB (normalmente aparece no smaps quebrado em duas linhas —
// a parte já comprometida `rw-p` e o resto reservado `---p`).
const GLIBC_ARENA_BYTES = 64 * 1024 * 1024

export const REGION_KINDS = Object.freeze({
  GLIBC_ARENA: 'arena_glibc',
  MAIN_HEAP: 'heap_principal',
  ANON: 'anonimo',
  STACK: 'pilha',
  SHARED_LIB: 'biblioteca',
  FILE: 'arquivo',
  OTHER: 'outro',
})

const HEADER_RE = /^([0-9a-f]+)-([0-9a-f]+)\s+(\S{4})\s+\S+\s+\S+\s+\S+\s*(.*)$/
const FIELD_RE = /^(\w[\w()]*):\s+(\d+)\s*kB$/

/**
 * Quebra o texto de `/proc/<pid>/smaps` em regiões com {start, end, perms,
 * path, size, rss, pss}. Valores em bytes. Linhas desconhecidas são ignoradas
 * de propósito: o formato do smaps ganha campos novos a cada versão de kernel e
 * quebrar por causa disso tornaria o instrumento inútil justamente quando o
 * servidor for atualizado.
 */
export function parseSmaps(text) {
  const regions = []
  let current = null
  for (const line of String(text ?? '').split('\n')) {
    const header = HEADER_RE.exec(line)
    if (header) {
      current = {
        start: Number.parseInt(header[1], 16),
        end: Number.parseInt(header[2], 16),
        perms: header[3],
        path: header[4].trim(),
        size: 0,
        rss: 0,
        pss: 0,
      }
      regions.push(current)
      continue
    }
    if (!current) continue
    const field = FIELD_RE.exec(line)
    if (!field) continue
    const bytes = Number(field[2]) * 1024
    if (field[1] === 'Size') current.size = bytes
    else if (field[1] === 'Rss') current.rss = bytes
    else if (field[1] === 'Pss') current.pss = bytes
  }
  return regions
}

/**
 * Marca quais regiões anônimas pertencem a uma arena secundária do glibc.
 *
 * Detecção por FORMA, não por nome: o smaps não rotula arena. O que a
 * identifica é o mmap de 64 MiB alinhado em 64 MiB e sem arquivo por trás.
 * Agrupamos por base alinhada e só aceitamos o grupo cuja soma de `Size` bate
 * exatamente com 64 MiB — assim um bloco anônimo grande do V8 que por acaso
 * caia num endereço alinhado não é contado como arena.
 */
export function findGlibcArenas(regions) {
  const groups = new Map()
  for (const region of regions) {
    if (region.path) continue
    const base = Math.floor(region.start / GLIBC_ARENA_BYTES) * GLIBC_ARENA_BYTES
    if (!groups.has(base)) groups.set(base, [])
    groups.get(base).push(region)
  }
  const arenas = []
  for (const [base, members] of groups) {
    const size = members.reduce((acc, r) => acc + r.size, 0)
    if (size !== GLIBC_ARENA_BYTES) continue
    arenas.push({
      base,
      size,
      rss: members.reduce((acc, r) => acc + r.rss, 0),
      pss: members.reduce((acc, r) => acc + r.pss, 0),
      regions: members,
    })
  }
  return arenas.sort((a, b) => b.pss - a.pss)
}

function classify(region, arenaRegions) {
  if (arenaRegions.has(region)) return REGION_KINDS.GLIBC_ARENA
  if (region.path === '[heap]') return REGION_KINDS.MAIN_HEAP
  if (region.path === '[stack]' || region.path.startsWith('[stack')) return REGION_KINDS.STACK
  if (!region.path || region.path.startsWith('[anon')) return REGION_KINDS.ANON
  if (/\.(so|node)(\.\d+)*$/.test(region.path)) return REGION_KINDS.SHARED_LIB
  if (region.path.startsWith('/')) return REGION_KINDS.FILE
  return REGION_KINDS.OTHER
}

/**
 * Resumo por tipo de região + a lista de bibliotecas nativas mais caras.
 *
 * `pss` é a métrica que vale para somar processos: RSS conta a MESMA página
 * compartilhada uma vez por processo e superestima qualquer economia de
 * consolidação (armadilha registrada na revisão da POC de shard).
 */
export function summarizeSmaps(text, { topLibs = 8 } = {}) {
  const regions = parseSmaps(text)
  const arenas = findGlibcArenas(regions)
  const arenaRegions = new Set(arenas.flatMap((a) => a.regions))

  const byKind = {}
  const libs = new Map()
  let totalPss = 0
  let totalRss = 0

  for (const region of regions) {
    const kind = classify(region, arenaRegions)
    const bucket = (byKind[kind] ??= { kind, count: 0, size: 0, rss: 0, pss: 0 })
    bucket.count += 1
    bucket.size += region.size
    bucket.rss += region.rss
    bucket.pss += region.pss
    totalPss += region.pss
    totalRss += region.rss
    if (kind === REGION_KINDS.SHARED_LIB) {
      const name = region.path.slice(region.path.lastIndexOf('/') + 1)
      const lib = libs.get(name) ?? { name, rss: 0, pss: 0 }
      lib.rss += region.rss
      lib.pss += region.pss
      libs.set(name, lib)
    }
  }

  return {
    totalRss,
    totalPss,
    regionCount: regions.length,
    byKind: Object.values(byKind).sort((a, b) => b.pss - a.pss),
    arenas: {
      count: arenas.length,
      rss: arenas.reduce((acc, a) => acc + a.rss, 0),
      pss: arenas.reduce((acc, a) => acc + a.pss, 0),
      reserved: arenas.length * GLIBC_ARENA_BYTES,
    },
    topLibs: [...libs.values()].sort((a, b) => b.pss - a.pss).slice(0, topLibs),
  }
}

export const GLIBC_ARENA_SIZE_BYTES = GLIBC_ARENA_BYTES
