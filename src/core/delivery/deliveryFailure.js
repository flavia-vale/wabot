// Feature 017 (arquitetura multicanal de entrega) — módulo PURO.
//
// Scaffold da taxonomia de falha POR REDE (R8/FR-028). Reaproveita as
// categorias de src/errorTaxonomy.js POR COMPOSIÇÃO — nunca duplica a
// classificação. Cada motivo específico de uma rede (Telegram na Fatia 3,
// origem na Fatia 5) entra aqui como um prefixo próprio dentro de
// `error:delivery:<rede>:<motivo>`, que cai em ERROR_CATEGORIES.OTHER até
// ganhar categoria própria — nunca em silêncio, e nunca reinventando o que
// já existe em errorTaxonomy.js.
//
// Nenhum motivo específico de Telegram é definido nesta fatia (a Fatia 3
// implementa o adaptador do Telegram e é quem sabe quais motivos existem de
// verdade — "robô não adicionado", "sem permissão", "limite de ritmo"...).
// Este arquivo só garante o formato estável do prefixo e a composição com a
// taxonomia existente, para que o motivo específico entre aqui sem
// reescrever o restante do pipeline de erro.

import { ERROR_CATEGORIES, classifyError } from '../../errorTaxonomy.js'

// Prefixo canônico de falha específica de rede de entrega. Formato:
// `error:delivery:<deliveryNetwork>:<motivo>`. `<motivo>` é um código curto,
// estável, nunca texto livre (o texto leigo é traduzido só na tela).
export function buildDeliveryFailureCode(deliveryNetwork, motivo) {
  const rede = String(deliveryNetwork ?? '').trim().toLowerCase() || 'desconhecida'
  const codigo = String(motivo ?? '').trim().toLowerCase() || 'falha_desconhecida'
  return `error:delivery:${rede}:${codigo}`
}

export function isDeliveryFailureCode(errorMsg) {
  return typeof errorMsg === 'string' && errorMsg.startsWith('error:delivery:')
}

// Extrai { deliveryNetwork, motivo } de um código construído por
// buildDeliveryFailureCode. Devolve null se o formato não bater — tolerante,
// nunca lança (mesma postura de categorizeErrorMsg).
export function parseDeliveryFailureCode(errorMsg) {
  if (!isDeliveryFailureCode(errorMsg)) return null
  const rest = errorMsg.slice('error:delivery:'.length)
  const separatorIndex = rest.indexOf(':')
  if (separatorIndex === -1) return null
  return {
    deliveryNetwork: rest.slice(0, separatorIndex),
    motivo: rest.slice(separatorIndex + 1),
  }
}

// Categoriza um errorMsg de rede de entrega dentro da taxonomia EXISTENTE
// (nunca cria uma categoria paralela). Hoje toda falha de rede cai em OTHER;
// motivos específicos que precisarem de categoria própria (ex.: um
// equivalente a CHANNEL_THROTTLED para "limite de ritmo do Telegram") entram
// aqui nas fatias seguintes, sem duplicar classifyError/categorizeErrorMsg.
export function categorizeDeliveryFailure(errorMsg) {
  if (!isDeliveryFailureCode(errorMsg)) return ERROR_CATEGORIES.UNKNOWN
  return ERROR_CATEGORIES.OTHER
}

// Ponte para o classificador genérico existente — usada quando a falha de
// rede não tem motivo próprio ainda e precisa cair no catch-all já
// conhecido, em vez de inventar um caminho paralelo de classificação.
export function classifyGenericDeliveryError(err, context = {}) {
  return classifyError(err, context)
}
