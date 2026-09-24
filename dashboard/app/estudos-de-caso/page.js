import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_YOUTUBE_TUTORIAL_URL, SUPPORT_EMAIL } from '@/lib/marketing-content'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

const slug = '/estudos-de-caso'
const title = 'Estudos de caso do Espelha Grupos'
const description = 'Política pública para publicar estudos de caso do Espelha Grupos somente com consentimento, contexto, metodologia e dados verificáveis.'
const dates = getEditorialDates(slug)

const requirements = [
  'Consentimento explícito da pessoa ou operação citada.',
  'Contexto do nicho, volume aproximado e período analisado.',
  'Métrica operacional verificável, sem promessa de comissão garantida.',
  'Descrição do processo antes/depois e limitações do resultado.',
  'Aprovação final da pessoa citada antes de o texto ir ao ar.',
]

const faq = [
  { q: 'Por que não há cases com números inventados?', a: 'Porque estudos de caso precisam de consentimento e dados verificáveis. Publicar números sem lastro prejudica confiança e pode induzir compradores a erro.' },
  { q: 'Que tipo de resultado pode virar estudo de caso?', a: 'Resultados operacionais como redução de retrabalho, melhoria de conferência, cobertura de grupos e clareza de logs são mais adequados do que promessa de comissão.' },
  { q: 'Como enviar um caso para análise?', a: `Mande para ${SUPPORT_EMAIL} o contexto, o período, a métrica, a evidência (print do histórico de envios ou do relatório da loja) e a autorização de uso. Nada é publicado sem a sua aprovação do texto final.` },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl: getSiteUrl(), faq, type: 'Article' })

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Prova responsável</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Status dos estudos públicos</h2>
            <p className="mt-3 leading-8 text-gray-700">O Espelha Grupos ainda não publica estudos de caso com métricas de clientes nesta página porque a política do site exige consentimento, período, metodologia e dados verificáveis. Essa decisão evita prova social falsa e protege compradores.</p>
          </section>
          <section className="mt-8">
            <h2 className="text-2xl font-black text-gray-950">O que dá para conferir hoje</h2>
            <p className="mt-3 text-gray-700">Enquanto não há case publicado, a prova é o próprio produto: o <a href={BRAND_YOUTUBE_TUTORIAL_URL} className="font-bold text-emerald-700 underline underline-offset-4">passo a passo real de criar a conta</a>, sem corte, está no canal oficial, e o teste de 7 dias libera o plano Pro completo para você ver as ofertas saindo com o seu link antes de pagar.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Requisitos para publicar um case</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-8 text-gray-700">
              {requirements.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-xl font-black text-gray-950">Modelo de evidência</h2>
              <p className="mt-3 leading-7 text-gray-700">Nicho, tamanho da operação, período, rotina anterior, rotina com Espelha Grupos, métrica operacional, evidência, responsável pela aprovação e limitações.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-xl font-black text-gray-950">Claims proibidos</h2>
              <p className="mt-3 leading-7 text-gray-700">Nada de ganho garantido, comissão prometida, bloqueio impossível, ranking inventado ou depoimento sem autorização.</p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">FAQ</h2>
            <div className="mt-4 space-y-3">
              {faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                  <p className="mt-3 leading-7 text-gray-700">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="mt-8 leading-8 text-gray-700">Para entender os limites operacionais antes de analisar qualquer case, consulte a <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">metodologia de uso responsável</Link>.</p>
        </article>
      </main>
    </PublicShell>
  )
}
