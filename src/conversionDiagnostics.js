import { describeMissingCredentials } from './credentialHealth.js'
import { describeSheinConversionError, SHEIN_CONVERSION_ERROR } from './converters/shein.js'
import { describeAliExpressConversionError, ALIEXPRESS_CONVERSION_ERROR } from './converters/aliexpress.js'

const SHEIN_CODES = new Set(Object.values(SHEIN_CONVERSION_ERROR))
const ALIEXPRESS_CODES = new Set(Object.values(ALIEXPRESS_CONVERSION_ERROR))

// Seam puro entre validação/conversor e persistência. Só devolve texto/código
// estáveis; URLs e segredos continuam responsabilidade dos campos preexistentes
// e nunca entram nos novos campos de diagnóstico.
export function buildConversionIssue({ platform, credentialValidation, error = null }) {
  if (!credentialValidation?.configured) {
    return {
      reason: describeMissingCredentials(credentialValidation),
      errorMsg: null,
      kind: 'missing_credentials',
    }
  }
  if (platform === 'shein' && SHEIN_CODES.has(error?.code)) {
    return {
      reason: describeSheinConversionError(error.code),
      errorMsg: `error:conversion:${error.code}`,
      kind: 'classified_conversion',
    }
  }
  if (platform === 'aliexpress' && ALIEXPRESS_CODES.has(error?.code)) {
    return {
      reason: describeAliExpressConversionError(error.code),
      errorMsg: `error:conversion:${error.code}`,
      kind: 'classified_conversion',
    }
  }
  return null
}

export async function persistConversionIssue(input, recordIssue) {
  const issue = buildConversionIssue(input)
  if (!issue) return false
  await recordIssue(issue)
  return true
}
