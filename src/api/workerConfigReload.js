import { reloadConfig as _reloadConfig } from '../manager.js'

// `reloadConfig` é assíncrono no modo remote (comando via Redis até o
// supervisor) e devolve uma Promise. Sem `await`, a Promise ia crua para o
// logger e virava `configReloaded: {}` — parecia confirmação e não era: não
// dizia se o supervisor recebeu o comando nem se o worker invalidou o cache.
// Foi o que impediu de distinguir "job antigo ainda saindo" de "worker nem
// recarregou" no RCA 2026-08-26.
//
// Extraído de src/api/routes/groups.js (specs/017-client-coupon-catalog) para
// ser reusado por src/api/routes/coupons.js sem duplicar a lógica. Nenhum
// comportamento mudou: mesmo await, mesmo formato de retorno.
export async function reloadWorkerConfig(userId, opts = {}) {
  const reloadConfig = opts.reloadConfig ?? _reloadConfig
  try {
    return { ok: Boolean(await reloadConfig(userId)), error: null }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) }
  }
}
