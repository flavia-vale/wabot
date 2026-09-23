// "Assinei e o robô parou" (RCA 2026-09-23, conta tecnicotelecom10@gmail.com).
//
// O teste grátis libera tudo do Pro (canais, ofertas automáticas, filas —
// `hasProLikeAccess` em src/billing/plans.js). A cliente monta o robô usando
// isso, paga o Básico, e na virada o plano desliga esses recursos SEM AVISO:
// canal some da config do robô (`buildEntitledGroupConfig`), automação e fila
// deixam de rodar (os crons pulam o dono). Medido na conta: canal-destino com
// 121 ofertas publicadas no teste, zero tentativas desde a troca de plano,
// enquanto o grupo ao lado seguia recebendo. Para ela, "paguei e parou".
//
// Este módulo é PURO (sem banco): recebe as contagens e devolve o que a tela
// precisa dizer. Dois momentos, com frases diferentes:
//   - ANTES de escolher (teste grátis ou Pro): no card do Básico, avisar o que
//     vai parar — é aqui que a decisão ainda pode ser outra.
//   - DEPOIS (já no Básico): dizer que parou, e o que faz voltar.

export const PRO_FEATURES = Object.freeze({
  CHANNELS: 'channels',
  OFFER_AUTOMATIONS: 'offer_automations',
  OFFER_QUEUES: 'offer_queues',
})

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function toCount(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

// Lista, em linguagem leiga, o que a conta usa hoje e o Básico não cobre.
// Contagem ausente ou inválida vira zero: sem dado confiável não se afirma
// que ela usa algo (aviso falso faria a cliente pagar mais sem precisar).
export function listProFeaturesInUse({ channelCount, activeAutomationCount, activeQueueCount } = {}) {
  const items = []
  const canais = toCount(channelCount)
  const automacoes = toCount(activeAutomationCount)
  const filas = toCount(activeQueueCount)
  if (canais) items.push({ feature: PRO_FEATURES.CHANNELS, count: canais, label: plural(canais, 'canal do WhatsApp', 'canais do WhatsApp') })
  if (automacoes) items.push({ feature: PRO_FEATURES.OFFER_AUTOMATIONS, count: automacoes, label: plural(automacoes, 'oferta automática', 'ofertas automáticas') })
  if (filas) items.push({ feature: PRO_FEATURES.OFFER_QUEUES, count: filas, label: plural(filas, 'fila de ofertas', 'filas de ofertas') })
  return items
}

function joinLabels(items) {
  const labels = items.map(item => item.label)
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
}

// Decide o aviso da tela de planos. Devolve `null` quando não há o que dizer.
//   - plano 'basic' com acesso ativo e recursos do Pro configurados → 'stopped'
//     (já parou; a ação é trocar para o Pro);
//   - qualquer outro plano ('trial', 'pro') com recursos do Pro em uso →
//     'before_choosing' (aparece no card do Básico, antes do clique).
export function buildProFeaturesNotice({ plan, accessActive, items } = {}) {
  const inUse = Array.isArray(items) ? items.filter(item => item && item.count > 0) : []
  if (!inUse.length) return null
  const lista = joinLabels(inUse)
  const normalizedPlan = String(plan ?? '').trim().toLowerCase()

  if (normalizedPlan === 'basic') {
    if (accessActive === false) return null
    return {
      kind: 'stopped',
      title: 'Parte do seu robô está parada porque o plano Basic não inclui esses recursos',
      body: `No seu robô há ${lista}. No plano Basic isso fica guardado, mas não envia nada. Seus grupos continuam funcionando normalmente.`,
      action: 'Para voltar a enviar, mude para o plano Pro. Nada precisa ser configurado de novo.',
      items: inUse,
    }
  }

  return {
    kind: 'before_choosing',
    title: 'Atenção: o Basic não inclui o que você usa hoje',
    body: `Você usa ${lista}. No plano Basic isso para de enviar — só os grupos continuam.`,
    action: 'Para manter tudo funcionando como está, escolha o plano Pro.',
    items: inUse,
  }
}
