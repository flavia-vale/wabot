function normalizeJid(jid) {
  if (typeof jid !== 'string') return ''
  return jid.replace(/:\d+(?=@)/, '')
}

export async function getChannelMetadata({ sock, jid, inviteCode }) {
  if (!jid && !inviteCode) throw new Error('getChannelMetadata: jid ou inviteCode obrigatório')
  if (!sock?.newsletterMetadata) throw new Error('getChannelMetadata: sock.newsletterMetadata indisponível')

  const meta = jid
    ? await sock.newsletterMetadata('jid', jid)
    : await sock.newsletterMetadata('invite', inviteCode)

  if (!meta) return null

  const owner = meta.owner ?? null
  const viewerId = normalizeJid(sock?.user?.id)
  const ownerNorm = normalizeJid(owner)
  const isViewerOwner = Boolean(owner && viewerId && ownerNorm === viewerId)

  return {
    jid: meta.id,
    name: meta.name ?? '',
    owner,
    isViewerOwner,
    picture: meta.picture?.url ?? null,
  }
}

// Follow imediato idempotente. Reusa contratos de followedSet/inFlight da Fase 2.
// Retorna:
//  - { followed: 'already' } se já estava em followedSet
//  - { followed: 'in-flight' } se outra invocação já está processando
//  - { followed: 'new', duration } após follow+subscribe ok
export async function followChannel({ sock, jid, followedSet, inFlight, logger }) {
  if (!sock?.newsletterFollow) throw new Error('followChannel: sock.newsletterFollow indisponível')
  if (!jid) throw new Error('followChannel: jid obrigatório')
  if (followedSet?.has(jid)) return { followed: 'already' }
  if (inFlight?.has(jid)) return { followed: 'in-flight' }

  inFlight?.add(jid)
  try {
    await sock.newsletterFollow(jid)
    let duration = null
    try {
      const sub = await sock.subscribeNewsletterUpdates?.(jid)
      duration = sub?.duration ?? null
    } catch (err) {
      logger?.warn?.({ jid, err: err?.message }, 'followChannel: subscribe falhou; follow ok')
    }
    followedSet?.add(jid)
    return { followed: 'new', duration }
  } finally {
    inFlight?.delete(jid)
  }
}
