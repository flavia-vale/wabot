import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { PreservationDiagnostic } from '@/components/marketing/PreservationDiagnostic'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'

const slug = '/diagnostico-antiban-whatsapp'
const siteUrl = getSiteUrl()
const pageUrl = `${siteUrl}${slug}`
const title = 'Teste: qual o risco do seu WhatsApp ser banido'
const description = 'Responda 6 perguntas e veja o que aumenta o risco de banimento na sua divulgação: volume, ritmo, mensagens repetidas e chip. Ninguém garante imunidade.'

const faqItems = [
  {
    question: 'Este diagnóstico garante que meu WhatsApp não será banido?',
    answer: 'Não. Nenhuma ferramenta séria garante banimento zero. O diagnóstico aponta exposição operacional e recomenda camadas de preservação para reduzir risco.',
  },
  {
    question: 'Preciso conectar meu WhatsApp para usar?',
    answer: 'Não. A ferramenta não pede QR Code, senha, cookies, link de grupo nem acesso ao WhatsApp. Você responde perguntas operacionais e recebe uma estimativa local.',
  },
  {
    question: 'O que acontece depois do resultado?',
    answer: 'Você pode levar o resultado para o cadastro do Espelha Grupos, revisar cadência, separar chip dedicado e planejar migração gradual para Canais do WhatsApp.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: {
    title,
    description,
    url: pageUrl,
    siteName: 'Espelha Grupos',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: buildOgImageUrl({ slug: 'diagnostico-antiban-whatsapp', cluster: 'canais-preservacao', template: 'tool' }),
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [buildOgImageUrl({ slug: 'diagnostico-antiban-whatsapp', cluster: 'canais-preservacao', template: 'tool' })],
  },
}

function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: title,
        description,
        url: pageUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
        isPartOf: { '@type': 'WebSite', name: 'Espelha Grupos', url: siteUrl },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Diagnóstico de Preservação Avançada', item: pageUrl },
        ],
      },
    ],
  }
}

export default function Page() {
  const trackerRoute = {
    slug: 'diagnostico-antiban-whatsapp',
    path: slug,
    cluster: 'canais-preservacao',
    intent: 'diagnostico antiban whatsapp',
    template: 'diagnostic-tool',
  }

  return (
    <PublicShell>
      <OrganicPageTracker route={trackerRoute} />
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()).replace(/</g, '\\u003c') }} />
        <Link href="/bot-canais-whatsapp" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para Canais + Preservação</Link>
        <section className="mt-8 grid gap-8 rounded-[2rem] bg-emerald-950 p-7 text-white shadow-sm md:p-10 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Diagnóstico de Preservação Avançada</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Descubra onde sua operação de WhatsApp está mais exposta.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50">Responda 6 perguntas sobre chip, cadência, variações, canais, monitoramento e recuperação. O resultado mostra o próximo passo antes de escalar ofertas em grupos e Canais do WhatsApp.</p>
          </div>
          <aside className="rounded-3xl border border-emerald-700 bg-emerald-900/80 p-5">
            <h2 className="text-xl font-black tracking-tight">Sem promessa de “anti-ban 100%”</h2>
            <p className="mt-3 text-sm leading-7 text-emerald-50">O diagnóstico usa linguagem de busca do mercado, mas a entrega é preservação responsável: redução de risco, monitoramento e plano de recuperação.</p>
          </aside>
        </section>

        <div className="mt-10">
          <PreservationDiagnostic origin="diagnostico_antiban_whatsapp" />
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Perguntas frequentes sobre o diagnóstico">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-gray-950">{item.question}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-700">{item.answer}</p>
            </article>
          ))}
        </section>
      </main>
    </PublicShell>
  )
}
