import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicShell } from '@/components/PublicShell'
import { AFFILIATE_PLATFORMS } from '@/lib/painel/affiliatePlatforms'
import { STORE_GUIDES, STORE_GUIDE_SLUGS } from '@/lib/store-guides'
import { getSiteUrl } from '@/lib/site-url'

export const dynamicParams = false
export function generateStaticParams() { return STORE_GUIDE_SLUGS.map((slug) => ({ slug })) }

export async function generateMetadata({ params }) {
  const { slug } = await params
  const guide = STORE_GUIDES[slug]
  if (!guide) return {}
  // title/description ficam em lib/store-guides.js (fonte única lida também
  // por scripts/lint-seo-metadata-duplicates.mjs).
  const { title, description } = guide
  return { title, description, alternates: { canonical: `/guia/${slug}` }, openGraph: { title, description, url: `/guia/${slug}` } }
}

export default async function StoreGuidePage({ params }) {
  const { slug } = await params
  const guide = STORE_GUIDES[slug]
  if (!guide) notFound()
  const platform = AFFILIATE_PLATFORMS.find((item) => item.id === guide.platformId)
  const pageUrl = `${getSiteUrl()}/guia/${slug}`
  const faq = [
    { q: `Preciso pagar para entrar no programa ${guide.name}?`, a: 'O cadastro no programa de afiliados é feito diretamente na loja. Confira os termos atuais na página oficial antes de concluir.' },
    { q: 'Onde colo o identificador no Espelha Grupos?', a: 'Entre no painel, abra Minhas credenciais, escolha a loja e preencha somente os campos indicados. Depois, salve e use Testar conversão.' },
    { q: 'Posso enviar minha chave ao suporte?', a: 'Não envie segredo, cookie ou código de acesso por WhatsApp ou e-mail. Cole esses valores somente no campo protegido dentro da sua conta.' },
  ]
  const schemas = [{
    '@context': 'https://schema.org', '@type': 'HowTo', name: `Como cadastrar ${guide.name} no Espelha Grupos`, url: pageUrl,
    dateModified: '2026-09-28', step: guide.signup.map((text, index) => ({ '@type': 'HowToStep', position: index + 1, name: `Passo ${index + 1}`, text })),
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  }]

  return (
    <PublicShell>
      {schemas.map((schema) => <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />)}
      <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Guia por loja · revisado em 28/09/2026</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{guide.name} Afiliados: do cadastro ao primeiro link convertido</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">Três etapas: entrar no programa oficial, localizar a identificação correta e cadastrar no painel sem compartilhar seus segredos.</p>

          <section className="mt-10">
            <h2 className="text-2xl font-black text-gray-950">1. Cadastre-se no programa</h2>
            <ol className="mt-4 grid gap-3">
              {guide.signup.map((step, index) => <li key={step} className="rounded-2xl bg-emerald-50 p-5 text-gray-700"><strong className="text-emerald-800">{index + 1}.</strong> {step}</li>)}
            </ol>
            <a href={guide.joinUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-5 font-black text-white no-underline">Abrir página oficial de {guide.name}</a>
          </section>

          <section className="mt-10 rounded-2xl border border-emerald-100 p-6">
            <h2 className="text-2xl font-black text-gray-950">2. Encontre o ID ou código certo</h2>
            <p className="mt-3 leading-7 text-gray-700">{guide.identifier}</p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">{platform?.fields.map((field) => <li key={field.key}><strong>{field.label}:</strong> {field.hint}</li>)}</ul>
          </section>

          <section className="mt-10 rounded-2xl bg-violet-50 p-6">
            <h2 className="text-2xl font-black text-gray-950">3. Cole no painel e teste</h2>
            <p className="mt-3 leading-7 text-gray-700">Abra <strong>Minhas credenciais</strong>, escolha {guide.name}, cole os valores e salve. Em seguida, abra <strong>Testar conversão</strong> e use um link de produto seu.</p>
            <Link href="/painel/ids-afiliada" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 font-black text-white no-underline">Cadastrar {guide.name} no painel</Link>
          </section>

          <section className="mt-10"><h2 className="text-2xl font-black text-gray-950">Perguntas rápidas</h2><div className="mt-4 grid gap-3">{faq.map((item) => <details key={item.q} className="rounded-2xl border border-emerald-100 p-5"><summary className="cursor-pointer font-black text-gray-950">{item.q}</summary><p className="mt-3 text-gray-700">{item.a}</p></details>)}</div></section>
        </article>
      </main>
    </PublicShell>
  )
}

