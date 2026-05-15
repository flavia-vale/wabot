import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

const slug = '/glossario'
const title = 'Glossário de automação para afiliados no WhatsApp'
const description = 'Definições parseáveis sobre link monetizado, grupo de origem, grupo de destino, espelhamento, cadência, UTM, anti-spam e afiliado.'
const dates = getEditorialDates(slug)

const terms = [
  { term: 'Link monetizado', definition: 'URL com tag, código ou parâmetro de afiliado usado para atribuir clique, venda ou comissão a uma pessoa ou operação. Deve ser conferido no destino final antes da divulgação.' },
  { term: 'Grupo de origem', definition: 'Grupo ou canal usado como fonte de mensagens/ofertas que serão revisadas antes de serem distribuídas para outros destinos.' },
  { term: 'Grupo de destino', definition: 'Grupo autorizado que recebe uma mensagem revisada conforme nicho, contexto, regras internas, frequência e interesse do público.' },
  { term: 'Espelhamento', definition: 'Rotina de copiar ou encaminhar uma mensagem de uma origem para destinos definidos, com filtros, revisão e cadência para reduzir erro operacional.' },
  { term: 'Cadência', definition: 'Intervalo, janela de horário e frequência planejada para publicar mensagens sem saturar grupos ou repetir ofertas em excesso.' },
  { term: 'UTM', definition: 'Parâmetros adicionados a URLs para identificar origem, mídia, campanha e conteúdo em relatórios de marketing.' },
  { term: 'Anti-spam operacional', definition: 'Conjunto de limites, filtros e revisões para evitar mensagens irrelevantes, repetitivas, sem consentimento ou fora das regras dos grupos e plataformas.' },
  { term: 'Afiliado', definition: 'Pessoa ou operação que divulga links de produtos ou ofertas e pode receber comissão conforme regras da plataforma, rastreio correto e comportamento do comprador.' },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

function buildGlossaryJsonLd() {
  const siteUrl = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: title,
    description,
    url: `${siteUrl}${slug}`,
    hasDefinedTerm: terms.map((item) => ({
      '@type': 'DefinedTerm',
      name: item.term,
      description: item.definition,
      inDefinedTermSet: `${siteUrl}${slug}`,
    })),
  }
}

export default function Page() {
  const schemas = [
    ...buildArticleJsonLd({ title, description, slug, siteUrl: getSiteUrl(), type: 'Article' }),
    buildGlossaryJsonLd(),
  ]

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Glossário · AI SEO</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Resposta direta</h2>
            <p className="mt-3 leading-8 text-gray-700">Este glossário define os termos mínimos para entender uma operação de afiliados no WhatsApp com revisão humana: link monetizado, grupos de origem e destino, espelhamento, cadência, UTM, anti-spam operacional e afiliado.</p>
          </section>

          <dl className="mt-8 grid gap-4 md:grid-cols-2">
            {terms.map((item) => (
              <div key={item.term} id={item.term.toLowerCase().replaceAll(' ', '-')} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <dt className="text-xl font-black text-gray-950">{item.term}</dt>
                <dd className="mt-3 leading-7 text-gray-700">{item.definition}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8 rounded-2xl border border-emerald-100 bg-white p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Como usar essas definições</h2>
            <p className="mt-3 leading-8 text-gray-700">Use o glossário junto com a <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">metodologia de uso responsável</Link> e os <Link href="/materiais/checklist-divulgacao-ofertas-grupos-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">checklists públicos</Link> para padronizar comunicação entre marketing, operação e atendimento.</p>
          </section>
        </article>
      </main>
    </PublicShell>
  )
}
