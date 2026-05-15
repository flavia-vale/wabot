const DEFAULT_LAST_MODIFIED = '2026-05-15'

const citySlugs = [
  'espelhar-grupos-whatsapp-sao-paulo',
  'espelhar-grupos-whatsapp-rio-de-janeiro',
  'espelhar-grupos-whatsapp-belo-horizonte',
  'espelhar-grupos-whatsapp-curitiba',
  'espelhar-grupos-whatsapp-porto-alegre',
  'espelhar-grupos-whatsapp-recife',
  'espelhar-grupos-whatsapp-salvador',
  'espelhar-grupos-whatsapp-fortaleza',
  'espelhar-grupos-whatsapp-brasilia',
  'espelhar-grupos-whatsapp-goiania',
  'espelhar-grupos-whatsapp-campinas',
  'espelhar-grupos-whatsapp-manaus',
  'espelhar-grupos-whatsapp-belem',
  'espelhar-grupos-whatsapp-florianopolis',
  'espelhar-grupos-whatsapp-vitoria',
]

const nicheSlugs = [
  'bot-ofertas-supermercado-whatsapp',
  'bot-ofertas-farmacia-whatsapp',
  'bot-ofertas-eletronicos-whatsapp',
  'bot-ofertas-moda-whatsapp',
  'bot-ofertas-infoprodutos-whatsapp',
  'bot-ofertas-cursos-whatsapp',
  'bot-ofertas-autopecas-whatsapp',
  'bot-ofertas-turismo-whatsapp',
  'bot-ofertas-pet-shop-whatsapp',
  'bot-ofertas-afiliados-whatsapp',
  'bot-ofertas-beleza-whatsapp',
]

const painSlugs = [
  'automatizar-divulgacao-em-grupos-whatsapp',
  'escalar-grupos-ofertas-sem-equipe',
  'postar-em-varios-grupos-whatsapp-ao-mesmo-tempo',
  'padronizar-divulgacao-afiliado-whatsapp',
  'aumentar-conversao-em-grupos-de-cupons',
  'consistencia-postagens-em-grupos',
  'reduzir-tempo-operacional-em-grupos-whatsapp',
  'organizar-calendario-de-ofertas-no-whatsapp',
  'melhorar-alcance-em-grupos-de-promocoes',
  'rastrear-resultados-de-divulgacao-em-grupos',
]

const organicNicheRoutes = [
  {
    slug: 'bot-ofertas-restaurantes-whatsapp',
    path: '/bot-ofertas-restaurantes-whatsapp',
    type: 'niche',
    cluster: 'nichos',
    intent: 'bot ofertas restaurantes whatsapp',
    template: 'organic-niche',
    priority: 0.9,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['FAQPage', 'Article'],
  },
  {
    slug: 'bot-ofertas-marketplace-whatsapp',
    path: '/bot-ofertas-marketplace-whatsapp',
    type: 'niche',
    cluster: 'nichos',
    intent: 'bot ofertas marketplace whatsapp',
    template: 'organic-niche',
    priority: 0.9,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['FAQPage', 'Article'],
  },
]

function buildProgrammaticRoute(slug, type) {
  const clusterByType = {
    city: 'localizacoes',
    niche: 'nichos',
    pain: 'dores-operacionais',
  }

  const intentByType = {
    city: 'espelhar grupos whatsapp por cidade',
    niche: 'bot de ofertas whatsapp por nicho',
    pain: 'automacao de grupos whatsapp por dor operacional',
  }

  return {
    slug,
    path: `/${slug}`,
    type,
    cluster: clusterByType[type],
    intent: intentByType[type],
    template: 'programmatic-lp',
    priority: 0.9,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['FAQPage', 'HowTo', 'SoftwareApplication', 'BreadcrumbList'],
  }
}

export const PROGRAMMATIC_SEO_ROUTES = [
  ...citySlugs.map((slug) => buildProgrammaticRoute(slug, 'city')),
  ...nicheSlugs.map((slug) => buildProgrammaticRoute(slug, 'niche')),
  ...painSlugs.map((slug) => buildProgrammaticRoute(slug, 'pain')),
]

export const CORE_SEO_ROUTES = [
  { path: '/', template: 'home', priority: 1, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/llms.txt', template: 'ai-reference', priority: 0.6, changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/pricing.md', template: 'ai-reference', priority: 0.6, changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/termos', template: 'legal', priority: 0.6, changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/privacidade', template: 'legal', priority: 0.6, changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/quem-somos', template: 'institutional', priority: 0.6, changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/suporte', template: 'support', priority: 0.6, changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/promo-vip-7dias', template: 'promo', priority: 0.6, changeFrequency: 'monthly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
]

export const CONTENT_SEO_ROUTES = [
  { path: '/conteudos', template: 'content-hub', priority: 0.8, changeFrequency: 'weekly', lastModified: '2026-05-15', indexable: true },
  { path: '/blog/como-escalar-grupos-sem-operacao-manual', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: '2026-05-11', indexable: true },
  { path: '/blog/checklist-padronizar-divulgacao-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: '2026-05-11', indexable: true },
  { path: '/materiais/checklist-operacao-whatsapp', template: 'lead-magnet', priority: 0.8, changeFrequency: 'weekly', lastModified: '2026-05-12', indexable: true },
  { path: '/blog/conferir-converter-link-afiliado-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: '2026-05-11', indexable: true },
  { path: '/blog/bot-para-afiliados-whatsapp-grupos-cupons', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: '2026-05-11', indexable: true },
  { path: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', template: 'lead-magnet', priority: 0.8, changeFrequency: 'weekly', lastModified: '2026-05-12', indexable: true },
]

export const SEO_ROUTES = [
  ...CORE_SEO_ROUTES,
  ...PROGRAMMATIC_SEO_ROUTES,
  ...organicNicheRoutes,
  ...CONTENT_SEO_ROUTES,
]

export function getProgrammaticSeoSlugs() {
  return PROGRAMMATIC_SEO_ROUTES.map((route) => route.slug)
}

export function getProgrammaticSeoRoute(slug) {
  return PROGRAMMATIC_SEO_ROUTES.find((route) => route.slug === slug) ?? null
}

export function getIndexableSeoRoutes() {
  return SEO_ROUTES.filter((route) => route.indexable !== false)
}
