export class AppError extends Error {
  constructor(code, message, { retryable = false, statusCode = 500, cause } = {}) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.retryable = retryable
    this.statusCode = statusCode
    this.cause = cause
  }
}

const DOMAIN_ERRORS = {
  WA_NOT_CONNECTED: { message: 'Bot não está conectado', retryable: true, statusCode: 409 },
  WA_PAIRING_TIMEOUT: { message: 'Tempo esgotado ao solicitar código de pareamento', retryable: true, statusCode: 504 },
  WA_SESSION_CLOSED: { message: 'Sessão do WhatsApp foi encerrada', retryable: true, statusCode: 409 },
  WA_PAIRING_UNAVAILABLE: { message: 'Pareamento indisponível no momento', retryable: true, statusCode: 503 },
  WA_PAIRING_FAILED: { message: 'Falha ao solicitar código de pareamento', retryable: false, statusCode: 500 },
}

export function mapInfraError(err) {
  if (err instanceof AppError) return err

  const raw = String(err?.message || '')
  const msg = raw.toLowerCase()

  if (msg.includes('timeout ao solicitar código de pareamento')) {
    return new AppError('WA_PAIRING_TIMEOUT', DOMAIN_ERRORS.WA_PAIRING_TIMEOUT.message, { ...DOMAIN_ERRORS.WA_PAIRING_TIMEOUT, cause: err })
  }
  if (msg.includes('bot não conectado') || msg.includes('bot não está rodando') || msg.includes('not connected')) {
    return new AppError('WA_NOT_CONNECTED', DOMAIN_ERRORS.WA_NOT_CONNECTED.message, { ...DOMAIN_ERRORS.WA_NOT_CONNECTED, cause: err })
  }
  if (msg.includes('connection closed') || msg.includes('stream errored') || msg.includes('session closed')) {
    return new AppError('WA_SESSION_CLOSED', DOMAIN_ERRORS.WA_SESSION_CLOSED.message, { ...DOMAIN_ERRORS.WA_SESSION_CLOSED, cause: err })
  }
  if (msg.includes('bot não disponível')) {
    return new AppError('WA_PAIRING_UNAVAILABLE', DOMAIN_ERRORS.WA_PAIRING_UNAVAILABLE.message, { ...DOMAIN_ERRORS.WA_PAIRING_UNAVAILABLE, cause: err })
  }

  return new AppError('WA_PAIRING_FAILED', DOMAIN_ERRORS.WA_PAIRING_FAILED.message, { ...DOMAIN_ERRORS.WA_PAIRING_FAILED, cause: err })
}
