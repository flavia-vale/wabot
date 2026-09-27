// Tela de decisão do teste — aparece UMA vez por dia a partir do dia 5 do
// teste grátis, por cima do painel, com a prova do que o robô já fez e o
// preço na conta dela. Módulo PURO: sem banco, sem relógio implícito.
//
// Por que existe (dado de 27/09/2026, `diag-funil-ativacao --dias 30`): 111
// pessoas viram o robô publicar oferta de verdade e só 29 abriram a tela de
// pagamento. Quem abre, paga (24 de 29). O aviso de fim de teste já existia
// (`trialNotice.js`), mas como faixa discreta no topo do painel — e a cliente
// satisfeita não abre o painel, porque está tudo funcionando sozinho. E-mail
// também não alcança (o "o que faltou" teve zero respostas).
//
// Decisão da dona do produto (27/09): o pedido de venda aparece no DIA 5 do
// teste, na tela, sem estender o teste e sem carência depois do vencimento.
//
// Regras:
//  - só plano `trial`, só antes de vencer (vencido é do banner de plano vencido);
//  - só a partir do dia 5 (`TRIAL_DECISION_FROM_DAYS_LEFT` dias para acabar);
//  - uma vez por dia de calendário (`lastShownDay` vem do navegador);
//  - com prova (ofertas publicadas > 0) pede a venda; sem prova, não aparece —
//    pedir pagamento a quem nunca viu o robô funcionar é perder a cliente, e
//    esse caso já tem o banner e o e-mail de configuração.

import { calendarDaysUntil, CONFIG_PRESERVED_NOTE, TRIAL_TIMEZONE } from './trialNotice.js'
import { buildPricePerOffer } from './pricePerOffer.js'

/** Teste de 7 dias: dia 5 = faltam 2 dias. */
export const TRIAL_DECISION_FROM_DAYS_LEFT = 2

/** Chave do navegador que guarda o último dia em que a tela apareceu. */
export const TRIAL_DECISION_STORAGE_KEY = 'eg_trial_decision_last_shown'

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Dia de calendário no fuso do produto, 'AAAA-MM-DD'. */
export function decisionDayKey(now = new Date(), timeZone = TRIAL_TIMEZONE) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

function labelDias(dias) {
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}

/**
 * @param {{
 *   plan?: string,
 *   accessExpiresAt?: string|Date,
 *   offersPublished?: number|null,
 *   destGroupCount?: number,
 *   basicPriceCents?: number,
 *   proPriceCents?: number,
 *   lastShownDay?: string|null,
 *   now?: Date,
 * }} params
 * @returns {null | {
 *   dayKey: string, daysLeft: number, offersPublished: number, messagesSaved: number,
 *   headline: string, proof: string, priceLine: string|null, preserved: string,
 *   ctaLabel: string, ctaHref: string, dismissLabel: string,
 * }}
 */
export function buildTrialDecisionScreen({
  plan,
  accessExpiresAt,
  offersPublished = null,
  destGroupCount = 0,
  basicPriceCents = null,
  proPriceCents = null,
  lastShownDay = null,
  now = new Date(),
} = {}) {
  if (plan !== 'trial') return null
  const expiresAt = toDate(accessExpiresAt)
  if (!expiresAt) return null
  if (expiresAt.getTime() - now.getTime() <= 0) return null

  // Ainda não sabemos quantas ofertas saíram: esperar, nunca mostrar "zero".
  if (offersPublished === null || offersPublished === undefined) return null
  const publicadas = Math.max(0, Math.trunc(Number(offersPublished) || 0))
  if (publicadas === 0) return null

  const daysLeft = calendarDaysUntil(now, expiresAt)
  if (daysLeft > TRIAL_DECISION_FROM_DAYS_LEFT) return null

  const dayKey = decisionDayKey(now)
  if (lastShownDay && lastShownDay === dayKey) return null

  const grupos = Math.max(1, Math.trunc(Number(destGroupCount) || 0))
  const messagesSaved = publicadas * grupos
  const plural = publicadas === 1 ? 'oferta' : 'ofertas'

  const basic = buildPricePerOffer({ priceCents: basicPriceCents, offersPublished: publicadas })
  const pro = buildPricePerOffer({ priceCents: proPriceCents, offersPublished: publicadas })
  let priceLine = null
  if (basic && pro) {
    priceLine = `No seu ritmo, o Basic sai por ${basic.porOferta} por oferta e o Pro por ${pro.porOferta}.`
  } else if (basic || pro) {
    priceLine = (basic || pro).texto
  }

  return {
    dayKey,
    daysLeft,
    offersPublished: publicadas,
    messagesSaved,
    headline: `Seu teste acaba ${labelDias(daysLeft)}. Quer que o robô continue?`,
    proof: grupos > 1
      ? `Até agora ele publicou ${publicadas} ${plural} em ${grupos} grupos: ${messagesSaved} mensagens que você não precisou digitar.`
      : `Até agora ele publicou ${publicadas} ${plural} nos seus grupos, sozinho.`,
    priceLine,
    preserved: CONFIG_PRESERVED_NOTE,
    ctaLabel: 'Escolher meu plano',
    ctaHref: '/painel/plano',
    dismissLabel: 'Decidir depois',
  }
}
