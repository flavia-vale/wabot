import { EDITORIAL_DATES } from './editorial-content.js'

const DEFAULT_LAST_MODIFIED = '2026-05-15'


function resolveLastModified(path, fallback = DEFAULT_LAST_MODIFIED) {
  const dates = EDITORIAL_DATES[path]
  return dates?.updatedAt ?? fallback
}

const hubRoutes = [
  {
    slug: 'espelhar-grupos-whatsapp',
    path: '/espelhar-grupos-whatsapp',
    label: 'Espelhar grupos WhatsApp',
    title: 'Espelhar grupos WhatsApp por cidade e operação regional',
    description: 'Hub para operações regionais que querem espelhar ofertas em grupos de WhatsApp com cadência, revisão e controle.',
    type: 'hub',
    cluster: 'localizacoes',
    intent: 'espelhar grupos whatsapp',
    template: 'seo-hub',
    priority: 0.95,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
  },
  {
    slug: 'bot-ofertas-whatsapp',
    path: '/bot-ofertas-whatsapp',
    label: 'Bot de ofertas WhatsApp',
    title: 'Bot de ofertas para WhatsApp por nicho',
    description: 'Hub para nichos que divulgam ofertas no WhatsApp e precisam padronizar campanhas, links e grupos.',
    type: 'hub',
    cluster: 'nichos',
    intent: 'bot de ofertas whatsapp',
    template: 'seo-hub',
    priority: 0.95,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
  },
  {
    slug: 'automacao-whatsapp-afiliados',
    path: '/automacao-whatsapp-afiliados',
    label: 'Automação para afiliados',
    title: 'Automação de WhatsApp para afiliados e grupos de ofertas',
    description: 'Hub para resolver gargalos de rotina, escala, consistência e rastreamento em grupos de WhatsApp para afiliados.',
    type: 'hub',
    cluster: 'dores-operacionais',
    intent: 'automacao whatsapp afiliados',
    template: 'seo-hub',
    priority: 0.95,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['CollectionPage', 'ItemList', 'BreadcrumbList'],
  },
]

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

const labelBySlug = {
  'espelhar-grupos-whatsapp-sao-paulo': 'São Paulo',
  'espelhar-grupos-whatsapp-rio-de-janeiro': 'Rio de Janeiro',
  'espelhar-grupos-whatsapp-belo-horizonte': 'Belo Horizonte',
  'espelhar-grupos-whatsapp-curitiba': 'Curitiba',
  'espelhar-grupos-whatsapp-porto-alegre': 'Porto Alegre',
  'espelhar-grupos-whatsapp-recife': 'Recife',
  'espelhar-grupos-whatsapp-salvador': 'Salvador',
  'espelhar-grupos-whatsapp-fortaleza': 'Fortaleza',
  'espelhar-grupos-whatsapp-brasilia': 'Brasília',
  'espelhar-grupos-whatsapp-goiania': 'Goiânia',
  'espelhar-grupos-whatsapp-campinas': 'Campinas',
  'espelhar-grupos-whatsapp-manaus': 'Manaus',
  'espelhar-grupos-whatsapp-belem': 'Belém',
  'espelhar-grupos-whatsapp-florianopolis': 'Florianópolis',
  'espelhar-grupos-whatsapp-vitoria': 'Vitória',
  'bot-ofertas-supermercado-whatsapp': 'Supermercado',
  'bot-ofertas-farmacia-whatsapp': 'Farmácia',
  'bot-ofertas-eletronicos-whatsapp': 'Eletrônicos',
  'bot-ofertas-moda-whatsapp': 'Moda',
  'bot-ofertas-infoprodutos-whatsapp': 'Infoprodutos',
  'bot-ofertas-cursos-whatsapp': 'Cursos',
  'bot-ofertas-autopecas-whatsapp': 'Autopeças',
  'bot-ofertas-turismo-whatsapp': 'Turismo',
  'bot-ofertas-pet-shop-whatsapp': 'Pet shop',
  'bot-ofertas-afiliados-whatsapp': 'Afiliados',
  'bot-ofertas-beleza-whatsapp': 'Beleza',
  'automatizar-divulgacao-em-grupos-whatsapp': 'Automatizar divulgação',
  'escalar-grupos-ofertas-sem-equipe': 'Escalar sem equipe',
  'postar-em-varios-grupos-whatsapp-ao-mesmo-tempo': 'Postar em vários grupos',
  'padronizar-divulgacao-afiliado-whatsapp': 'Padronizar divulgação',
  'aumentar-conversao-em-grupos-de-cupons': 'Aumentar conversão',
  'consistencia-postagens-em-grupos': 'Consistência de postagens',
  'reduzir-tempo-operacional-em-grupos-whatsapp': 'Reduzir tempo operacional',
  'organizar-calendario-de-ofertas-no-whatsapp': 'Calendário de ofertas',
  'melhorar-alcance-em-grupos-de-promocoes': 'Melhorar alcance',
  'rastrear-resultados-de-divulgacao-em-grupos': 'Rastrear resultados',
}

const parentPathByType = {
  city: '/espelhar-grupos-whatsapp',
  niche: '/bot-ofertas-whatsapp',
  pain: '/automacao-whatsapp-afiliados',
}

const organicNicheRoutes = [
  {
    slug: 'bot-ofertas-restaurantes-whatsapp',
    path: '/bot-ofertas-restaurantes-whatsapp',
    label: 'Restaurantes',
    type: 'niche',
    cluster: 'nichos',
    intent: 'bot ofertas restaurantes whatsapp',
    template: 'organic-niche',
    parentPath: '/bot-ofertas-whatsapp',
    priority: 0.9,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['FAQPage', 'Article'],
  },
  {
    slug: 'bot-ofertas-marketplace-whatsapp',
    path: '/bot-ofertas-marketplace-whatsapp',
    label: 'Marketplaces',
    type: 'niche',
    cluster: 'nichos',
    intent: 'bot ofertas marketplace whatsapp',
    template: 'organic-niche',
    parentPath: '/bot-ofertas-whatsapp',
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
    label: labelBySlug[slug] ?? slug,
    type,
    cluster: clusterByType[type],
    intent: intentByType[type],
    template: 'programmatic-lp',
    parentPath: parentPathByType[type],
    priority: 0.9,
    changeFrequency: 'weekly',
    lastModified: DEFAULT_LAST_MODIFIED,
    indexable: true,
    schemaTypes: ['FAQPage', 'HowTo', 'SoftwareApplication', 'BreadcrumbList'],
  }
}

export const HUB_SEO_ROUTES = hubRoutes

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
]

export const CONTENT_SEO_ROUTES = [
  { path: '/bot-canais-whatsapp', title: 'Bot para Canais do WhatsApp com Módulo de Preservação Avançada', description: 'Migre achadinhos para Canais do WhatsApp com espelhamento entre grupos e canais, ritmo humano, variações, monitoramento e preservação avançada.', template: 'campaign-landing', priority: 0.9, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/bot-afiliados-whatsapp', title: 'Bot para afiliados no WhatsApp com preservação avançada', description: 'Automatize ofertas de afiliados no WhatsApp com espelhamento entre grupos e canais, cadência humana, variações e Módulo de Preservação Avançada.', template: 'commercial-seo', priority: 0.85, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/bot-achadinhos-whatsapp', title: 'Bot para achadinhos no WhatsApp com canais e preservação', description: 'Use o BOTinho para operar achadinhos em grupos e Canais do WhatsApp com espelhamento, cadência, variações e Módulo de Preservação Avançada.', template: 'commercial-seo', priority: 0.85, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/anti-ban-whatsapp', title: 'Módulo de Preservação Avançada para WhatsApp', description: 'Entenda o que afiliados chamam de “anti-ban” no WhatsApp e por que o BOTinho usa preservação avançada: cadência, variações e monitoramento.', template: 'commercial-seo', priority: 0.82, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/grupo-para-canal-whatsapp', title: 'Como migrar grupo de achadinhos para Canal do WhatsApp', description: 'Planeje a migração de grupos de achadinhos para Canais do WhatsApp com o BOTinho, mantendo grupos como fonte e canais como vitrine preservada.', template: 'commercial-seo', priority: 0.82, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/bot-canal-whatsapp', title: 'Bot para Canal do WhatsApp com cadência e preservação', description: 'Publique ofertas em Canal do WhatsApp com o BOTinho usando cadência humana, variações, monitoramento e Módulo de Preservação Avançada.', template: 'commercial-seo', priority: 0.82, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/comparativos', template: 'comparison-hub', priority: 0.75, changeFrequency: 'monthly', lastModified: resolveLastModified('/comparativos'), indexable: true },
  { path: '/conteudos', template: 'content-hub', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/conteudos'), indexable: true },
  { path: '/benchmarks/operacao-grupos-ofertas-whatsapp', template: 'benchmark', priority: 0.8, changeFrequency: 'monthly', lastModified: resolveLastModified('/benchmarks/operacao-grupos-ofertas-whatsapp'), indexable: true },
  { path: '/blog/como-escalar-grupos-sem-operacao-manual', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-escalar-grupos-sem-operacao-manual'), indexable: true },
  { path: '/blog/checklist-padronizar-divulgacao-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/checklist-padronizar-divulgacao-whatsapp'), indexable: true },
  { path: '/materiais/checklist-operacao-whatsapp', template: 'lead-magnet', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/materiais/checklist-operacao-whatsapp'), indexable: true },
  { path: '/blog/conferir-converter-link-afiliado-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/conferir-converter-link-afiliado-whatsapp'), indexable: true },
  { path: '/blog/bot-para-afiliados-whatsapp-grupos-cupons', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/bot-para-afiliados-whatsapp-grupos-cupons'), indexable: true },
  { path: '/blog/grupo-ou-canal-whatsapp-achadinhos', title: 'Grupo ou Canal do WhatsApp: qual é melhor para achadinhos?', description: 'Entenda quando usar grupo, quando usar Canal do WhatsApp e como combinar os dois para divulgar achadinhos com mais organização e preservação operacional.', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/grupo-ou-canal-whatsapp-achadinhos'), indexable: true },
  { path: '/blog/como-evitar-banimento-whatsapp-afiliados', title: 'Como reduzir o risco de banimento no WhatsApp para afiliados', description: 'Guia honesto para afiliados reduzirem risco no WhatsApp com chip dedicado, cadência, variações, canais e Módulo de Preservação Avançada.', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-evitar-banimento-whatsapp-afiliados'), indexable: true },
  { path: '/blog/shadowban-whatsapp-canais', title: 'Shadowban em Canais do WhatsApp: sinais silenciosos para monitorar', description: 'Veja sinais de queda silenciosa em Canais do WhatsApp e como afiliados podem monitorar entrega, cliques e saúde antes do prejuízo.', template: 'article', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/shadowban-whatsapp-canais'), indexable: true },
  { path: '/blog/migrar-grupo-achadinhos-para-canal', title: 'Como migrar um grupo de achadinhos para Canal do WhatsApp', description: 'Passo a passo para migrar grupos de achadinhos para Canais do WhatsApp sem interromper a operação e preservando audiência.', template: 'article', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/migrar-grupo-achadinhos-para-canal'), indexable: true },
  { path: '/blog/chip-dedicado-bot-whatsapp', title: 'Por que afiliados devem usar chip dedicado no bot do WhatsApp', description: 'Entenda por que chip dedicado protege sua operação de afiliados no WhatsApp e evita misturar número pessoal com canais e grupos de ofertas.', template: 'article', priority: 0.76, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/chip-dedicado-bot-whatsapp'), indexable: true },
  { path: '/blog/bot-whatsapp-antiban-existe', title: 'Bot “anti-ban” para WhatsApp existe? A resposta honesta', description: 'Entenda por que “anti-ban” absoluto não existe e como o Módulo de Preservação Avançada do BOTinho reduz risco com camadas operacionais.', template: 'article', priority: 0.76, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/bot-whatsapp-antiban-existe'), indexable: true },
  { path: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', template: 'lead-magnet', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/materiais/checklist-divulgacao-ofertas-grupos-whatsapp'), indexable: true },
  { path: '/metodologia-uso-responsavel-whatsapp', template: 'methodology', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/metodologia-uso-responsavel-whatsapp'), indexable: true },
  { path: '/botinho-vs-planilha-manual', template: 'comparison', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/botinho-vs-planilha-manual'), indexable: true },
  { path: '/botinho-vs-ferramentas-genericas-automacao', template: 'comparison', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/botinho-vs-ferramentas-genericas-automacao'), indexable: true },
  { path: '/melhores-bots-para-afiliados-whatsapp', template: 'listicle', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/melhores-bots-para-afiliados-whatsapp'), indexable: true },
  { path: '/glossario', template: 'glossary', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/glossario'), indexable: true },
  { path: '/estudos-de-caso', template: 'case-studies', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/estudos-de-caso'), indexable: true },
  { path: '/alternativas/bot-para-whatsapp-afiliados', template: 'alternatives', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/bot-para-whatsapp-afiliados'), indexable: true },
  { path: '/ferramentas', template: 'tools-hub', priority: 0.8, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/ferramentas/calculadora-tempo-grupos-whatsapp', template: 'tool-calculator', priority: 0.8, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
]

export const SEO_ROUTES = [
  ...CORE_SEO_ROUTES,
  ...HUB_SEO_ROUTES,
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

export function getHubSeoRoute(pathOrCluster) {
  return HUB_SEO_ROUTES.find((route) => route.path === pathOrCluster || route.cluster === pathOrCluster) ?? null
}

export function getSeoRoutesByCluster(cluster) {
  return SEO_ROUTES.filter((route) => route.cluster === cluster && route.type !== 'hub' && route.indexable !== false)
}

export function getRelatedProgrammaticSeoRoutes(route, limit = 3) {
  if (!route?.cluster) return []
  return getSeoRoutesByCluster(route.cluster)
    .filter((candidate) => candidate.path !== route.path)
    .slice(0, limit)
}

export function getIndexableSeoRoutes() {
  return SEO_ROUTES.filter((route) => route.indexable !== false)
}
