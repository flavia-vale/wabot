// Cache e concorrência do libvips (Sharp). (2026-09-18)
//
// Cinco módulos importam `sharp` no topo (`imageScrapers`, `inlineThumbnail`,
// `storeBrandCard`, `destinationWatermark`, `imageMutation`) e todos são
// alcançados por `bot-worker.js` — ou seja, **todo robô carrega o libvips**.
// Os padrões da biblioteca nunca foram ajustados aqui:
//
//   sharp.cache()       -> 50 MB de cache de operação, POR PROCESSO
//   sharp.concurrency() -> número de núcleos (8 aqui)
//
// O cache são 50 MB de memória NATIVA por processo, invisível em `heapUsed`.
//
// ⚠️ **Estes são os padrões DOCUMENTADOS da biblioteca, não medição nossa.** A
// medição de 17/09 achou `libvips-cpp.so` com 2,1 MiB de PSS (o código, que é
// compartilhado entre os robôs) e **zero threads de vips** nos 41 robôs — o
// pool é criado sob demanda. Ou seja: o ganho real depende de quantos robôs de
// fato encheram o cache, e isso não foi medido. Não prometer os 50 MB.
//
// Nasce DESLIGADO: sem env, nada é chamado e o Sharp fica com os padrões dele.

/**
 * Lê a intenção do ambiente. PURA: não importa sharp, não toca nada.
 *
 * | env                  | efeito                                            |
 * |----------------------|---------------------------------------------------|
 * | `SHARP_CACHE_MB=0`   | desliga o cache de operação do libvips            |
 * | `SHARP_CACHE_MB=<n>` | limita o cache a n MB                             |
 * | ausente              | **não chama** `sharp.cache()` — padrão da lib     |
 * | `SHARP_CONCURRENCY`  | idem para o pool de threads                       |
 *
 * ⚠️ Aqui `0` é valor VÁLIDO e significa "desligar o cache" — ao contrário de
 * `WA_WORKER_MALLOC_ARENA_MAX`, onde `0` significa "não setar". A diferença é
 * de propósito: para o glibc, `MALLOC_ARENA_MAX=0` quer dizer "automático", e
 * um `0` escrito para desligar ligaria o padrão. Para o Sharp, `cache(0)`
 * desliga de verdade. Quem diz "não mexa" aqui é a AUSÊNCIA da env.
 */
export function resolveSharpTuning(env = process.env) {
  const tuning = {}
  const cache = readNonNegativeInt(env.SHARP_CACHE_MB)
  if (cache !== null) tuning.cacheMemoryMb = cache
  const concurrency = readNonNegativeInt(env.SHARP_CONCURRENCY)
  if (concurrency !== null) tuning.concurrency = concurrency
  return tuning
}

function readNonNegativeInt(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null
  const parsed = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Aplica o que `resolveSharpTuning` decidiu. `sharp` é injetado para o módulo
 * continuar testável sem a biblioteca instalada.
 *
 * **Best-effort de propósito:** ajuste de cache é economia de memória, nunca
 * motivo para derrubar o robô. Qualquer falha é engolida e devolvida no
 * resultado, para quem chama poder logar.
 */
export function applySharpTuning(sharp, env = process.env) {
  const tuning = resolveSharpTuning(env)
  const applied = {}
  if (!sharp || Object.keys(tuning).length === 0) return { applied, skipped: true }
  try {
    if (tuning.cacheMemoryMb !== undefined) {
      // `files` e `items` acompanham o cache de memória: manter arquivo aberto
      // e operação memorizada sem memória para o resultado não serve de nada.
      const off = tuning.cacheMemoryMb === 0
      sharp.cache({ memory: tuning.cacheMemoryMb, files: off ? 0 : 20, items: off ? 0 : 100 })
      applied.cacheMemoryMb = tuning.cacheMemoryMb
    }
    if (tuning.concurrency !== undefined) {
      sharp.concurrency(tuning.concurrency)
      applied.concurrency = tuning.concurrency
    }
  } catch (err) {
    return { applied, skipped: false, error: String(err?.message ?? err) }
  }
  return { applied, skipped: false }
}
