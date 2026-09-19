/**
 * Contas de TESTE que ficam de fora das somas do Financeiro.
 *
 * Por que existe: a dona do produto mantém assinaturas de teste ligadas para
 * validar o funcionamento da cobrança recorrente (o ciclo de renovação só se
 * prova com uma assinatura de verdade rodando). Esse dinheiro NÃO entra no
 * caixa dela — contá-lo como receita infla MRR, LTV, receita 30d e, agora,
 * o ROI, que é justamente a conta que precisa ser honesta.
 *
 * Invariantes (não regredir):
 *
 * - A conta de teste continua VISÍVEL em toda lista e na aba de cobranças
 *   recorrentes: ela existe para ser observada. O que muda é só a soma.
 * - A decisão mora AQUI, no backend, nunca em cada tela — senão duas tabelas
 *   do admin passam a discordar sobre quanto entrou no mês.
 * - `FINANCE_TEST_ACCOUNT_EMAILS` SUBSTITUI a lista (não soma), para dar como
 *   desligar tudo (`FINANCE_TEST_ACCOUNT_EMAILS=`) quando a assinatura de
 *   teste virar cliente de verdade, sem precisar de deploy.
 *
 * Módulo PURO: sem banco, sem rede.
 */

/** Contas de teste conhecidas. Editar aqui exige deploy; prefira a env. */
export const DEFAULT_TEST_ACCOUNT_EMAILS = Object.freeze([
  'tacianeaas02@gmail.com',
])

export function normalizeAccountEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase()
  return normalized || null
}

/**
 * Lista efetiva de contas de teste.
 * env ausente  -> lista padrão do código.
 * env presente -> substitui (string vazia = nenhuma conta de teste).
 */
export function resolveTestAccountEmails(env = process.env) {
  const raw = env?.FINANCE_TEST_ACCOUNT_EMAILS
  if (raw === undefined || raw === null) return [...DEFAULT_TEST_ACCOUNT_EMAILS]
  return String(raw)
    .split(',')
    .map(normalizeAccountEmail)
    .filter(Boolean)
}

export function isTestAccountEmail(email, emails = resolveTestAccountEmails()) {
  const normalized = normalizeAccountEmail(email)
  if (!normalized) return false
  return emails.some(candidate => normalizeAccountEmail(candidate) === normalized)
}

/**
 * Resolve os ids das contas de teste para poder tirá-las das agregações.
 *
 * Fail-safe: qualquer falha devolve lista VAZIA (nada é excluído). Sumir com
 * receita por causa de um blip de banco seria pior que contar a assinatura de
 * teste por mais um carregamento de tela.
 */
export async function loadTestAccountUserIds(db, { env = process.env } = {}) {
  const emails = resolveTestAccountEmails(env)
  if (!emails.length) return { ids: [], emails: [] }
  try {
    const rows = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })
    return { ids: rows.map(row => row.id), emails: rows.map(row => row.email) }
  } catch {
    return { ids: [], emails: [] }
  }
}

/** Cláusula Prisma pronta: `{}` quando não há nada a excluir. */
export function excludeUserIdsWhere(ids, field = 'userId') {
  if (!Array.isArray(ids) || !ids.length) return {}
  return { [field]: { notIn: ids } }
}
