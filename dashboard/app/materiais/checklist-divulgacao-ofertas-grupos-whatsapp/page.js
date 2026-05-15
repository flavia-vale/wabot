import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'
import { LeadMagnetCard } from '@/components/marketing/LeadMagnetCard'
import { getSiteUrl } from '@/lib/site-url'

const title = 'Checklist para divulgar ofertas em grupos de WhatsApp'
const description = 'Checklist público para afiliados e admins validarem oferta, link monetizado, copy, grupos e UTM antes de escalar divulgação de cupons no WhatsApp.'
const slug = '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp'
const publishedAt = '2026-05-14'

const checklistBlocks = [
  ['1. Oferta', ['Preço, estoque e prazo conferidos', 'Cupom ou benefício testado', 'Categoria e público definidos', 'Aviso de variação de preço incluído quando necessário']],
  ['2. Link de afiliado', ['URL final abre no celular', 'Tag, código ou parâmetro de afiliado presente', 'Redirecionador não remove o rastreio', 'Link errado descartado para evitar perda de comissão']],
  ['3. Copy', ['H1 ou primeira linha com benefício claro', 'Preço ou condição em destaque', 'CTA direto e sem promessa exagerada', 'Claim comercial revisado antes de publicar']],
  ['4. Grupos', ['Origem e destino separados', 'Permissão e regras do grupo respeitadas', 'Nicho/cidade/categoria registrados', 'Intervalo definido para evitar repetição excessiva']],
  ['5. Medição', ['UTM ou tag interna preenchida', 'Responsável pelo monitoramento definido', 'Falhas de envio anotadas', 'Aprendizados salvos para próxima rodada']],
]

const faq = [
  {
    q: 'Esse checklist serve para afiliados?',
    a: 'Sim. Ele prioriza conferência de link monetizado, tag ou código de afiliado antes da distribuição para reduzir risco de perda de comissão.',
  },
  {
    q: 'Posso usar o BOTinho para divulgar qualquer oferta?',
    a: 'Use apenas ofertas permitidas pelas regras dos grupos, do WhatsApp e das plataformas envolvidas. O BOTinho organiza a operação, não valida autorização comercial externa.',
  },
  {
    q: 'Quando automatizar a distribuição?',
    a: 'Automatize depois que oferta, link, copy e grupos estiverem validados. Automação deve escalar um processo correto, não compensar revisão ausente.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: { '@type': 'Organization', name: 'BOTinho' },
    publisher: { '@type': 'Organization', name: 'BOTinho' },
    datePublished: publishedAt,
    dateModified: publishedAt,
    mainEntityOfPage: `${getSiteUrl()}${slug}`,
  }
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PublicPage eyebrow="Material · Checklist SEO/AEO" title={title} description={description}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8 text-base leading-8 text-gray-700">
            <section>
              <h2 className="text-2xl font-black tracking-tight text-gray-950">Resposta direta</h2>
              <p className="mt-3">
                Antes de divulgar ofertas em grupos de WhatsApp, valide a oferta, confira se o link monetizado carrega a tag ou código de afiliado, revise a copy e escolha grupos com permissão e contexto. Só depois automatize o espelhamento com o BOTinho.
              </p>
            </section>

            {checklistBlocks.map(([blockTitle, items]) => (
              <section key={blockTitle} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <h2 className="text-xl font-black text-gray-950">{blockTitle}</h2>
                <ul className="mt-4 grid gap-3 text-sm leading-6 text-gray-700">
                  {items.map((item) => (
                    <li key={item} className="flex gap-3"><span aria-hidden="true" className="mt-0.5 text-emerald-600">□</span><span>{item}</span></li>
                  ))}
                </ul>
              </section>
            ))}

            <section>
              <h2 className="text-2xl font-black tracking-tight text-gray-950">Links internos úteis</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li><Link href="/blog/conferir-converter-link-afiliado-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">Como conferir e converter link de afiliado</Link></li>
                <li><Link href="/blog/bot-para-afiliados-whatsapp-grupos-cupons" className="font-bold text-emerald-700 underline underline-offset-4">Bot para afiliados em grupos de cupons</Link></li>
                <li><Link href="/automatizar-divulgacao-em-grupos-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">Automatizar divulgação em grupos de WhatsApp</Link></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black tracking-tight text-gray-950">FAQ</h2>
              <div className="mt-4 space-y-3">
                {faq.map((item) => (
                  <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                    <p className="mt-3 text-gray-700">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-black tracking-tight text-gray-950">CTA</h2>
              <p className="mt-3">
                Use este checklist como pré-publicação e entre na lista VIP para organizar a rotina de espelhamento em grupos autorizados.
              </p>
              <p className="mt-4">
                <Link href="/login?mode=register&utm_source=materiais&utm_medium=organic&utm_campaign=organic-marketing-sprint-1&utm_content=cta-checklist-grupos" className="inline-flex min-h-12 items-center rounded-xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700">
                  Entrar na lista VIP
                </Link>
              </p>
            </section>
          </div>
          <LeadMagnetCard origin="material_checklist_divulgacao_ofertas_grupos_whatsapp" compact />
        </div>
      </PublicPage>
    </>
  )
}
