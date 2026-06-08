import Link from 'next/link'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildRegisterHref } from '@/lib/marketing-attribution'

const title = 'Conteúdos: blog e materiais para afiliados no WhatsApp'
const description = 'Central de conteúdos do BOTinho com artigos e materiais práticos para padronizar divulgação, validar links de afiliado e escalar grupos no WhatsApp com responsabilidade.'
const slug = '/conteudos'

const lastUpdated = '2026-05-15'
const editorialOwner = 'Time editorial WABOT'
const siteUrl = getSiteUrl()
const formattedLastUpdated = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${lastUpdated}T00:00:00Z`))

const blogPosts = [
  {
    href: '/blog/comecar-afiliado-whatsapp-sem-grupo-grande',
    title: 'Como começar como afiliado no WhatsApp sem ter grupo grande',
    description: 'Primeiros passos para quem está começando: chip dedicado, conversão de link e cadência sem precisar de audiência grande.',
  },
  {
    href: '/blog/como-ser-afiliado-shopee-whatsapp',
    title: 'Como ser afiliado Shopee e divulgar ofertas no WhatsApp',
    description: 'Entre no programa de afiliados, gere o link com seu código e divulgue com conversão automática.',
  },
  {
    href: '/blog/como-divulgar-ofertas-amazon-whatsapp',
    title: 'Como divulgar ofertas da Amazon no WhatsApp como afiliado',
    description: 'Tag de associado, link convertido, preview com imagem e cadência que protege o número.',
  },
  {
    href: '/blog/grupo-ou-canal-whatsapp-achadinhos',
    title: 'Guia: grupo ou canal para achadinhos no WhatsApp',
    description: 'Compare grupos e canais para organizar achadinhos com menos ruído e mais preservação operacional.',
  },
  {
    href: '/blog/como-evitar-banimento-whatsapp-afiliados',
    title: 'Como reduzir o risco de banimento no WhatsApp para afiliados',
    description: 'Checklist honesto de chip dedicado, cadência, variações e preservação avançada.',
  },
  {
    href: '/blog/shadowban-whatsapp-canais',
    title: 'Shadowban em Canais do WhatsApp: sinais silenciosos',
    description: 'Sinais de queda de entrega e cliques para monitorar antes do prejuízo.',
  },
  {
    href: '/blog/migrar-grupo-achadinhos-para-canal',
    title: 'Como migrar grupo de achadinhos para Canal do WhatsApp',
    description: 'Passo a passo para migrar sem abandonar comunidade nem quebrar rotina.',
  },
  {
    href: '/blog/chip-dedicado-bot-whatsapp',
    title: 'Por que afiliados devem usar chip dedicado no bot do WhatsApp',
    description: 'Separe número pessoal da infraestrutura de canais, grupos e ofertas.',
  },
  {
    href: '/blog/bot-whatsapp-antiban-existe',
    title: 'Bot “anti-ban” para WhatsApp existe? A resposta honesta',
    description: 'Por que promessa absoluta é perigosa e como funciona preservação avançada.',
  },
  {
    href: '/blog/conferir-converter-link-afiliado-whatsapp',
    title: 'Como conferir e converter link de afiliado para WhatsApp',
    description: 'Evite perda de comissão ao validar tag, redirecionamento e destino final antes da divulgação.',
  },
  {
    href: '/blog/bot-para-afiliados-whatsapp-grupos-cupons',
    title: 'Bot para afiliados no WhatsApp em grupos de cupons',
    description: 'Fluxo para organizar divulgação em grupos sem depender de operação manual.',
  },
  {
    href: '/blog/como-escalar-grupos-sem-operacao-manual',
    title: 'Como escalar grupos sem operação manual',
    description: 'Princípios de processo para crescer mantendo qualidade da mensagem.',
  },
  {
    href: '/blog/checklist-padronizar-divulgacao-whatsapp',
    title: 'Checklist para padronizar divulgação no WhatsApp',
    description: 'Padronize copy, horário e grupos de destino para reduzir retrabalho.',
  },
]

const nichePages = [
  {
    href: '/bot-ofertas-restaurantes-whatsapp',
    title: 'Bot de ofertas para restaurantes no WhatsApp',
    description: 'Calendário, copy e distribuição responsável para promoções de restaurantes.',
  },
  {
    href: '/bot-ofertas-marketplace-whatsapp',
    title: 'Bot de ofertas para marketplace no WhatsApp',
    description: 'Conferência de link monetizado, tag de afiliado e automação em grupos.',
  },
]

const methodologyPages = [
  {
    href: '/faq-antiban-whatsapp',
    title: 'FAQ anti-ban WhatsApp honesto',
    description: 'Respostas sobre preservação avançada, chip dedicado, cadência, variações e recuperação.',
  },
  {
    href: '/como-funciona-botinho-canais',
    title: 'Como funciona o BOTinho para Canais do WhatsApp',
    description: 'Fluxo operacional de fontes, destinos, cadência, monitoramento e recuperação.',
  },
  {
    href: '/protecao-antiban-botinho',
    title: 'Proteção anti-ban no BOTinho',
    description: 'Camadas do Módulo de Preservação Avançada: limites, variações, monitoramento e plano B.',
  },
  {
    href: '/metodologia-uso-responsavel-whatsapp',
    title: 'Metodologia de uso responsável no WhatsApp',
    description: 'Critérios públicos para revisar ofertas, links, grupos, cadência e logs antes de escalar automação.',
  },
]


const comparisonPages = [
  {
    href: '/bot-comum-vs-botinho',
    title: 'Bot comum vs BOTinho',
    description: 'Compare repostagem simples com operação preservada para grupos e Canais do WhatsApp.',
  },
  {
    href: '/comparativos',
    title: 'Hub de comparativos do BOTinho',
    description: 'Página índice com comparativos e alternativas para escolher ferramenta por estágio e tipo de operação.',
  },
  {
    href: '/alternativas/bot-para-whatsapp-afiliados',
    title: 'Alternativas de bot para WhatsApp para afiliados',
    description: 'Comparativo equilibrado entre planilha, automação genérica, ferramentas oficiais e BOTinho.',
  },
  {
    href: '/botinho-vs-planilha-manual',
    title: 'BOTinho vs planilha manual',
    description: 'Quando a planilha basta e quando logs, cadência e origem/destino viram prioridade.',
  },
  {
    href: '/botinho-vs-ferramentas-genericas-automacao',
    title: 'BOTinho vs ferramentas genéricas de automação',
    description: 'Comparação para times que avaliam construir fluxos próprios ou usar ferramenta focada em grupos.',
  },
  {
    href: '/melhores-bots-para-afiliados-whatsapp',
    title: 'Melhores bots para afiliados no WhatsApp',
    description: 'Critérios transparentes para avaliar ferramentas sem ranking falso ou promessa de ganho.',
  },
]

const authorityPages = [
  {
    href: '/glossario',
    title: 'Glossário de automação para afiliados no WhatsApp',
    description: 'Definições parseáveis de link monetizado, origem, destino, espelhamento, cadência, UTM e anti-spam.',
  },
  {
    href: '/estudos-de-caso',
    title: 'Estudos de caso do BOTinho',
    description: 'Política pública para publicar cases somente com consentimento e dados verificáveis.',
  },
]

const materials = [
  {
    href: '/materiais/checklist-antiban-whatsapp',
    title: 'Checklist de Preservação Avançada para WhatsApp',
    description: 'Roteiro para revisar chip, cadência, variações, monitoramento e recuperação sem promessa de banimento zero.',
  },
  {
    href: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp',
    title: 'Checklist de divulgação de ofertas em grupos de WhatsApp',
    description: 'Roteiro público para validar oferta, link, copy, grupo e medição.',
  },
  {
    href: '/materiais/checklist-operacao-whatsapp',
    title: 'Checklist de operação para WhatsApp',
    description: 'Material para padronizar rotina antes de escalar automação.',
  },
]

const benchmarkItems = [
  {
    href: '/ferramentas/calculadora-risco-whatsapp',
    title: 'Calculadora de risco operacional no WhatsApp',
    description: 'Ferramenta gratuita para estimar exposição por volume, cadência, repetição, chip e monitoramento.',
  },
  {
    href: '/benchmarks/operacao-grupos-ofertas-whatsapp',
    title: 'Benchmark de operação em grupos de ofertas',
    description: 'Modelo para medir tempo, revisão, falhas e consistência sem expor dados sensíveis.',
  },
]

const hubPages = [
  {
    href: '/espelhar-grupos-whatsapp',
    title: 'Hub: espelhar grupos WhatsApp por cidade',
    description: 'Rotas regionais para operações que precisam comparar cidades e cadência local.',
  },
  {
    href: '/bot-ofertas-whatsapp',
    title: 'Hub: bot de ofertas por nicho',
    description: 'Páginas por categoria para adaptar calendário, copy e validação de ofertas.',
  },
  {
    href: '/automacao-whatsapp-afiliados',
    title: 'Hub: automação para afiliados',
    description: 'Diagnósticos de escala, consistência, tempo operacional e rastreamento.',
  },
]

const roadmapTracks = [
  {
    id: 'iniciante',
    title: 'Trilha iniciante',
    description: 'Base para publicar com consistência sem depender de memória operacional.',
    links: [
      { href: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', label: 'Checklist principal de divulgação' },
      { href: '/blog/checklist-padronizar-divulgacao-whatsapp', label: 'Checklist de padronização no WhatsApp' },
    ],
  },
  {
    id: 'intermediario',
    title: 'Trilha intermediária',
    description: 'Reduza erros de afiliado e aumente previsibilidade da operação.',
    links: [
      { href: '/blog/conferir-converter-link-afiliado-whatsapp', label: 'Conferir e converter links de afiliado' },
      { href: '/blog/bot-para-afiliados-whatsapp-grupos-cupons', label: 'Fluxo para afiliados em grupos de cupons' },
    ],
  },
  {
    id: 'escala',
    title: 'Trilha de escala',
    description: 'Evolua da execução manual para uma rotina de alto volume com controle.',
    links: [
      { href: '/blog/como-escalar-grupos-sem-operacao-manual', label: 'Escalar grupos sem operação manual' },
      { href: '/materiais/checklist-operacao-whatsapp', label: 'Checklist de operação para escala' },
      { href: '/ferramentas/calculadora-risco-whatsapp', label: 'Calculadora de risco operacional' },
    ],
  },
]

const contentItems = [...blogPosts, ...materials, ...benchmarkItems, ...hubPages]

const faqItems = [
  {
    question: 'Para quem é esta central de conteúdos?',
    answer: 'Para afiliados, admins de grupos e operações locais que publicam ofertas no WhatsApp e querem padronizar rotina sem perder qualidade.',
  },
  {
    question: 'Por onde devo começar?',
    answer: 'Comece pelo checklist principal de divulgação, depois aplique os guias do blog para revisar links, copy e ordem de execução.',
  },
  {
    question: 'Com que frequência esta central é atualizada?',
    answer: 'O hub é revisado continuamente para incluir materiais práticos e artigos aplicáveis ao dia a dia operacional.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: {
    title,
    description,
    url: `${siteUrl}${slug}`,
    type: 'website',
    locale: 'pt_BR',
  },
}

function ContentCard({ item }) {
  return (
    <li className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-black tracking-tight text-gray-950">{item.title}</h3>
      <p className="mt-3 text-sm leading-7 text-gray-700">{item.description}</p>
      <Link href={item.href} data-seo-cta="content-card" className="mt-4 inline-flex text-sm font-black text-emerald-700 underline underline-offset-4">
        Ver guia completo
      </Link>
    </li>
  )
}

function HubSection({ title: sectionTitle, description: sectionDescription, items, ctaHref, ctaLabel }) {
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-black tracking-tight text-gray-950">{sectionTitle}</h2>
      <p className="mt-2 text-sm leading-7 text-gray-700">{sectionDescription}</p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((item) => <ContentCard key={item.href} item={item} />)}
      </ul>
      <div className="mt-5">
        <Link href={ctaHref} data-seo-cta="content-section-cta" className="inline-flex rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
          {ctaLabel}
        </Link>
      </div>
    </section>
  )
}

export default function Page() {
  const experimentId = 'hub-fase4'
  const heroCta = {
    label: 'Receber checklist + plano semanal',
    href: buildRegisterHref({ source: 'conteudos', campaign: 'content-hub', content: 'hero-cta-checklist-plano', term: experimentId })
  }

  const hubSections = [
    {
      key: 'hubs',
      title: 'Hubs programáticos',
      description: 'Páginas centrais que conectam clusters de localizações, nichos e dores operacionais.',
      items: hubPages,
      ctaHref: `/login?mode=register&utm_source=conteudos&utm_medium=organic&utm_campaign=content-hub&utm_content=cta-pos-hubs&utm_term=${experimentId}`,
      ctaLabel: 'Receber plano por cluster',
    },
    {
      key: 'benchmarks',
      title: 'Benchmarks e dados operacionais',
      description: 'Modelos para transformar rotina de grupos em métricas agregadas e seguras.',
      items: benchmarkItems,
      ctaHref: `/login?mode=register&utm_source=conteudos&utm_medium=organic&utm_campaign=content-hub&utm_content=cta-pos-benchmarks&utm_term=${experimentId}`,
      ctaLabel: 'Receber benchmark operacional',
    },
    {
      key: 'blog',
      title: 'Artigos do blog',
      description: 'Guias para melhorar a qualidade das postagens e reduzir erros antes de escalar.',
      items: blogPosts,
      ctaHref: buildRegisterHref({ source: 'conteudos', campaign: 'content-hub', content: 'cta-pos-blog', term: experimentId }),
      ctaLabel: 'Receber próximos artigos aplicáveis',
    },
    {
      key: 'materiais',
      title: 'Materiais práticos',
      description: 'Checklists acionáveis para executar processo, manter consistência e acompanhar resultado.',
      items: materials,
      ctaHref: buildRegisterHref({ source: 'conteudos', campaign: 'content-hub', content: 'cta-pos-materiais', term: experimentId }),
      ctaLabel: 'Entrar na lista e receber novos materiais',
    },
  ]

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: `${siteUrl}${slug}`,
        inLanguage: 'pt-BR',
        dateModified: lastUpdated,
        mainEntityOfPage: `${siteUrl}${slug}`,
        isPartOf: { '@type': 'WebSite', name: 'WABOT', url: siteUrl },
        about: { '@type': 'Thing', name: 'Operação de divulgação em grupos de WhatsApp' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Conteúdos', item: `${siteUrl}${slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Conteúdos recomendados',
        itemListElement: contentItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.title,
          url: `${siteUrl}${item.href}`,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  }

  return (
    <>
      <OrganicPageTracker route={{ slug: 'conteudos', path: slug, cluster: 'conteudos', intent: 'conteudos afiliados whatsapp', template: 'content-hub' }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <PublicShell>
        <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
          <section className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-emerald-100 md:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Central de conteúdo</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">Blog e materiais para crescer com processo</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              Se você publica ofertas em grupos de WhatsApp, esta página centraliza os guias e checklists para validar links, padronizar operação e escalar divulgação sem improviso.
            </p>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Páginas por nicho</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {nichePages.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Metodologia e uso responsável</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {methodologyPages.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>

            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-emerald-800">
              <Link href={heroCta.href} data-seo-cta="content-hero-register" className="rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700">
                {heroCta.label}
              </Link>
              <Link href={`/materiais/checklist-divulgacao-ofertas-grupos-whatsapp?from=hub&exp_id=${experimentId}`} data-seo-cta="content-primary-checklist" className="rounded-xl border border-emerald-200 px-4 py-3 hover:bg-emerald-50">
                Ver checklist principal
              </Link>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Trilhas por estágio operacional</h2>
            <p className="mt-2 text-sm leading-7 text-gray-700">Escolha uma trilha de execução e avance da base até escala com sequência orientada.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {roadmapTracks.map((track) => (
                <article key={track.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <h3 className="text-lg font-black text-gray-950">{track.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{track.description}</p>
                  <ul className="mt-3 space-y-2 text-sm font-bold text-emerald-800">
                    {track.links.map((link) => (
                      <li key={link.href}>
                        <Link href={`${link.href}?from=trilha-${track.id}&exp_id=${experimentId}`} data-seo-cta="content-roadmap-link" className="underline underline-offset-4">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Autoridade e definições</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {authorityPages.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Materiais práticos</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {materials.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>
      </main>
    </PublicShell>
    </>
  )
}
