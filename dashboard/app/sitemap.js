import { getIndexableSeoRoutes } from '../lib/seo-registry.mjs'
import { getSiteUrl } from '../lib/site-url'
import { EDITORIAL_DATES } from '../lib/editorial-content'

const baseUrl = getSiteUrl()
const LP_ROUTES = getAllLpSlugs().map((slug) => `/${slug}`)

const CORE_ROUTES = ['/', '/llms.txt', '/pricing.md', '/termos', '/privacidade', '/quem-somos', '/suporte']
const CONTENT_ROUTES = [
  '/conteudos',
  '/blog/como-escalar-grupos-sem-operacao-manual',
  '/blog/checklist-padronizar-divulgacao-whatsapp',
  '/materiais/checklist-operacao-whatsapp',
  '/blog/conferir-converter-link-afiliado-whatsapp',
  '/blog/bot-para-afiliados-whatsapp-grupos-cupons',
  '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp',
  '/metodologia-uso-responsavel-whatsapp',
  '/alternativas/bot-para-whatsapp-afiliados',
  '/botinho-vs-planilha-manual',
  '/botinho-vs-ferramentas-genericas-automacao',
  '/melhores-bots-para-afiliados-whatsapp',
  '/glossario',
  '/estudos-de-caso',
]

const ROUTE_LAST_MODIFIED = {
  '/': '2026-05-15',
  '/llms.txt': '2026-05-15',
  '/pricing.md': '2026-05-15',
  '/conteudos': '2026-05-15',
  '/quem-somos': '2026-05-15',
  '/suporte': '2026-05-15',
  '/termos': '2026-05-15',
  '/privacidade': '2026-05-15',
  ...Object.fromEntries(Object.entries(EDITORIAL_DATES).map(([route, dates]) => [route, dates.updatedAt])),
}

function getLastModified(route) {
  if (ROUTE_LAST_MODIFIED[route]) return new Date(ROUTE_LAST_MODIFIED[route])
  if (LP_ROUTES.includes(route)) return new Date('2026-05-13')
  return new Date('2026-05-15')
}

export default function sitemap() {
  const allRoutes = [...CORE_ROUTES, ...LP_ROUTES, ...CONTENT_ROUTES]
  return allRoutes.map((route) => {
    const isHome = route === '/'
    const isLp = LP_ROUTES.includes(route)
    const isContent = CONTENT_ROUTES.includes(route)

    return {
      url: `${baseUrl}${route === '/' ? '' : route}`,
      lastModified: getLastModified(route),
      changeFrequency: isHome ? 'weekly' : isLp || isContent ? 'weekly' : 'monthly',
      priority: isHome ? 1 : isLp ? 0.9 : isContent ? 0.8 : 0.6,
    }
  })
}
