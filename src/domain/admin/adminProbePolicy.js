// Rajada de negativas nas rotas do admin — decisão PURA (sem banco, sem rede).
//
// Medido em produção (2026-10-02, Q10 da auditoria): uma conta trial recém-
// criada fez 80 chamadas a /api/admin/* por `curl` em 6 minutos. Todas tomaram
// 403 e ficaram na auditoria, mas nada avisou ninguém e o limite de requisições
// é só global por IP. Este módulo conta negativas POR CONTA numa janela curta:
// passou do teto, a resposta vira 429 e a dona recebe um aviso (uma vez por
// conta a cada 24 h — o cooldown mora em sendAdminAlert).
//
// Memória: um Map com no máximo PROBE_MAX_TRACKED contas, cada uma com até
// `threshold` horários. Ordem de poucos KB. Sinalizado na auditoria.

export const PROBE_WINDOW_MS = 10 * 60 * 1000
export const PROBE_THRESHOLD = 20
export const PROBE_MAX_TRACKED = 500
export const PROBE_ALERT_SLUG = 'admin_sondagem_admin'

export function createProbeTracker({ windowMs = PROBE_WINDOW_MS, threshold = PROBE_THRESHOLD, maxTracked = PROBE_MAX_TRACKED } = {}) {
  const byKey = new Map()

  function prune(list, nowMs) {
    while (list.length && nowMs - list[0] > windowMs) list.shift()
  }

  return {
    get size() { return byKey.size },
    /**
     * Registra uma negativa e diz se a conta está em rajada.
     * `justCrossed` é verdadeiro só na chamada que atinge o teto — é o momento
     * de avisar; `burst` fica verdadeiro enquanto a janela não esvaziar.
     */
    recordDenial({ key, now = new Date() } = {}) {
      const nowMs = now instanceof Date ? now.getTime() : Number(now)
      if (!key) return { count: 0, burst: false, justCrossed: false }
      let list = byKey.get(key)
      if (!list) {
        if (byKey.size >= maxTracked) byKey.delete(byKey.keys().next().value)
        list = []
        byKey.set(key, list)
      }
      prune(list, nowMs)
      if (list.length < threshold) list.push(nowMs)
      // Reinsere no fim para que a poda por tamanho tire sempre a conta mais parada.
      byKey.delete(key); byKey.set(key, list)
      const count = list.length
      const burst = count >= threshold
      return { count, burst, justCrossed: burst && count === threshold && list[threshold - 1] === nowMs }
    },
  }
}

export function buildProbeAlertVars({ email, userId, count, windowMs = PROBE_WINDOW_MS, ip, dashboardUrl = '' } = {}) {
  const minutos = Math.max(1, Math.round(windowMs / 60_000))
  return {
    resumo: `${email || userId || 'uma conta'} tentou ${count} vezes rotas internas do admin em ${minutos} minutos`,
    conta: email || userId || 'desconhecida',
    ip: ip || 'não registrado',
    link_clientes: `${dashboardUrl}/admin/clientes${email ? `?search=${encodeURIComponent(email)}` : ''}`,
  }
}
