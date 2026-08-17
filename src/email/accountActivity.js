// "Essa conta está usando o robô agora?" — a pergunta que faltava antes de
// mandar aviso operacional.
//
// Caso real (ago/2026): cliente com o plano vencido, WhatsApp desconectado e
// nenhuma oferta há semanas recebeu "a Shopee parou de aceitar sua chave". O
// aviso estava tecnicamente certo e completamente sem sentido — e, pior, o robô
// ainda gastava uma sondagem na loja para descobrir isso. A varredura de
// credencial olhava só "conta não banida + e-mail real".
//
// Regra: aviso de SAÚDE (grupo `saude` do catálogo: código de acesso venceu,
// chave da Shopee recusada, WhatsApp caiu, robô parado) só vale para conta em
// uso. Cobrança, senha e dinheiro de afiliada NÃO passam por aqui — conta
// parada continua precisando saber que o plano vence e que tem saque a fazer.
//
// PURO: as decisões abaixo recebem `now` e não fazem I/O. O carregamento da
// foto (`loadAccountActivity`) fica no fim do arquivo, com o db injetado.

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Tipo do evento gravado quando a cliente manda desconectar pelo painel. */
export const MANUAL_STOP_EVENT = 'manual_stop_requested'

/** Grupos do catálogo que só fazem sentido para quem está com o robô rodando. */
export const OPERATIONAL_GROUPS = Object.freeze(['saude'])

/** Grupos que entram na conta do teto semanal de e-mail automático. */
export const CAPPED_GROUPS = Object.freeze(['saude', 'marketing'])

const DEFAULT_IDLE_DAYS = 7
const DEFAULT_WEEKLY_CAP = 2
// Conta nova que conectou mas ainda não teve oferta nenhuma continua "em uso":
// é justamente quem mais precisa saber que o robô caiu.
const GRACE_DAYS_AFTER_SIGNUP = 14

/**
 * Quantos dias sem enviar oferta até a conta ser considerada parada.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveOperationalIdleDays(env = process.env) {
  const raw = Number(env.EMAIL_OPERATIONAL_IDLE_DAYS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IDLE_DAYS
}

/**
 * Teto de e-mail automático por cliente por semana (saúde + divulgação).
 * `0` desliga o teto.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveAutoEmailWeeklyCap(env = process.env) {
  const raw = Number(env.EMAIL_AUTO_WEEKLY_CAP)
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_WEEKLY_CAP
}

function daysSince(value, now) {
  if (!value) return null
  const diff = new Date(now).getTime() - new Date(value).getTime()
  return Number.isFinite(diff) ? diff / MS_PER_DAY : null
}

/**
 * A conta está usando o robô agora?
 *
 * Precisa de acesso ativo E de um sinal de vida: WhatsApp conectado, oferta
 * enviada dentro da janela, ou conta recém-criada que já chegou a conectar.
 *
 * @param {{accessExpiresAt?: Date|string|null, waConnected?: boolean,
 *          waEverConnected?: boolean, lastSuccessAt?: Date|string|null,
 *          createdAt?: Date|string|null}} activity
 * @param {Date|number} [now]
 * @param {{idleDays?: number, graceDays?: number}} [options]
 * @returns {boolean}
 */
export function isAccountInUse(activity, now = new Date(), { idleDays, graceDays } = {}) {
  if (!activity) return false

  const restam = activity.accessExpiresAt
    ? new Date(activity.accessExpiresAt).getTime() - new Date(now).getTime()
    : null
  if (restam === null || !Number.isFinite(restam) || restam <= 0) return false

  if (activity.waConnected) return true

  const janela = Number.isFinite(idleDays) && idleDays > 0 ? idleDays : resolveOperationalIdleDays()
  const desdeUltimoEnvio = daysSince(activity.lastSuccessAt, now)
  if (desdeUltimoEnvio !== null && desdeUltimoEnvio <= janela) return true

  const carencia = Number.isFinite(graceDays) && graceDays >= 0 ? graceDays : GRACE_DAYS_AFTER_SIGNUP
  const diasDeConta = daysSince(activity.createdAt, now)
  if (activity.waEverConnected && diasDeConta !== null && diasDeConta <= carencia) return true

  return false
}

/**
 * A desconexão foi ela quem pediu?
 *
 * "Desconectar" pelo painel é escolha (viagem, troca de chip, pausa), não
 * problema — e mandar "seu robô está fora do ar" nesse caso é ruído. Vale
 * enquanto não houver conexão nova depois do pedido.
 *
 * @param {{stoppedByUserAt?: Date|string|null, lastConnectedAt?: Date|string|null}} activity
 * @returns {boolean}
 */
export function wasStoppedByUser(activity) {
  const pedido = activity?.stoppedByUserAt ? new Date(activity.stoppedByUserAt).getTime() : null
  if (pedido === null || !Number.isFinite(pedido)) return false
  const conectou = activity?.lastConnectedAt ? new Date(activity.lastConnectedAt).getTime() : null
  if (conectou !== null && Number.isFinite(conectou) && conectou >= pedido) return false
  return true
}

/**
 * Esse e-mail depende da conta estar em uso?
 * @param {{group?: string}|null} template
 */
export function isOperationalEmail(template) {
  return OPERATIONAL_GROUPS.includes(String(template?.group ?? ''))
}

/**
 * Esse e-mail conta no teto semanal?
 * @param {{group?: string}|null} template
 */
export function countsTowardWeeklyCap(template) {
  return CAPPED_GROUPS.includes(String(template?.group ?? ''))
}

/**
 * Foto de atividade de um cliente. I/O injetado; cada consulta é isolada, para
 * dado que falha nunca virar "conta parada" (silenciar aviso legítimo por causa
 * de uma consulta que caiu seria pior que mandá-lo).
 *
 * @param {{db: object, userId: string, user?: object}} params
 * @returns {Promise<{accessExpiresAt: Date|null, waConnected: boolean, waEverConnected: boolean,
 *                    lastSuccessAt: Date|null, createdAt: Date|null,
 *                    stoppedByUserAt: Date|null, lastConnectedAt: Date|null, incompleta: boolean}>}
 */
export async function loadAccountActivity({ db, userId, user = null }) {
  const falhou = { valor: false }
  const seguro = async (consulta) => {
    try {
      return await consulta()
    } catch {
      falhou.valor = true
      return null
    }
  }

  let dono = user
  if (!dono?.accessExpiresAt && typeof db?.user?.findUnique === 'function') {
    dono = await seguro(() => db.user.findUnique({
      where: { id: userId },
      select: { accessExpiresAt: true, createdAt: true },
    })) ?? user
  }

  // Banco sem esses modelos = não dá para saber se a conta está em uso. Isso é
  // foto incompleta, não conta parada: quem chama trata como "manda o aviso".
  if (typeof db?.waSession?.findUnique !== 'function' || typeof db?.messageLog?.findFirst !== 'function') {
    falhou.valor = true
  }

  const [waSession, lastSuccess] = await Promise.all([
    typeof db?.waSession?.findUnique === 'function'
      ? seguro(() => db.waSession.findUnique({ where: { userId } }))
      : null,
    typeof db?.messageLog?.findFirst === 'function'
      ? seguro(() => db.messageLog.findFirst({
        where: { userId, status: 'success' },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      }))
      : null,
  ])

  const connected = waSession?.status === 'connected'
  return {
    accessExpiresAt: dono?.accessExpiresAt ?? null,
    createdAt: dono?.createdAt ?? null,
    waConnected: connected,
    waEverConnected: Boolean(waSession?.phone || waSession?.lastHeartbeatAt || connected),
    lastSuccessAt: lastSuccess?.sentAt ?? null,
    stoppedByUserAt: null,
    lastConnectedAt: null,
    incompleta: falhou.valor,
  }
}

/**
 * Quem pediu para desconectar e quando foi a última conexão. Consulta separada
 * porque só o aviso de WhatsApp caído precisa dela.
 * @param {{db: object, userId: string}} params
 */
export async function loadDisconnectIntent({ db, userId }) {
  if (typeof db?.waConnectionEvent?.findFirst !== 'function') {
    return { stoppedByUserAt: null, lastConnectedAt: null }
  }
  const buscar = async (types) => {
    try {
      const row = await db.waConnectionEvent.findFirst({
        where: { userId, type: { in: types } },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      })
      return row?.occurredAt ?? null
    } catch {
      return null
    }
  }
  const [stoppedByUserAt, lastConnectedAt] = await Promise.all([
    buscar([MANUAL_STOP_EVENT]),
    buscar(['connected', 'reconnect_success']),
  ])
  return { stoppedByUserAt, lastConnectedAt }
}
