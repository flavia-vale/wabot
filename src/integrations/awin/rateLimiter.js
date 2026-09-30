// Limitador de chamadas por token Awin (janela deslizante de 60s).
//
// A Awin limita a 20 chamadas/min POR USUÁRIO (= por token), não por conta:
// https://help.awin.com/apidocs/introduction-1 ("Limitations"). Usamos 15/min
// por padrão para deixar folga (o mesmo token pode estar em uso fora daqui).
//
// A chave é a impressão digital do token (HMAC), nunca o token. Memória:
// até `maxPerMinute` timestamps por token ativo; chaves vazias são apagadas.

const WINDOW_MS = 60_000

export function createTokenRateLimiter({
  maxPerMinute = 15,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const windows = new Map()
  // Uma fila por chave: chamadas do mesmo token saem uma de cada vez, na ordem.
  const tails = new Map()

  function prune(key, at) {
    const list = (windows.get(key) || []).filter((t) => at - t < WINDOW_MS)
    if (list.length) windows.set(key, list)
    else windows.delete(key)
    return list
  }

  async function reserve(key) {
    for (;;) {
      const at = now()
      const list = prune(key, at)
      if (list.length < maxPerMinute) {
        list.push(at)
        windows.set(key, list)
        return
      }
      await sleep(Math.max(1, list[0] + WINDOW_MS - at))
    }
  }

  function acquire(key) {
    const previous = tails.get(key) || Promise.resolve()
    const next = previous.then(() => reserve(key))
    const tail = next.catch(() => {})
    tails.set(key, tail)
    tail.then(() => { if (tails.get(key) === tail) tails.delete(key) })
    return next
  }

  // Sem espera: reserva uma vaga agora ou devolve false. Para quem tem plano
  // B imediato (conversão no espelhamento cai para o link longo em vez de
  // segurar a oferta até a janela abrir).
  function tryAcquire(key) {
    if (tails.has(key)) return false
    const at = now()
    const list = prune(key, at)
    if (list.length >= maxPerMinute) return false
    list.push(at)
    windows.set(key, list)
    return true
  }

  return { acquire, tryAcquire, size: () => windows.size }
}
