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
    // Título e descrição moram em dashboard/app/_seoHubShared.js desde
    // 2026-09-02 — fonte única (FR-001), mesmo caminho que 'bot-ofertas-whatsapp'
    // seguiu em 19/08. Os antigos falavam em "por cidade e operação regional",
    // apontando para a linha de LPs de cidade que está congelada e fora do
    // índice; a página passou a responder pelo produto, não pelo índice de
    // páginas mortas.
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
    // title/description ficam só em _seoHubShared.js (HUB_CONTENT), fonte
    // única FR-001 — specs/013-inbound-leads-strategy.
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

// Rotas de grade retiradas do índice em 2026-08-19 (P2, US2 —
// specs/013-inbound-leads-strategy). NÃO são apagadas: continuam no ar,
// continuam recebendo link interno (`follow: true` em `buildSeoRobots`) e
// voltam com a remoção de uma linha. O que muda é só parar de disputar
// rastreamento com as páginas que produzem.
//
// Evidência (AGENTS.md, "SEO orgânico — linhas CONGELADAS", baseline
// 2026-08-16): as 15 rotas de cidade somaram ~25 impressões em 2,5 meses (5
// delas em zero) e as de nicho tiveram zero impressão no mesmo período. Ter
// `uniqueHeadline`/`faq`/`howTo` preenchidos é conteúdo DECLARADO, não
// intenção de busca COMPROVADA — foi essa confusão que, na primeira triagem
// automática, não selecionou nenhuma rota.
//
// EXCEÇÃO deliberada: `bot-ofertas-afiliados-whatsapp` continua indexável
// apesar de ser da família de nicho. Ela tem 49 impressões e é uma das nove
// páginas cujo título foi reescrito em US1 para ganhar clique — tirá-la do
// índice desfaria essa entrega na mesma rodada. Guarda em
// `test/seo-noindex-guard.test.js`.
const GRADE_FORA_DO_INDICE = new Set([
  ...citySlugs,
  ...nicheSlugs.filter((slug) => slug !== 'bot-ofertas-afiliados-whatsapp'),
])

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
    indexable: !GRADE_FORA_DO_INDICE.has(slug),
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
  // title/description ficam só em app/precos/page.js (fonte única, FR-001).
  { path: '/precos', template: 'pricing', priority: 0.95, changeFrequency: 'weekly', lastModified: resolveLastModified('/precos', '2026-08-05'), indexable: true },
  { path: '/cadastro', title: 'Cadastro Espelha Grupos — teste grátis para automatizar ofertas no WhatsApp', description: 'Crie sua conta no Espelha Grupos e comece a automatizar a divulgação de ofertas em grupos e canais do WhatsApp.', template: 'signup', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/cadastro'), indexable: true },
  // title/description ficam só em app/parcerias/page.js (fonte única, FR-001).
  { path: '/parcerias', template: 'partnerships', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/parcerias'), indexable: true },
  // title/description ficam só em app/bot-canais-whatsapp/page.js (fonte única, FR-001).
  { path: '/bot-canais-whatsapp', template: 'campaign-landing', priority: 0.9, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  // title/description destas 5 rotas moram só em _preservationCommercialPages.js
  // (fonte única, FR-001 — specs/013-inbound-leads-strategy). Removidos daqui em
  // 2026-08-19: viviam duplicados (e no caso de /bot-achadinhos-whatsapp,
  // divergentes — R2 de research.md) sem nenhum validador comparar os dois.
  // Frente Tier 1 (ação 9 do PLANO_ACAO_SEO_IA_2026-09-01): "shopee afiliados"
  // tem 50.000 buscas/mês com concorrência baixa, e não havia página COMERCIAL
  // nossa entrando por esse termo — só artigo de blog, que responde outra
  // intenção. UMA página por enquanto: Amazon e Mercado Livre só depois desta
  // provar que indexa e ranqueia (a lição das dez LPs de dor que não indexaram).
  { path: '/shopee-afiliados-whatsapp', template: 'commercial-seo', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/shopee-afiliados-whatsapp', '2026-09-02'), indexable: true },
  { path: '/mercado-livre-afiliados-whatsapp', template: 'commercial-seo', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/mercado-livre-afiliados-whatsapp', '2026-09-02'), indexable: true },
  { path: '/amazon-afiliados-whatsapp', template: 'commercial-seo', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/amazon-afiliados-whatsapp', '2026-09-02'), indexable: true },
  { path: '/shein-afiliados-whatsapp', template: 'commercial-seo', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/shein-afiliados-whatsapp', '2026-09-02'), indexable: true },
  { path: '/magalu-afiliados-whatsapp', template: 'commercial-seo', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/magalu-afiliados-whatsapp', '2026-09-02'), indexable: true },
  { path: '/bot-afiliados-whatsapp', template: 'commercial-seo', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/bot-afiliados-whatsapp', '2026-07-30'), indexable: true },
  { path: '/bot-achadinhos-whatsapp', template: 'commercial-seo', priority: 0.88, changeFrequency: 'weekly', lastModified: resolveLastModified('/bot-achadinhos-whatsapp', '2026-07-30'), indexable: true },
  { path: '/anti-ban-whatsapp', template: 'commercial-seo', priority: 0.85, changeFrequency: 'weekly', lastModified: resolveLastModified('/anti-ban-whatsapp', '2026-07-30'), indexable: true },
  { path: '/grupo-para-canal-whatsapp', template: 'commercial-seo', priority: 0.82, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/bot-canal-whatsapp', template: 'commercial-seo', priority: 0.82, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  // title/description ficam só em app/diagnostico-antiban-whatsapp/page.js (fonte única, FR-001).
  { path: '/diagnostico-antiban-whatsapp', template: 'diagnostic-tool', priority: 0.86, changeFrequency: 'weekly', lastModified: resolveLastModified('/diagnostico-antiban-whatsapp'), indexable: true },
  // Saída do estudo de mercado de 10/09/2026 (docs/produto/pesquisa-mercado-2026-09-10.md).
  //
  // Só a PRIMEIRA das três tem volume de busca medido — "quanto ganha afiliado
  // shopee" soma ~3.050/mês com concorrência baixa (16-25) e não havia página
  // nossa respondendo. As outras duas voltaram SEM DADOS no Planejador (e
  // "rastrear link afiliado" ficou em zero em 262 de 262 semanas do Trends):
  // existem para o canal de IA e para a comparação, não para busca orgânica.
  // Não cobrar tráfego de busca delas — o motivo está no topo de cada page.js.
  //
  // As três nascem linkadas de 3+ páginas já indexadas, como exige a regra de
  // página órfã (RCA 2026-09-11) — guarda em test/marketing-paginas-orfas.test.js.
  { path: '/quanto-ganha-afiliado-shopee', template: 'article', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/quanto-ganha-afiliado-shopee', '2026-09-11'), indexable: true },
  { path: '/vendas-e-comissao-afiliado-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'monthly', lastModified: resolveLastModified('/vendas-e-comissao-afiliado-whatsapp', '2026-09-11'), indexable: true },
  { path: '/copiaram-minha-oferta-no-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'monthly', lastModified: resolveLastModified('/copiaram-minha-oferta-no-whatsapp', '2026-09-11'), indexable: true },
  { path: '/comparativos', template: 'comparison-hub', priority: 0.75, changeFrequency: 'monthly', lastModified: resolveLastModified('/comparativos'), indexable: true },
  // title/description ficam só em app/programa-de-afiliados/page.js (fonte única, FR-001).
  { path: '/programa-de-afiliados', template: 'comparison-hub', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/programa-de-afiliados'), indexable: true },
  // title/description ficam só em app/parceiro-influenciador/page.js (fonte única, FR-001).
  { path: '/parceiro-influenciador', template: 'partner-landing', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/parceiro-influenciador', '2026-08-04'), indexable: true },
  // title/description ficam só em app/termos-parceria-influenciador/page.js (fonte única, FR-001).
  { path: '/termos-parceria-influenciador', template: 'legal', priority: 0.5, changeFrequency: 'monthly', lastModified: resolveLastModified('/termos-parceria-influenciador', '2026-08-04'), indexable: true },
  // title/description ficam só em app/conteudos/page.js (fonte única, FR-001).
  { path: '/conteudos', template: 'content-hub', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/conteudos'), indexable: true },
  { path: '/benchmarks/operacao-grupos-ofertas-whatsapp', template: 'benchmark', priority: 0.8, changeFrequency: 'monthly', lastModified: resolveLastModified('/benchmarks/operacao-grupos-ofertas-whatsapp'), indexable: true },
  { path: '/blog/como-escalar-grupos-sem-operacao-manual', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-escalar-grupos-sem-operacao-manual'), indexable: true },
  { path: '/blog/checklist-padronizar-divulgacao-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/checklist-padronizar-divulgacao-whatsapp'), indexable: true },
  { path: '/materiais/checklist-operacao-whatsapp', template: 'lead-magnet', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/materiais/checklist-operacao-whatsapp'), indexable: true },
  { path: '/blog/conferir-converter-link-afiliado-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/conferir-converter-link-afiliado-whatsapp'), indexable: true },
  { path: '/blog/bot-para-afiliados-whatsapp-grupos-cupons', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/bot-para-afiliados-whatsapp-grupos-cupons'), indexable: true },
  { path: '/blog/grupo-ou-canal-whatsapp-achadinhos', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/grupo-ou-canal-whatsapp-achadinhos'), indexable: true },
  { path: '/blog/como-evitar-banimento-whatsapp-afiliados', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-evitar-banimento-whatsapp-afiliados'), indexable: true },
  { path: '/blog/shadowban-whatsapp-canais', template: 'article', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/shadowban-whatsapp-canais'), indexable: true },
  { path: '/blog/migrar-grupo-achadinhos-para-canal', template: 'article', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/migrar-grupo-achadinhos-para-canal'), indexable: true },
  { path: '/blog/chip-dedicado-bot-whatsapp', template: 'article', priority: 0.76, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/chip-dedicado-bot-whatsapp'), indexable: true },
  { path: '/blog/bot-whatsapp-antiban-existe', template: 'article', priority: 0.76, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/bot-whatsapp-antiban-existe'), indexable: true },
  { path: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/comecar-afiliado-whatsapp-sem-grupo-grande'), indexable: true },
  { path: '/blog/como-ser-afiliado-shopee-whatsapp', template: 'article', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-ser-afiliado-shopee-whatsapp', '2026-07-31'), indexable: true },
  // title/description destas 3 rotas moram só em blog/_preservationBlogPosts.js (fonte única, FR-001).
  { path: '/blog/como-divulgar-ofertas-amazon-whatsapp', template: 'article', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-divulgar-ofertas-amazon-whatsapp', '2026-07-31'), indexable: true },
  { path: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-divulgar-ofertas-mercado-livre-whatsapp'), indexable: true },
  { path: '/blog/quanto-custa-bot-para-whatsapp-afiliados', template: 'article', priority: 0.82, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/quanto-custa-bot-para-whatsapp-afiliados'), indexable: true },
  { path: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/melhores-horarios-para-postar-ofertas-no-whatsapp'), indexable: true },
  { path: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp', template: 'article', priority: 0.82, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-converter-link-de-afiliado-automaticamente-whatsapp'), indexable: true },
  { path: '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp'), indexable: true },
  // title/description ficam só em blog/_preservationBlogPosts.js (fonte única, FR-001).
  { path: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero'), indexable: true },
  { path: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', template: 'lead-magnet', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/materiais/checklist-divulgacao-ofertas-grupos-whatsapp'), indexable: true },
  // title/description ficam só em _preservationDecisionPages.js (fonte única, FR-001).
  { path: '/bot-comum-vs-botinho', template: 'comparison', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/bot-comum-vs-botinho'), indexable: true },
  // title/description ficam só em _preservationDecisionPages.js (fonte única, FR-001).
  { path: '/faq-antiban-whatsapp', template: 'faq', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/faq-antiban-whatsapp'), indexable: true },
  // title/description ficam só em _preservationDecisionPages.js (fonte única, FR-001).
  { path: '/como-funciona-botinho-canais', template: 'howto', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/como-funciona-botinho-canais'), indexable: true },
  // title/description ficam só em _preservationDecisionPages.js (fonte única, FR-001).
  { path: '/protecao-antiban-botinho', template: 'module-deep-dive', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/protecao-antiban-botinho'), indexable: true },
  // title/description ficam só em app/materiais/checklist-antiban-whatsapp/page.js (fonte única, FR-001).
  { path: '/materiais/checklist-antiban-whatsapp', template: 'lead-magnet', priority: 0.82, changeFrequency: 'weekly', lastModified: resolveLastModified('/materiais/checklist-antiban-whatsapp'), indexable: true },
  { path: '/metodologia-uso-responsavel-whatsapp', template: 'methodology', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/metodologia-uso-responsavel-whatsapp'), indexable: true },
  { path: '/botinho-vs-planilha-manual', template: 'comparison', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/botinho-vs-planilha-manual'), indexable: true },
  { path: '/botinho-vs-ferramentas-genericas-automacao', template: 'comparison', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/botinho-vs-ferramentas-genericas-automacao'), indexable: true },
  { path: '/melhores-bots-para-afiliados-whatsapp', template: 'listicle', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/melhores-bots-para-afiliados-whatsapp'), indexable: true },
  { path: '/glossario', template: 'glossary', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/glossario'), indexable: true },
  { path: '/estudos-de-caso', template: 'case-studies', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/estudos-de-caso'), indexable: true },
  // title/description das 4 rotas /alternativas/* abaixo moram só em
  // _comparisonContent.js (fonte única, FR-001 — specs/013-inbound-leads-strategy).
  { path: '/alternativas/achadinhos-bot', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/achadinhos-bot'), indexable: true },
  { path: '/alternativas/bot-para-whatsapp-afiliados', template: 'alternatives', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/bot-para-whatsapp-afiliados'), indexable: true },
  { path: '/alternativas/proafiliados', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/proafiliados'), indexable: true },
  { path: '/alternativas/shozap', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/shozap'), indexable: true },
  { path: '/alternativas/fluxopromo', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/fluxopromo'), indexable: true },
  // US5 (specs/013-inbound-leads-strategy) — única página nova desta rodada.
  // title/description ficam só em _comparisonContent.js (fonte única, FR-001).
  { path: '/alternativas/achadinho-pro', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/achadinho-pro'), indexable: true },
  // Único concorrente que uma IA colocou explicitamente à nossa frente (o
  // ChatGPT chamou o Promium de "o mais completo" na consulta de cupons,
  // medição de 01/09) — e que nem estava no mapa de concorrentes.
  { path: '/alternativas/promium', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/promium', '2026-09-02'), indexable: true },
  // Busca pelo NOME do concorrente — a linha que virou o motor de impressão
  // do site (15% do total em 2026-08-16). title/description ficam só em
  // _comparisonContent.js (fonte única, FR-001).
  { path: '/alternativas/gigi-bot', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/gigi-bot'), indexable: true },
  // Intenção "clonar mensagens de grupo afiliado" (2026-08-26). O site
  // inteiro diz "espelhar"; o mercado busca "clonar" — e a Visão Geral do
  // Google responde essa busca listando concorrentes. title/description ficam
  // só em app/clonar-mensagens-de-grupo-de-afiliados/page.js (fonte única, FR-001).
  { path: '/clonar-mensagens-de-grupo-de-afiliados', template: 'article', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/clonar-mensagens-de-grupo-de-afiliados', '2026-08-26'), indexable: true },
  { path: '/ferramentas', template: 'tools-hub', priority: 0.8, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/ferramentas/calculadora-tempo-grupos-whatsapp', template: 'tool-calculator', priority: 0.8, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  // title/description ficam só em app/ferramentas/calculadora-risco-whatsapp/page.js (fonte única, FR-001).
  { path: '/ferramentas/calculadora-risco-whatsapp', template: 'tool-calculator', priority: 0.84, changeFrequency: 'weekly', lastModified: resolveLastModified('/ferramentas/calculadora-risco-whatsapp'), indexable: true },
  // title/description ficam só em app/confiabilidade-sessao-whatsapp/page.js (fonte única, FR-001).
  { path: '/confiabilidade-sessao-whatsapp', template: 'module-deep-dive', priority: 0.78, changeFrequency: 'monthly', lastModified: resolveLastModified('/confiabilidade-sessao-whatsapp'), indexable: true },
  // title/description ficam só em app/seguranca-credenciais-afiliado/page.js (fonte única, FR-001).
  { path: '/seguranca-credenciais-afiliado', template: 'module-deep-dive', priority: 0.78, changeFrequency: 'monthly', lastModified: resolveLastModified('/seguranca-credenciais-afiliado'), indexable: true },
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

// NÃO filtra por `indexable` de propósito: este helper alimenta NAVEGAÇÃO (a
// lista de páginas irmãs no hub e o bloco de relacionadas), não o sitemap.
// Filtrar aqui esvaziaria o hub `/espelhar-grupos-whatsapp` assim que as 15
// rotas de cidade saíssem do índice, e orfanaria as páginas retiradas — o
// contrário do `follow: true` que `buildSeoRobots` emite justamente para o
// link interno continuar circulando (FR-009). Quem filtra por indexação é
// `getIndexableSeoRoutes` (sitemap + IndexNow), e só ele.
export function getSeoRoutesByCluster(cluster) {
  return SEO_ROUTES.filter((route) => route.cluster === cluster && route.type !== 'hub')
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

// P2 (specs/013-inbound-leads-strategy) — sinal real de não-indexar, sem
// custo de memória (funções puras, build-time). Ver contracts/seo-robots.md.

/** Todas as rotas do registro, sem filtro de indexação — base de cobertura. */
export function getAllSeoRoutes() {
  return SEO_ROUTES
}

/** Entrada do registro por caminho — indexável ou não. */
export function getSeoRoute(routePath) {
  return SEO_ROUTES.find((route) => route.path === routePath) ?? null
}

/**
 * Metadata `robots` do Next derivada do registro. `follow: true` é sempre
 * obrigatório (FR-009) — a página sai do índice mas continua fazendo
 * circular o link interno. Devolve `undefined` quando a rota é indexável
 * (ausência = herda o default do site, que é indexar) — nunca emitir
 * `index: true` explícito, para não criar ruído nem divergir do
 * comportamento atual das rotas indexáveis.
 */
export function buildSeoRobots(routePath) {
  const route = getSeoRoute(routePath)
  if (!route || route.indexable !== false) return undefined
  return { index: false, follow: true }
}
