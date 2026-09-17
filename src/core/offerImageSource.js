// Escolhe QUAL endereço usar para buscar a foto do produto no painel
// "Criar oferta" (`POST /api/link-conversion/scrape-offer`).
//
// RCA 2026-09-16 — "Shopee no Criar Oferta sai sem imagem". A rota usava
// `offer.finalUrl` cru como fonte da foto. `finalUrl` é a URL onde o fetch de
// HTML TERMINOU — e, na Shopee, o fetch frequentemente termina numa parede
// anti-bot (`/unsupported.html`, `verify/traffic`) que NÃO carrega
// (shopId, itemId). Sem os ids, `fetchShopeeImage` devolve `null`
// (`shopee_sem_ids`) e a oferta sai sem foto.
//
// O caminho de TÍTULO/PREÇO já se protegia disso desde sempre
// (`shopeeApiSourceUrl` em `productInfoScraper.js`: "prioriza a URL que de
// fato contém (shopId, itemId)"). Era essa assimetria que fazia a oferta
// chegar com título e preço e sem imagem — o sintoma exato relatado.
//
// Módulo PURO: sem rede, sem banco. A escolha é barata (nenhuma ida à rede a
// mais) e acontece ANTES de qualquer fetch.

import { extractShopeeIds } from '../converters/shopee.js'

// Endereços que provam ser um beco sem saída para a busca de foto: são páginas
// de bloqueio/verificação, não a página do produto. Passar uma delas ao
// resolver de imagem é garantia de `null`.
const DEAD_END_URL_RE = [
  /shopee\.com\.br\/unsupported\.html/i,
  /\/gz\/account-verification/i,
  /suspicious-traffic/i,
]

export function isDeadEndImageSourceUrl(value) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) return false
  return DEAD_END_URL_RE.some(re => re.test(url))
}

// `true` quando o endereço identifica UM produto de forma que o resolver de
// foto consegue usar sem depender de resolução server-side.
export function identifiesProduct(platform, value) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) return false
  if (platform === 'shopee') return Boolean(extractShopeeIds(url))
  return false
}

/**
 * Devolve o melhor endereço para buscar a foto, na ordem:
 *   1) o primeiro candidato que IDENTIFICA o produto (hoje: ids da Shopee);
 *   2) o primeiro candidato que não é um beco sem saída conhecido;
 *   3) o primeiro candidato não vazio (fail-safe: melhor tentar do que desistir).
 *
 * Para as demais lojas a regra (2) preserva o comportamento histórico
 * (`finalUrl` primeiro), então nada muda fora da Shopee.
 */
export function pickOfferImageSourceUrl({ platform = null, candidates = [] } = {}) {
  const list = (Array.isArray(candidates) ? candidates : [])
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  if (!list.length) return null

  const unique = [...new Set(list)]
  return unique.find(item => identifiesProduct(platform, item) && !isDeadEndImageSourceUrl(item))
    ?? unique.find(item => !isDeadEndImageSourceUrl(item))
    ?? unique[0]
}
