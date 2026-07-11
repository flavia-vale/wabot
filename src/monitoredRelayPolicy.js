// Decide quando o pipeline monitorado pode usar relayMessage para reaproveitar
// a mídia hospedada da mensagem de origem. Relay preserva a foto original; por
// isso só pode ser usado no modo histórico "Imagem que veio na mensagem".
//
// 2026-07 (specs/001-image-mode-preview-default): como o chokepoint em
// src/billing/groupEntitlements.js força `imageMode` para 'preview' sempre,
// esta função NUNCA retorna `true` em runtime hoje (o relay de mídia original
// fica dormente). Lógica preservada intacta para reativação futura (FR-006) —
// não remover nem simplificar.
export function shouldRelayOriginalMediaForImageMode(imageMode) {
  return (imageMode ?? 'original') === 'original'
}
