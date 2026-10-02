// Trava do `pm2 save` e lista de apps que NÃO podem sumir — decisão pura.
//
// RCA 2026-10-01 (docs/rca/deploy-e-infra.md, "pm2 sumiu"): o serviço do pm2
// foi reiniciado (pm2 kill) e, 20 s depois, o deploy de STAGING rodou um
// `pm2 save` cru com o pm2 vazio. O dump perdeu `bot-supervisor` e `dashboard`
// de PRODUÇÃO e o pm2 voltou sem eles: todos os robôs parados, sem alarme.
// Produção e staging dividem o MESMO daemon pm2, então qualquer `pm2 save`
// grava os dois ambientes de uma vez.
//
// Regras (na dúvida, NÃO salva — salvar um estado quebrado é pior que não salvar):
//   1. pm2 vazio nunca é salvo.
//   2. Um app de produção que existia no dump não pode sumir dele.
//   3. Um app de produção presente precisa estar online (ou subindo).
//   4. Remover um app de propósito exige nomeá-lo em PM2_SAVE_ALLOW_REMOVE.

export const PRODUCTION_APPS = Object.freeze(['api', 'dashboard', 'bot-supervisor'])
const ALIVE = new Set(['online', 'launching'])

const splitNames = v => String(v ?? '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean)

/** `pm2 jlist` (string ou array) → [{ name, status }]. Lixo vira lista vazia. */
export function parsePm2List(raw) {
  let list = raw
  if (typeof raw === 'string') { try { list = JSON.parse(raw) } catch { return [] } }
  if (!Array.isArray(list)) return []
  return list
    .filter(p => p && typeof p.name === 'string')
    .map(p => ({ name: p.name, status: String(p.pm2_env?.status ?? p.status ?? 'unknown') }))
}

/** Conteúdo do dump.pm2 → nomes. Dump ilegível = null (não "vazio"). */
export function parseDumpNames(raw) {
  if (raw === null || raw === undefined) return null
  let list = raw
  if (typeof raw === 'string') { try { list = JSON.parse(raw) } catch { return null } }
  if (!Array.isArray(list)) return null
  return [...new Set(list.map(p => p?.name).filter(n => typeof n === 'string'))]
}

/**
 * @returns {{ ok: boolean, reasons: string[], removed: string[] }}
 */
export function decidePm2Save({ current = [], dumpNames = null, allowRemove = [], productionApps = PRODUCTION_APPS } = {}) {
  const reasons = []
  const allow = new Set(Array.isArray(allowRemove) ? allowRemove : splitNames(allowRemove))
  const byName = new Map(current.map(p => [p.name, p]))
  const prod = new Set(productionApps)

  if (current.length === 0) reasons.push('o pm2 está vazio — salvar agora apagaria todos os apps do dump')

  const removed = (dumpNames ?? []).filter(n => !byName.has(n) && !allow.has(n))
  for (const n of removed.filter(n => prod.has(n))) {
    reasons.push(`"${n}" (produção) está no dump mas não existe no pm2 — salvar faria ele não voltar num reinício`)
  }
  for (const n of productionApps) {
    const p = byName.get(n)
    if (p && !ALIVE.has(p.status)) reasons.push(`"${n}" (produção) está "${p.status}", não online`)
  }
  return { ok: reasons.length === 0, reasons, removed }
}

/**
 * Apps que o vigia exige presentes. Override: VIGIA_EXPECTED_APPS="a,b".
 * Sem override: api + dashboard, e bot-supervisor só em modo remote (em inline
 * quem forka os robôs é a api). Host de staging (APP_ENV=staging) não exige
 * os de produção.
 */
export function resolveExpectedApps(env = process.env) {
  if (env.VIGIA_EXPECTED_APPS !== undefined && String(env.VIGIA_EXPECTED_APPS).trim() !== '') return splitNames(env.VIGIA_EXPECTED_APPS)
  if (String(env.APP_ENV ?? '').toLowerCase() === 'staging') return ['api-staging', 'visual-staging']
  const remote = String(env.BOT_SUPERVISOR_MODE ?? '').toLowerCase() === 'remote'
  return remote ? [...PRODUCTION_APPS] : ['api', 'dashboard']
}

/** Quais dos esperados não estão no pm2 (ausentes, não "parados"). */
export function missingApps(current = [], expected = []) {
  const names = new Set(current.map(p => p.name))
  return expected.filter(n => !names.has(n))
}
