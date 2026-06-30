// Decide quando o pipeline monitorado pode usar relayMessage para reaproveitar
// a mídia hospedada da mensagem de origem. Relay preserva a foto original; por
// isso só pode ser usado no modo histórico "Imagem que veio na mensagem".
//
// Mesmo quando o pipeline de fallback usa canvas/padding (fit=contain), grupo →
// grupo deve preferir relay quando há uma mídia original boa: isso evita o novo
// upload da imagem e mantém o comportamento histórico do WhatsApp, aceitando o
// risco conhecido de corte/sem canvas seguro.
export function shouldRelayOriginalMediaForImageMode(imageMode, options = {}) {
  if ((imageMode ?? 'original') !== 'original') return false
  return true
}
