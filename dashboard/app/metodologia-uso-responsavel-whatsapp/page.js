import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS } from '@/lib/marketing-content'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

const title = 'Metodologia de uso responsável para automação no WhatsApp'
const description = 'Critérios públicos do BOTinho para operar divulgação em grupos de WhatsApp com revisão humana, consentimento, cadência e respeito às regras das plataformas.'
const slug = '/metodologia-uso-responsavel-whatsapp'
const dates = getEditorialDates(slug)

const principles = [
  ['1. Permissão antes de volume', 'A operação deve usar grupos autorizados, públicos aderentes e mensagens relevantes. Volume sem contexto aumenta ruído e risco de bloqueio.'],
  ['2. Revisão humana obrigatória', 'Preço, estoque, cupom, link monetizado, destino e copy devem ser conferidos antes de qualquer rotina automatizada.'],
  ['3. Cadência configurável', 'Intervalos e janelas de postagem ajudam a evitar repetição excessiva e preservam a experiência dos grupos.'],
  ['4. Logs para auditoria', 'Registros de envio e falha permitem revisar o que aconteceu, corrigir rotas e aprender antes de escalar.'],
  ['5. Sem promessa de ganho', 'Automação organiza a execução, mas não garante comissão, vendas, alcance, aprovação de marketplace ou entregabilidade no WhatsApp.'],
]

const steps = [
  'Valide se a oferta é permitida pelo grupo, pela plataforma de afiliados e pelo WhatsApp.',
  'Confira preço, estoque, cupom, link final e tag/código de afiliado no celular.',
  'Defina grupos de origem e destino com contexto claro, evitando públicos sem consentimento.',
  'Configure filtros, intervalos e horários antes de ampliar volume.',
  'Revise logs dos primeiros envios e só escale após confirmar qualidade operacional.',
]

const faq = [
  {
    q: 'Automação de WhatsApp é spam?',
    a: 'Pode virar spam quando ignora consentimento, contexto, frequência e relevância. A metodologia do BOTinho exige revisão humana, grupos autorizados e cadência responsável.',
  },
  {
    q: 'O BOTinho garante que uma conta nunca será bloqueada?',
    a: 'Não. Nenhuma ferramenta elimina risco de bloqueio. O objetivo é reduzir ruído operacional com filtros, intervalos, logs e boas práticas.',
  },
  {
    q: 'Posso automatizar qualquer link de afiliado?',
    a: 'Não automaticamente. O operador precisa conferir as regras da plataforma, a tag de afiliado, o destino final e a permissão para divulgar em cada grupo.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const siteUrl = getSiteUrl()
  const schemas = [
    ...buildArticleJsonLd({ title, description, slug, siteUrl, faq, type: 'TechArticle' }),
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Como validar uma rotina responsável de divulgação em grupos de WhatsApp',
      description: 'Passo a passo para revisar oferta, link, destino, cadência e logs antes de escalar automação.',
      step: steps.map((text, index) => ({ '@type': 'HowToStep', position: index + 1, name: `Passo ${index + 1}`, text })),
    },
  ]

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/conteudos" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para conteúdos</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Metodologia · Uso responsável</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p>{PRODUCT_DEFINITION} A metodologia pública do produto orienta que automação só entre depois de validação de oferta, link, grupo, copy e cadência.</p>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2>Limites que não devem ser prometidos</h2>
              <ul>
                {PRODUCT_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>

            <section>
              <h2>Princípios de operação responsável</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {principles.map(([heading, body]) => (
                  <div key={heading} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <h3 className="font-black text-gray-950">{heading}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-700">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2>Checklist de validação antes de escalar</h2>
              <ol>
                {steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>

            <section>
              <h2>FAQ</h2>
              {faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                  <p className="mt-3 text-gray-700">{item.a}</p>
                </details>
              ))}
            </section>

            <section>
              <h2>Próximos passos</h2>
              <p>Use esta metodologia junto com o <Link href="/materiais/checklist-divulgacao-ofertas-grupos-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">checklist de divulgação</Link> e o guia de <Link href="/blog/conferir-converter-link-afiliado-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">conferência de link de afiliado</Link>.</p>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
