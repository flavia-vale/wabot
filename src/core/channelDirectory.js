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

export async function listFollowedChannels({
  sock,
  followedSet,
  concurrency = 8,
  // Deadline global folgado abaixo dos 20s do timeout do comando do supervisor
  // (channel:listFollowed). Se houver muitos canais ou o newsletterMetadata
  // estiver lento, retornamos resultado PARCIAL em vez de estourar o comando.
  budgetMs = 12_000,
  // Timeout por canal: um newsletterMetadata travado não pode prender o worker.
  perCallTimeoutMs = 3_000,
} = {}) {
  if (!followedSet || followedSet.size === 0) return []
  const jids = [...followedSet]
  const deadline = Date.now() + budgetMs
  const result = []
  let next = 0
  async function worker() {
    while (next < jids.length && Date.now() < deadline) {
      const jid = jids[next++]
      const meta = await withTimeout(
        getChannelMetadata({ sock, jid }).catch(() => null),
        perCallTimeoutMs,
      )
      if (meta) result.push(meta)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jids.length) }, worker))
  return result
}

// Resolve `null` se a promise não terminar em `ms` — usado para não deixar um
// newsletterMetadata travado prender a listagem inteira.
function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms) })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
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
