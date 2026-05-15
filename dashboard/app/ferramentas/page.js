import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'

const slug = '/ferramentas'
const siteUrl = getSiteUrl()
const title = 'Ferramentas gratuitas para afiliados no WhatsApp'
const description = 'Use ferramentas gratuitas do BOTinho para calcular tempo operacional, planejar cadência e organizar divulgação de ofertas em grupos de WhatsApp com responsabilidade.'

const tools = [
  {
    href: '/ferramentas/calculadora-tempo-grupos-whatsapp',
    status: 'Disponível',
    title: 'Calculadora de tempo em grupos de WhatsApp',
    description: 'Estime horas/mês gastas com curadoria, conferência e repostagem manual de ofertas.',
    cta: 'Calcular agora',
  },
  {
    href: '/ferramentas/calculadora-tempo-grupos-whatsapp',
    status: 'Próxima',
    title: 'Auditor de operação de grupos de ofertas',
    description: 'Score de maturidade para cadência, revisão, filtros e logs antes de escalar.',
    cta: 'Usar calculadora enquanto isso',
  },
  {
    href: '/ferramentas/calculadora-tempo-grupos-whatsapp',
    status: 'Planejada',
    title: 'Gerador de calendário de ofertas',
    description: 'Monte uma semana de postagens com horários, categorias e checklist de revisão.',
    cta: 'Começar pela calculadora',
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

function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: title,
        description,
        url: `${siteUrl}${slug}`,
        isPartOf: { '@type': 'WebSite', name: 'BOTinho', url: siteUrl },
      },
      {
        '@type': 'ItemList',
        name: 'Ferramentas gratuitas do BOTinho',
        itemListElement: tools.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.title,
          url: `${siteUrl}${tool.href}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Ferramentas', item: `${siteUrl}${slug}` },
        ],
      },
    ],
  }
}

export default function Page() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }} />
        <section className="rounded-[2rem] bg-emerald-950 p-7 text-white shadow-sm md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Engineering as marketing</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">Ferramentas gratuitas para organizar grupos de WhatsApp</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50">Diagnósticos simples para afiliados, curadores de ofertas e admins de grupos estimarem tempo, planejarem cadência e reduzirem improviso antes de conectar qualquer conta.</p>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3" aria-label="Lista de ferramentas gratuitas">
          {tools.map((tool) => (
            <article key={tool.title} className="flex flex-col rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800">{tool.status}</span>
              <h2 className="mt-4 text-xl font-black tracking-tight text-gray-950">{tool.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-gray-700">{tool.description}</p>
              <Link href={tool.href} className="mt-5 inline-flex justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">
                {tool.cta}
              </Link>
            </article>
          ))}
        </section>
      </main>
    </PublicShell>
  )
}
