import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'

const slug = '/parcerias'
const siteUrl = getSiteUrl()
const title = 'Parcerias BOTinho | Co-marketing para admins e afiliados'
const description = 'Programa de parcerias do BOTinho para admins, creators e comunidades que operam ofertas no WhatsApp com piloto guiado, UTMs e operação responsável.'

const partnerTypes = [
  {
    name: 'Admins e curadores de ofertas',
    detail: 'Para quem já opera grupos/canais no WhatsApp e quer testar um piloto guiado com escopo controlado.',
  },
  {
    name: 'Creators e comunidades de afiliados',
    detail: 'Para quem ensina operação de ofertas e quer campanha conjunta com checklist, conteúdo e cupom rastreável.',
  },
  {
    name: 'Plataformas adjacentes',
    detail: 'Para ecossistemas que atendem afiliados/lojistas e buscam conteúdo prático sobre operação de ofertas em canais conversacionais.',
  },
]

const partnershipFormats = [
  'Webinar ou live co-hosted',
  'Lead magnet/checklist conjunto',
  'Cupom exclusivo com UTM dedicada',
  'Case prático por nicho com aprovação prévia',
]

const guardrails = [
  'Sem promessa de renda garantida.',
  'Sem promessa de risco zero de bloqueio.',
  'Compartilhamento de leads apenas com consentimento explícito.',
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
        '@type': 'WebPage',
        name: title,
        description,
        url: `${siteUrl}${slug}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Precisa integração técnica para começar?',
            acceptedAnswer: { '@type': 'Answer', 'text': 'Não. O início recomendado é campanha educativa e piloto guiado com escopo controlado.' },
          },
          {
            '@type': 'Question',
            name: 'Como funciona lead sharing?',
            acceptedAnswer: { '@type': 'Answer', 'text': 'Leads só podem ser compartilhados com consentimento explícito no formulário da campanha.' },
          },
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
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Programa de parcerias BOTinho</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">Faça co-marketing com o BOTinho e leve mais consistência operacional para sua audiência</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50">Para admins, creators e comunidades que já trabalham com ofertas no WhatsApp e querem campanhas conjuntas com rastreio, checklist e piloto guiado.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex min-h-12 items-center rounded-xl bg-white px-5 font-black text-emerald-900 hover:bg-emerald-100">Quero ser parceiro(a)</Link>
            <a href="#tipos" className="inline-flex min-h-12 items-center rounded-xl border border-emerald-200 px-5 font-black text-white hover:bg-emerald-800">Ver tipos de parceria</a>
          </div>
        </section>

        <section id="tipos" className="mt-8 grid gap-5 md:grid-cols-3">
          {partnerTypes.map((item) => (
            <article key={item.name} className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black tracking-tight text-gray-950">{item.name}</h2>
              <p className="mt-3 text-sm leading-7 text-gray-700">{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Formatos de parceria</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
              {partnershipFormats.map((item) => (
                <li key={item} className="flex gap-3"><span aria-hidden="true" className="text-emerald-600">✓</span><span>{item}</span></li>
              ))}
            </ul>
          </article>

          <article className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-tight text-emerald-950">Guardrails da parceria</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-emerald-900">
              {guardrails.map((item) => (
                <li key={item} className="flex gap-3"><span aria-hidden="true">•</span><span>{item}</span></li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    </PublicShell>
  )
}
