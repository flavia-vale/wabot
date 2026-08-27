// COMO a oferta saiu no grupo — vocabulário único, usado pelo worker ao gravar
// e pelo painel admin ao ler.
//
// Por que existe (RCA 2026-08-26/27): "a oferta chegou sem foto" só era
// detectável quando a cliente reclamava. O `MessageLog` registrava que o envio
// deu certo, mas não COMO ele saiu — e "entreguei ao WhatsApp" não é a mesma
// coisa que "chegou bonito no grupo". Sem esse campo, três incidentes seguidos
// (foto borrada, foto sumida, texto pelado) foram descobertos pela cliente, não
// por nós.

export const DELIVERY_KIND = {
  // Foto de corpo inteiro (imageMessage). É o melhor resultado.
  FOTO: 'foto',
  // Repasse do proto de mídia da origem (modo relay).
  RELAY: 'relay',
  // Card clicável com a foto oficial da LOJA.
  CARD_LOJA: 'card_loja',
  // Card clicável com a foto da MENSAGEM DE ORIGEM (plano B — a loja não deu foto).
  CARD_ORIGEM: 'card_origem',
  // Card clicável com o banner de marca (cupom sem produto).
  CARD_BANNER: 'card_banner',
  // Texto puro: sem foto e sem card. É o pior resultado e o que a cliente
  // enxerga como "chegou sem imagem".
  TEXTO: 'texto',
}

const ROTULOS = {
  [DELIVERY_KIND.FOTO]: 'Foto',
  [DELIVERY_KIND.RELAY]: 'Foto (repasse)',
  [DELIVERY_KIND.CARD_LOJA]: 'Card com foto da loja',
  [DELIVERY_KIND.CARD_ORIGEM]: 'Card com foto da origem',
  [DELIVERY_KIND.CARD_BANNER]: 'Card com banner',
  [DELIVERY_KIND.TEXTO]: 'Só texto (sem imagem)',
}

export function rotuloDeliveryKind(kind) {
  return ROTULOS[kind] || 'Não registrado'
}

const COM_IMAGEM = new Set([
  DELIVERY_KIND.FOTO,
  DELIVERY_KIND.RELAY,
  DELIVERY_KIND.CARD_LOJA,
  DELIVERY_KIND.CARD_ORIGEM,
  DELIVERY_KIND.CARD_BANNER,
])

export function entregouComImagem(kind) {
  return COM_IMAGEM.has(kind)
}

/**
 * O caso que interessa vigiar: a oferta saiu SEM imagem nenhuma **e** a
 * mensagem de origem trazia imagem. Aí a foto existia e se perdeu no caminho —
 * é defeito nosso, não limitação da origem.
 *
 * `originImageBytes` nulo = envio antigo, sem registro: não conta como suspeito
 * (não sabemos, e alarme por dúvida treina a pessoa a ignorar o painel).
 */
export function ofertaPerdeuImagem({ deliveryKind, originImageBytes } = {}) {
  if (deliveryKind !== DELIVERY_KIND.TEXTO) return false
  return Number.isFinite(originImageBytes) && originImageBytes > 0
}
