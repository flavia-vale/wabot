// Gatilhos de aviso para a DONA (M4 da auditoria do painel admin): o que hoje
// só aparece se alguém abrir o painel na hora certa.
//
// Aqui só mora a DECISÃO (pura, sem banco, sem relógio implícito). A coleta
// está em `adminOpsAlertSweep.js`, que roda dentro do setInterval de 15 min que
// já existe (aviso de vagas) — sem processo, timer ou cache novo.
//
// Já cobertos por outros caminhos, de propósito NÃO repetidos aqui:
//   - swap ativo / pouca RAM / supervisor sumido → vigia (`admin_servidor_vigia`)
//   - rajada de 403 no admin → Q10 (`admin_sondagem_admin`)

import { resolveSessionOwner, SESSION_OWNER } from '../core/sessionOwnership.js'
import { summarizeReceptionBlindRows } from '../domain/admin/receptionBlindStatus.js'
import { BLIND_KIND } from '../core/inboundNodeCensus.js'

export const OPS_ALERT_SLUG = 'admin_operacao_atencao'
export const OPS_ALERT_COOLDOWN_HOURS = 12
export const PAYING_DOWN_MS = 2 * 60 * 60_000
export const BLIND_SILENT_MS = 3 * 60 * 60_000
export const STUCK_SENDING_MS = 30 * 60_000
export const STUCK_SENDING_MIN = 3
const LIST_LIMIT = 10

export function isOpsAlertEnabled(env = process.env) {
  return String(env.ADMIN_OPS_ALERT_ENABLED ?? 'true').toLowerCase() !== 'false'
}

export function resolveOpsAlertCooldownHours(env = process.env) {
  const value = Number(env.ADMIN_OPS_ALERT_COOLDOWN_HOURS)
  return Number.isFinite(value) && value > 0 ? value : OPS_ALERT_COOLDOWN_HOURS
}

function label(user) {
  const nome = String(user?.name ?? '').trim()
  return nome ? `${nome} (${user.email})` : String(user?.email ?? user?.id ?? 'conta sem e-mail')
}

function horas(ms) {
  return `${Math.max(1, Math.round(ms / 3_600_000))} h`
}

// Onde a mensagem de grupo some, em palavras da dona (censo de entrada, RCA
// 2026-10-03). Robô sem o censo não manda o campo → nada acrescentado.
function descreveCegueira(blindKind, stuckDrops) {
  const quedas = Number(stuckDrops) > 0 ? `, ${Number(stuckDrops)} queda(s) por mensagem travada antes` : ''
  switch (blindKind) {
    case BLIND_KIND.NOTHING_ARRIVES: return ` — nada chega do WhatsApp${quedas}: parear de novo`
    case BLIND_KIND.FAILS_TO_OPEN: return ` — chega e não abre${quedas}: Reconectar`
    case BLIND_KIND.DROPPED_BY_RULE: return ` — chega e uma regra descarta${quedas}: conferir grupos monitorados`
    case BLIND_KIND.NOT_ACCEPTED: return ` — chega e abre, mas nada é aceito${quedas}: filtro do robô`
    default: return quedas
  }
}

function lista(linhas, total) {
  const corpo = linhas.slice(0, LIST_LIMIT).join('\n')
  return total > LIST_LIMIT ? `${corpo}\n… e mais ${total - LIST_LIMIT}` : corpo
}

/**
 * Pagante com o WhatsApp fora do ar há mais de 2 h. Fora quem desligou de
 * propósito e quem está com o acesso vencido: não são queda.
 * @param users [{ id, name, email, waSession: { status, lifecycle, lastDisconnectCode, lastHeartbeatAt, updatedAt } }]
 */
export function findPayingDown(users = [], now = Date.now()) {
  const found = []
  for (const user of users) {
    const session = user?.waSession
    if (!session) continue
    const { owner } = resolveSessionOwner({
      status: session.status,
      lifecycle: session.lifecycle,
      lastDisconnectCode: session.lastDisconnectCode,
      lastHeartbeatAt: session.lastHeartbeatAt,
      now,
    })
    if ([SESSION_OWNER.CONNECTED, SESSION_OWNER.CLIENT_STOPPED, SESSION_OWNER.EXPIRED].includes(owner)) continue
    const since = new Date(session.lastHeartbeatAt ?? session.updatedAt ?? 0).getTime()
    if (!Number.isFinite(since) || since <= 0) continue
    const downMs = now - since
    if (downMs >= PAYING_DOWN_MS) found.push({ user, downMs, owner })
  }
  return found.sort((a, b) => b.downMs - a.downMs)
}

/**
 * Conectada e sem receber há mais de 3 h (o "verde mentiroso"), só pagantes.
 * @param rows [{ userId, metadata }] de ops_wa_reception_blind
 * @param payingById Map userId -> { name, email }
 */
export function findPayingBlind(rows = [], payingById = new Map()) {
  const found = []
  for (const [userId, detail] of summarizeReceptionBlindRows(rows)) {
    const user = payingById.get(userId)
    if (!user) continue
    if (Number(detail.silentForMs) >= BLIND_SILENT_MS) found.push({ user: { id: userId, ...user }, silentForMs: detail.silentForMs, blindKind: detail.blindKind ?? null, stuckDrops: detail.stuckDrops ?? 0 })
  }
  return found.sort((a, b) => b.silentForMs - a.silentForMs)
}

/** @returns {Array<{ key: string, count: number, vars: { resumo: string, lista: string, acao: string } }>} */
export function buildOpsAlerts({ payingDown = [], payingBlind = [], stuckSending = 0 } = {}) {
  const alerts = []
  if (payingDown.length) {
    alerts.push({
      key: 'pagante_caido',
      count: payingDown.length,
      vars: {
        resumo: `${payingDown.length} cliente(s) pagante(s) com o WhatsApp fora do ar há mais de 2 h`,
        lista: lista(payingDown.map(({ user, downMs, owner }) => `- ${label(user)} — fora há ${horas(downMs)} (${owner})`), payingDown.length),
        acao: 'Abra Admin → Online, filtre por "Parada" e use Reconectar nos casos em que o robô não está tentando sozinho.',
      },
    })
  }
  if (payingBlind.length) {
    alerts.push({
      key: 'cega',
      count: payingBlind.length,
      vars: {
        resumo: `${payingBlind.length} cliente(s) pagante(s) conectada(s) mas sem receber há mais de 3 h`,
        lista: lista(payingBlind.map(({ user, silentForMs, blindKind, stuckDrops }) => `- ${label(user)} — sem receber há ${horas(silentForMs)}${descreveCegueira(blindKind, stuckDrops)}`), payingBlind.length),
        acao: payingBlind.some(b => b.blindKind === BLIND_KIND.NOTHING_ARRIVES)
          ? 'Conectada de mentira: as ofertas dela não estão chegando. Quem está marcada como "nada chega" precisa parear de novo (desconectar, esquecer o aparelho no celular e ler o QR) — Reconectar e reiniciar o robô não resolvem esse caso (RCA 2026-10-03). As outras: Reconecte pelo Admin → Online; se repetir, é caso de re-pareamento.'
          : 'Conectada de mentira: as ofertas dela não estão chegando. Reconecte pelo Admin → Online; se repetir, é caso de re-pareamento.',
      },
    })
  }
  if (stuckSending >= STUCK_SENDING_MIN) {
    alerts.push({
      key: 'envios_presos',
      count: stuckSending,
      vars: {
        resumo: `${stuckSending} envio(s) presos em "enviando" há mais de 30 min`,
        lista: `- ${stuckSending} mensagens em estado "enviando" que o limpador automático (15 min) não resolveu.`,
        acao: 'O limpador de envios presos pode ter parado. Veja os logs da API (stuckSendLogs) e a aba Envios do admin.',
      },
    })
  }
  return alerts
}
