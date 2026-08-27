// Episódios de desconexão da sessão WhatsApp (visão admin).
//
// RCA 2026-08-26: a versão anterior (`summarizeOfflineEpisodes` inline em
// `src/api/routes/admin.js`) tinha DOIS defeitos que faziam a métrica mentir
// exatamente no caso que mais dói:
//
//   1. Ao ver `manual_reconnect_requested`/`manual_pairing_requested` ela
//      DESCARTAVA o episódio aberto (`startedByUser.delete`). Ou seja: o tempo
//      em que a cliente ficou parada ANTES de ir re-parear nunca era somado.
//      O pior cenário — o robô não voltou sozinho e ela teve que agir — era o
//      único que somava zero.
//   2. O pareamento queda↔volta era feito só sobre os eventos DENTRO da
//      janela. Uma queda às 23h50 que só voltou às 00h10 perdia o par: não
//      contava recuperação nem tempo.
//
// Aqui os episódios são montados sobre a série INTEIRA e só depois recortados
// pela janela. Ação da cliente não descarta o episódio: ela apenas MARCA como
// tendo sido resolvido por ela (`endedBy: 'cliente'`), com o tempo somado num
// balde separado — misturar "voltou sozinho" com "só voltou porque ela agiu"
// esconde justamente a métrica que mede a promessa do produto.
//
// Puro: sem I/O, sem Prisma, sem Date.now() implícito.

export const OFFLINE_EPISODE_EVENT_TYPES = [
  'disconnect',
  'disconnect_terminal',
  'auth_reset',
  'reconnect_success',
  'connected',
  'manual_reconnect_requested',
  'manual_pairing_requested',
]

const MANUAL_TYPES = new Set(['manual_reconnect_requested', 'manual_pairing_requested'])
const RESTORE_TYPES = new Set(['reconnect_success', 'connected'])
const TERMINAL_TYPES = new Set(['disconnect_terminal', 'auth_reset'])

function parseMetadata(metadata) {
  if (!metadata) return {}
  if (typeof metadata === 'object') return metadata
  try { return JSON.parse(metadata) || {} } catch { return {} }
}

function toMs(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

// Monta a linha do tempo de episódios por usuário. Cada episódio é
// { startedAt, endedAt, durationMs, endedBy, code, stuckMsg, terminal,
//   manualActionAt, open }.
// `endedBy`: 'sozinho' (o robô voltou), 'cliente' (só voltou depois de ação
// dela), null (ainda aberto). `terminal` marca o episódio que começou com
// logout/auth apagado — o robô NÃO volta sozinho desse, precisa da cliente.
export function buildOfflineEpisodesByUser(events = [], { now } = {}) {
  const nowMs = toMs(now) ?? Date.now()
  const byUser = new Map()
  const open = new Map()

  const ordered = [...events]
    .map(event => ({ ...event, atMs: toMs(event?.occurredAt) }))
    .filter(event => event.userId && Number.isFinite(event.atMs))
    .sort((a, b) => a.atMs - b.atMs)

  const ensure = (userId) => {
    if (!byUser.has(userId)) byUser.set(userId, [])
    return byUser.get(userId)
  }

  for (const event of ordered) {
    const { userId, atMs } = event
    const type = String(event.type || '')
    const metadata = parseMetadata(event.metadata)
    ensure(userId)

    if (MANUAL_TYPES.has(type)) {
      const episode = open.get(userId)
      // NÃO fecha o episódio: só registra que a cliente teve que agir. Quem
      // fecha é a volta da conexão — é isso que dá o tempo real que ela ficou
      // esperando antes de mexer.
      if (episode && episode.manualActionAt == null) episode.manualActionAt = atMs
      else if (!episode) ensure(userId).push({
        startedAt: atMs,
        endedAt: atMs,
        durationMs: 0,
        endedBy: 'cliente',
        code: null,
        stuckMsg: false,
        terminal: false,
        manualActionAt: atMs,
        open: false,
        orphanManual: true,
      })
      continue
    }

    if (type === 'disconnect' || TERMINAL_TYPES.has(type)) {
      const terminal = TERMINAL_TYPES.has(type)
      // Queda de pareamento/parada pedida pela cliente não é indisponibilidade
      // do robô — é escolha dela. Não abre episódio.
      if (!terminal && (metadata.pairing || metadata.manual || metadata.terminal)) continue
      const current = open.get(userId)
      if (current) {
        // Uma queda terminal encerra o episódio anterior e abre outro, porque
        // a natureza mudou: antes o robô voltava sozinho, agora precisa dela.
        if (terminal) {
          current.endedAt = atMs
          current.durationMs = Math.max(0, atMs - current.startedAt)
          current.endedBy = current.manualActionAt != null ? 'cliente' : 'interrompido'
          current.open = false
          open.delete(userId)
        } else {
          continue // já estamos fora do ar; queda repetida não abre outro
        }
      }
      const episode = {
        startedAt: atMs,
        endedAt: null,
        durationMs: 0,
        endedBy: null,
        code: event.code ?? metadata.code ?? null,
        stuckMsg: Boolean(metadata.stuckMsg),
        terminal,
        manualActionAt: null,
        open: true,
      }
      open.set(userId, episode)
      ensure(userId).push(episode)
      continue
    }

    if (RESTORE_TYPES.has(type)) {
      const episode = open.get(userId)
      if (!episode) continue
      episode.endedAt = atMs
      episode.durationMs = Math.max(0, atMs - episode.startedAt)
      // Episódio terminal (logout/auth apagado) só volta com ação da cliente,
      // mesmo que ela não tenha passado pelas rotas que gravam manual_*.
      episode.endedBy = (episode.manualActionAt != null || episode.terminal) ? 'cliente' : 'sozinho'
      episode.open = false
      open.delete(userId)
    }
  }

  for (const [userId, episode] of open.entries()) {
    episode.durationMs = Math.max(0, nowMs - episode.startedAt)
    ensure(userId)
  }

  return byUser
}

// Recorta os episódios pela janela e devolve os contadores consumidos pelo
// painel admin. Só o TEMPO é recortado; a duração cheia continua disponível em
// `longest*` para não subestimar um episódio que começou antes da janela.
export function summarizeEpisodes(episodes = [], { since, now } = {}) {
  const sinceMs = toMs(since) ?? 0
  const nowMs = toMs(now) ?? Date.now()
  const metrics = {
    manualReconnects: 0,
    automaticRecoveries: 0,
    manualRecoveries: 0,
    automaticOfflineMs: 0,
    manualOfflineMs: 0,
    longestAutomaticOfflineMs: 0,
    longestManualOfflineMs: 0,
    ongoingOfflineMs: 0,
    terminalEpisodes: 0,
    episodes: 0,
  }

  for (const episode of episodes) {
    const endMs = episode.open ? nowMs : (episode.endedAt ?? nowMs)
    if (endMs < sinceMs) continue
    const clippedMs = Math.max(0, endMs - Math.max(episode.startedAt, sinceMs))
    metrics.episodes += 1
    if (episode.manualActionAt != null && episode.manualActionAt >= sinceMs) metrics.manualReconnects += 1
    if (episode.terminal) metrics.terminalEpisodes += 1

    if (episode.open) {
      metrics.ongoingOfflineMs += clippedMs
      const target = episode.terminal || episode.manualActionAt != null ? 'longestManualOfflineMs' : 'longestAutomaticOfflineMs'
      metrics[target] = Math.max(metrics[target], episode.durationMs)
      continue
    }
    if (episode.endedBy === 'sozinho') {
      metrics.automaticRecoveries += 1
      metrics.automaticOfflineMs += clippedMs
      metrics.longestAutomaticOfflineMs = Math.max(metrics.longestAutomaticOfflineMs, episode.durationMs)
    } else if (episode.endedBy === 'cliente') {
      metrics.manualRecoveries += 1
      metrics.manualOfflineMs += clippedMs
      metrics.longestManualOfflineMs = Math.max(metrics.longestManualOfflineMs, episode.durationMs)
    }
  }

  return metrics
}

// Atalho usado pelas rotas: monta os episódios sobre a série inteira e
// devolve as métricas já recortadas por janela, por usuário.
export function summarizeOfflineEpisodesByUser(events = [], { since, now } = {}) {
  const byUser = buildOfflineEpisodesByUser(events, { now })
  const result = new Map()
  for (const [userId, episodes] of byUser.entries()) {
    result.set(userId, summarizeEpisodes(episodes, { since, now }))
  }
  return result
}

// Linha do tempo pronta para a tela (mais recentes primeiro), com datas em ISO.
export function presentOfflineEpisodes(episodes = [], { limit = 50 } = {}) {
  return [...episodes]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, Math.max(0, limit))
    .map(episode => ({
      startedAt: new Date(episode.startedAt).toISOString(),
      endedAt: episode.endedAt ? new Date(episode.endedAt).toISOString() : null,
      durationMs: episode.durationMs,
      endedBy: episode.endedBy,
      open: Boolean(episode.open),
      terminal: Boolean(episode.terminal),
      manualActionAt: episode.manualActionAt ? new Date(episode.manualActionAt).toISOString() : null,
      code: episode.code ?? null,
      stuckMsg: Boolean(episode.stuckMsg),
    }))
}
