// "O robô está parado esperando o tempo que EU configurei?" — aviso global do
// painel (pedido da dona do produto, 2026-09-24).
//
// Módulo PURO (sem banco/rede). Consumido pela rota `GET /api/logs/send-pause`
// (que só classifica as linhas `queued`) e pelo PainelShell, que monta o aviso
// em cima do que já carrega a cada 20s (`GET /groups` com `sendWindow` efetivo
// por destino) mais o resumo da fila. Nenhuma tela precisa saber o motivo:
// ele vale em QUALQUER página do painel.
//
// O que conta como "esperando o Anti-banimento":
// - `horario`: TODOS os destinos estão fora do horário de envio agora
//   (`describeSendPause`). Destino sem horário envia 24h e derruba o aviso.
// - `limite_diario`, `seguranca`, `ritmo`: há linhas `queued` cujo motivo (o
//   texto leigo gravado por `deferReasonMessage` no bot-worker) diz que o
//   destino bateu o limite diário, foi pausado por segurança, ou está
//   esperando intervalo/rajada. Linha `queued` SEM motivo é envio normal em
//   vôo e não entra.
//
// Prioridade quando há mais de um motivo: horário > limite diário > segurança
// > ritmo — do mais longo para o mais curto, porque é o mais longo que explica
// "o robô parou".
//
// Não regredir: a classificação lê o TEXTO gravado, e `deferReasonMessage`
// em bot-worker.js é quem escreve — o teste extrai as frases de lá e exige
// que cada uma caia num tipo conhecido, senão o aviso some em silêncio.
import { formatSendWindowLabel, sendWindowState } from '../../core/sendWindow.js'

export const SEND_PAUSE_KIND = Object.freeze({
  HORARIO: 'horario',
  LIMITE_DIARIO: 'limite_diario',
  SEGURANCA: 'seguranca',
  RITMO: 'ritmo',
})

export const ANTI_BAN_SETTINGS_HREF = '/painel/anti-banimento?parte=ritmo'

function hourLabel(h) {
  return `${h}h`
}

/**
 * Todos os destinos fora do horário de envio agora?
 * @returns {null|{ title:string, detail:string, opensAtHour:number, destinations:Array<{id,name}> }}
 */
export function describeSendPause(groups = [], now = Date.now()) {
  const destinations = (Array.isArray(groups) ? groups : []).filter((g) => g?.role === 'post')
  if (!destinations.length) return null

  const closed = []
  for (const g of destinations) {
    const w = g?.sendWindow
    // Destino sem horário envia a qualquer hora: se existe um assim, parte
    // das ofertas sai agora e o aviso mentiria.
    if (!w || !Number.isFinite(w.startHour) || !Number.isFinite(w.endHour)) return null
    const state = sendWindowState(now, w)
    if (state.open) return null
    closed.push({ id: g.id, name: g.name, window: w, waitMs: state.waitMs })
  }
  if (!closed.length) return null

  // O destino que abre PRIMEIRO dita a hora de retorno.
  const soonest = closed.reduce((a, b) => (b.waitMs < a.waitMs ? b : a))
  const windows = new Set(closed.map((c) => formatSendWindowLabel(c.window)))
  const label = windows.size === 1 ? formatSendWindowLabel(soonest.window) : 'horário de cada destino'
  return {
    title: `Envio pausado agora: fora do horário (${label})`,
    detail: `As ofertas voltam a sair às ${hourLabel(soonest.window.startHour)}. Oferta que chegar agora e não conseguir sair antes do limite de espera é descartada na hora, com o motivo na aba Envios.`,
    opensAtHour: soonest.window.startHour,
    destinations: closed.map((c) => ({ id: c.id, name: c.name })),
  }
}

/** Tipo de espera a partir do motivo leigo gravado em MessageLog.errorMsg. */
export function classifyDeferMessage(errorMsg) {
  const text = typeof errorMsg === 'string' ? errorMsg : ''
  if (!text) return null
  if (/limite di[áa]rio/i.test(text)) return SEND_PAUSE_KIND.LIMITE_DIARIO
  if (/fora do hor[áa]rio de envio/i.test(text)) return SEND_PAUSE_KIND.HORARIO
  if (/pausou os envios/i.test(text)) return SEND_PAUSE_KIND.SEGURANCA
  if (/segurando os envios|intervalo m[íi]nimo|intervalo entre destinos|aguardando a vez certa/i.test(text)) return SEND_PAUSE_KIND.RITMO
  return null
}

/**
 * Resume as linhas `queued` por tipo de espera.
 * @param {Array<{ errorMsg?: string, sentAt?: string|number|Date }>} rows
 */
export function summarizeQueuedByKind(rows = []) {
  const byKind = {}
  let total = 0
  let oldestAt = null
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const kind = classifyDeferMessage(row?.errorMsg)
    if (!kind) continue
    byKind[kind] = (byKind[kind] || 0) + 1
    total += 1
    const ts = row?.sentAt instanceof Date ? row.sentAt.getTime() : Number(new Date(row?.sentAt ?? NaN))
    if (Number.isFinite(ts) && ts > 0 && (oldestAt == null || ts < oldestAt)) oldestAt = ts
  }
  return { byKind, total, oldestAt: oldestAt == null ? null : new Date(oldestAt).toISOString() }
}

function waitingLabel(total, oldestAt, now) {
  const n = Number(total) || 0
  const base = n === 1 ? '1 oferta está na fila' : `${n} ofertas estão na fila`
  const ts = oldestAt ? Number(new Date(oldestAt)) : NaN
  if (!Number.isFinite(ts) || ts <= 0 || now - ts < 60_000) return base
  const min = Math.round((now - ts) / 60_000)
  return `${base} (a mais antiga há ${min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ''}` : `${min} min`})`
}

/**
 * O aviso global, ou null quando não há o que avisar.
 * @param {object} p
 * @param {Array} p.groups           grupos da conta (`GET /groups`, com sendWindow)
 * @param {{ byKind?: object, total?: number, oldestAt?: string|null }|null} p.queued
 * @param {boolean|null} p.online    robô conectado agora
 * @param {number} [p.now]
 */
export function buildSendPauseNotice({ groups = [], queued = null, online = null, now = Date.now() } = {}) {
  // Desconectado, o assunto é a conexão (a shell já mostra) — não a espera.
  if (online !== true) return null
  const cta = { ctaLabel: 'Mudar esse tempo no Anti-banimento', ctaHref: ANTI_BAN_SETTINGS_HREF }

  const hours = describeSendPause(groups, now)
  if (hours) {
    return { kind: SEND_PAUSE_KIND.HORARIO, title: hours.title, body: `${hours.detail} Isso é o horário de envio que você definiu no Anti-banimento — não é defeito.`, ...cta }
  }

  const byKind = queued?.byKind && typeof queued.byKind === 'object' ? queued.byKind : {}
  const count = (k) => Number(byKind[k]) || 0
  const total = Number(queued?.total) || Object.values(byKind).reduce((a, b) => a + (Number(b) || 0), 0)
  if (total <= 0) return null
  const fila = waitingLabel(total, queued?.oldestAt, now)

  if (count(SEND_PAUSE_KIND.LIMITE_DIARIO) > 0) {
    return {
      kind: SEND_PAUSE_KIND.LIMITE_DIARIO,
      title: 'O robô está segurando ofertas: limite diário atingido',
      body: `${fila}. Um ou mais destinos já bateram o limite diário de ofertas que você definiu no Anti-banimento; elas voltam a sair amanhã. Não é defeito — é a proteção do seu número.`,
      ...cta,
    }
  }
  if (count(SEND_PAUSE_KIND.SEGURANCA) > 0) {
    return {
      kind: SEND_PAUSE_KIND.SEGURANCA,
      title: 'O robô pausou os envios por segurança',
      body: `${fila}. O Anti-banimento detectou sinal de risco num destino e segurou os envios para ele por um tempo. Ele volta sozinho; você não precisa fazer nada.`,
      ...cta,
    }
  }
  if (count(SEND_PAUSE_KIND.HORARIO) > 0) {
    return {
      kind: SEND_PAUSE_KIND.HORARIO,
      title: 'O robô está esperando o horário de envio de um destino',
      body: `${fila} esperando o horário de envio que você definiu no Anti-banimento para esse destino. Não é defeito.`,
      ...cta,
    }
  }
  return {
    kind: SEND_PAUSE_KIND.RITMO,
    title: 'O robô está esperando o tempo que você definiu no Anti-banimento',
    body: `${fila} esperando o intervalo entre envios. Não é defeito — é o ritmo que protege o seu número. Se quiser envios mais rápidos, ajuste o intervalo.`,
    ...cta,
  }
}
