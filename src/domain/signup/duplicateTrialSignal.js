// "Essa pessoa já fez o teste grátis com outra conta?"
//
// Módulo PURO (padrão da casa): recebe a foto do cadastro novo e das contas
// anteriores, devolve a decisão. Nada aqui importa `db.js`, então o teste roda
// sem banco.
//
// POR QUE EXISTE (2026-09-09): a varredura de produção achou quatro pessoas
// recriando conta para renovar o teste, e uma delas encadeou QUATRO contas
// desde 4 de agosto — cada uma nascendo no dia em que a anterior vencia, com um
// nome de pessoa diferente a cada vez. Cinco semanas de produto de graça sem
// nenhum aviso em lugar nenhum: o padrão só apareceu porque alguém foi olhar.
//
// ⚠️ O SINAL DE IP NÃO SERVE, e isso foi MEDIDO, não suposto. No caso que
// motivou a investigação, a conta original nasceu de um IPv6 de celular e as
// duas contas novas de um IPv4 fixo — endereço residencial e móvel mudam
// sozinhos. Em toda a base só três endereços se repetiam, e um deles era o da
// própria dona do produto. O que separa de verdade é o NOME e a RAIZ DO E-MAIL.
//
// TRÊS INVARIANTES QUE NÃO PODEM AFROUXAR:
//
// 1. **Isto AVISA, nunca bloqueia.** Nome repetido é comum (homônimo), e a
//    mesma pessoa pode ter motivo legítimo para recadastrar (perdeu a senha,
//    errou o e-mail). Barrar cadastro por suspeita perde cliente de verdade —
//    e cliente perdido no cadastro ninguém descobre depois. Quem decide
//    encerrar acesso é uma pessoa, olhando o caso.
// 2. **Fail-safe é NÃO acusar.** Dado faltando, raiz curta demais, conta
//    anterior sem prazo de acesso, janela furada → nenhum sinal. Alarme falso
//    recorrente treina a pessoa a ignorar justamente este aviso.
// 3. **Raiz de e-mail curta não vale.** `lucas`, `maria` e `contato` são
//    prefixo de meio mundo. Abaixo de `MIN_EMAIL_ROOT_LENGTH` só o nome
//    completo decide.

const DAY_MS = 24 * 60 * 60 * 1000

/** Raiz de e-mail menor que isto é prefixo comum, não identidade. */
export const MIN_EMAIL_ROOT_LENGTH = 8

/**
 * Janela em torno do vencimento da conta anterior.
 *
 * Aceita a conta nova nascendo ANTES do vencimento de propósito: no caso da
 * investigação as duas contas novas foram criadas um dia antes de o teste
 * antigo acabar. Quem recicla se antecipa; exigir "depois do vencimento"
 * deixaria passar exatamente o padrão que isto existe para pegar.
 */
export const SIGNUP_BEFORE_EXPIRY_DAYS = 7
export const SIGNUP_AFTER_EXPIRY_DAYS = 60

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Nome comparável: sem acento, sem caixa, sem espaço dobrado.
 * "RAELY DA Silva SANTOS" e "Raely da Silva Santos" são a mesma pessoa.
 */
export function normalizeSignupName(name) {
  const texto = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
  return texto || null
}

/**
 * Raiz do e-mail: o que vem antes do arroba, sem os dígitos e separadores do
 * fim. `castelloisabella2`, `castelloisabella22` e `castelloisabella4` viram
 * todos `castelloisabella`.
 */
export function emailRoot(email) {
  const local = String(email ?? '').toLowerCase().split('@')[0] ?? ''
  const raiz = local.replace(/[0-9._-]+$/, '')
  return raiz || null
}

/** A conta anterior venceu perto o bastante do cadastro novo? */
function dentroDaJanela(createdAt, accessExpiresAt) {
  const criada = toDate(createdAt)
  const venceu = toDate(accessExpiresAt)
  if (!criada || !venceu) return false
  const diff = criada.getTime() - venceu.getTime()
  return diff >= -SIGNUP_BEFORE_EXPIRY_DAYS * DAY_MS && diff <= SIGNUP_AFTER_EXPIRY_DAYS * DAY_MS
}

/**
 * @param {object} args
 * @param {{ id?: string, name?: string, email?: string, createdAt?: Date|string }} args.novo
 * @param {Array<{ id?: string, name?: string, email?: string, accessExpiresAt?: Date|string|null }>} args.anteriores
 * @returns {{ suspeito: boolean, motivo: string|null, contas: Array<{ id: string|null, email: string|null, sinal: string }> }}
 */
export function decideDuplicateTrialSignal({ novo = {}, anteriores = [] } = {}) {
  const nada = { suspeito: false, motivo: null, contas: [] }

  const nomeNovo = normalizeSignupName(novo.name)
  const raizNova = emailRoot(novo.email)
  const criadaEm = toDate(novo.createdAt)
  if (!criadaEm) return nada
  if (!nomeNovo && !raizNova) return nada

  const contas = []
  for (const anterior of Array.isArray(anteriores) ? anteriores : []) {
    if (!anterior || anterior.id === novo.id) continue
    if (!dentroDaJanela(criadaEm, anterior.accessExpiresAt)) continue

    const mesmoNome = Boolean(nomeNovo) && normalizeSignupName(anterior.name) === nomeNovo
    const raizAnterior = emailRoot(anterior.email)
    const mesmaRaiz = Boolean(raizNova)
      && raizNova.length >= MIN_EMAIL_ROOT_LENGTH
      && raizAnterior === raizNova

    if (!mesmoNome && !mesmaRaiz) continue
    contas.push({
      id: anterior.id ?? null,
      email: anterior.email ?? null,
      sinal: mesmoNome ? 'mesmo nome' : 'mesma raiz de e-mail',
    })
  }

  if (!contas.length) return nada
  const temNome = contas.some(c => c.sinal === 'mesmo nome')
  return {
    suspeito: true,
    motivo: temNome ? 'mesmo nome' : 'mesma raiz de e-mail',
    contas,
  }
}
