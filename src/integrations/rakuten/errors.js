// Erros tipados do cliente Rakuten. As mensagens NUNCA carregam o segredo,
// o token de acesso, cabeçalho ou corpo cru da resposta — elas podem ir para
// log e para a tela. Mesmo desenho de src/integrations/awin/errors.js.

export class RakutenError extends Error {
  constructor(message, { code = 'rakuten_error', status = null } = {}) {
    super(message)
    this.name = 'RakutenError'
    this.code = code
    this.status = status
  }
}

// Pedido de token recusado (medido em 2026-09-30: SID errado → 401 e
// segredo errado → 400, os dois com `invalid_client`). A conta para de
// sincronizar até a cliente salvar dados novos.
export class RakutenAuthError extends RakutenError {
  constructor(status) {
    super('A Rakuten recusou os dados de acesso', { code: 'rakuten_auth', status })
    this.name = 'RakutenAuthError'
  }
}

// 401/403 num pedido de DADOS mesmo com token recém-emitido. Pode ser soluço
// da Rakuten ou falta de acesso àquele recurso: passageiro. A sync só marca a
// conta como recusada depois de 3 seguidos (revisão 2026-10-03, R2).
export class RakutenAccessDeniedError extends RakutenError {
  constructor(status) {
    super('A Rakuten recusou o acesso a esses dados agora', { code: 'rakuten_access_denied', status })
    this.name = 'RakutenAccessDeniedError'
  }
}

// 429: limite de chamadas estourado (100/min por conta, cabeçalho
// x-ratelimit-limit-minute medido em 2026-09-30). Reagenda, não invalida.
export class RakutenRateLimitError extends RakutenError {
  constructor(retryAfterMs = null) {
    super('A Rakuten pediu para esperar antes de novas consultas', { code: 'rakuten_rate_limited', status: 429 })
    this.name = 'RakutenRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class RakutenHttpError extends RakutenError {
  constructor(status) {
    super(`A Rakuten respondeu com erro (${status})`, { code: 'rakuten_http', status })
    this.name = 'RakutenHttpError'
  }
}

export class RakutenTimeoutError extends RakutenError {
  constructor() {
    super('A Rakuten demorou demais para responder', { code: 'rakuten_timeout' })
    this.name = 'RakutenTimeoutError'
  }
}

export class RakutenNetworkError extends RakutenError {
  constructor() {
    super('Não foi possível falar com a Rakuten', { code: 'rakuten_network' })
    this.name = 'RakutenNetworkError'
  }
}

export class RakutenResponseError extends RakutenError {
  constructor() {
    super('A Rakuten respondeu num formato inesperado', { code: 'rakuten_bad_response' })
    this.name = 'RakutenResponseError'
  }
}
