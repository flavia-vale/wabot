// Foto das ofertas da Magalu: por que ela vinha vazia e o que este módulo faz.
//
// RCA 2026-09-17 — "ofertas da Magalu estão indo sem imagem".
//
// A Magalu era a ÚNICA loja habilitada (`platforms` em src/api/routes/config.js)
// sem ramo próprio em `fetchProductImage`: Shopee tem a API de afiliado, Amazon
// tem o `data-a-dynamic-image`, Mercado Livre tem vitrine + API, SHEIN tem o
// strip de `_thumbnail_`. A Magalu caía só no leitor genérico de HTML
// (`resolveByHtmlLayers`) — e esse caminho é justamente o que a loja fecha.
//
// Medido (2026-09-17, do servidor, página real de produto):
//   - navegador, Googlebot, Twitterbot, Slackbot, TelegramBot, iPhone, curl
//     → **403** com a página de erro de marca da Magalu (1.075 bytes,
//       "Não é possível acessar a página", CSS em `wx.mlcdn.com.br/akamai-bot/`);
//   - User-Agent do WhatsApp → **200** com ~2,5KB de desafio JavaScript do
//     Akamai Bot Manager (`sec-if-cpt-container`, "Powered and protected by
//     Akamai"), sem `og:image` nenhum.
//
// O segundo caso é a MESMA armadilha do muro do Mercado Livre (seção
// "ML sem foto" do AGENTS.md): **vem com status 200**, então "a página
// respondeu" não significa nada, e o resultado chegava ao log como
// `scrape_sem_imagem` — que quer dizer "a loja não tem foto deste produto",
// um diagnóstico com ação OPOSTA à real (a loja está barrando o servidor).
// O primeiro caso era ainda mais mudo: `fetchHtml` devolve `{ html: null }`
// em qualquer `!res.ok`, então 403 de bloqueio e 404 de link morto eram
// indistinguíveis.
//
// Este módulo é puro (sem rede, sem banco) para poder ser testado sem a loja:
//   - `isMagaluBotWallHtml` dá nome ao muro nas DUAS formas;
//   - `buildMagaluImageUrlCandidates` sobe a resolução da foto quando ela
//     chega (o og:image da Magalu vem com o tamanho no caminho do CDN).

// Hosts do CDN de imagem da Magalu. `a-static` serve a foto do produto;
// `wx` serve os assets compartilhados da loja (inclusive os da própria página
// de bloqueio, que segue acessível — ou seja, o CDN NÃO é o que está barrado).
const MAGALU_IMAGE_HOST_RE = /(^|\.)mlcdn\.com\.br$/i

// Marcadores do Akamai Bot Manager e da página de erro de marca da Magalu.
// Nenhum deles aparece em página de produto legítima.
const MAGALU_BOT_WALL_RE = /sec-if-cpt-container|akamai-bot\/css|powered and protected by|n(?:ã|a)o (?:é|e) poss(?:í|i)vel acessar a p(?:á|a)gina|_abck/i

/**
 * O HTML que a Magalu devolveu é o muro anti-robô (403 de marca ou desafio
 * JavaScript do Akamai com status 200) em vez da página do produto?
 * @param {string|null|undefined} html
 * @returns {boolean}
 */
export function isMagaluBotWallHtml(html) {
  if (typeof html !== 'string' || !html) return false
  return MAGALU_BOT_WALL_RE.test(html)
}

/**
 * O status HTTP da Magalu é recusa de acesso (bloqueio de borda), e não
 * "produto não existe"? 403 e 429 são os dois que o Akamai usa; 404 continua
 * significando link morto e NÃO deve ser reportado como bloqueio.
 * @param {number|null|undefined} status
 * @returns {boolean}
 */
export function isMagaluBlockedStatus(status) {
  return status === 403 || status === 429
}

/**
 * É uma URL do CDN de imagem da Magalu?
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isMagaluImageUrl(rawUrl) {
  try {
    return MAGALU_IMAGE_HOST_RE.test(new URL(rawUrl).hostname)
  } catch {
    return false
  }
}

// O og:image da Magalu carrega o tamanho no PRIMEIRO segmento do caminho:
// `https://a-static.mlcdn.com.br/450x450/<slug>/<loja>/<sku>/<hash>.jpg`.
// Muitas páginas anunciam uma variante bem abaixo dos 800px que o preview do
// WhatsApp precisa (IMAGE_HIRES_MIN_DIMENSION_PX) — a foto sai legível, mas
// borrada no card grande.
const MAGALU_SIZE_SEGMENT_RE = /^\/(\d{2,4})x(\d{2,4})\//

// Variantes pedidas em ordem decrescente. A URL ORIGINAL fica sempre na lista
// (por último) — mesmo contrato de `buildAmazonImageUrlCandidates` e
// `buildSheinImageUrlCandidates`: se o CDN não servir o tamanho pedido,
// `fetchImageBuffer` cai para a que já funcionava em vez de a oferta sair sem
// foto. Nunca REESCREVER destrutivamente.
const MAGALU_PREFERRED_SIZES = [1500, 1000, 800]

/**
 * Candidatas de download para uma foto da Magalu, da maior resolução para a
 * menor, com a URL original preservada como último recurso.
 * @param {string} rawUrl
 * @returns {string[]}
 */
export function buildMagaluImageUrlCandidates(rawUrl) {
  const out = []
  const push = url => { if (url && !out.includes(url)) out.push(url) }

  try {
    const u = new URL(rawUrl)
    const match = u.pathname.match(MAGALU_SIZE_SEGMENT_RE)
    if (match) {
      const currentLargest = Math.max(Number(match[1]) || 0, Number(match[2]) || 0)
      for (const size of MAGALU_PREFERRED_SIZES) {
        // Não pedir variante MENOR do que a que a loja já anunciou.
        if (size <= currentLargest) continue
        const upgraded = new URL(rawUrl)
        upgraded.pathname = u.pathname.replace(MAGALU_SIZE_SEGMENT_RE, `/${size}x${size}/`)
        push(upgraded.toString())
      }
    }
  } catch {
    // URL inválida: devolve só a original, como o caminho genérico faria.
  }

  push(rawUrl)
  return out
}
