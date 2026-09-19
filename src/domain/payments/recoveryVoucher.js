// Voucher de desconto para quem deixou o acesso vencer.
//
// PURO (só `crypto`): recebe quem é a cliente e quando o acesso venceu, devolve
// o código, o desconto e até quando vale. Sem banco, sem rede, sem tabela nova.
//
// Por que SEM TABELA: o resgate é humano — a cliente responde o e-mail ou chama
// no WhatsApp e a administradora aplica o desconto na mão (registrando o
// pagamento por fora, ou combinando o valor). O que o sistema precisa garantir
// é só isto: o código do segundo e-mail ser o MESMO do primeiro, e dar para
// conferir depois se um código que chegou por WhatsApp é de verdade e ainda
// está no prazo. Tudo isso sai de uma derivação determinística — guardar linha
// em banco custaria migration e não responderia nada a mais.
//
// A chave: `VOUCHER_CODE_SECRET`, com `JWT_SECRET` como segunda opção e uma
// constante como último recurso (mantém teste e ambiente de desenvolvimento sem
// env). Sem chave própria o código é adivinhável em teoria — e o risco é baixo
// de propósito: adivinhar não desconta nada sozinho, só faz uma pessoa conferir
// um pedido de 20% que ela ia conferir de qualquer forma.
import { createHmac } from 'node:crypto'

/** Desconto oferecido para voltar. */
export const RECOVERY_VOUCHER_PERCENT = 20

/**
 * Por quantos dias, contados do vencimento do acesso, o voucher vale.
 *
 * Amarrado ao VENCIMENTO (não à data de envio) de propósito: é o que faz o
 * e-mail do 7º dia dizer um prazo que bate com o do 5º. Com validade contada do
 * envio, um atraso da passada diária mudaria o prazo no meio da conversa.
 */
export const RECOVERY_VOUCHER_VALID_DAYS = 10

// Sem vogais e sem os pares que a pessoa erra ao ditar por WhatsApp (O/0, I/1,
// S/5, B/8): o código é lido em voz alta e digitado por outra pessoa.
const ALPHABET = '23456789ACDEFGHJKLMNPQRTUVWXYZ'
const CODE_LENGTH = 6
const MS_PER_DAY = 24 * 60 * 60 * 1000

function resolveSecret(env) {
  const own = String(env?.VOUCHER_CODE_SECRET ?? '').trim()
  if (own) return own
  const jwt = String(env?.JWT_SECRET ?? '').trim()
  if (jwt) return jwt
  return 'espelha-grupos-voucher'
}

/** Dia (UTC) de uma data, para a derivação não mudar com a hora do envio. */
function dayKey(value) {
  // `new Date(null)` é 1970-01-01, uma data VÁLIDA: sem este teto, conta sem
  // data de vencimento ganharia um código de verdade, com prazo de 1970.
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

/**
 * Código do voucher daquela cliente naquele vencimento. Determinístico: os dois
 * e-mails da jornada chamam isto e recebem o mesmo código.
 *
 * @returns {string|null} ex.: 'VOLTA20-7KMQ4D'
 */
export function buildRecoveryVoucherCode({ userId, expiredAt, percent = RECOVERY_VOUCHER_PERCENT, env = process.env } = {}) {
  const id = String(userId ?? '').trim()
  const dia = dayKey(expiredAt)
  if (!id || !dia) return null
  const digest = createHmac('sha256', resolveSecret(env)).update(`${id}:${dia}:${percent}`).digest()
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[digest[i] % ALPHABET.length]
  return `VOLTA${percent}-${code}`
}

/**
 * O voucher inteiro, pronto para virar texto de e-mail.
 *
 * @returns {{ code: string, percent: number, validUntil: Date, diasRestantes: number }|null}
 *   null quando não há dado confiável (sem conta, sem data de vencimento) — e
 *   aí o e-mail do voucher simplesmente não sai, em vez de sair com prazo
 *   inventado.
 */
export function buildRecoveryVoucher({
  userId,
  expiredAt,
  now = new Date(),
  percent = RECOVERY_VOUCHER_PERCENT,
  validDays = RECOVERY_VOUCHER_VALID_DAYS,
  env = process.env,
} = {}) {
  const code = buildRecoveryVoucherCode({ userId, expiredAt, percent, env })
  if (!code) return null
  const venceu = new Date(expiredAt).getTime()
  const validUntil = new Date(venceu + validDays * MS_PER_DAY)
  const diasRestantes = Math.ceil((validUntil.getTime() - new Date(now).getTime()) / MS_PER_DAY)
  return { code, percent, validUntil, diasRestantes }
}

/**
 * O código que chegou por WhatsApp é desta conta e ainda está no prazo?
 * Usado pela conferência manual (`scripts/conferir-voucher.mjs`).
 */
export function checkRecoveryVoucher({ code, userId, expiredAt, now = new Date(), env = process.env } = {}) {
  const voucher = buildRecoveryVoucher({ userId, expiredAt, now, env })
  if (!voucher) return { valido: false, motivo: 'sem_dado' }
  const informado = String(code ?? '').trim().toUpperCase()
  if (informado !== voucher.code) return { valido: false, motivo: 'codigo_diferente', voucher }
  if (voucher.diasRestantes <= 0) return { valido: false, motivo: 'prazo_vencido', voucher }
  return { valido: true, motivo: 'ok', voucher }
}
