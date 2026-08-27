// Quais sessões o supervisor deve RESSUSCITAR quando o worker some.
//
// RCA 2026-08-27 (confirmado em produção): existia uma armadilha entre duas
// regras que, isoladas, fazem sentido:
//
//   1. Quando a reconexão passa de `WA_HEARTBEAT_MAX_RECONNECTING_MS` (2min)
//      presa, o worker grava `status='disconnected'` com
//      `lifecycle='reconnecting'` — a válvula de honestidade que impede o
//      painel de esconder um loop de reconexão da cliente
//      (`buildHeartbeatSessionPatch`).
//   2. O health monitor do supervisor só ressuscitava sessões com
//      `status IN ('connected','connecting')`.
//
// Juntas: passou de 2 minutos → vira `disconnected` → SAI da lista de
// ressurreição. Se o worker morrer depois disso (OOM, exceção, ou o próprio
// matador de zumbis do supervisor, que derruba worker sem heartbeat contando
// com a ressurreição no tick seguinte), ninguém mais o levanta. A sessão fica
// morta até a cliente clicar em "Conectar".
//
// Medido: sessões presas nesse estado por 4h e por 45 DIAS; e clientes com
// quedas de 428/515 que só voltaram após 8h, 18h e 29h — sempre por ação
// manual delas.
//
// A correção é reconhecer o que o próprio worker declarou: `reconnecting`
// quer dizer "eu ainda estava tentando". Isso NÃO afrouxa nada — quem parou
// de propósito continua parado.
//
// Puro: sem I/O, sem relógio implícito.

// Estados em que a sessão estava viva (ou tentando) quando o worker sumiu.
const RESURRECTABLE_STATUSES = new Set(['connected', 'connecting'])

// `lifecycle` que significa "o robô ainda estava tentando sozinho".
const RECONNECTING_LIFECYCLE = 'reconnecting'

// Paradas DELIBERADAS — nunca ressuscitar, em nenhuma hipótese:
//   stopped_by_user      → a cliente desligou pelo painel
//   auth_reset_required  → apagamos a credencial; só volta com QR novo
//   disconnected         → parada de verdade, sem reconexão agendada
//   authenticating       → pareamento interrompido; subir geraria um QR que
//                          ninguém está olhando
const DELIBERATE_LIFECYCLES = new Set([
  'stopped_by_user',
  'auth_reset_required',
  'disconnected',
  'authenticating',
])

export function shouldResurrectSession({ status = null, lifecycle = null, includeReconnecting = true } = {}) {
  const currentStatus = String(status ?? '')
  const currentLifecycle = String(lifecycle ?? '')

  if (DELIBERATE_LIFECYCLES.has(currentLifecycle)) return false
  if (RESURRECTABLE_STATUSES.has(currentStatus)) return true
  // O caso do RCA: o worker declarou que ainda estava tentando e sumiu.
  if (!includeReconnecting) return false
  return currentStatus === 'disconnected' && currentLifecycle === RECONNECTING_LIFECYCLE
}

// Filtro Prisma para a consulta do supervisor. Mantém a busca estreita (não
// varre a base inteira) e deixa a decisão fina para `shouldResurrectSession`.
export function buildResurrectionWhere({ includeReconnecting = true } = {}) {
  if (!includeReconnecting) return { status: { in: [...RESURRECTABLE_STATUSES] } }
  return {
    OR: [
      { status: { in: [...RESURRECTABLE_STATUSES] } },
      { status: 'disconnected', lifecycle: RECONNECTING_LIFECYCLE },
    ],
  }
}

// `WA_RESURRECT_RECONNECTING=0` volta ao comportamento antigo sem redeploy.
export function resolveIncludeReconnecting(value = process.env.WA_RESURRECT_RECONNECTING) {
  return String(value ?? '1') !== '0'
}
