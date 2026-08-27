// Sinais operacionais para os "gatilhos" de escala da auditoria (WABOT-010):
// ocorrências de SQLITE_BUSY e de dedup global em fail-open. O objetivo é
// tornar esses gatilhos OBSERVÁVEIS (e não subjetivos) — alimentando o
// critério de cutover SQLite->Postgres e a decisão de REDIS_DEDUP_FAIL_MODE.
//
// Este é um módulo LEAF de propósito: não importa `db.js` nem `analytics.js`
// no topo, para que `db.js` possa consumi-lo sem criar ciclo de import
// (db -> signals -> analytics -> db). A emissão durável em `AnalyticsEvent`
// é feita via dynamic import lazy e best-effort: o contador in-memory é a
// fonte confiável; a linha no banco é bônus para histórico cross-processo.

const WINDOW_24H_MS = 24 * 60 * 60 * 1000
const WINDOW_1H_MS = 60 * 60 * 1000
const MAX_TIMESTAMPS_PER_SIGNAL = 10_000 // bound defensivo de memória por sinal

const signals = new Map() // name -> { total, timestamps: number[] (ascendente) }

// Mapeia o nome curto do sinal para o evento canônico do allowlist de analytics.
const ANALYTICS_EVENT_BY_SIGNAL = {
  sqlite_busy: 'ops_sqlite_busy',
  dedup_fail_open: 'ops_dedup_fail_open',
  wa_connection_replaced: 'ops_wa_connection_replaced',
  // Desconexão 403/forbidden do WhatsApp: chip possivelmente restringido/banido
  // (costuma vir após flapping prolongado). Sinal durável para vigiar por chip
  // e agir antes de virar ban definitivo.
  wa_forbidden: 'ops_wa_forbidden',
  // Flapping (closes repetidos 500/428/408/...) que disparou o cooldown longo —
  // fonte do spam de "A sincronização foi concluída". Durável por chip.
  wa_flap_cooldown: 'ops_wa_flap_cooldown',
  // badSession (500) repetido sem conexão estável → auth limpo p/ re-pareamento.
  wa_bad_session_reset: 'ops_wa_bad_session_reset',
  // Sessão ficou estável e mesmo assim cai em cadência periódica; cooldown
  // maior para reduzir re-sync/push notification sem limpar auth.
  wa_stable_close_cooldown: 'ops_wa_stable_close_cooldown',
  // Mesma mensagem repetindo no ack de um stream:error — loop de
  // retry-receipt travado derrubando a sessão em cadência (RCA 2026-07).
  wa_stuck_message_retry: 'ops_wa_stuck_message_retry',
  // Camada 3 (issue #1216): grupo com sender-key dessincronizada disparou
  // auto-refresh sozinho (não-destrutivo).
  wa_group_desync_autoheal: 'ops_wa_group_desync_autoheal',
  // Auto-refresh repetido não resolveu — precisa de ação manual (humano).
  wa_group_desync_unresolved: 'ops_wa_group_desync_unresolved',
  // `failure reason=405`: o WhatsApp recusou o login/registro. Na prática é
  // sempre a versão do WA Web anunciada no handshake tendo sido cortada pelo
  // servidor — atinge TODAS as sessões de uma vez (RCA 2026-07-28), não um chip
  // específico. Sinal durável para separar "essa conta está com problema" de
  // "o WhatsApp cortou a nossa versão e todo mundo caiu junto".
  wa_version_rejected: 'ops_wa_version_rejected',
  // Oferta espelhada saiu sem foto porque o card de preview não conseguiu
  // imagem. Durável para comparar por loja e por etapa ao longo dos dias.
  preview_card_no_image: 'ops_preview_card_no_image',
  // Sessão conectada e SEM receber mensagem útil, com evidência de tráfego
  // chegando e falhando (RCA 2026-08-26: painel verde e espelhamento parado).
  wa_reception_blind: 'ops_wa_reception_blind',
  // Escopo de conversas (Fase 2): resumo agregado do que foi ignorado por
  // estar fora da lista de escolhidos. Nunca por mensagem.
  wa_chat_scope_filtered: 'ops_wa_chat_scope_filtered',
  // Freio de emergência: a conta parou de receber com a regra ligada e ela se
  // desligou sozinha. Precisa de olho humano — é sinal de lista defasada ou de
  // endereçamento novo do WhatsApp.
  wa_chat_scope_auto_disabled: 'ops_wa_chat_scope_auto_disabled',
  // Sessão presa em reconexão sem worker que o supervisor levantou de volta
  // (RCA 2026-08-27). Antes ela morria de vez e só voltava com a cliente
  // clicando em Conectar.
  wa_session_resurrected: 'ops_wa_session_resurrected',
  // Muro anti-robô do ML batendo no IP do servidor (RCA 2026-08-19/20).
  ml_anti_bot_wall: 'ops_ml_anti_bot_wall',
  // Card de preview salvo pelo plano B: loja sem foto, foto da mensagem de
  // origem no lugar. A oferta SAIU com card clicável e com imagem.
  preview_card_origin_fallback: 'ops_preview_card_origin_fallback',
  // Miniatura abaixo do piso de qualidade: a oferta saiu sem imagem em vez de
  // com borrão (RCA 2026-08-26).
  monitored_thumbnail_dropped: 'ops_monitored_thumbnail_dropped',
  // Origem sem destino explícito espelhando para todos os destinos da conta.
  mirror_fallback_all_destinations: 'ops_mirror_fallback_all_destinations',
  // Job descartado no dequeue: destino não está mais vinculado à origem.
  send_dest_unlinked: 'ops_send_dest_unlinked',
}

let cachedTrackFn = null
async function emitDurable(name, metadata) {
  const event = ANALYTICS_EVENT_BY_SIGNAL[name]
  if (!event) return
  try {
    if (!cachedTrackFn) {
      const mod = await import('../analytics.js')
      cachedTrackFn = mod.trackAnalyticsEventSafe
    }
    // userId top-level (quando vier na metadata) popula a coluna userId do
    // AnalyticsEvent, permitindo agregação por chip (GROUP BY userId) sem
    // precisar parsear JSON. Backward-compatible: sinais sem userId seguem null.
    cachedTrackFn({ event, userId: metadata?.userId ?? null, metadata })
  } catch {
    // best-effort: o contador in-memory já registrou. Em SQLITE_BUSY, a própria
    // escrita do AnalyticsEvent pode falhar — e tudo bem, é só durabilidade.
  }
}

export function recordOperationalSignal(name, metadata = {}) {
  const now = Date.now()
  let entry = signals.get(name)
  if (!entry) {
    entry = { total: 0, timestamps: [] }
    signals.set(name, entry)
  }
  entry.total += 1
  entry.timestamps.push(now)
  if (entry.timestamps.length > MAX_TIMESTAMPS_PER_SIGNAL) {
    entry.timestamps.splice(0, entry.timestamps.length - MAX_TIMESTAMPS_PER_SIGNAL)
  }
  emitDurable(name, metadata)
  return entry.total
}

function countWithin(timestamps, windowMs, now) {
  let n = 0
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (now - timestamps[i] <= windowMs) n += 1
    else break // ascendente: o primeiro fora da janela encerra a contagem
  }
  return n
}

export function getOperationalSignalsSnapshot(now = Date.now()) {
  const out = {}
  for (const [name, entry] of signals) {
    // Poda preguiçosa do que saiu da janela de 24h (mantém a memória limitada).
    while (entry.timestamps.length && now - entry.timestamps[0] > WINDOW_24H_MS) {
      entry.timestamps.shift()
    }
    out[name] = {
      total: entry.total,
      last1h: countWithin(entry.timestamps, WINDOW_1H_MS, now),
      last24h: entry.timestamps.length,
    }
  }
  return out
}

// Hook de teste: zera o estado in-memory entre casos.
export function __resetOperationalSignals() {
  signals.clear()
  cachedTrackFn = null
}
