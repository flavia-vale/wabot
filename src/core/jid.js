const GROUP_SUFFIX = '@g.us'
const CHANNEL_SUFFIX = '@newsletter'

export const JID_KIND = Object.freeze({
  GROUP: 'group',
  CHANNEL: 'channel',
})

export function detectKind(jid) {
  if (typeof jid !== 'string') return null
  if (jid.endsWith(GROUP_SUFFIX)) return JID_KIND.GROUP
  if (jid.endsWith(CHANNEL_SUFFIX)) return JID_KIND.CHANNEL
  return null
}

export function isMirrorableJid(jid) {
  return detectKind(jid) !== null
}

export function ensureJid(raw, defaultKind = JID_KIND.GROUP) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (value.includes('@')) return value
  if (defaultKind === JID_KIND.GROUP) return `${value}${GROUP_SUFFIX}`
  if (defaultKind === JID_KIND.CHANNEL) return `${value}${CHANNEL_SUFFIX}`
  return null
}

const CHANNEL_INVITE_RE = /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]{8,})(?:[/?#].*)?$/i

export function parseChannelInviteUrl(url) {
  if (typeof url !== 'string') return null
  const match = url.trim().match(CHANNEL_INVITE_RE)
  return match ? match[1] : null
}
