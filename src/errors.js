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
  // `failure reason=405`: o WhatsApp recusou o login/registro porque a versão
  // do aplicativo que anunciamos foi cortada pelo servidor (RCA 2026-07-28).
  // Não é problema do número da cliente e não adianta ela tentar de novo em
  // seguida — por isso a mensagem diz o que está acontecendo de verdade em vez
  // do genérico "falha ao solicitar código", que mandava a cliente re-parear
  // repetidamente sem chance nenhuma de sucesso.
  WA_VERSION_REJECTED: {
    message: 'O WhatsApp recusou a conexão porque a versão do aplicativo que usamos ficou desatualizada. Não é problema do seu número. Já estamos atualizando — tente de novo mais tarde.',
    retryable: true,
    statusCode: 503,
  },
}

export function mapInfraError(err) {
  if (err instanceof AppError) return err

  const raw = String(err?.message || '')
  const msg = raw.toLowerCase()

  if (msg.includes('timeout ao solicitar código de pareamento')) {
    return new AppError('WA_PAIRING_TIMEOUT', DOMAIN_ERRORS.WA_PAIRING_TIMEOUT.message, { ...DOMAIN_ERRORS.WA_PAIRING_TIMEOUT, cause: err })
  }
  // Precede as demais regras: o worker devolve o 405 embutido na mensagem de
  // close ("... (code=405)"), e ele tem causa e texto próprios.
  if (msg.includes('code=405') || msg.includes('(405)')) {
    return new AppError('WA_VERSION_REJECTED', DOMAIN_ERRORS.WA_VERSION_REJECTED.message, { ...DOMAIN_ERRORS.WA_VERSION_REJECTED, cause: err })
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
