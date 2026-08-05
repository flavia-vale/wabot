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
  { path: '/cadastro', title: 'Cadastro BOTinho — teste grátis para automatizar ofertas no WhatsApp', description: 'Crie sua conta no BOTinho e comece a automatizar a divulgação de ofertas em grupos e canais do WhatsApp.', template: 'signup', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/cadastro'), indexable: true },
  { path: '/parcerias', title: 'Parcerias BOTinho | Co-marketing para admins e afiliados', description: 'Programa de parcerias do BOTinho para admins, creators e comunidades que operam ofertas no WhatsApp com piloto guiado, UTMs e operação responsável.', template: 'partnerships', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/parcerias'), indexable: true },
  { path: '/bot-canais-whatsapp', title: 'Bot para Canais do WhatsApp com Módulo de Preservação Avançada', description: 'Migre achadinhos para Canais do WhatsApp com espelhamento entre grupos e canais, ritmo humano, variações, monitoramento e preservação avançada.', template: 'campaign-landing', priority: 0.9, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/bot-afiliados-whatsapp', title: 'Bot para Afiliados no WhatsApp: Shopee, Amazon e Mercado Livre', description: 'Converta links de afiliado da Shopee, Amazon, Mercado Livre e Magalu e publique as ofertas nos seus grupos e Canais do WhatsApp automaticamente. Teste grátis por 7 dias.', template: 'commercial-seo', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/bot-afiliados-whatsapp', '2026-07-30'), indexable: true },
  { path: '/bot-achadinhos-whatsapp', title: 'Bot para Achadinhos no WhatsApp: automatize seus grupos de ofertas', description: 'Automatize seu grupo de achadinhos no WhatsApp: o bot captura as ofertas, troca o link pelo seu código de afiliado e publica sozinho nos seus grupos e canais. Teste grátis por 7 dias.', template: 'commercial-seo', priority: 0.88, changeFrequency: 'weekly', lastModified: resolveLastModified('/bot-achadinhos-whatsapp', '2026-07-30'), indexable: true },
  { path: '/anti-ban-whatsapp', title: 'WhatsApp banido por divulgar ofertas: como reduzir o risco', description: 'Por que o WhatsApp bane quem divulga ofertas em grupos, o que aumenta o risco e o que dá para controlar de verdade. Sem promessa de “anti-ban 100%” — isso ninguém pode garantir.', template: 'commercial-seo', priority: 0.85, changeFrequency: 'weekly', lastModified: resolveLastModified('/anti-ban-whatsapp', '2026-07-30'), indexable: true },
  { path: '/grupo-para-canal-whatsapp', title: 'Como migrar grupo de achadinhos para Canal do WhatsApp', description: 'Planeje a migração de grupos de achadinhos para Canais do WhatsApp com o BOTinho, mantendo grupos como fonte e canais como vitrine preservada.', template: 'commercial-seo', priority: 0.82, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/bot-canal-whatsapp', title: 'Bot para Canal do WhatsApp com cadência e preservação', description: 'Publique ofertas em Canal do WhatsApp com o BOTinho usando cadência humana, variações, monitoramento e Módulo de Preservação Avançada.', template: 'commercial-seo', priority: 0.82, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/diagnostico-antiban-whatsapp', title: 'Teste: qual o risco do seu WhatsApp ser banido divulgando ofertas', description: 'Faça um diagnóstico rápido de exposição operacional no WhatsApp: chip dedicado, cadência, variações, canais, monitoramento e recuperação.', template: 'diagnostic-tool', priority: 0.86, changeFrequency: 'weekly', lastModified: resolveLastModified('/diagnostico-antiban-whatsapp'), indexable: true },
  { path: '/comparativos', template: 'comparison-hub', priority: 0.75, changeFrequency: 'monthly', lastModified: resolveLastModified('/comparativos'), indexable: true },
  { path: '/programa-de-afiliados', title: 'Programa de afiliados: Shopee, Amazon ou Mercado Livre (comparativo 2026)', description: 'Compare os programas de afiliados de Shopee, Amazon e Mercado Livre: quanto cada um paga de comissão, prazo de atribuição e como divulgar no WhatsApp. Dados com fonte e data.', template: 'comparison-hub', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/programa-de-afiliados'), indexable: true },
  { path: '/parceiro-influenciador', title: 'Parceria para criadores: robô grátis + 30% de comissão recorrente', description: 'Se você ensina afiliação ou tem audiência de afiliados: use o BOTinho de graça e ganhe 30% de comissão recorrente de cada pessoa que assinar pelo seu link. Todo mês, enquanto ela for cliente.', template: 'partner-landing', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/parceiro-influenciador', '2026-08-04'), indexable: true },
  { path: '/termos-parceria-influenciador', title: 'Regras da parceria com criadores: cortesia e comissão recorrente', description: 'As regras da parceria do BOTinho com criadores: como funciona a cortesia do robô, por quanto tempo ela vale, o que renova, como é calculada a comissão de 30% recorrente e quando ela é paga.', template: 'legal', priority: 0.5, changeFrequency: 'monthly', lastModified: resolveLastModified('/termos-parceria-influenciador', '2026-08-04'), indexable: true },
  { path: '/conteudos', title: 'Conteúdos: blog e materiais para afiliados no WhatsApp — hub de conteúdo BOTinho', description: 'Hub com todos os artigos e materiais gratuitos do BOTinho para afiliados que divulgam ofertas em grupos e canais do WhatsApp.', template: 'content-hub', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/conteudos'), indexable: true },
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
  { path: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande', title: 'Como começar como afiliado no WhatsApp sem ter grupo grande', description: 'Guia para afiliado iniciante começar a divulgar ofertas no WhatsApp mesmo sem audiência grande: chip dedicado, primeiros grupos, conversão de link e cadência responsável.', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/comecar-afiliado-whatsapp-sem-grupo-grande'), indexable: true },
  { path: '/blog/como-ser-afiliado-shopee-whatsapp', title: 'Shopee Afiliados: como se cadastrar e divulgar no WhatsApp (guia 2026)', description: 'Guia completo de Shopee Afiliados: como se cadastrar, quanto paga de comissão por tipo de venda, prazo de atribuição e como divulgar no WhatsApp sem perder comissão.', template: 'article', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-ser-afiliado-shopee-whatsapp', '2026-07-31'), indexable: true },
  { path: '/blog/como-divulgar-ofertas-amazon-whatsapp', title: 'Afiliado Amazon: como divulgar ofertas no WhatsApp (comissão por categoria)', description: 'Guia de afiliado Amazon (Amazon Associados): quanto paga de comissão por categoria de produto, como divulgar no WhatsApp com a tag correta e cadência que protege o número.', template: 'article', priority: 0.9, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-divulgar-ofertas-amazon-whatsapp', '2026-07-31'), indexable: true },
  { path: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp', title: 'Afiliado Mercado Livre: comissão por categoria e como divulgar no WhatsApp', description: 'Quanto o Mercado Livre paga de comissão de afiliado por categoria (venda direta e indireta), o prazo de pagamento e como divulgar as ofertas no WhatsApp sem perder a atribuição do link.', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-divulgar-ofertas-mercado-livre-whatsapp'), indexable: true },
  { path: '/blog/quanto-custa-bot-para-whatsapp-afiliados', title: 'Quanto custa um bot para WhatsApp de afiliados? Preços e o que avaliar', description: 'Entenda quanto custa um bot para WhatsApp de afiliados, o que muda entre plano básico e avançado e como avaliar custo real além do preço da mensalidade.', template: 'article', priority: 0.82, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/quanto-custa-bot-para-whatsapp-afiliados'), indexable: true },
  { path: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', title: 'Melhores horários para postar ofertas no WhatsApp (guia prático)', description: 'Descubra os melhores horários para postar ofertas no WhatsApp, por que a cadência importa mais que o horário exato e como distribuir envios sem parecer disparo.', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/melhores-horarios-para-postar-ofertas-no-whatsapp'), indexable: true },
  { path: '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp', title: 'Como converter link de afiliado automaticamente no WhatsApp', description: 'Entenda como converter link de afiliado automaticamente no WhatsApp para Shopee, Amazon, Mercado Livre e Magalu, sem perder comissão nem encaminhar link de terceiro.', template: 'article', priority: 0.82, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-converter-link-de-afiliado-automaticamente-whatsapp'), indexable: true },
  { path: '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp', title: 'Como combinar Amazon, Shopee e Mercado Livre no mesmo grupo de ofertas', description: 'Estratégia para operar os três programas de afiliados ao mesmo tempo no WhatsApp: qual loja usar para cada tipo de oferta, como não misturar os códigos e como medir qual rende mais no seu público.', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp'), indexable: true },
  { path: '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero', title: 'Como montar um grupo de ofertas no WhatsApp do zero', description: 'Guia para montar um grupo de ofertas no WhatsApp do zero: chip dedicado, primeiras fontes de oferta, conversão de link, cadência e quando migrar para canal.', template: 'article', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero'), indexable: true },
  { path: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', template: 'lead-magnet', priority: 0.8, changeFrequency: 'weekly', lastModified: resolveLastModified('/materiais/checklist-divulgacao-ofertas-grupos-whatsapp'), indexable: true },
  { path: '/bot-comum-vs-botinho', title: 'Bot comum vs BOTinho: qual preserva melhor sua operação no WhatsApp?', description: 'Compare bot comum e BOTinho para afiliados no WhatsApp: repostagem simples, cadência, variações, monitoramento, canais e preservação avançada.', template: 'comparison', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/bot-comum-vs-botinho'), indexable: true },
  { path: '/faq-antiban-whatsapp', title: 'WhatsApp banido divulgando ofertas: perguntas e respostas', description: 'Por que o WhatsApp bane número que divulga ofertas em grupo, se existe bot “anti-ban”, se chip dedicado resolve e o que fazer quando o número já foi bloqueado.', template: 'faq', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/faq-antiban-whatsapp'), indexable: true },
  { path: '/como-funciona-botinho-canais', title: 'Como funciona o BOTinho para Canais do WhatsApp', description: 'Veja o fluxo operacional do BOTinho para Canais do WhatsApp: fontes, destinos, cadência, variações, monitoramento e preservação avançada.', template: 'howto', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/como-funciona-botinho-canais'), indexable: true },
  { path: '/protecao-antiban-botinho', title: 'Como evitar que o WhatsApp seja banido divulgando ofertas', description: 'As quatro camadas que reduzem o risco de o número ser banido divulgando ofertas: intervalo entre envios, variação de mensagem, monitoramento e plano de recuperação.', template: 'module-deep-dive', priority: 0.78, changeFrequency: 'weekly', lastModified: resolveLastModified('/protecao-antiban-botinho'), indexable: true },
  { path: '/materiais/checklist-antiban-whatsapp', title: 'Checklist: como não tomar ban no WhatsApp divulgando ofertas', description: 'Checklist prático para reduzir exposição operacional no WhatsApp com chip dedicado, cadência, variações, monitoramento e plano de recuperação.', template: 'lead-magnet', priority: 0.82, changeFrequency: 'weekly', lastModified: resolveLastModified('/materiais/checklist-antiban-whatsapp'), indexable: true },
  { path: '/metodologia-uso-responsavel-whatsapp', template: 'methodology', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/metodologia-uso-responsavel-whatsapp'), indexable: true },
  { path: '/botinho-vs-planilha-manual', template: 'comparison', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/botinho-vs-planilha-manual'), indexable: true },
  { path: '/botinho-vs-ferramentas-genericas-automacao', template: 'comparison', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/botinho-vs-ferramentas-genericas-automacao'), indexable: true },
  { path: '/melhores-bots-para-afiliados-whatsapp', template: 'listicle', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/melhores-bots-para-afiliados-whatsapp'), indexable: true },
  { path: '/glossario', template: 'glossary', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/glossario'), indexable: true },
  { path: '/estudos-de-caso', template: 'case-studies', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/estudos-de-caso'), indexable: true },
  { path: '/alternativas/achadinhos-bot', title: 'Alternativa ao AchadinhosBot: comparativo honesto para grupos de achadinhos', description: 'Compare AchadinhosBot, Achadinho Pro e BOTinho para automatizar grupos de achadinhos no WhatsApp: preço por plano, marketplaces suportados e teste grátis. Dados verificados em 31/07/2026.', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/achadinhos-bot'), indexable: true },
  { path: '/alternativas/bot-para-whatsapp-afiliados', template: 'alternatives', priority: 0.7, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/bot-para-whatsapp-afiliados'), indexable: true },
  { path: '/alternativas/proafiliados', title: 'Alternativa ao ProAfiliados: comparativo honesto para bot de afiliados no WhatsApp', description: 'Compare ProAfiliados e BOTinho para automatizar ofertas de afiliado no WhatsApp: plano grátis, preço por plano, tag nas mensagens e o que cada um cobre. Dados verificados em 04/08/2026.', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/proafiliados'), indexable: true },
  { path: '/alternativas/shozap', title: 'Alternativa ao Shozap: comparativo honesto de preço e limites por plano', description: 'Compare Shozap e BOTinho para divulgar ofertas no WhatsApp: preço por plano, quantas conexões e grupos cabem, e quais marketplaces entram em cada faixa. Dados verificados em 04/08/2026.', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/shozap'), indexable: true },
  { path: '/alternativas/fluxopromo', title: 'Alternativa ao FluxoPromo: comparativo honesto para quem divulga ofertas', description: 'Compare FluxoPromo e BOTinho para divulgar ofertas de afiliado: plano grátis, preço por plano, limite de ofertas por dia e a diferença entre feed de ofertas e espelhamento de grupos. Verificado em 04/08/2026.', template: 'alternatives', priority: 0.85, changeFrequency: 'monthly', lastModified: resolveLastModified('/alternativas/fluxopromo'), indexable: true },
  { path: '/ferramentas', template: 'tools-hub', priority: 0.8, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/ferramentas/calculadora-tempo-grupos-whatsapp', template: 'tool-calculator', priority: 0.8, changeFrequency: 'weekly', lastModified: DEFAULT_LAST_MODIFIED, indexable: true },
  { path: '/ferramentas/calculadora-risco-whatsapp', title: 'Calculadora: risco de banimento do WhatsApp para quem divulga ofertas', description: 'Calcule a exposição operacional da sua divulgação no WhatsApp com base em volume, cadência, mensagens idênticas, chip dedicado, monitoramento e recuperação.', template: 'tool-calculator', priority: 0.84, changeFrequency: 'weekly', lastModified: resolveLastModified('/ferramentas/calculadora-risco-whatsapp'), indexable: true },
  { path: '/confiabilidade-sessao-whatsapp', title: 'Confiabilidade da sessão do WhatsApp no BOTinho', description: 'Como o BOTinho mantém sua sessão do WhatsApp conectada durante atualizações do sistema, com um processo dedicado ao ciclo de vida do bot e status honesto no painel.', template: 'module-deep-dive', priority: 0.78, changeFrequency: 'monthly', lastModified: resolveLastModified('/confiabilidade-sessao-whatsapp'), indexable: true },
  { path: '/seguranca-credenciais-afiliado', title: 'Segurança das credenciais de afiliado no BOTinho', description: 'Como o BOTinho protege as credenciais das suas contas de afiliado e sua chave PIX: criptografia em repouso, proteção contra força bruta no login e isolamento entre ambientes.', template: 'module-deep-dive', priority: 0.78, changeFrequency: 'monthly', lastModified: resolveLastModified('/seguranca-credenciais-afiliado'), indexable: true },
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
