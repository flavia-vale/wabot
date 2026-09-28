import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { CommissionCalculator } from '@/components/free-tools/CommissionCalculator'
import { getSiteUrl } from '@/lib/site-url'
import { EditorialFreshness } from '@/components/marketing/EditorialFreshness'

const slug = '/ferramentas/calculadora-comissao-afiliado-whatsapp'
const siteUrl = getSiteUrl()
const title = 'Calculadora de comissão de afiliado no WhatsApp'
const description = 'Coloque cliques, conversão, valor médio e comissão da loja e veja pedidos, comissão estimada e ponto de equilíbrio da sua operação. Grátis, sem cadastro.'

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
    question: 'Quanto um afiliado ganha com grupos de WhatsApp?',
    answer: 'Depende de quantos cliques os seus links recebem, de quantos viram pedido, do valor médio do pedido e da comissão de cada loja. A calculadora faz essa conta com os números que você informa; ela não sabe o seu resultado e não promete nenhum.',
  },
  {
    question: 'De onde tiro a conversão e o valor médio dos pedidos?',
    answer: 'Do relatório do programa de afiliados de cada loja, que mostra cliques, pedidos e comissão. Se ainda não tem histórico, use um número prudente e refaça a conta quando tiver dados.',
  },
  {
    question: 'A calculadora acessa meu WhatsApp, meus links ou minhas credenciais?',
    answer: 'Não. Ela roda no seu navegador com os números que você digita e não pede QR Code, cookies, links de afiliado nem dados de grupos.',
  },
  {
    question: 'Os valores que já vêm preenchidos são médias de mercado?',
    answer: 'Não. São só um exemplo para a tela não abrir vazia. Troque pelos seus números.',
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
          { '@type': 'ListItem', position: 3, name: 'Calculadora de comissão', item: `${siteUrl}${slug}` },
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
            <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-6xl">Calculadora de comissão de afiliado no WhatsApp</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700">Quantos pedidos e quanta comissão os seus cliques podem render, e quantos você precisa para pagar as ferramentas. O cálculo é aberto, sem cadastro e sem conectar nada.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
              <span className="rounded-full bg-emerald-100 px-3 py-2">Sem QR Code</span>
              <span className="rounded-full bg-emerald-100 px-3 py-2">Sem cookies</span>
              <span className="rounded-full bg-emerald-100 px-3 py-2">Sem links de afiliado</span>
            </div>
          </div>
          <aside className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black tracking-tight text-gray-950">Quando usar esta ferramenta?</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
              <li>• Você quer saber se a divulgação já paga as ferramentas que usa.</li>
              <li>• Você quer estimar quantos cliques precisa para chegar a uma meta.</li>
              <li>• Você quer comparar lojas com comissões diferentes.</li>
            </ul>
          </aside>
        </section>

        <div className="mt-10">
          <CommissionCalculator />
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-gray-950">{item.question}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-700">{item.answer}</p>
            </article>
          ))}
        </section>
      </main>
      <EditorialFreshness pathname="/ferramentas/calculadora-comissao-afiliado-whatsapp" />
    </PublicShell>
  )
}
