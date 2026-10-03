// Caixa de entrada "Hoje" do admin — decisão PURA (sem banco, sem rede).
//
// G1 da auditoria (docs/admin/auditoria-painel-admin.md): o Início mostrava
// cards e números; a fila de atendimento morava em outra tela; e nada dizia
// "quem primeiro". Aqui cada cliente vira NO MÁXIMO uma linha, com prioridade
// = peso financeiro × gravidade, e a ação primária ao lado.
//
// Fontes das linhas (todas já existentes e testadas):
//   - comercial: classifyOutreachSegment (outreachSegments.js) — cobrança
//     recusada, vence em breve, venceu, nunca publicou, robô caído ≥2 d,
//     parou de enviar, sem loja;
//   - operacional: findPayingDown / findPayingBlind (ops/adminOpsAlertPolicy)
//     — pagante com robô fora do ar há >2 h ou conectada sem receber >3 h.
// Invariante herdado de outreachSegments: UMA linha por cliente, a de maior
// prioridade. Três cobranças para a mesma pessoa no mesmo dia é o jeito mais
// rápido de ela parar de ler.

import { PAYING_STATUS } from './payingStatus.js'
import { describeOutreachSegment } from './outreachSegments.js'

/** Peso financeiro: quem paga vem antes de quem testa. */
export const PESO_FINANCEIRO = Object.freeze({
  [PAYING_STATUS.PAYING]: 3,
  [PAYING_STATUS.FORMER]: 2,
  trial_ativado: 1.5,
  lead: 1,
})

/** Gravidade por motivo (3 = receita parando agora, 1 = conversa de funil). */
export const GRAVIDADE = Object.freeze({
  'robo-caido-agora': 3,
  'cega-agora': 3,
  'cobranca-recusada': 3,
  'chave-de-loja': 2.5,
  'robo-caido': 2.5,
  'parou-de-enviar': 2,
  'sem-loja': 2,
  'vence-em-breve': 1.5,
  'venceu-ate-3d': 1.5,
  'venceu-4-a-20d': 1.2,
  'venceu-mais-20d': 1,
  'sem-envio-ate-7d': 1,
  'sem-envio-8-a-20d': 1,
})

/** Prioridade a partir da qual a linha entra em "Agora" em vez de "Esta semana". */
export const LIMIAR_AGORA = 6

const MOTIVOS_OPERACIONAIS = Object.freeze({
  'robo-caido-agora': {
    titulo: 'Robô fora do ar',
    porque: 'Pagante sem robô é receita parando agora.',
    acao: 'Reconectar; se o WhatsApp pedir QR novo, avisar a cliente.',
  },
  'cega-agora': {
    titulo: 'Conectada, mas sem receber',
    porque: 'Verde mentiroso: as ofertas dela não estão chegando.',
    acao: 'Reconectar; se repetir, é caso de re-pareamento.',
  },
  'chave-de-loja': {
    titulo: 'Chave de loja vencida ou recusada',
    porque: 'A sondagem diária confirmou: a loja recusa a chave dela. As ofertas dessa loja saem sem comissão ou não saem.',
    acao: 'Abrir a ficha (aba Técnico), conferir "Chaves das lojas" e pedir para ela recadastrar.',
  },
})

export function pesoFinanceiro({ payingStatus, everSent = false } = {}) {
  if (payingStatus === PAYING_STATUS.PAYING) return PESO_FINANCEIRO[PAYING_STATUS.PAYING]
  if (payingStatus === PAYING_STATUS.FORMER) return PESO_FINANCEIRO[PAYING_STATUS.FORMER]
  return everSent ? PESO_FINANCEIRO.trial_ativado : PESO_FINANCEIRO.lead
}

export function descreverMotivo(motivo) {
  if (MOTIVOS_OPERACIONAIS[motivo]) return MOTIVOS_OPERACIONAIS[motivo]
  const seg = describeOutreachSegment(motivo)
  if (!seg) return { titulo: motivo, porque: '', acao: '' }
  return { titulo: seg.titulo.replace(/^\d+\.\s*/, ''), porque: seg.porque, acao: seg.acao }
}

/** Ações disponíveis por motivo. A primeira é a primária. */
export function acoesPara(motivo, { canAdminRetry = false, telefone = '' } = {}) {
  const acoes = []
  if ((motivo === 'robo-caido-agora' || motivo === 'cega-agora' || motivo === 'robo-caido') && canAdminRetry) acoes.push('reconectar')
  if (telefone) acoes.push('whatsapp')
  acoes.push('ficha')
  return acoes
}

/**
 * @param clientes [{ id, nome, email, telefone, payingStatus, everSent, segmento, canAdminRetry,
 *                    operacional?: 'robo-caido-agora'|'cega-agora', chaveDeLoja?: boolean, detalheMs?: number }]
 */
export function buildInbox({ clientes = [], now = new Date() } = {}) {
  const linhas = []
  for (const c of clientes) {
    // Uma linha por cliente: operacional manda; entre o segmento comercial e a
    // chave de loja ruim vence a de maior gravidade (empate = segmento).
    let motivo = c.operacional || c.segmento
    if (!c.operacional && c.chaveDeLoja && (!motivo || (GRAVIDADE[motivo] ?? 0) < GRAVIDADE['chave-de-loja'])) motivo = 'chave-de-loja'
    if (!motivo || !GRAVIDADE[motivo]) continue
    const peso = pesoFinanceiro(c)
    const prioridade = Math.round(peso * GRAVIDADE[motivo] * 10) / 10
    const desc = descreverMotivo(motivo)
    linhas.push({
      userId: c.id,
      nome: c.nome ?? null,
      email: c.email ?? null,
      telefone: c.telefone ?? null,
      payingStatus: c.payingStatus ?? PAYING_STATUS.NEVER,
      motivo,
      titulo: desc.titulo,
      porque: desc.porque,
      sugestao: desc.acao,
      detalheMs: Number.isFinite(c.detalheMs) ? c.detalheMs : null,
      acoes: acoesPara(motivo, c),
      prioridade,
      secao: prioridade >= LIMIAR_AGORA ? 'agora' : 'semana',
    })
  }
  linhas.sort((a, b) => b.prioridade - a.prioridade || String(a.email).localeCompare(String(b.email)))
  return {
    generatedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    agora: linhas.filter(l => l.secao === 'agora'),
    semana: linhas.filter(l => l.secao === 'semana'),
    total: linhas.length,
  }
}
