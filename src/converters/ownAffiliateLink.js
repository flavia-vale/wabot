/* Detecta se o link COLADO já carrega a identificação de afiliado da própria
 * cliente — antes de rodar a conversão de verdade (sem rede, só leitura da
 * URL). Existe para a tela "Testar conversão" responder "Esse já é seu link
 * de afiliado!" em vez de tratar isso como uma conversão qualquer.
 *
 * Só cobre lojas onde a identificação é um parâmetro estável e visível na
 * própria URL, igual ao valor salvo na credencial (Amazon `tag`, Magalu
 * `partner_id`, SHEIN `koc_id`/`url_from`, e o formato de fallback do
 * Mercado Livre que também usa `partner_id`). Shopee e AliExpress geram
 * link curto opaco via API própria — o parâmetro que credita a comissão não
 * fica visível na URL colada, então não têm como ser detectados aqui sem uma
 * chamada de rede (o que a conversão normal já faz).
 */
import { extractSheinAffiliateId, normalizeSheinDigits } from './shein.js'

function paramMatchesTag(url, param, tag) {
  const tagTrim = String(tag ?? '').trim()
  if (!tagTrim) return false
  try {
    const u = new URL(url)
    const value = u.searchParams.get(param)
    return value != null && value.trim() === tagTrim
  } catch {
    return false
  }
}

const DETECTORS = {
  amazon: (url, creds) => paramMatchesTag(url, 'tag', creds?.tag),
  magazineluiza: (url, creds) => paramMatchesTag(url, 'partner_id', creds?.tag),
  mercadolivre: (url, creds) => paramMatchesTag(url, 'partner_id', creds?.tag),
  shein: (url, creds) => {
    const tag = String(creds?.tag ?? '').trim()
    if (!tag) return false
    const extracted = extractSheinAffiliateId(url)
    if (!extracted) return false
    return normalizeSheinDigits(extracted) === normalizeSheinDigits(tag)
  },
}

/** @returns {boolean} true quando o link já sai com a identificação da própria cliente. */
export function isOwnAffiliateLink(platform, url, creds) {
  const detector = DETECTORS[platform]
  if (!detector) return false
  return detector(url, creds)
}
