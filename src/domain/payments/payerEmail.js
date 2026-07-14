// Política de validação do e-mail do pagador para assinatura recorrente
// (preapproval do Mercado Pago). Módulo PURO/testável: NÃO importa db/analytics.
// Consumido por src/api/routes/payments.js.
//
// Contexto (RCA do 502 "Mercado Pago", 2026-07): o `/preapproval` do MP usa o
// e-mail da conta do usuário como `payer_email`. Se o e-mail não for aceito
// pelo MP, ele recusa a criação — às vezes com um `500 {"message":"Internal
// server error"}` cru (foi o caso do e-mail fictício `aaaa@gmail.com`) —, e a
// rota transformava isso num 502 opaco sem registrar o motivo real. Aqui
// detectamos ANTES da chamada os casos localmente óbvios (ausente, fallback
// `@sistema.com`, formato inválido) para devolver um erro claro e oferecer a
// troca de e-mail no painel. Um e-mail real e bem-formado (ex.:
// `flavia.vale@usp.br`) passa e o MP responde 201 normalmente.

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Domínio do e-mail gerado automaticamente no cadastro sem e-mail real
// (generateFallbackEmail em src/api/routes/auth.js → `user_<hex>@sistema.com`).
const FALLBACK_EMAIL_DOMAIN = '@sistema.com'

export function isFallbackPayerEmail(email) {
  return typeof email === 'string' && email.trim().toLowerCase().endsWith(FALLBACK_EMAIL_DOMAIN)
}

export function isValidPayerEmailFormat(email) {
  return typeof email === 'string' && EMAIL_FORMAT_RE.test(email.trim())
}

// Retorna `null` quando o e-mail é aceitável para tentar o preapproval, ou
// `{ reason, message }` quando dá para saber localmente que o MP recusaria.
export function classifyPayerEmail(email) {
  const value = typeof email === 'string' ? email.trim() : ''
  if (!value) {
    return {
      reason: 'missing',
      message: 'Sua conta não tem um e-mail cadastrado. Adicione um e-mail válido para assinar com renovação automática.',
    }
  }
  if (isFallbackPayerEmail(value)) {
    return {
      reason: 'fallback',
      message: 'Sua conta usa um e-mail gerado automaticamente, que o Mercado Pago não aceita. Cadastre um e-mail real para assinar com renovação automática.',
    }
  }
  if (!isValidPayerEmailFormat(value)) {
    return {
      reason: 'invalid_format',
      message: 'O e-mail da sua conta está em um formato inválido. Atualize para um e-mail válido para assinar com renovação automática.',
    }
  }
  return null
}
