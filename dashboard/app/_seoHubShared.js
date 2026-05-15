import Link from 'next/link'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { PublicShell } from '@/components/PublicShell'
import { getHubSeoRoute, getSeoRoutesByCluster } from '@/lib/seo-registry.mjs'
import { getSiteUrl } from '@/lib/site-url'

const HUB_CONTENT = {
  'espelhar-grupos-whatsapp': {
    eyebrow: 'Hub de localizações',
    intro: 'Compare rotinas regionais antes de criar novas campanhas. O objetivo é escolher grupos, horários e cadência por cidade sem transformar automação em disparo indiscriminado.',
    promise: 'Ideal para operações que têm grupos em várias cidades ou querem sair do copia-e-cola regional.',
    checklist: ['Separar grupos por cidade, região e perfil de compra.', 'Definir janelas de postagem para evitar repetição excessiva.', 'Validar preço, estoque e link antes de escalar a mensagem.'],
  },
  'bot-ofertas-whatsapp': {
    eyebrow: 'Hub de nichos',
    intro: 'Use este hub para adaptar a divulgação de ofertas ao calendário comercial de cada nicho, com copy, link, plataforma e revisão adequados antes da automação.',
    promise: 'Ideal para afiliados, curadores e admins que publicam ofertas por categoria.',
    checklist: ['Criar checklist de validação por nicho.', 'Padronizar benefício, preço, validade e CTA da oferta.', 'Medir quais categorias justificam mais frequência.'],
  },
  'automacao-whatsapp-afiliados': {
    eyebrow: 'Hub de dores operacionais',
    intro: 'Diagnostique gargalos de escala, consistência, tempo operacional e rastreamento antes de automatizar. A automação deve ampliar um processo correto, não esconder falhas.',
    promise: 'Ideal para quem já divulga em grupos e quer transformar esforço manual em rotina controlada.',
    checklist: ['Identificar o gargalo principal antes de configurar automação.', 'Acompanhar logs, falhas e aprendizados por campanha.', 'Escalar apenas grupos permitidos e com mensagens relevantes.'],
  },
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function getSeoHubMetadata(hubSlug) {
  const route = getHubSeoRoute(`/${hubSlug}`)
  if (!route) return {}

  return {
    title: route.title,
    description: route.description,
    alternates: { canonical: route.path },
    openGraph: {
      title: route.title,
      description: route.description,
      url: `${getSiteUrl()}${route.path}`,
      type: 'website',
      locale: 'pt_BR',
    },
  }
}

export function SeoHubPage({ hubSlug }) {
  const route = getHubSeoRoute(`/${hubSlug}`)
  const content = HUB_CONTENT[hubSlug]
  const spokes = route ? getSeoRoutesByCluster(route.cluster) : []
  const siteUrl = getSiteUrl()

  if (!route || !content) return null

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: route.title,
    description: route.description,
    url: `${siteUrl}${route.path}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: spokes.map((spoke, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: spoke.label,
        url: `${siteUrl}${spoke.path}`,
      })),
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: route.label, item: `${siteUrl}${route.path}` },
    ],
  }

  return (
    <PublicShell>
      <OrganicPageTracker route={route} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">{content.eyebrow}</p>
        <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
            <h1 className="text-4xl font-black tracking-tight text-gray-950 md:text-6xl">{route.title}</h1>
            <p className="mt-5 text-lg leading-8 text-gray-600">{content.intro}</p>
            <p className="mt-4 rounded-2xl bg-emerald-50 p-5 text-base font-bold leading-7 text-emerald-900 ring-1 ring-emerald-100">{content.promise}</p>
          </section>
          <aside className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Checklist do cluster</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
              {content.checklist.map((item) => <li key={item}>✓ {item}</li>)}
            </ul>
            <Link href="/login?mode=register" data-seo-cta="hub-register" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700">
              Entrar na lista VIP
            </Link>
          </aside>
        </div>

        <section className="mt-10 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Spokes do hub</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Páginas relacionadas</h2>
            </div>
            <Link href="/conteudos" data-seo-cta="hub-content-center" className="font-bold text-emerald-700 underline underline-offset-4">Ver central de conteúdos</Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {spokes.map((spoke) => (
              <Link key={spoke.path} href={spoke.path} data-seo-cta="hub-spoke" className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-gray-800 transition hover:border-emerald-200 hover:bg-emerald-50">
                <span className="text-xs font-black uppercase tracking-wide text-emerald-700">{spoke.template}</span>
                <span className="mt-2 block text-lg font-black text-gray-950">{spoke.label}</span>
                <span className="mt-2 block text-sm leading-6 text-gray-600">Intenção: {spoke.intent}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </PublicShell>
  )
}
