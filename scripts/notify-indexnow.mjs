import { getIndexableSeoRoutes } from '../dashboard/lib/seo-registry.mjs'
import { getSiteUrl } from '../dashboard/lib/site-url.js'

const INDEXNOW_KEY = '76ef5ca2d765d0c0a6a34d4fc02376fd'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_ATTEMPTS = 3

const baseUrl = getSiteUrl()
const host = new URL(baseUrl).host

const urlList = getIndexableSeoRoutes().map(
  (route) => `${baseUrl}${route.path === '/' ? '' : route.path}`
)

const payload = {
  host,
  key: INDEXNOW_KEY,
  keyLocation: `${baseUrl}/${INDEXNOW_KEY}.txt`,
  urlList,
}

async function submit() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        console.log(`OK: IndexNow notificado com ${urlList.length} URLs (status ${res.status}).`)
        return
      }
      console.warn(`Tentativa ${attempt}/${MAX_ATTEMPTS} falhou: status ${res.status} ${res.statusText}`)
    } catch (err) {
      console.warn(`Tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${err.message}`)
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
    }
  }
  console.error('ERRO: falha ao notificar IndexNow após 3 tentativas. Não bloqueia o deploy.')
  process.exit(1)
}

await submit()
