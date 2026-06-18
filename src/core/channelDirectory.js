function normalizeJid(jid) {
  if (typeof jid !== 'string') return ''
  return jid.replace(/:\d+(?=@)/, '')
}

// O nome do canal vem em formatos diferentes conforme a versão do Baileys e a
// origem (jid vs invite): pode ser string direta (`name`), objeto `{ text }`,
// ou aninhado em `thread_metadata.name.text`. Lê tolerante a todos. Sem isso a
// lista de "Canais que sigo" aparece toda como "Canal sem nome".
function pickChannelName(meta) {
  const fromField = (v) => {
    if (typeof v === 'string') return v.trim()
    if (v && typeof v === 'object' && typeof v.text === 'string') return v.text.trim()
    return ''
  }
  return (
    fromField(meta?.name) ||
    fromField(meta?.thread_metadata?.name) ||
    fromField(meta?.threadMetadata?.name) ||
    ''
  )
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
    name: pickChannelName(meta),
    owner,
    isViewerOwner,
    picture: meta.picture?.url ?? null,
  }
}

async function mapParallel(items, concurrency, fn) {
  const result = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      try { result[i] = await fn(items[i]) } catch { result[i] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return result
}

export async function listFollowedChannels({ sock, followedSet, concurrency = 5 }) {
  if (!followedSet || followedSet.size === 0) return []
  const jids = [...followedSet]
  const items = await mapParallel(jids, concurrency, async (jid) => {
    return getChannelMetadata({ sock, jid })
  })
  return items.filter(Boolean)
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
