import { getSiteUrl } from './site-url'

// Imagem OG padrão do site — arquivo ESTÁTICO em dashboard/public, gerado por
// `node scripts/build-og-image.mjs`.
//
// RCA 2026-09-18: esta função apontava para `/api/public/og` (com slug na
// query), rota
// que nunca existiu (nem no Next, nem no Fastify). Sete templates — as 10
// páginas comerciais, inclusive as 5 de loja do Tier 1 — publicavam um
// `og:image` que devolvia 404, e a home não declarava imagem nenhuma. Prévia
// sem imagem no WhatsApp, no ChatGPT, na Perplexity e nas redes: a pessoa não
// reconhece a marca ao clicar na citação. `test/og-image-existe.test.js` falha
// se o caminho voltar a apontar para algo que não existe em `public/`.
//
// A assinatura com `{ slug, cluster, template }` foi mantida para não mexer
// nos 7 chamadores; hoje todos recebem a mesma imagem. Arte por template só
// quando existir um arquivo por template em `public/` — nunca uma rota.
export const OG_DEFAULT_IMAGE_PATH = '/og-default.png'
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_ALT = 'Espelha Grupos — bot para afiliadas espelhar ofertas no WhatsApp'

export function buildOgImageUrl(_options = {}) {
  return `${getSiteUrl()}${OG_DEFAULT_IMAGE_PATH}`
}

export function buildOgImageDescriptor() {
  return { url: OG_DEFAULT_IMAGE_PATH, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: OG_IMAGE_ALT }
}
