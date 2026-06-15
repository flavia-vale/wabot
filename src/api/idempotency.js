// Idempotency key opcional para operações de envio. Um retry de rede do
// cliente (timeout, reconexão) pode reenviar o MESMO broadcast e duplicar o
// fan-out inteiro para N grupos. Quando o cliente manda uma chave (header
// Idempotency-Key ou campo idempotencyKey no body), a primeira resposta é
// cacheada por (userId, key) e devolvida em retries dentro da janela TTL,
// sem reexecutar o envio.
//
// In-memory cobre a instância única atual; ao escalar para múltiplas APIs,
// mover para Redis (SET NX EX).

const TTL_MS = Math.max(60_000, Number(process.env.IDEMPOTENCY_TTL_MS || 10 * 60_000))
const MAX_ENTRIES = Math.max(100, Number(process.env.IDEMPOTENCY_MAX_ENTRIES || 5_000))

const store = new Map() // `${userId}:${key}` -> { expiresAt, status: 'pending'|'done', result }

export function extractIdempotencyKey(req) {
  const header = req.headers?.['idempotency-key']
  const body = req.body?.idempotencyKey
  const raw = (typeof header === 'string' && header) || (typeof body === 'string' && body) || ''
  const trimmed = raw.trim()
  if (!trimmed) return null
  // limita tamanho para não virar vetor de memória
  return trimmed.slice(0, 200)
}

function prune(now) {
  if (store.size <= MAX_ENTRIES) return
  for (const [k, entry] of store) {
    if (entry.expiresAt <= now) store.delete(k)
    if (store.size <= MAX_ENTRIES) break
  }
}

// Reserva atômica da chave. Retorna:
//  - { fresh: true, commit, release } quando é a primeira vez (executar e commitar)
//  - { replay: true, result } quando já houve resposta com a mesma chave
//  - { inFlight: true } quando há outra requisição com a mesma chave em curso
export function beginIdempotent(userId, key, now = Date.now()) {
  if (!key) return { fresh: true, commit: () => {}, release: () => {} }
  const mapKey = `${userId}:${key}`
  const existing = store.get(mapKey)
  if (existing && existing.expiresAt > now) {
    if (existing.status === 'done') return { replay: true, result: existing.result }
    return { inFlight: true }
  }
  prune(now)
  store.set(mapKey, { expiresAt: now + TTL_MS, status: 'pending', result: null })
  return {
    fresh: true,
    commit: (result) => {
      store.set(mapKey, { expiresAt: now + TTL_MS, status: 'done', result })
    },
    // libera o slot se a operação falhar, permitindo um novo retry honesto
    release: () => { store.delete(mapKey) },
  }
}

export function startIdempotencyCleanup(intervalMs = TTL_MS) {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [k, entry] of store) if (entry.expiresAt <= now) store.delete(k)
  }, intervalMs)
  timer.unref?.()
  return timer
}

export function _resetIdempotency() {
  store.clear()
}

startIdempotencyCleanup()
