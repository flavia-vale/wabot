// Módulo leaf, puro, sem I/O e sem imports pesados (mesmo padrão de
// reconnectPolicy.js / couponPolicy.js / monitoredRelayPolicy.js).
//
// Decide o que fazer quando o Mercado Livre recusa createLink() para um link
// sem produto (cupom/vitrine/perfil de terceiro), cruzando o motivo da recusa
// (`failureType`) com o fato de o link original já ser uma vitrine direta
// (`isDirectVitrine`) e de a usuária ter uma vitrine própria cadastrada
// (`hasVitrine`). Ver contrato normativo em
// specs/007-ml-vitrine-fallback-expired/contracts/decide-vitrine-fallback.md.
//
// Motivação (FR-001/FR-003/FR-005): antes desta feature, o fallback de
// vitrine própria (feature 004) só era aplicado no motivo `unsupported_url`.
// Quando o motivo é `expired` (SSID/cookie vencido) e o link já é vitrine
// direta de terceiro, renovar o SSID nunca resolve — mas a oferta era
// descartada com uma mensagem que sugeria exatamente isso. Esta função
// centraliza a decisão para os dois motivos tratarem vitrine direta do mesmo
// jeito, sem duplicar a lógica em cada call site.

export function decideVitrineFallback({ failureType, isDirectVitrine, hasVitrine }) {
  // Atualização 2026-07-23 (pedido da cliente): quando o SSID venceu
  // (`expired`) e a afiliada TEM vitrine própria cadastrada, usar a vitrine
  // dela mesmo que o link original seja um ENCURTADOR (não `/social/` direto).
  // Antes, `expired` só caía na vitrine com `isDirectVitrine` (linha 7 da
  // tabela = passthrough) — então cupom do ML por meli.la com SSID vencido era
  // descartado ("Credencial ML inválida/expirada") em vez de sair com a vitrine
  // + banner de cupom. Segurança preservada: a vitrine é o link de afiliado da
  // PRÓPRIA cliente (nunca vaza comissão), e este ramo só é alcançado quando
  // não há produto conversível a montante (resolveToCleanProductUrl == null).
  // `isDirectVitrine` segue relevante só para `missing_vitrine` (mensagem
  // acionável quando ela NÃO tem vitrine — não regride o RCA 2026-07-08).
  const useVitrine = hasVitrine
    && (failureType === 'unsupported_url' || failureType === 'expired')
  if (useVitrine) return 'use_vitrine'

  const missingVitrine = !hasVitrine
    && isDirectVitrine
    && (failureType === 'unsupported_url' || failureType === 'expired')
  if (missingVitrine) return 'missing_vitrine'

  const discard = failureType === 'unsupported_url' && !isDirectVitrine && !hasVitrine
  if (discard) return 'discard'

  return 'passthrough'
}
