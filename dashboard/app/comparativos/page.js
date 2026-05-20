import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { COMPARISON_PAGES } from '@/app/_comparisonContent'
import { getSiteUrl } from '@/lib/site-url'

const slug = '/comparativos'
const title = 'Comparativos e alternativas para operação de afiliados no WhatsApp'
const description = 'Hub com páginas de comparativos e alternativas para avaliar BOTinho, planilha manual e automações genéricas com critérios transparentes.'

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: {
    title,
    description,
    url: `${getSiteUrl()}${slug}`,
    type: 'website',
    locale: 'pt_BR',
  },
}

export default function Page() {
  const items = Object.entries(COMPARISON_PAGES).map(([href, page]) => ({ href, title: page.title, description: page.description }))

  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <section className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Hub de comparativos</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">Compare ferramentas para operar grupos com consistência</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">{description}</p>
        </section>

        <section className="mt-8">
          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <li key={item.href} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black tracking-tight text-gray-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-700">{item.description}</p>
                <Link href={item.href} data-seo-cta="comparativos-hub-card" className="mt-4 inline-flex text-sm font-black text-emerald-700 underline underline-offset-4">
                  Ver comparativo
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </PublicShell>
  )
}
