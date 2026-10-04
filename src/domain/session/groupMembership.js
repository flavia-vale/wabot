// Linhas de pertença (em quais grupos um número está) a partir do
// `groupFetchAllParticipating` do Baileys — vários números, Fase 2
// (docs/rca/multi-numero.md). Puro: sem banco, sem socket.

function userPart(jid) {
  // '5511999:12@s.whatsapp.net' → '5511999'; '123@lid' → '123'
  return String(jid ?? '').split('@')[0].split(':')[0]
}

// `selfIds`: identidades da própria conta (jid do número e `@lid`).
export function buildMembershipRows({ groups = {}, selfIds = [] } = {}) {
  const self = new Set(selfIds.filter(Boolean).map(userPart).filter(Boolean))
  const rows = []
  for (const [waJid, meta] of Object.entries(groups || {})) {
    if (!waJid.endsWith('@g.us')) continue
    const me = Array.isArray(meta?.participants)
      ? meta.participants.find(p => self.has(userPart(p?.id)) || self.has(userPart(p?.lid)) || self.has(userPart(p?.phoneNumber)))
      : null
    rows.push({
      waJid,
      name: meta?.subject ? String(meta.subject).slice(0, 200) : null,
      isAdmin: me?.admin === 'admin' || me?.admin === 'superadmin',
    })
  }
  return rows
}

// Destinos (grupos) em que o número NÃO está. `memberJids` vem da tabela.
export function missingDestinations({ destinations = [], memberJids = [] } = {}) {
  const present = new Set(memberJids)
  return destinations.filter(d => !present.has(d.waJid))
}

// ---------------------------------------------------------------------------
// Origens (Fase 2.1): depois da troca, o robô só recebe dos grupos em que o
// número está e dos canais que ele segue. Origem fora do número = para de
// espelhar em silêncio (o robô fica `quiet`, não `blind`).
// ---------------------------------------------------------------------------

// `viewer_metadata.role` do `newsletterMetadata`: quem segue é SUBSCRIBER;
// dono/admin também recebe. GUEST = não segue.
const CHANNEL_FOLLOWING_ROLES = new Set(['SUBSCRIBER', 'ADMIN', 'OWNER'])

// 'ok' | 'missing' | 'unknown' (sem resposta do WhatsApp).
export function channelFollowState(viewerRole) {
  if (!viewerRole) return 'unknown'
  return CHANNEL_FOLLOWING_ROLES.has(String(viewerRole).toUpperCase()) ? 'ok' : 'missing'
}

export function isWhatsAppSourceJid(waJid) {
  const jid = String(waJid ?? '')
  return jid.endsWith('@g.us') || jid.endsWith('@newsletter')
}

// `sources`: origens da conta ({ waJid, name }); Telegram (`tg:`) fica de fora.
// `memberJids`: grupos do número (WaGroupMembership). `channelStates`: jid →
// 'ok' | 'missing' | 'unknown'; canal sem estado = 'unknown'.
export function sourceCoverage({ sources = [], memberJids = [], channelStates = {} } = {}) {
  const present = new Set(memberJids)
  const seen = new Set()
  const list = sources.filter(s => isWhatsAppSourceJid(s?.waJid) && !seen.has(s.waJid) && seen.add(s.waJid))
  const missingGroups = []
  const missingChannels = []
  const unknownChannels = []
  for (const s of list) {
    const item = { waJid: s.waJid, name: s.name ?? null }
    if (s.waJid.endsWith('@g.us')) {
      if (!present.has(s.waJid)) missingGroups.push(item)
      continue
    }
    const state = channelStates[s.waJid] ?? 'unknown'
    if (state === 'missing') missingChannels.push(item)
    else if (state === 'unknown') unknownChannels.push(item)
  }
  const ok = list.length - missingGroups.length - missingChannels.length - unknownChannels.length
  return { total: list.length, ok, missingGroups, missingChannels, unknownChannels }
}
