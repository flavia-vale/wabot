// Feature 017 (arquitetura multicanal de entrega) — módulo PURO.
//
// A oferta NEUTRA (D-A3 do plano): o conteúdo pronto para publicar,
// independente de aplicativo. É o que o miolo compartilhado produz e o que
// cada rede traduz para o seu formato. O WhatsApp NÃO passa a usar esta
// estrutura nesta fatia — ele continua montando o payload dele exatamente
// como hoje (src/monitoredMessagePayload.js); a oferta neutra alimenta os
// OUTROS adaptadores (rede fictícia de teste, Telegram na Fatia 3).
//
// Forma: { texto, linkConvertido, imagem: { url, bytes? }, produto: { titulo,
// preco }, botao?, marca? } — data-model.md §4.2.

/**
 * degradeFor(oferta, capabilities) — FR-009: quando o formato completo de
 * uma oferta não cabe na rede de destino, ela sai na MELHOR FORMA POSSÍVEL
 * ali (nunca é descartada por causa disso), e o que foi reduzido é
 * registrado — nunca em silêncio (SC-012).
 *
 * Devolve { oferta, reducoes: [códigos] }. Os códigos são estáveis e
 * traduzidos para linguagem leiga só na tela (dashboard/lib/painel/*).
 */
export const DELIVERY_REDUCTION = Object.freeze({
  BOTAO_REMOVIDO: 'botao_removido',
  CARD_REMOVIDO: 'card_removido',
  IMAGEM_REMOVIDA: 'imagem_removida',
  VIDEO_REMOVIDO: 'video_removido',
  MARCA_DAGUA_REMOVIDA: 'marca_dagua_removida',
  SEM_IMAGEM_DISPONIVEL: 'sem_imagem_disponivel',
})

function hasImage(oferta) {
  return Boolean(oferta?.imagem?.url)
}

export function degradeFor(oferta, capabilities = {}) {
  const reducoes = []
  const resultado = { ...oferta }

  if (resultado.botao && !capabilities.acceptsButton) {
    delete resultado.botao
    reducoes.push(DELIVERY_REDUCTION.BOTAO_REMOVIDO)
  }

  if (resultado.marca && !capabilities.acceptsWatermark) {
    delete resultado.marca
    reducoes.push(DELIVERY_REDUCTION.MARCA_DAGUA_REMOVIDA)
  }

  if (hasImage(resultado) && !capabilities.acceptsImage) {
    resultado.imagem = null
    reducoes.push(DELIVERY_REDUCTION.IMAGEM_REMOVIDA)
  }

  // Rede que EXIGE imagem e a oferta não tem: não é degradação — é o
  // adaptador quem decide (via readiness/send) se recusa ou não a
  // publicação. Aqui só registramos o fato para quem chamou decidir.
  if (capabilities.requiresImage && !hasImage(resultado)) {
    reducoes.push(DELIVERY_REDUCTION.SEM_IMAGEM_DISPONIVEL)
  }

  return { oferta: resultado, reducoes }
}

/**
 * Serializa a lista de códigos de redução para o formato gravado em
 * MessageLog.deliveryReductions (string, códigos separados por vírgula).
 * Lista vazia/ausente vira null (= nada foi reduzido).
 */
export function serializeDeliveryReductions(reducoes) {
  if (!Array.isArray(reducoes) || reducoes.length === 0) return null
  return reducoes.filter(Boolean).join(',')
}

export function parseDeliveryReductions(value) {
  if (!value || typeof value !== 'string') return []
  return value.split(',').map((code) => code.trim()).filter(Boolean)
}
