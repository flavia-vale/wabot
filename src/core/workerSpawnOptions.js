// Opções de spawn dos bot-workers, isoladas como módulo PURO (sem fork, sem
// I/O) para serem testáveis e para manter `sessionCore.js` ([PROTECTED_CORE])
// intocado na lógica interna — aqui mora só a matemática do flag.
//
// Contexto (incidente "WhatsApp caindo toda hora", jun/2026): os bot-workers
// são `fork()` da API e NÃO têm teto de memória — o `max_memory_restart` do
// PM2 (no ecosystem) só enxerga os apps PM2, não os filhos forkados. Sem teto,
// um worker incha sob scrape pesado (Amazon ~1.3MB + buffers de imagem) e, num
// VPS apertado, a pausa de GC trava o event-loop o suficiente para o keepalive
// do WhatsApp estourar → socket cai (408/428) → reconexão em loop ("sincronização
// concluída" + worker_restart). Passar `--max-old-space-size` força o V8 a
// coletar antes de inchar, contendo o old-space do worker.
//
// Limitação conhecida: `--max-old-space-size` limita só o heap JS (old space),
// não a memória externa (Buffers de mídia vivem fora do heap). Ainda assim
// bound o crescimento do heap e reduz pausas de GC longas. É mitigação, não
// teto rígido de RSS.

const DEFAULT_MAX_OLD_SPACE_MB = 384

// Resolve o execArgv do worker a partir do env. Regras:
//   - ausente            → default (DEFAULT_MAX_OLD_SPACE_MB)
//   - '0' / '' / inválido → [] (sem cap; escape hatch para reverter sem deploy)
//   - inteiro > 0        → ['--max-old-space-size=<mb>']
export function resolveWorkerExecArgv(env = process.env) {
  const raw = env.BOT_WORKER_MAX_OLD_SPACE_MB
  let mb
  if (raw === undefined) {
    mb = DEFAULT_MAX_OLD_SPACE_MB
  } else {
    const parsed = Number.parseInt(String(raw).trim(), 10)
    mb = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }
  const argv = mb > 0 ? [`--max-old-space-size=${mb}`] : []
  // Pool de plataforma do V8: medido em 7 threads por worker (núcleos - 1), e
  // thread é o que cria arena do glibc. Ausente = não passa a flag (histórico).
  // ⚠️ Mexe em GC paralelo e compilação em background: pausa de GC longa é
  // literalmente o que derrubava sessão no incidente de junho/2026. Medir o
  // event loop antes de promover.
  const pool = Number.parseInt(String(env.WA_WORKER_V8_POOL_SIZE ?? '').trim(), 10)
  if (Number.isFinite(pool) && pool > 0) argv.push(`--v8-pool-size=${pool}`)
  return argv
}

export const WORKER_DEFAULT_MAX_OLD_SPACE_MB = DEFAULT_MAX_OLD_SPACE_MB

// ---------------------------------------------------------------------------
// Ambiente do worker: alocador e pools de thread (2026-09-17)
//
// MEDIDO em produção (41 robôs, docs/analise-ram-memoria-nativa-2026-09-16.md):
// 58% do PSS da frota está em arena secundária do glibc — memória já liberada
// que nunca voltou ao sistema. Cada worker tem 29 threads (16 do motor do
// Prisma, 7 do V8, 4 do libuv) e ~30 arenas: o glibc cria arena por disputa
// entre threads, então arena e thread andam praticamente 1 para 1
// (1.219 arenas para 1.189 threads na frota).
//
// O que a medição separou:
//   - a CONTAGEM de arenas é quase igual em todos (28 a 33) e a de threads é
//     idêntica (29 em todos os 41);
//   - o que ela GUARDA varia 6,6x: de 35,8 a 237,0 MiB.
// Ou seja: o problema não é quantas arenas existem, é a memória que fica presa
// dentro delas sem poder ser reaproveitada por outra arena. Concentrar tudo em
// poucas arenas (MALLOC_ARENA_MAX) ataca isso de frente; cortar thread ataca
// pela origem, com risco maior (mexe em concorrência de I/O de verdade).
//
// TUDO AQUI NASCE DESLIGADO. Sem env configurada o objeto devolvido é vazio e
// o fork fica byte a byte como sempre foi — mesmo padrão dos demais
// interruptores de rollout do projeto.
//
// ⚠️ Nomes PRÓPRIOS (`WA_WORKER_*`) em vez dos nomes que as bibliotecas leem,
// por dois motivos:
//   1. colocar `MALLOC_ARENA_MAX` direto no `.env` valeria também para a API e
//      para o supervisor, que não são o alvo;
//   2. para o glibc, `MALLOC_ARENA_MAX=0` significa "automático", NÃO
//      "desligado" — um `0` escrito com a intenção de desligar ligaria o
//      comportamento padrão. Com nome próprio, ausente e `0` significam a mesma
//      coisa segura: não setar nada.

function positiveIntOrNull(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null
  const parsed = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Variáveis de ambiente EXTRA para o fork do worker. Devolve `{}` quando nada
 * está configurado — o chamador espalha o resultado por cima do `process.env`,
 * então objeto vazio é no-op garantido.
 *
 * | env de entrada                  | vira                   | ataca                          |
 * |---------------------------------|------------------------|--------------------------------|
 * | `WA_WORKER_MALLOC_ARENA_MAX`    | `MALLOC_ARENA_MAX`     | as arenas (58% do PSS medido)  |
 * | `WA_WORKER_TOKIO_THREADS`       | `TOKIO_WORKER_THREADS` | 16 threads do motor do Prisma  |
 * | `WA_WORKER_UV_THREADPOOL_SIZE`  | `UV_THREADPOOL_SIZE`   | 4 threads do pool do libuv     |
 *
 * ⚠️ Não está verificado que o motor do Prisma honra `TOKIO_WORKER_THREADS` —
 * é a variável padrão do tokio, mas depende de como ele constrói o runtime.
 * Conferir contando as threads depois de aplicar, antes de acreditar no valor.
 */
export function resolveWorkerSpawnEnv(env = process.env) {
  const extra = {}
  const arenaMax = positiveIntOrNull(env.WA_WORKER_MALLOC_ARENA_MAX)
  if (arenaMax !== null) extra.MALLOC_ARENA_MAX = String(arenaMax)
  const tokio = positiveIntOrNull(env.WA_WORKER_TOKIO_THREADS)
  if (tokio !== null) extra.TOKIO_WORKER_THREADS = String(tokio)
  const uv = positiveIntOrNull(env.WA_WORKER_UV_THREADPOOL_SIZE)
  if (uv !== null) extra.UV_THREADPOOL_SIZE = String(uv)
  return extra
}
