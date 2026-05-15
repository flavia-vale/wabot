import { getSiteUrl } from '../lib/site-url'
import { getAllLpSlugs } from '../lib/lp-config.mjs'

const baseUrl = getSiteUrl()
const LP_ROUTES = getAllLpSlugs().map((slug) => `/${slug}`)

const CORE_ROUTES = ['/', '/llms.txt', '/pricing.md', '/termos', '/privacidade', '/quem-somos', '/suporte', '/promo-vip-7dias']
const CONTENT_ROUTES = [
  '/conteudos',
  '/blog/como-escalar-grupos-sem-operacao-manual',
  '/blog/checklist-padronizar-divulgacao-whatsapp',
  '/materiais/checklist-operacao-whatsapp',
  '/blog/conferir-converter-link-afiliado-whatsapp',
  '/blog/bot-para-afiliados-whatsapp-grupos-cupons',
  '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp',
]

const LAST_MODIFIED_BY_ROUTE = {
  '/conteudos': '2026-05-15',
  '/blog/como-escalar-grupos-sem-operacao-manual': '2026-05-11',
  '/blog/checklist-padronizar-divulgacao-whatsapp': '2026-05-11',
  '/materiais/checklist-operacao-whatsapp': '2026-05-12',
  '/blog/conferir-converter-link-afiliado-whatsapp': '2026-05-11',
  '/blog/bot-para-afiliados-whatsapp-grupos-cupons': '2026-05-11',
  '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp': '2026-05-12',
}

const DEFAULT_LAST_MODIFIED = '2026-05-15'

export default function sitemap() {
  const fallbackDate = new Date(DEFAULT_LAST_MODIFIED)
  const allRoutes = [...CORE_ROUTES, ...LP_ROUTES, ...CONTENT_ROUTES]

  return allRoutes.map((route) => {
    const isHome = route === '/'
    const isLp = LP_ROUTES.includes(route)
    const isContent = CONTENT_ROUTES.includes(route)

    return {
      url: `${baseUrl}${route === '/' ? '' : route}`,
      lastModified: LAST_MODIFIED_BY_ROUTE[route] ? new Date(LAST_MODIFIED_BY_ROUTE[route]) : fallbackDate,
      changeFrequency: isHome ? 'weekly' : isLp || isContent ? 'weekly' : 'monthly',
      priority: isHome ? 1 : isLp ? 0.9 : isContent ? 0.8 : 0.6,
    }
  })
}
