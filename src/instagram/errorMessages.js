// Tradução dos erros do Instagram para a tela da cliente.
//
// Regra do produto: nome técnico não chega à tela. Antes o painel imprimia o
// `error.message` cru do backend — "Meta HTTP 400", "Container ERROR",
// "Chave de idempotência pertence a outra publicação" —, que não diz nada e
// ainda vaza jargão. Aqui cada código vira uma frase que diz O QUE aconteceu e
// O QUE fazer.
const MESSAGES = {
  FEATURE_REQUIRES_PREMIUM: 'A publicação no Instagram ainda não está liberada para o seu plano.',
  INSTAGRAM_CONFIG_MISSING: 'A conexão com o Instagram ainda não está configurada aqui. Fale com o suporte.',
  INSTAGRAM_RUNTIME_UNAVAILABLE: 'A publicação no Instagram está indisponível neste momento. Tente de novo em alguns minutos.',
  INSTAGRAM_ACCOUNT_SELECTION_REQUIRED: 'Encontramos mais de uma conta do Instagram no seu perfil. Conecte pela opção do Instagram para escolher qual usar.',
  INVALID_OAUTH_STATE: 'O pedido de conexão expirou. Clique em "Conectar Instagram" de novo.',
  NOT_FOUND: 'Não encontramos essa conta do Instagram na sua conta.',
  CONNECTION_UNAVAILABLE: 'A conta do Instagram não está conectada. Reconecte para voltar a publicar.',
  INVALID_CREDENTIAL: 'O Instagram não aceita mais essa conexão. Reconecte a conta.',
  NEEDS_RECONNECT: 'O Instagram pediu para você entrar de novo. Reconecte a conta.',
  META_OAUTH_FAILED: 'O Instagram recusou a conexão. Confira se a conta é profissional (Business ou Creator) e tente de novo.',
  META_OAUTH_NETWORK: 'Não conseguimos falar com o Instagram agora. Tente de novo em alguns minutos.',
  META_NETWORK_ERROR: 'Não conseguimos falar com o Instagram agora. Vamos tentar sozinhos mais tarde.',
  META_PUBLISH_FAILED: 'O Instagram recusou esta publicação. Vamos tentar de novo automaticamente.',
  PUBLISHING_LIMIT_REACHED: 'A conta atingiu o limite de publicações do dia no Instagram. Vamos publicar assim que a janela liberar.',
  STORY_PACING: 'Aguardando o intervalo entre publicações para não parecer disparo automático.',
  ASSET_UNAVAILABLE: 'A imagem desta oferta expirou. Envie a oferta de novo.',
  IMAGE_UNAVAILABLE: 'Não conseguimos pegar a foto do produto nesta oferta.',
  PREPARE_FAILED: 'Não conseguimos montar a imagem desta oferta. Confira o link e a foto.',
  DESTINATION_UNAVAILABLE: 'Essa conta do Instagram foi desligada ou removida. Reconecte para publicar nela.',
  TEMPLATE_UNAVAILABLE: 'O modelo de imagem não está disponível. Fale com o suporte.',
  IDEMPOTENCY_CONFLICT: 'Essa oferta já foi enviada para o Instagram.',
  CONTAINER_ERROR: 'O Instagram não conseguiu processar a imagem. Vamos tentar de novo.',
  CONTAINER_EXPIRED: 'O Instagram demorou demais para processar a imagem. Envie a oferta de novo.',
  CONTAINER_TIMEOUT: 'O Instagram está demorando para processar. Vamos tentar de novo sozinhos.',
  INVALID_META_RESPONSE: 'O Instagram respondeu de um jeito que não entendemos. Vamos conferir e tentar de novo.',
}

export const FALLBACK_INSTAGRAM_MESSAGE = 'Não conseguimos concluir a ação no Instagram agora. Tente de novo em alguns minutos.'

export function friendlyInstagramError(error) {
  if (!error) return FALLBACK_INSTAGRAM_MESSAGE
  return MESSAGES[error.code] || FALLBACK_INSTAGRAM_MESSAGE
}
