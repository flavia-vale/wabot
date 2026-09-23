// E-mails que dão acesso de DONA ao admin só por estarem na conta
// (`resolveAdminAccess` em src/api/routes/admin.js). Fonte ÚNICA da lista.
//
// RCA 2026-09-23: como o papel sai do e-mail e o e-mail não é confirmado,
// quem cadastrasse (ou trocasse o e-mail da própria conta para) um destes
// endereços virava dona do painel inteiro — financeiro, liberação de acesso,
// disparo de e-mail em massa. Por isso eles ficam RESERVADOS: nenhum caminho de
// autoatendimento (cadastro, troca de e-mail) pode gravá-los. Conta que já tem
// um deles continua funcionando como antes.
export const DEFAULT_OWNER_ADMIN_EMAILS = Object.freeze([
  'flavia.vale@usp.br',
  'flaviaroberta.1496@gmail.com',
  'tacianeaas02@gmail.com',
])

function normalize(email) {
  return String(email ?? '').trim().toLowerCase()
}

export function reservedAdminEmails(env = process.env) {
  return new Set(
    [...DEFAULT_OWNER_ADMIN_EMAILS, ...String(env.ADMIN_EMAILS ?? '').split(',')]
      .map(normalize)
      .filter(Boolean),
  )
}

export function isReservedAdminEmail(email, env = process.env) {
  const value = normalize(email)
  return Boolean(value) && reservedAdminEmails(env).has(value)
}
