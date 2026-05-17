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
