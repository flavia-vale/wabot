import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { WhatsAppRiskCalculator } from '@/components/free-tools/WhatsAppRiskCalculator'
import { getSiteUrl } from '@/lib/site-url'

const slug = '/ferramentas/calculadora-risco-whatsapp'
const siteUrl = getSiteUrl()
const title = 'Calculadora de risco para WhatsApp de afiliados'
const description = 'Calcule a exposição operacional da sua divulgação no WhatsApp com base em volume, cadência, mensagens idênticas, chip dedicado, monitoramento e recuperação.'

const faqItems = [
  {
    question: 'A calculadora garante que meu WhatsApp não será banido?',
    answer: 'Não. Ela estima exposição operacional e recomenda camadas de preservação. Nenhuma ferramenta séria garante banimento zero.',
  },
  {
    question: 'A ferramenta acessa meus grupos ou canais?',
    answer: 'Não. Ela roda com números aproximados informados por você e não pede QR Code, telefone, link de grupo, cookies ou credenciais.',
  },
  {
    question: 'Qual o próximo passo depois do score?',
    answer: 'Use as recomendações para aplicar o checklist de preservação, revisar cadência e levar a faixa de risco para o cadastro do BOTinho.',
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
        '@type': 'WebApplication',
        name: title,
        description,
        url: `${siteUrl}${slug}`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
        isPartOf: { '@type': 'WebSite', name: 'BOTinho', url: siteUrl },
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
          { '@type': 'ListItem', position: 2, name: 'Ferramentas', item: `${siteUrl}/ferramentas` },
          { '@type': 'ListItem', position: 3, name: 'Calculadora de risco', item: `${siteUrl}${slug}` },
        ],
      },
    ],
  }
}

export default function Page() {
  const trackerRoute = {
    slug: 'calculadora-risco-whatsapp',
    path: slug,
    cluster: 'canais-preservacao',
    intent: 'calculadora risco whatsapp',
    template: 'tool-calculator',
  }

  return (
    <PublicShell>
      <OrganicPageTracker route={trackerRoute} />
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()).replace(/</g, '\\u003c') }} />
        <Link href="/ferramentas" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para ferramentas</Link>
        <section className="mt-8 grid gap-8 rounded-[2rem] bg-emerald-950 p-7 text-white shadow-sm md:p-10 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Ferramenta gratuita · Preservação Avançada</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Calculadora de risco operacional no WhatsApp</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50">Estime exposição por volume, cadência, repetição de mensagens, chip dedicado, monitoramento e recuperação antes de escalar grupos e Canais do WhatsApp.</p>
          </div>
          <aside className="rounded-3xl border border-emerald-700 bg-emerald-900/80 p-5">
            <h2 className="text-xl font-black tracking-tight">Sem acesso ao WhatsApp</h2>
            <p className="mt-3 text-sm leading-7 text-emerald-50">A calculadora usa apenas números aproximados e transforma o resultado em ações práticas de preservação.</p>
          </aside>
        </section>

        <div className="mt-10">
          <WhatsAppRiskCalculator />
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Perguntas frequentes sobre a calculadora de risco">
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
