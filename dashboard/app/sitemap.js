import { getSiteUrl } from '../lib/site-url'

const baseUrl = getSiteUrl()
const LP_ROUTES = [
  '/espelhar-grupos-whatsapp-sao-paulo',
  '/espelhar-grupos-whatsapp-rio-de-janeiro',
  '/espelhar-grupos-whatsapp-belo-horizonte',
  '/espelhar-grupos-whatsapp-curitiba',
  '/espelhar-grupos-whatsapp-porto-alegre',
  '/espelhar-grupos-whatsapp-recife',
  '/espelhar-grupos-whatsapp-salvador',
  '/espelhar-grupos-whatsapp-fortaleza',
  '/espelhar-grupos-whatsapp-brasilia',
  '/espelhar-grupos-whatsapp-goiania',
  '/espelhar-grupos-whatsapp-campinas',
  '/espelhar-grupos-whatsapp-manaus',
  '/espelhar-grupos-whatsapp-belem',
  '/espelhar-grupos-whatsapp-florianopolis',
  '/espelhar-grupos-whatsapp-vitoria',
  '/automatizar-divulgacao-em-grupos-whatsapp',
  '/escalar-grupos-ofertas-sem-equipe',
  '/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo',
  '/padronizar-divulgacao-afiliado-whatsapp',
  '/aumentar-conversao-em-grupos-de-cupons',
  '/consistencia-postagens-em-grupos',
  '/reduzir-tempo-operacional-em-grupos-whatsapp',
  '/organizar-calendario-de-ofertas-no-whatsapp',
  '/melhorar-alcance-em-grupos-de-promocoes',
  '/rastrear-resultados-de-divulgacao-em-grupos',
  '/bot-ofertas-supermercado-whatsapp',
  '/bot-ofertas-farmacia-whatsapp',
  '/bot-ofertas-eletronicos-whatsapp',
  '/bot-ofertas-moda-whatsapp',
  '/bot-ofertas-beleza-whatsapp',
]

const CORE_ROUTES = ['/', '/termos', '/privacidade', '/quem-somos', '/suporte', '/promo-vip-7dias']
const CONTENT_ROUTES = [
  '/conteudos',
  '/blog/como-escalar-grupos-sem-operacao-manual',
  '/blog/checklist-padronizar-divulgacao-whatsapp',
  '/materiais/checklist-operacao-whatsapp',
  '/blog/conferir-converter-link-afiliado-whatsapp',
  '/blog/bot-para-afiliados-whatsapp-grupos-cupons',
  '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp',
]

export default function sitemap() {
  const now = new Date('2026-05-14')
  const allRoutes = [...CORE_ROUTES, ...LP_ROUTES, ...CONTENT_ROUTES]

  return allRoutes.map((route) => {
    const isHome = route === '/'
    const isLp = LP_ROUTES.includes(route)
    const isContent = CONTENT_ROUTES.includes(route)

    return {
      url: `${baseUrl}${route === '/' ? '' : route}`,
      lastModified: now,
      changeFrequency: isHome ? 'weekly' : isLp || isContent ? 'weekly' : 'monthly',
      priority: isHome ? 1 : isLp ? 0.9 : isContent ? 0.8 : 0.6,
    }
  })
}
