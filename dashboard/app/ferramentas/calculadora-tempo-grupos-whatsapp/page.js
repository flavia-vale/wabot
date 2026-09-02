import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { TimeSavingsCalculator } from '@/components/free-tools/TimeSavingsCalculator'
import { getSiteUrl } from '@/lib/site-url'

const slug = '/ferramentas/calculadora-tempo-grupos-whatsapp'
const siteUrl = getSiteUrl()
const title = 'Calculadora de tempo em grupos de WhatsApp grátis'
const description = 'Calcule quantas horas sua operação de ofertas em grupos de WhatsApp consome por mês e veja como organizar cadência, revisão e logs com responsabilidade.'

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

const faqItems = [
  {
    question: 'A calculadora acessa meu WhatsApp ou meus grupos?',
    answer: 'Não. A calculadora roda com números aproximados informados por você e não pede QR Code, cookies, links de afiliado, telefone de grupos ou credenciais.',
  },
  {
    question: 'O resultado é promessa de venda ou comissão?',
    answer: 'Não. O resultado é uma estimativa de tempo operacional. Preço, cupom, estoque, tag de afiliado e regras das plataformas sempre devem ser revisados pela operação.',
  },
  {
    question: 'Como usar o resultado no Espelha Grupos?',
    answer: 'Use a estimativa para definir grupos de origem e destino, intervalos de postagem, filtros e rotina de revisão antes de escalar a divulgação.',
  },
]

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
        isPartOf: { '@type': 'WebSite', name: 'Espelha Grupos', url: siteUrl },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: 'Ferramentas', item: `${siteUrl}/ferramentas` },
          { '@type': 'ListItem', position: 3, name: 'Calculadora de tempo', item: `${siteUrl}${slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  }
}

export default function Page() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }} />
        <Link href="/ferramentas" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para ferramentas</Link>
        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Ferramenta gratuita para afiliados</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-6xl">Calculadora de tempo perdido em grupos de WhatsApp</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700">Descubra quanto tempo sua rotina de curadoria, conferência e repostagem de ofertas pode estar consumindo por mês. O cálculo é aberto, sem cadastro obrigatório e sem pedir dados sensíveis.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
              <span className="rounded-full bg-emerald-100 px-3 py-2">Sem QR Code</span>
              <span className="rounded-full bg-emerald-100 px-3 py-2">Sem cookies</span>
              <span className="rounded-full bg-emerald-100 px-3 py-2">Sem links de afiliado</span>
            </div>
          </div>
          <aside className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black tracking-tight text-gray-950">Quando usar esta ferramenta?</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
              <li>• Você copia ofertas manualmente entre vários grupos.</li>
              <li>• Você não sabe se vale a pena organizar automação agora.</li>
              <li>• Você quer estimar economia de tempo sem conectar WhatsApp.</li>
            </ul>
          </aside>
        </section>

        <div className="mt-10">
          <TimeSavingsCalculator />
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
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
