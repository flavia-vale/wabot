import { CREDENTIAL_RULES_VERSION } from './workerMetadata.js'

export function classifyWorkerHealth(metrics, expectedCredentialRulesVersion = CREDENTIAL_RULES_VERSION) {
  const worker = metrics?.worker
  const actualCredentialRulesVersion = worker?.credentialRulesVersion ?? null

  if (!metrics) {
    return {
      status: 'unknown',
      reason: 'metrics_unavailable',
      expectedCredentialRulesVersion,
      actualCredentialRulesVersion: null,
      restartRecommended: false,
    }
  }

  if (!worker || typeof worker !== 'object') {
    return {
      status: 'stale',
      reason: 'worker_metadata_missing',
      expectedCredentialRulesVersion,
      actualCredentialRulesVersion: null,
      restartRecommended: true,
    }
  }

  if (actualCredentialRulesVersion !== expectedCredentialRulesVersion) {
    return {
      status: 'stale',
      reason: 'credential_rules_version_mismatch',
      expectedCredentialRulesVersion,
      actualCredentialRulesVersion,
      restartRecommended: true,
    }
  }

  return {
    status: 'ok',
    reason: null,
    expectedCredentialRulesVersion,
    actualCredentialRulesVersion,
    restartRecommended: false,
  }
}
