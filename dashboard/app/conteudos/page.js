import Link from 'next/link'
import { buildRegisterHref } from '@/lib/marketing-attribution'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'

const title = 'Conteúdos: blog e materiais para afiliados no WhatsApp'
const description = 'Central de conteúdos do BOTinho com artigos e materiais práticos para padronizar divulgação, validar links de afiliado e escalar grupos no WhatsApp com responsabilidade.'
const slug = '/conteudos'

const lastUpdated = '2026-05-15'
const editorialOwner = 'Time editorial WABOT'
const siteUrl = getSiteUrl()
const formattedLastUpdated = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${lastUpdated}T00:00:00Z`))

const blogPosts = [
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

const materials = [
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
    ],
  },
]

const contentItems = [...blogPosts, ...materials]

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
      <Link href={item.href} className="mt-4 inline-flex text-sm font-black text-emerald-700 underline underline-offset-4">
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
        <Link href={ctaHref} className="inline-flex rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <PublicShell>
        <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
          <section className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-emerald-100 md:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Central de conteúdo</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">Blog e materiais para crescer com processo</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
              Se você publica ofertas em grupos de WhatsApp, esta página centraliza os guias e checklists para validar links, padronizar operação e escalar divulgação sem improviso.
            </p>

            <p className="mt-4 text-sm text-gray-600">
              Atualizado em <time dateTime={lastUpdated}>{formattedLastUpdated}</time> · Curadoria: {editorialOwner}
            </p>

            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 md:p-5">
              <h2 className="text-base font-black text-emerald-900">Como usar esta central em 3 passos</h2>
              <ol className="mt-3 space-y-2 text-sm leading-7 text-emerald-950">
                <li><span className="font-black">1.</span> Comece pelo checklist principal para padronizar sua operação.</li>
                <li><span className="font-black">2.</span> Aplique os artigos do blog para reduzir erros de link e copy.</li>
                <li><span className="font-black">3.</span> Entre na lista para receber novos materiais e executar semanalmente.</li>
              </ol>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-emerald-800">
              <Link href={heroCta.href} className="rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700">
                {heroCta.label}
              </Link>
              <Link href={`/materiais/checklist-divulgacao-ofertas-grupos-whatsapp?from=hub&exp_id=${experimentId}`} className="rounded-xl border border-emerald-200 px-4 py-3 hover:bg-emerald-50">
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
                        <Link href={`${link.href}?from=trilha-${track.id}&exp_id=${experimentId}`} className="underline underline-offset-4">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {hubSections.map((section) => (
            <HubSection
              key={section.key}
              title={section.title}
              description={section.description}
              items={section.items}
              ctaHref={section.ctaHref}
              ctaLabel={section.ctaLabel}
            />
          ))}

          <section className="mt-10 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Perguntas frequentes</h2>
            <dl className="mt-4 space-y-4 text-sm leading-7 text-gray-700">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-black text-gray-950">{item.question}</dt>
                  <dd className="mt-1">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </PublicShell>
    </>
  )
}
