// Plano B em cascata da foto do card de preview clicável.
//
// O PROBLEMA (RCA 2026-08-19/21): o card de preview clicável é o formato que o
// produto quer — a mensagem sai como TEXTO + card grande, e tocar no card ABRE
// A LOJA. Só que a foto do card vinha de UMA fonte só: raspar a página da loja.
// Quando a loja bloqueia o IP do servidor (o Mercado Livre passou a servir o
// muro anti-robô, medido: 200 + ~39KB + sem `og:image`), `fetchProductImage`
// devolve `null`, `buildManualLinkPreview` devolve `null` por falta de
// thumbnail e a oferta sai como TEXTO PURO. Foi por isso que o padrão do
// produto teve de ser trocado para `original` ("a foto que veio na mensagem"),
// que não abre a loja — mas custou a clicabilidade: tocar numa imagem só amplia
// a imagem, não abre a loja.
//
// A CASCATA: a mensagem monitorada de origem quase sempre JÁ TRAZ a foto do
// produto. Se a loja não entregar, usar essa foto como thumbnail do card
// preserva as DUAS coisas ao mesmo tempo — foto E clique que abre a loja.
//
// POR QUE ISSO FUNCIONA (não é hipótese): o card do WhatsApp não faz ideia de
// onde vieram os bytes da thumbnail. Ela é só um JPEG subido por
// `prepareWAMessageMedia` com `mediaTypeOverride: 'thumbnail-link'`. O caminho
// do banner de marca (`buildStoreBrandCardImage`, specs/008) já alimenta
// exatamente os mesmos dois campos (`jpegThumbnail`/`hqSourceBuffer`) com um
// JPEG GERADO LOCALMENTE a partir de um SVG — nunca toca na loja — e renderiza
// card clicável normalmente. Ou seja, "bytes que não vêm da loja" é caminho já
// exercitado, não experimento.
//
// ORDEM (não inverter): a foto da LOJA continua sendo a primeira escolha. Ela é
// a foto do produto certo, em alta resolução. A foto da mensagem de origem é o
// PLANO B — vem do concorrente, pode trazer marca d'água/colagem/preço antigo.
// Trocar a ordem baixaria a qualidade de toda oferta para resolver o caso das
// bloqueadas.
//
// DEFAULT LIGADO, de propósito e sem risco para a produção de hoje: a cascata
// só roda no modo `preview`, e o padrão em produção é `original`
// (DEFAULT_GROUP_IMAGE_MODE) — logo, ligada por default ela NÃO muda nada no
// que está no ar agora. Ela existe justamente para ser exercitada quando
// `GROUP_IMAGE_MODE=preview` for religado em staging. E, mesmo lá, ela só entra
// em cena quando o card JÁ IA SAIR SEM FOTO: não há caminho em que ela piore o
// resultado — o pior caso dela é continuar sem foto, que é o estado atual.
// Escape hatch `PREVIEW_CARD_ORIGIN_FALLBACK=off` desliga sem redeploy.

/**
 * A foto da mensagem de origem pode socorrer o card quando a loja não entrega?
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function shouldUseOriginPhotoFallback(env = process.env) {
  const raw = String(env?.PREVIEW_CARD_ORIGIN_FALLBACK ?? '').trim().toLowerCase()
  return !['off', 'false', '0', 'no'].includes(raw)
}
