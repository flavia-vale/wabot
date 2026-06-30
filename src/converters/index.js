import { convert as convertML }     from './mercadolivre.js'
import { convert as convertAmazon } from './amazon.js'
import { convert as convertShopee } from './shopee.js'
import { convert as convertMagalu } from './magazineluiza.js'

const CONVERTERS = {
  mercadolivre:  convertML,
  amazon:        convertAmazon,
  shopee:        convertShopee,
  magazineluiza: convertMagalu,
}

// Normaliza retorno dos converters para `{ url, warning } | null`.
// Converters individuais podem retornar string (caso comum) ou objeto
// `{ url, warning }` quando precisam sinalizar algo ao chamador (ex:
// Amazon avisa que cookies sitestripe expiraram mas a oferta saiu via
// fallback `?tag=` longo). Consumidores leem `.url` e, se houver,
// `.warning` decide se grava aviso no painel.
export async function convertLink(platform, url, credentials) {
  const fn = CONVERTERS[platform]
  if (!fn) return null
  const creds = credentials[platform]
  if (!creds) return null
  const platformCreds = typeof credentials.__onCredentialPatch === 'function'
    ? { ...creds, __onCredentialPatch: credentials.__onCredentialPatch }
    : creds
  const result = await fn(url, platformCreds)
  if (!result) return null
  if (typeof result === 'string') return { url: result, warning: null }
  if (result.url) return { ...result, url: result.url, warning: result.warning ?? null }
  return null
}
