// Decide quando o pipeline monitorado pode usar relayMessage para reaproveitar
// a mídia hospedada da mensagem de origem. Relay preserva a foto original; por
// isso só pode ser usado no modo histórico "Imagem que veio na mensagem".
export function shouldRelayOriginalMediaForImageMode(imageMode) {
  return (imageMode ?? 'original') === 'original'
}
