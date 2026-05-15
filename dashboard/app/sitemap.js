import { getSiteUrl } from '../lib/site-url'
import { EDITORIAL_DATES } from '../lib/editorial-content'

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
  '/bot-ofertas-autopecas-whatsapp',
  '/bot-ofertas-cursos-whatsapp',
  '/bot-ofertas-infoprodutos-whatsapp',
  '/bot-ofertas-moda-whatsapp',
  '/bot-ofertas-beleza-whatsapp',
  '/bot-ofertas-pet-shop-whatsapp',
  '/bot-ofertas-turismo-whatsapp',
  '/bot-ofertas-afiliados-whatsapp',
  '/bot-ofertas-restaurantes-whatsapp',
  '/bot-ofertas-marketplace-whatsapp',
]

const CORE_ROUTES = ['/', '/llms.txt', '/pricing.md', '/termos', '/privacidade', '/quem-somos', '/suporte', '/promo-vip-7dias']
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
