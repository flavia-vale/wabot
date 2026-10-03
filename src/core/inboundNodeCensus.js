// Censo de entrada do socket (RCA 2026-10-03, "conta conectada e cega").
//
// Pergunta que ninguém conseguia responder pelo bot.log: numa conta
// "conectada" que não espelha nada, as mensagens de GRUPO sequer chegam ao
// socket? O log só tinha rastro das mensagens que ABRIAM (`messages.upsert`,
// `mensagem recebida`) e das que falhavam ao abrir (`failed to decrypt`). O que
// o Baileys confirma e descarta antes de abrir (`shouldIgnoreJid`) sai em
// `debug`, que não vai para o arquivo, e o que o servidor nunca manda não deixa
// linha nenhuma — os dois casos ficavam idênticos: silêncio.
//
// Aqui contamos, por tipo de chat, cada nó `<message>` que chegou ao socket
// (gancho `onIncomingMessageNode` do patch do Baileys — ANTES de qualquer
// decisão), o que foi descartado e por qual regra, o que falhou ao abrir, o que
// chegou ao `messages.upsert` e o que o robô aceitou. A diferença entre os
// baldes separa as hipóteses:
//
//   chegou=0                       → o servidor não entrega grupo a este aparelho
//   chegou>0, descartado≈chegou    → regra nossa descartando (qual: `ignored`)
//   chegou>0, falhou≈chegou        → chave de grupo (sender-key) ruim
//   chegou>0, upsert>0, aceito=0   → filtro do worker (fromMe, frescor, dedup)
//
// Só contagem e amostra limitada — nunca uma linha por mensagem. Puro: sem
// logger, sem relógio implícito, sem estado global. O worker guarda a instância
// em escopo de módulo (sobrevive a reconexões; só o `aceito` zera o
// "desde a última aceitação").

import { chatKindOfJid } from './stuckAckClassifier.js'

export const INBOUND_KINDS = Object.freeze(['grupo', 'dm', 'canal', 'status', 'propria', 'desconhecido'])

export const DEFAULT_INBOUND_CENSUS_INTERVAL_MS = 30 * 60_000
export const DEFAULT_INBOUND_CENSUS_SAMPLE = 3

function normalize(jid) {
  return typeof jid === 'string' ? jid.trim().replace(/:\d+(?=@)/, '') : ''
}

// Tipo de chat do ponto de vista do censo. A própria conta (número ou @lid)
// vem antes de `dm`: é por ela que chegam histórico, notificações e as cópias
// `fromMe` de outro aparelho — misturá-las com conversa de contato esconderia
// justamente o caso do RCA "Cegueira com DMs fromMe".
export function classifyInboundChat(jid, { selfJids } = {}) {
  const normalized = normalize(jid)
  if (!normalized) return 'desconhecido'
  if (selfJids && typeof selfJids.has === 'function' && selfJids.has(normalized)) return 'propria'
  return chatKindOfJid(normalized)
}

function emptyByKind() {
  const o = {}
  for (const k of INBOUND_KINDS) o[k] = 0
  return o
}

function bump(obj, key, by = 1) {
  obj[key] = (obj[key] || 0) + by
}

function compact(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) if (v) out[k] = v
  return out
}

// Instância do censo. Dois relógios:
//  - `janela`: zera a cada `drain()` (resumo periódico no log);
//  - `desdeAceite`: zera só em `noteAccepted()` — é o que o classificador de
//    cegueira usa, porque reconexão e passagem de tempo não podem limpar a
//    evidência (mesma lição de failuresSinceLastAccepted).
export function createInboundCensus({ sampleLimit = DEFAULT_INBOUND_CENSUS_SAMPLE } = {}) {
  const limiteAmostra = Math.max(0, Number(sampleLimit) || 0)
  let janela = fresh()
  let desdeAceite = { arrivals: emptyByKind(), ignored: {}, decryptFailures: emptyByKind(), upserts: emptyByKind() }
  let lastArrivalAtByKind = {}
  let lastAcceptedAt = null
  let totalAccepted = 0

  function fresh(now = null) {
    return {
      since: now,
      arrivals: emptyByKind(),
      arrivalsOffline: emptyByKind(),
      encTypes: {},
      ignored: {},
      decryptFailures: emptyByKind(),
      upserts: emptyByKind(),
      accepted: emptyByKind(),
      sampled: emptyByKind(),
    }
  }

  return {
    // Nó `<message>` chegou ao socket, antes de qualquer decisão. Devolve o tipo
    // e se esta chegada deve virar linha de amostra no log (primeiras N por
    // tipo na janela) — quem loga é o worker.
    noteArrival({ chatJid, offline = false, encType = null, now = Date.now(), selfJids } = {}) {
      const kind = classifyInboundChat(chatJid, { selfJids })
      if (janela.since == null) janela.since = now
      bump(janela.arrivals, kind)
      bump(desdeAceite.arrivals, kind)
      if (offline) bump(janela.arrivalsOffline, kind)
      if (encType) bump(janela.encTypes, `${kind}:${encType}`)
      lastArrivalAtByKind[kind] = now
      let sample = false
      if (janela.sampled[kind] < limiteAmostra) {
        janela.sampled[kind] += 1
        sample = true
      }
      return { kind, sample }
    },
    // Descartado por regra nossa antes de abrir (`rule`: escopo, grupo_nao_monitorado,
    // canal_quarentena, chat_quarentena, dm_outro_aparelho...). Atenção: o mesmo
    // `shouldIgnoreJid` do Baileys também é consultado para recibo, notificação e
    // presença do chat — este balde pode SUPERESTIMAR o descarte em relação a
    // `arrivals` (que conta só nó `<message>`). Por isso `describeBlindness` só
    // compara descarte com falha de decrypt, nunca com a chegada.
    noteIgnored(chatJid, rule, { selfJids } = {}) {
      const kind = classifyInboundChat(chatJid, { selfJids })
      const key = `${kind}:${rule || 'sem_regra'}`
      bump(janela.ignored, key)
      bump(desdeAceite.ignored, key)
      return kind
    },
    // Linha de falha de decrypt do Baileys (Bad MAC, MessageCounterError, retry receipt).
    noteDecryptFailure(chatJid, { selfJids } = {}) {
      const kind = classifyInboundChat(chatJid, { selfJids })
      bump(janela.decryptFailures, kind)
      bump(desdeAceite.decryptFailures, kind)
      return kind
    },
    // Mensagem abriu e chegou ao `messages.upsert` do worker.
    noteUpsert(chatJid, { selfJids } = {}) {
      const kind = classifyInboundChat(chatJid, { selfJids })
      bump(janela.upserts, kind)
      bump(desdeAceite.upserts, kind)
      return kind
    },
    // O robô ACEITOU a mensagem (passou pelos filtros). Única coisa que zera o
    // "desde a última aceitação".
    noteAccepted(chatJid, { now = Date.now(), selfJids } = {}) {
      const kind = classifyInboundChat(chatJid, { selfJids })
      bump(janela.accepted, kind)
      totalAccepted += 1
      lastAcceptedAt = now
      desdeAceite = { arrivals: emptyByKind(), ignored: {}, decryptFailures: emptyByKind(), upserts: emptyByKind() }
      return kind
    },
    // Foto para IPC/metrics e para o sinal de cegueira. Não zera nada.
    snapshot(now = Date.now()) {
      return {
        window: {
          sinceMs: janela.since,
          arrivals: compact(janela.arrivals),
          arrivalsOffline: compact(janela.arrivalsOffline),
          encTypes: compact(janela.encTypes),
          ignored: compact(janela.ignored),
          decryptFailures: compact(janela.decryptFailures),
          upserts: compact(janela.upserts),
          accepted: compact(janela.accepted),
        },
        sinceLastAccepted: {
          arrivals: compact(desdeAceite.arrivals),
          ignored: compact(desdeAceite.ignored),
          decryptFailures: compact(desdeAceite.decryptFailures),
          upserts: compact(desdeAceite.upserts),
        },
        lastGroupArrivalAgeMs: lastArrivalAtByKind.grupo != null ? Math.max(0, now - lastArrivalAtByKind.grupo) : null,
        lastArrivalAgeMs: Object.keys(lastArrivalAtByKind).length
          ? Math.max(0, now - Math.max(...Object.values(lastArrivalAtByKind)))
          : null,
        lastAcceptedAgeMs: lastAcceptedAt != null ? Math.max(0, now - lastAcceptedAt) : null,
        totalAccepted,
      }
    },
    // Resumo da janela para o log periódico; zera a janela (não o "desde aceite").
    drain(now = Date.now()) {
      const snap = this.snapshot(now)
      const resumo = { ...snap.window, windowMs: janela.since != null ? Math.max(0, now - janela.since) : 0 }
      janela = fresh(now)
      return { ...resumo, sinceLastAccepted: snap.sinceLastAccepted, lastGroupArrivalAgeMs: snap.lastGroupArrivalAgeMs, totalAccepted }
    },
  }
}

export const BLIND_KIND = Object.freeze({
  NOTHING_ARRIVES: 'nada_chega',
  DROPPED_BY_RULE: 'chega_e_e_descartada',
  FAILS_TO_OPEN: 'chega_e_nao_abre',
  NOT_ACCEPTED: 'chega_e_nao_e_aceita',
  UNKNOWN: 'sem_dado',
})

// Lê o "desde a última aceitação" e diz EM QUE PONTO a mensagem de grupo some.
// É a separação das hipóteses do RCA; vai no log e no sinal de cegueira para
// que o aviso à dona já diga qual é o caso (e qual a ação).
export function describeBlindness(snapshot) {
  const s = snapshot?.sinceLastAccepted
  if (!s) return { kind: BLIND_KIND.UNKNOWN, grupoChegou: 0, grupoDescartado: 0, grupoFalhou: 0, grupoUpsert: 0 }
  const grupoChegou = Number(s.arrivals?.grupo) || 0
  const grupoDescartado = Object.entries(s.ignored || {}).filter(([k]) => k.startsWith('grupo:')).reduce((a, [, v]) => a + (Number(v) || 0), 0)
  const grupoFalhou = Number(s.decryptFailures?.grupo) || 0
  const grupoUpsert = Number(s.upserts?.grupo) || 0
  const base = { grupoChegou, grupoDescartado, grupoFalhou, grupoUpsert }
  if (grupoChegou === 0) return { kind: BLIND_KIND.NOTHING_ARRIVES, ...base }
  if (grupoUpsert > 0) return { kind: BLIND_KIND.NOT_ACCEPTED, ...base }
  if (grupoFalhou >= grupoDescartado) return { kind: BLIND_KIND.FAILS_TO_OPEN, ...base }
  return { kind: BLIND_KIND.DROPPED_BY_RULE, ...base }
}

// Texto curto, para o aviso à dona (sem jargão).
export function blindKindHint(kind) {
  switch (kind) {
    case BLIND_KIND.NOTHING_ARRIVES:
      return 'nenhuma mensagem de grupo chega ao robô: o WhatsApp não está entregando a este aparelho — é caso de parear de novo (desconectar, esquecer o aparelho no celular e ler o QR)'
    case BLIND_KIND.DROPPED_BY_RULE:
      return 'as mensagens de grupo chegam e uma regra nossa descarta antes de abrir — conferir a lista de grupos monitorados e o modo de escopo'
    case BLIND_KIND.FAILS_TO_OPEN:
      return 'as mensagens de grupo chegam e não abrem (chave do grupo) — Reconectar costuma resolver; se repetir, parear de novo'
    case BLIND_KIND.NOT_ACCEPTED:
      return 'as mensagens de grupo chegam e abrem, mas o robô não aceita nenhuma — filtro do worker (fromMe, frescor, duplicata)'
    default:
      return 'sem dado do censo de entrada (robô antigo ou sem o conserto)'
  }
}
