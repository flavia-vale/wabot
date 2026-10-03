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
  const parsed = parseDeliveryFailureCode(errorMsg)
  if (!parsed) return ERROR_CATEGORIES.UNKNOWN
  return DELIVERY_FAILURE_REASONS[parsed.deliveryNetwork]?.[parsed.motivo]?.categoria ?? ERROR_CATEGORIES.OTHER
}

// Ponte para o classificador genérico existente — usada quando a falha de
// rede não tem motivo próprio ainda e precisa cair no catch-all já
// conhecido, em vez de inventar um caminho paralelo de classificação.
export function classifyGenericDeliveryError(err, context = {}) {
  return classifyError(err, context)
}

// Motivos de falha conhecidos por rede, com o texto leigo que a cliente lê no
// histórico (FR-028/SC-007). Cada motivo precisa de explicação PRÓPRIA — o
// texto genérico de "erro" é o que este catálogo existe para evitar (ver
// test/delivery-failure-taxonomy.test.js). Motivo novo entra aqui, com
// texto, antes de qualquer código gravar `error:delivery:<rede>:<motivo>`.
// `categoria` é sempre uma das já existentes em ERROR_CATEGORIES.
export const DELIVERY_FAILURE_REASONS = Object.freeze({
  telegram: Object.freeze({
    robo_nao_adicionado: Object.freeze({
      categoria: ERROR_CATEGORIES.CONFIG_BLOCK,
      texto: 'O robô do Espelha Grupos não está no seu grupo do Telegram. Adicione o robô ao grupo (tela Aplicativos) e as próximas ofertas voltam a sair.',
    }),
    sem_permissao: Object.freeze({
      categoria: ERROR_CATEGORIES.CONFIG_BLOCK,
      texto: 'O robô do Espelha Grupos está no seu grupo do Telegram, mas não pode publicar. Torne o robô administrador com permissão de enviar mensagens.',
    }),
    destino_apagado: Object.freeze({
      categoria: ERROR_CATEGORIES.CONFIG_BLOCK,
      texto: 'O grupo do Telegram não existe mais ou o robô foi tirado dele. Confira o grupo na tela Aplicativos.',
    }),
    plano_pausado: Object.freeze({
      categoria: ERROR_CATEGORIES.CONFIG_BLOCK,
      texto: 'Seu plano mudou e o envio para o Telegram foi pausado. Nada foi apagado: ao voltar para o Premium, os grupos voltam a receber sozinhos.',
    }),
    oferta_incompativel: Object.freeze({
      categoria: ERROR_CATEGORIES.CONFIG_BLOCK,
      texto: 'Esta oferta tem algo que o Telegram não aceita e não dava para enviar sem isso. As outras ofertas seguem normalmente.',
    }),
    limite_de_ritmo: Object.freeze({
      categoria: ERROR_CATEGORIES.TIMEOUT,
      texto: 'O Telegram pediu para o robô ir mais devagar. A oferta esperou a vez e foi descartada por ficar velha demais na fila.',
    }),
    aplicativo_desligado: Object.freeze({
      categoria: ERROR_CATEGORIES.CONFIG_BLOCK,
      texto: 'O envio para o Telegram está desligado na sua conta (tela Aplicativos). Seus grupos continuam cadastrados; é só ligar de novo.',
    }),
    entrega_incerta: Object.freeze({
      categoria: ERROR_CATEGORIES.OTHER,
      texto: 'O servidor reiniciou no meio do envio para o Telegram e não deu para confirmar se a oferta chegou. Para não repetir no seu grupo, ela não foi enviada de novo.',
    }),
    robo_indisponivel: Object.freeze({
      categoria: ERROR_CATEGORIES.OTHER,
      texto: 'O Telegram ficou fora do ar para o robô do Espelha Grupos neste momento. Não é nada na sua conta; o envio volta sozinho quando o Telegram normalizar.',
    }),
  }),
})

// Texto leigo de um código `error:delivery:*`. Motivo desconhecido ainda
// ganha uma frase que diz QUAL aplicativo falhou — nunca o texto genérico.
export function describeDeliveryFailure(errorMsg) {
  const parsed = parseDeliveryFailureCode(errorMsg)
  if (!parsed) return null
  const reason = DELIVERY_FAILURE_REASONS[parsed.deliveryNetwork]?.[parsed.motivo]
  if (reason) return reason.texto
  return 'A oferta não chegou neste aplicativo. As outras entregas seguem normalmente; se continuar, fale com o suporte.'
}
