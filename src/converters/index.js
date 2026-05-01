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

export async function convertLink(platform, url, credentials) {
  const fn = CONVERTERS[platform]
  if (!fn) return null
  const creds = credentials[platform]
  if (!creds) return null
  return fn(url, creds)
}
