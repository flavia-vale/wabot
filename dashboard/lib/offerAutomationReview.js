const SKIP_MESSAGES = {
  review_queue_full: 'A fila já está completa. Aprove ou remova uma oferta antes de buscar mais.',
  review_discovery_busy: 'Já existe uma busca em andamento. Aguarde alguns segundos.',
  no_shopee_credentials: 'Conecte sua conta da Shopee antes de buscar ofertas.',
  invalid_shopee_credentials: 'A conexão com a Shopee precisa ser atualizada antes da busca.',
}

export function explainReviewDiscovery(result = {}) {
  if (result.skipped) return { tone: 'warning', text: SKIP_MESSAGES[result.skipped] || 'Não foi possível iniciar uma nova busca agora.' }
  if (Number(result.discovered) > 0) return { tone: 'success', text: `${result.discovered} oferta(s) adicionada(s) à fila.` }
  if (Number(result.rawCount) > 0) return { tone: 'warning', text: 'Os produtos encontrados já estavam na fila ou foram publicados recentemente. Tente ajustar a busca.' }
  return { tone: 'warning', text: 'Nenhuma oferta correspondeu à busca e ao desconto mínimo. Tente palavras mais amplas ou diminua o desconto.' }
}
