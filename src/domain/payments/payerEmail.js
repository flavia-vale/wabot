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

// Qual e-mail vai como `payer_email` na assinatura recorrente.
//
// O checkout de assinatura do Mercado Pago exige que a pessoa entre no Mercado
// Pago com o MESMO e-mail enviado em `payer_email`. Mandávamos sempre o e-mail
// da conta daqui — e quem usa outro e-mail no Mercado Pago ficava sem saída
// (a única opção era trocar o e-mail de LOGIN da conta). Agora a cliente pode
// informar o e-mail que usa no Mercado Pago só para a cobrança; a conta daqui
// não muda. O vínculo com a conta é o `external_reference` (userId), nunca o
// e-mail, então o aviso do pagamento continua achando a cliente certa.
//
// Devolve `{ email, source, issue }`: `source` é 'informed' ou 'account';
// `issue` segue o formato de `classifyPayerEmail` (null quando aceitável).
export function resolveSubscriptionPayerEmail({ accountEmail, informedEmail } = {}) {
  const informed = typeof informedEmail === 'string' ? informedEmail.trim() : ''
  if (informed) {
    const issue = classifyPayerEmail(informed)
    return {
      email: informed,
      source: 'informed',
      issue: issue
        ? { reason: issue.reason, message: 'O e-mail do Mercado Pago que você informou não parece válido. Confira e tente de novo.' }
        : null,
    }
  }
  const account = typeof accountEmail === 'string' ? accountEmail.trim() : ''
  return { email: account || null, source: 'account', issue: classifyPayerEmail(account) }
}

// O checkout em aberto só pode ser reaproveitado se foi criado para o MESMO
// e-mail: devolver a pessoa ao link com o e-mail antigo recriaria exatamente o
// bloqueio que ela está tentando contornar. Sem e-mail confiável do lado do
// Mercado Pago, NÃO reaproveita (cria um checkout novo, que é o caminho seguro).
export function samePayerEmail(a, b) {
  const x = typeof a === 'string' ? a.trim().toLowerCase() : ''
  const y = typeof b === 'string' ? b.trim().toLowerCase() : ''
  return Boolean(x) && x === y
}
