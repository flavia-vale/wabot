// Loja não suportada (P1-4, docs/produto/backlog-p1-4-loja-nao-suportada.md).
// Funções PURAS — nada aqui toca banco, rede ou relógio.
//
// Contexto: `removeNonOfferUrls` (src/messageProcessor.js) apaga toda URL que
// não é de uma das lojas de `PATTERNS` (src/detector.js). A remoção está CERTA
// (encaminhar link de terceiro dá a comissão da cliente para outra pessoa — é a
// mesma invariante de `skip:no_valid_conversions`). O defeito era o SILÊNCIO:
// quando o link apagado era o ÚNICO link da oferta e o grupo aceitava mensagem
// sem link (`ALLOW_NO_LINK`), a oferta saía no grupo SEM link, sem linha no
// painel e sem sinal nenhum.

// Sufixos de dois rótulos em que o domínio registrável tem TRÊS rótulos
// (`kabum.com.br`, não `com.br`). Lista curta de propósito: não existe helper de
// public suffix no repo e dependência nova é memória nova (REGRA #1). Um sufixo
// que falte aqui só faz o domínio sair "curto demais" (`algo.xx`) — nunca faz
// caminho, query ou texto chegar ao que é gravado.
const THREE_LABEL_SUFFIXES = new Set([
  'com.br', 'net.br', 'org.br', 'art.br', 'blog.br', 'eco.br', 'ind.br',
  'inf.br', 'tv.br', 'app.br', 'dev.br', 'log.br', 'shop.br', 'gov.br', 'edu.br',
  'com.ar', 'com.mx', 'com.co', 'com.pe', 'com.uy', 'com.py', 'com.cl',
  'co.uk', 'org.uk', 'com.au', 'co.jp', 'com.cn', 'co.kr', 'com.tr', 'co.in',
  'com.hk', 'com.tw', 'com.sg',
])

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/
const HOST_CHARS_RE = /^[a-z0-9.-]+$/
// Formato do que PODE ser persistido. Qualquer coisa fora disso é descartada
// antes de chegar ao banco — é a guarda de privacidade na origem.
export const PERSISTABLE_DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,62})(?:\.[a-z0-9-]{1,63}){1,2}$/
const MAX_DOMAIN_CHARS = 80

/**
 * Domínio registrável de uma URL (`https://share.temu.com/x?y` → `temu.com`,
 * `https://www.kabum.com.br/p/1` → `kabum.com.br`). Devolve `null` para
 * qualquer coisa que não seja um host público com ponto. PURA.
 *
 * Só o host sai daqui: caminho, query, fragmento e credencial ficam para trás —
 * mesma regra do `referral_visit` (só o host do referenciador).
 */
export function registrableDomain(rawUrl) {
  let host
  try {
    host = new URL(String(rawUrl ?? '')).hostname.toLowerCase()
  } catch {
    return null
  }
  host = host.replace(/\.+$/, '')
  if (!host || host.length > 253) return null
  if (host.startsWith('[') || IPV4_RE.test(host)) return null
  if (!HOST_CHARS_RE.test(host) || !host.includes('.')) return null

  const labels = host.split('.').filter(Boolean)
  if (labels.length < 2) return null
  const lastTwo = labels.slice(-2).join('.')
  const take = THREE_LABEL_SUFFIXES.has(lastTwo) && labels.length >= 3 ? 3 : 2
  const domain = labels.slice(-take).join('.')
  if (domain.length > MAX_DOMAIN_CHARS || !PERSISTABLE_DOMAIN_RE.test(domain)) return null
  return domain
}

/** Domínios distintos (sem repetição) de uma lista de URLs. PURA. */
export function distinctRegistrableDomains(urls) {
  const out = new Set()
  for (const url of urls || []) {
    const domain = registrableDomain(url)
    if (domain) out.add(domain)
  }
  return [...out]
}

/**
 * O que fazer com uma mensagem que a POLÍTICA do grupo deixou passar. PURA.
 *
 * Devolve o `errorMsg` de descarte quando a mensagem tinha link, TODOS os links
 * eram de loja não suportada (ou de site próprio que não resolveu até a loja) e
 * por isso o sanitizador a deixou sem link nenhum. `null` = segue o fluxo
 * normal.
 *
 * Decisão (P1-4): NÃO publicar. Antes a oferta saía no grupo sem ter onde
 * clicar e a cliente não tinha como saber por quê. Continuar removendo o link
 * é obrigatório; publicar a oferta mutilada não é. Mensagem SEM link nenhum na
 * origem (aviso, "bom dia") não é afetada: `unsupportedLinkCount` é 0.
 */
export function linkRemovedSkipReason({ supportedLinkCount, unsupportedLinkCount, offerEndedAtSource = false }) {
  if (supportedLinkCount > 0) return null
  if (!(unsupportedLinkCount > 0)) return null
  return offerEndedAtSource
    ? 'skip:link_removed:offer_ended_at_source'
    : 'skip:link_removed:unsupported_store'
}
