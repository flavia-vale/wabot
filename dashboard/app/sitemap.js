import { getSiteUrl } from '../lib/site-url'

const baseUrl = getSiteUrl()
const LP_ROUTES = [
  '/espelhar-grupos-whatsapp-sao-paulo',
  '/espelhar-grupos-whatsapp-rio-de-janeiro',
  '/espelhar-grupos-whatsapp-belo-horizonte',
  '/espelhar-grupos-whatsapp-curitiba',
  '/espelhar-grupos-whatsapp-porto-alegre',
  '/bot-ofertas-supermercado-whatsapp',
  '/bot-ofertas-farmacia-whatsapp',
  '/bot-ofertas-eletronicos-whatsapp',
  '/bot-ofertas-moda-whatsapp',
  '/bot-ofertas-beleza-whatsapp',
]

const CORE_ROUTES = ['/', '/termos', '/privacidade', '/quem-somos', '/suporte', '/promo-vip-7dias']

export default function sitemap() {
  const now = new Date('2026-05-11')
  const allRoutes = [...CORE_ROUTES, ...LP_ROUTES]

  return allRoutes.map((route) => {
    const isHome = route === '/'
    const isLp = LP_ROUTES.includes(route)

    return {
      url: `${baseUrl}${route === '/' ? '' : route}`,
      lastModified: now,
      changeFrequency: isHome ? 'weekly' : isLp ? 'weekly' : 'monthly',
      priority: isHome ? 1 : isLp ? 0.9 : 0.6,
    }
  })
}
