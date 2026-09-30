// Erros tipados do cliente Awin. As mensagens NUNCA carregam token, cabeçalho
// ou corpo cru da resposta — elas podem ir para log e para a tela.

export class AwinError extends Error {
  constructor(message, { code = 'awin_error', status = null } = {}) {
    super(message)
    this.name = 'AwinError'
    this.code = code
    this.status = status
  }
}

// 401/403: token recusado ou sem acesso à conta. A conta para de sincronizar
// até a cliente salvar um código novo.
export class AwinAuthError extends AwinError {
  constructor(status) {
    super('A Awin recusou o código de acesso', { code: 'awin_auth', status })
    this.name = 'AwinAuthError'
  }
}

// 429: limite de chamadas por token estourado. Reagenda, não invalida.
export class AwinRateLimitError extends AwinError {
  constructor(retryAfterMs = null) {
    super('A Awin pediu para esperar antes de novas consultas', { code: 'awin_rate_limited', status: 429 })
    this.name = 'AwinRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class AwinHttpError extends AwinError {
  constructor(status) {
    super(`A Awin respondeu com erro (${status})`, { code: 'awin_http', status })
    this.name = 'AwinHttpError'
  }
}

export class AwinTimeoutError extends AwinError {
  constructor() {
    super('A Awin demorou demais para responder', { code: 'awin_timeout' })
    this.name = 'AwinTimeoutError'
  }
}

export class AwinNetworkError extends AwinError {
  constructor() {
    super('Não foi possível falar com a Awin', { code: 'awin_network' })
    this.name = 'AwinNetworkError'
  }
}

export class AwinResponseError extends AwinError {
  constructor() {
    super('A Awin respondeu num formato inesperado', { code: 'awin_bad_response' })
    this.name = 'AwinResponseError'
  }
}
