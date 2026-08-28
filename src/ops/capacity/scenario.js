import { CAPACITY_POLICY_VERSION } from './policy.js'
const ALLOWED_FIELDS = new Set(['newCustomers', 'horizonMonths', 'activationPercent', 'stagingExpectedOn'])
function invalid(message) { const error = new TypeError(message); error.code = 'INVALID_CAPACITY_SCENARIO'; return error }
export function validateCapacityScenarioInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Informe os dados do cenário.')
  const unknown = Object.keys(input).filter((key) => !ALLOWED_FIELDS.has(key)); if (unknown.length) throw invalid(`Campo não reconhecido: ${unknown[0]}.`)
  const newCustomers = Number(input.newCustomers); const horizonMonths = Number(input.horizonMonths); const activationPercent = Number(input.activationPercent)
  if (!Number.isInteger(newCustomers)) throw invalid('Novos clientes deve ser um número inteiro.')
  if (newCustomers < 0 || newCustomers > 10_000) throw invalid('Novos clientes deve ficar entre 0 e 10.000.')
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 36) throw invalid('Horizonte deve ser um inteiro entre 1 e 36 meses.')
  if (!Number.isFinite(activationPercent) || activationPercent < 0 || activationPercent > 100) throw invalid('Percentual de ativação deve ficar entre 0 e 100.')
  if (input.stagingExpectedOn != null && typeof input.stagingExpectedOn !== 'boolean') throw invalid('Staging esperado deve ser verdadeiro ou falso.')
  return { newCustomers, horizonMonths, activationPercent, stagingExpectedOn: input.stagingExpectedOn === true }
}
export function calculateCapacityScenario(input, baseline = {}) {
  const valid = validateCapacityScenarioInput(input); const currentSessions = Math.max(0, Math.trunc(Number(baseline.currentSessions) || 0)); const safeLimit = Math.max(0, Math.trunc(Number(baseline.safeLimit) || 0)); const sessionCostMb = Math.max(350, Math.ceil(Number(baseline.sessionCostMb) || 350))
  const activatedSessions = Math.ceil(valid.newCustomers * valid.activationPercent / 100); const stagingMemoryMb = valid.stagingExpectedOn && !baseline.stagingCurrentlyOn ? Math.max(0, Math.ceil(Number(baseline.stagingMemoryMb) || 0)) : 0; const effectiveSafeLimit = Math.max(0, safeLimit - Math.ceil(stagingMemoryMb / sessionCostMb)); const projectedSessions = currentSessions + activatedSessions; const headroomSessions = effectiveSafeLimit - projectedSessions; const deficitSessions = Math.max(0, -headroomSessions); const calculatedAt = baseline.calculatedAt ? new Date(baseline.calculatedAt) : new Date()
  return { input: valid, activatedSessions, projectedSessions, effectiveSafeLimit, headroomSessions, deficitSessions, incrementalMemoryMb: activatedSessions * sessionCostMb + stagingMemoryMb, bottleneck: baseline.bottleneck || 'memory', recommendedBy: deficitSessions > 0 ? calculatedAt.toISOString() : null, recommendation: deficitSessions > 0 ? `Planeje capacidade para pelo menos ${deficitSessions} sessões além do limite seguro antes de iniciar o crescimento.` : `O cenário mantém ${headroomSessions} sessões de margem segura.`, assumptions: [`${valid.activationPercent}% dos novos clientes terão sessão ativa.`, `Cada sessão adicional foi orçada em ${sessionCostMb} MB.`, valid.stagingExpectedOn ? `Staging permanecerá ligado${stagingMemoryMb ? ` e reservará ${stagingMemoryMb} MB` : ''}.` : 'Staging não foi incluído no cenário.'], policyVersion: baseline.policyVersion || CAPACITY_POLICY_VERSION }
}
