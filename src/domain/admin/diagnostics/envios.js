// Diagnóstico "por que esta cliente não envia", elo por elo (PURO, sem banco).
//
// Fonte única das regras de scripts/diag-envios-vazios.mjs (que importa daqui)
// e de GET /api/admin/users/:id/diagnostico/envios (aba Robô da ficha).
// Só enxerga o que está no banco e no Redis — NUNCA o bot.log, que é da frota
// inteira e não se atribui a uma conta. Os elos que dependem do bot.log
// ("o grupo não publicou", "mensagem descartada") ficam só no script.
//
// Cadeia (a primeira que falha é o veredito):
//   1. conta     — ativa e com acesso valendo
//   2. robô      — processo do robô rodando
//   3. sessão    — WhatsApp conectado e com sinal recente
//   4. grupos    — monitorado com destino; canal liberado pelo plano
//   5. envios    — o que o banco registrou na janela (falhas, presos, fila de erros)
import { isHeartbeatFresh } from '../../session/sessionLiveness.js'

export const ENVIOS_ELOS = ['conta', 'robo', 'sessao', 'grupos', 'envios']

const elo = (id, titulo, problemas) => ({
  id,
  titulo,
  ok: problemas.length === 0,
  frases: problemas,
})

export function diagnoseEnvios({
  nowMs = Date.now(),
  hours = 6,
  user = {},
  canUseChannels = true,
  workerRunning = null, // true | false | null (= não sei: supervisor não respondeu)
  session = null,
  groups = [],
  targets = [],
  logs = { total: 0, byStatus: {}, lastSentAt: null },
  stuckSending = 0,
  dlqTotal = null, // null = fila de erros indisponível neste ambiente
} = {}) {
  // 1. conta
  const conta = []
  if (user.status && user.status !== 'active') conta.push(`A conta está "${user.status}" (não ativa): o robô não sobe.`)
  if (user.accessExpiresAt && new Date(user.accessExpiresAt).getTime() <= nowMs) {
    conta.push('O acesso desta conta venceu: o robô sobe, vê o vencimento e desliga. É caso de renovação.')
  }

  // 2. robô
  const robo = []
  if (workerRunning === false) robo.push('Não há robô rodando para esta cliente: nada é recebido nem enviado.')
  if (workerRunning === null) robo.push('Não consegui saber se o robô está rodando (o supervisor não respondeu).')

  // 3. sessão
  const sessao = []
  if (!session) {
    sessao.push('A cliente nunca conectou o WhatsApp neste ambiente.')
  } else {
    if (session.lifecycle === 'stopped_by_user') {
      sessao.push('O robô foi parado de propósito (pela cliente ou pelo admin). Só volta quando ela conectar de novo.')
    } else if (session.status !== 'connected') {
      sessao.push(`O WhatsApp está "${session.status}": enquanto não conectar, nada chega nem sai.`)
    }
    if (session.status === 'connected' && !isHeartbeatFresh(session.lastHeartbeatAt, nowMs)) {
      sessao.push('Diz que está conectado, mas o robô não dá sinal há mais de 5 minutos: provavelmente travado.')
    }
  }

  // 4. grupos
  const grupos = []
  const monitors = groups.filter(g => g.role === 'monitor')
  const posts = groups.filter(g => g.role === 'post')
  if (!monitors.length) grupos.push('Nenhum grupo para monitorar está cadastrado.')
  if (!posts.length) grupos.push('Nenhum grupo de destino está cadastrado.')
  for (const m of monitors) {
    if (!targets.some(t => t.monitorId === m.id)) {
      grupos.push(`O grupo monitorado "${m.name}" não tem nenhum destino ligado: nada sai dele.`)
    }
    if (m.kind === 'channel' && !canUseChannels) {
      grupos.push(`"${m.name}" é canal e o plano não libera canais: ele some da configuração do robô em silêncio.`)
    }
  }
  for (const p of posts) {
    if (p.kind === 'channel' && !canUseChannels) {
      grupos.push(`O destino "${p.name}" é canal e o plano não libera canais.`)
    }
  }

  // 5. envios (o que o banco registrou)
  const envios = []
  const porStatus = logs.byStatus || {}
  const falhas = Number(porStatus.failed || 0) + Number(porStatus.error || 0)
  if (stuckSending > 0) envios.push(`${stuckSending} envio(s) preso(s) em "enviando" há muito tempo: a fila não anda.`)
  if (dlqTotal > 0) envios.push(`${dlqTotal} envio(s) na fila de erros esperando reprocesso.`)
  if (falhas > 0 && falhas >= Number(logs.total || 0) / 2) {
    envios.push(`${falhas} de ${logs.total} envios das últimas ${hours}h falharam.`)
  }

  const elos = [
    elo('conta', 'Conta', conta),
    elo('robo', 'Robô', robo),
    elo('sessao', 'WhatsApp', sessao),
    elo('grupos', 'Grupos e destinos', grupos),
    elo('envios', 'Envios', envios),
  ]
  const primeiro = elos.find(e => !e.ok)
  const veredito = primeiro
    ? { eloId: primeiro.id, ok: false, frase: primeiro.frases[0] }
    : (Number(logs.total || 0) === 0
      ? { eloId: null, ok: true, frase: `Nenhum elo quebrado, mas não houve envio nas últimas ${hours}h. Provavelmente os grupos monitorados não publicaram nada.` }
      : { eloId: null, ok: true, frase: `Tudo certo: ${logs.total} envio(s) nas últimas ${hours}h.` })

  return {
    hours,
    elos,
    veredito,
    problemas: elos.flatMap(e => e.frases),
    resumo: {
      enviosNaJanela: Number(logs.total || 0),
      porStatus,
      ultimoEnvioEm: logs.lastSentAt ? new Date(logs.lastSentAt).toISOString() : null,
      presos: stuckSending,
      filaDeErros: dlqTotal,
    },
  }
}
