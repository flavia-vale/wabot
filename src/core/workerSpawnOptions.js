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
  if (mb <= 0) return []
  return [`--max-old-space-size=${mb}`]
}

export const WORKER_DEFAULT_MAX_OLD_SPACE_MB = DEFAULT_MAX_OLD_SPACE_MB
