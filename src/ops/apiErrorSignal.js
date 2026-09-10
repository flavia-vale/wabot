// "Este erro da API merece nome próprio, sinal durável e aviso interno?"
//
// Módulo PURO: sem banco, sem rede.
//
// POR QUE EXISTE (incidente 2026-09-09): o `schema.prisma` perdeu duas colunas
// que o código lia, e `GET /me` passou a lançar em TODA chamada — o painel não
// abria para ninguém. O Fastify registrou o erro no stdout do processo, e só:
// sem nome próprio para procurar, sem linha no banco e sem ninguém avisado. Ao
// investigar, um `grep` nas últimas 200 linhas do log não achou nada, e a
// conclusão quase virou "o log não registrou" — quando o problema real era não
// existir NADA pesquisável nem durável sobre uma falha que derrubou o produto.
//
// TRÊS INVARIANTES:
//
// 1. **Erro de CONTRATO com o banco é categoria própria.** Campo desconhecido,
//    tabela ausente e migration pendente não são "erro de rota": significam que
//    o código e o banco discordam, o que costuma derrubar TODAS as contas de
//    uma vez. É o único caso que merece e-mail interno na primeira ocorrência.
// 2. **Erro de cliente NÃO é incidente.** 4xx (validação, não encontrado, sem
//    permissão) nunca vira sinal — senão o número perde sentido e o aviso é
//    ignorado justamente quando importa.
// 3. **Sem dado confiável, classifica como genérico.** Nunca inventar
//    categoria: `outro` é resposta honesta e continua virando sinal.

/** Marcas de erro em que o CÓDIGO e o BANCO discordam. */
const SCHEMA_MISMATCH_MARKERS = [
  'unknown field',
  'unknown argument',
  'does not exist in the current database',
  'no such column',
  'no such table',
  'the table',           // "The table `main.X` does not exist"
  'migration',
]

/** Prefixos de código do Prisma para erro de contrato (P1xxx/P2021/P2022). */
const SCHEMA_MISMATCH_CODES = new Set(['P2021', 'P2022', 'P1012', 'P1013'])

export const API_ERROR_KINDS = Object.freeze({
  SCHEMA_MISMATCH: 'contrato_com_o_banco',
  DB_UNAVAILABLE: 'banco_indisponivel',
  OTHER: 'outro',
})

function textOf(error) {
  return [error?.message, error?.code, error?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * @param {{ statusCode?: number, code?: string, message?: string, name?: string }} error
 * @returns {{ signal: boolean, kind: string|null, alert: boolean }}
 */
export function classifyApiError(error, { statusCode } = {}) {
  const status = Number(statusCode ?? error?.statusCode ?? 500)
  // Invariante 2: o que a pessoa fez errado não é incidente nosso.
  if (Number.isFinite(status) && status >= 400 && status < 500) {
    return { signal: false, kind: null, alert: false }
  }

  const texto = textOf(error)
  const code = String(error?.code ?? '').toUpperCase()

  if (SCHEMA_MISMATCH_CODES.has(code) || SCHEMA_MISMATCH_MARKERS.some(m => texto.includes(m))) {
    return { signal: true, kind: API_ERROR_KINDS.SCHEMA_MISMATCH, alert: true }
  }
  if (code.startsWith('P1') || texto.includes('database is locked') || texto.includes('sqlite_busy')) {
    return { signal: true, kind: API_ERROR_KINDS.DB_UNAVAILABLE, alert: false }
  }
  return { signal: true, kind: API_ERROR_KINDS.OTHER, alert: false }
}

/**
 * O texto que uma pessoa lê no e-mail interno. Diz o que quebrou e o que fazer
 * — aviso sem próximo passo vira ruído.
 */
export function describeApiErrorKind(kind) {
  if (kind === API_ERROR_KINDS.SCHEMA_MISMATCH) {
    return 'O código e o banco de dados discordam sobre alguma coluna. Isso costuma derrubar o painel inteiro, não uma tela só. Confira se o schema declara tudo o que as migrations criaram.'
  }
  if (kind === API_ERROR_KINDS.DB_UNAVAILABLE) {
    return 'O banco de dados não respondeu. Costuma ser passageiro; se repetir, confira se algum processo está segurando o arquivo.'
  }
  return 'Uma chamada do painel falhou por erro nosso. Confira o log da API para o detalhe.'
}
