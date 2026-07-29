/**
 * Decide se uma sessão persistida deve ser retomada automaticamente pelo
 * supervisor.
 *
 * RCA 2026-07-29 (rescaldo do incidente do `failure 405`): o supervisor só
 * retoma sessão com `status` em `connected`/`connecting`. Durante as ~27h de
 * apagão, cada sessão que ficou tentando reconectar acabou marcada como
 * `disconnected` pelo heartbeat — e passou a ser IGNORADA na retomada. Ou seja,
 * o próprio incidente tirou as clientes da fila de recuperação automática: a
 * causa raiz foi corrigida, o robô voltou, e mesmo assim parte das clientes
 * seguiu fora do ar até alguém investigar no banco, uma a uma.
 *
 * **Por que a correção óbvia está errada:** `POST /session/stop` (o botão
 * "Desconectar" do painel) grava exatamente o MESMO `status: 'disconnected'`.
 * Retomar todo `disconnected` religaria o robô de quem desligou de propósito —
 * reconexão indesejada, notificação de sincronização no celular e sessão
 * rodando contra a vontade da cliente. Pior que o problema original.
 *
 * Por isso a decisão precisa de um marcador explícito de intenção
 * (`lifecycle`), somado a duas provas de que a retomada faz sentido:
 * credencial no disco (sem ela a retomada só geraria QR que ninguém pediu) e
 * conta em dia (mesma regra do botão "Conectar", em
 * `validateSessionStartUser`).
 *
 * Módulo PURO: sem DB, sem fs, sem rede — quem chama injeta os fatos.
 */

/** Marcador gravado por `POST /session/stop`: a cliente desligou de propósito. */
export const STOPPED_BY_USER_LIFECYCLE = 'stopped_by_user'

/** Status que sempre foram elegíveis à retomada (comportamento histórico). */
export const ALWAYS_RESUMABLE_STATUSES = ['connected', 'connecting']

/**
 * @param {object} session
 * @param {string}      session.status         status persistido em WaSession
 * @param {string|null} session.lifecycle      lifecycle persistido em WaSession
 * @param {boolean}     session.hasCredential  existe credencial no disco?
 * @param {string|null} session.userStatus     User.status ('active'/'banned'/'suspended')
 * @param {Date|number|string|null} session.accessExpiresAt
 * @param {Date}        [now]
 * @returns {{ resume: boolean, reason: string }}
 */
export function shouldResumeSession(session, now = new Date()) {
  const {
    status,
    lifecycle = null,
    hasCredential = false,
    userStatus = null,
    accessExpiresAt = null,
  } = session || {}

  // Conta bloqueada nunca sobe, mesmo com status 'connected' — espelha
  // validateSessionStartUser (src/domain/session/service.js).
  if (userStatus === 'banned' || userStatus === 'suspended') {
    return { resume: false, reason: 'account_blocked' }
  }
  if (accessExpiresAt != null) {
    const expiresAt = accessExpiresAt instanceof Date ? accessExpiresAt : new Date(accessExpiresAt)
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt < now) {
      return { resume: false, reason: 'access_expired' }
    }
  }

  // Caminho histórico: sessão que o sistema acreditava estar de pé continua
  // sendo retomada exatamente como antes, inclusive sem credencial (é o fluxo
  // que gera QR para quem está pareando agora).
  if (ALWAYS_RESUMABLE_STATUSES.includes(status)) {
    return { resume: true, reason: 'persisted_active' }
  }

  if (status !== 'disconnected') return { resume: false, reason: 'status_not_resumable' }

  // A cliente desligou pelo painel: respeitar. Este é o caso que impede a
  // regra de virar "religa tudo".
  if (lifecycle === STOPPED_BY_USER_LIFECYCLE) {
    return { resume: false, reason: 'stopped_by_user' }
  }

  // Sem credencial, retomar não reconecta nada — só criaria um socket pedindo
  // QR que ninguém está esperando (ex.: sessão encerrada por logout 401).
  if (!hasCredential) return { resume: false, reason: 'no_credential' }

  return { resume: true, reason: 'abandoned_with_credential' }
}
