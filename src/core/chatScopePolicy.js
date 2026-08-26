// "Olhar só o que foi escolhido" — escopo de conversas que o robô processa.
//
// Inverte a política antiga (`ignoredJidPolicy.js`), que era uma LISTA DE
// EXCEÇÕES e envelheceu mal: começou cobrindo grupo, veio o incidente de canal
// (`@newsletter`, conta cynthiatceles@ em 2026-08-25) e a medição de 26/08
// mostrou que o MAIOR balde nem era grupo — eram as conversas diretas pessoais
// da própria cliente (538 de 1.082 eventos, 15 contas), que o robô tenta
// decifrar e descarta na linha seguinte. Cada incidente descobria um balde
// novo depois que a cliente reclamava.
//
// Aqui a lista é do que OLHAR. O balde que ainda não existe já nasce coberto.
//
// Confirmado na fonte do Baileys instalado (6.7.23): quando `shouldIgnoreJid`
// devolve true, `handleMessage` (Socket/messages-recv.js:611) faz apenas
// `sendMessageAck` e RETORNA — antes do decrypt e antes do pedido de reenvio.
// Sem retry receipt, o WhatsApp não reoferece, e o stream não cai.
//
// ⚠️ O MESMO gancho é consultado em outros três caminhos, e é por isso que a
// lista de escolhidos precisa conter mais do que as fontes monitoradas:
//   - `handleReceipt` (:512)      → confirmação de entrega das NOSSAS mensagens
//   - `handleNotification` (:580) → entrada em grupo (dispara a boas-vindas)
//   - `handlePresenceUpdate`      → presença (irrelevante)
// Por isso destinos de postagem, canal do botão e `status@broadcast` NUNCA
// podem ser ignorados. A descoberta de "Canais que sigo" não passa por aqui
// (vem de `messaging-history.set`/`chats.upsert`), então não é afetada.
//
// Puro: sem I/O, sem relógio implícito.

export const CHAT_SCOPE_MODES = {
  OFF: 'off',
  DM: 'dm',
  DM_GROUP: 'dm+group',
  STRICT: 'strict',
}

export const CHAT_JID_TYPES = {
  GROUP: 'group',
  NEWSLETTER: 'newsletter',
  DM: 'dm',
  STATUS: 'status',
  UNKNOWN: 'unknown',
}

export const DEFAULT_CHAT_SCOPE_PANIC_MS = 30 * 60_000

const MODE_IGNORES = {
  [CHAT_SCOPE_MODES.OFF]: new Set(),
  [CHAT_SCOPE_MODES.DM]: new Set([CHAT_JID_TYPES.DM]),
  [CHAT_SCOPE_MODES.DM_GROUP]: new Set([CHAT_JID_TYPES.DM, CHAT_JID_TYPES.GROUP]),
  [CHAT_SCOPE_MODES.STRICT]: new Set([CHAT_JID_TYPES.DM, CHAT_JID_TYPES.GROUP, CHAT_JID_TYPES.NEWSLETTER]),
}

// Modo desconhecido cai em `off` — configuração errada não pode virar filtro
// mais agressivo do que alguém pediu.
export function normalizeChatScopeMode(value) {
  const mode = String(value ?? '').trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(MODE_IGNORES, mode) ? mode : CHAT_SCOPE_MODES.OFF
}

export function normalizeJid(jid) {
  if (typeof jid !== 'string') return ''
  return jid.trim().replace(/:\d+(?=@)/, '')
}

export function classifyChatJid(jid) {
  const normalized = normalizeJid(jid)
  if (!normalized) return CHAT_JID_TYPES.UNKNOWN
  if (normalized === 'status@broadcast') return CHAT_JID_TYPES.STATUS
  if (normalized.endsWith('@g.us')) return CHAT_JID_TYPES.GROUP
  if (normalized.endsWith('@newsletter')) return CHAT_JID_TYPES.NEWSLETTER
  // No Baileys 6.7.23 `@lid` é endereço de PESSOA (`isLidUser`), não de grupo —
  // grupo continua `@g.us`. Se o WhatsApp migrar o endereçamento de grupo para
  // `@lid`, um grupo monitorado deixaria de casar com a lista e sairia do ar em
  // silêncio: é exatamente para isso que existe o freio de emergência abaixo.
  if (normalized.endsWith('@lid') || normalized.endsWith('@s.whatsapp.net')) return CHAT_JID_TYPES.DM
  return CHAT_JID_TYPES.UNKNOWN
}

export function buildAllowedJidSet(jids = []) {
  const set = new Set()
  for (const jid of jids) {
    const normalized = normalizeJid(jid)
    if (normalized) set.add(normalized)
  }
  return set
}

// Decide se o socket deve IGNORAR mensagens deste chat.
//
// Tudo falha para o lado de DEIXAR PASSAR (princípio 1 do plano): modo
// desligado, config ainda não carregada, lista vazia, freio acionado, tipo
// desconhecido, jid vazio — nada disso filtra.
export function shouldIgnoreByChatScope(jid, {
  mode = CHAT_SCOPE_MODES.OFF,
  allowedJids = null,
  ready = false,
  selfJids = null,
  disabled = false,
} = {}) {
  const type = classifyChatJid(jid)
  const normalized = normalizeJid(jid)
  const effectiveMode = normalizeChatScopeMode(mode)

  if (effectiveMode === CHAT_SCOPE_MODES.OFF) return { ignore: false, type, reason: 'modo desligado' }
  if (disabled) return { ignore: false, type, reason: 'freio de emergência acionado' }
  if (!ready) return { ignore: false, type, reason: 'config ainda não carregada' }
  if (!normalized) return { ignore: false, type, reason: 'jid vazio' }
  // Lista vazia é sinal de config incompleta, não autorização para ignorar
  // tudo — sem esta guarda, uma conta sem grupos configurados ficaria surda.
  if (!allowedJids || allowedJids.size === 0) return { ignore: false, type, reason: 'lista de escolhidos vazia' }
  if (allowedJids.has(normalized)) return { ignore: false, type, reason: 'está na lista de escolhidos' }
  // O próprio número/identidade nunca é ignorado: é por ele que chegam o
  // histórico e as notificações da própria conta.
  if (selfJids && selfJids.has(normalized)) return { ignore: false, type, reason: 'é a própria conta' }
  // `status@broadcast` é destino de publicação quando postToStatus está ligado,
  // e o recibo de entrega passa pelo mesmo gancho.
  if (type === CHAT_JID_TYPES.STATUS) return { ignore: false, type, reason: 'status é destino de publicação' }
  if (type === CHAT_JID_TYPES.UNKNOWN) return { ignore: false, type, reason: 'tipo desconhecido' }

  return MODE_IGNORES[effectiveMode].has(type)
    ? { ignore: true, type, reason: 'fora da lista de escolhidos' }
    : { ignore: false, type, reason: 'tipo não coberto pelo modo' }
}

// FREIO DE EMERGÊNCIA — o que garante "nada trava o uso".
//
// Se a conta ESTAVA recebendo mensagem, parou de receber por completo e o
// contador de ignoradas continua subindo, a regra desliga sozinha naquele
// worker e volta a deixar tudo passar. É a rede contra o cenário que não
// conseguimos prever (endereçamento novo do WhatsApp, lista defasada, bug
// nosso): falha para o lado de deixar passar, sem esperar alguém perceber.
export function shouldAutoDisableChatScope({
  now = Date.now(),
  enabled = false,
  alreadyDisabled = false,
  everAccepted = false,
  lastAcceptedAtMs = null,
  ignoredSinceLastAccepted = 0,
  panicMs = DEFAULT_CHAT_SCOPE_PANIC_MS,
} = {}) {
  if (!enabled || alreadyDisabled) return false
  const window = Number(panicMs)
  if (!Number.isFinite(window) || window <= 0) return false
  // Sem histórico de recepção não dá para dizer que "parou" — conta nova ou
  // fonte parada não pode desligar a regra à toa.
  if (!everAccepted || lastAcceptedAtMs == null) return false
  if (Number(ignoredSinceLastAccepted) <= 0) return false
  return now - Number(lastAcceptedAtMs) >= window
}
