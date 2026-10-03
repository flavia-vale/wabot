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
