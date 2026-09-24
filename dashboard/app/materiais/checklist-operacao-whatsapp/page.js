import { PublicPage } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'
import { LeadMagnetCard } from '@/components/marketing/LeadMagnetCard'
import { CHECKLIST_OPERACAO_BLOCKS } from '@/lib/checklist-operacao'

const slug = '/materiais/checklist-operacao-whatsapp'
const title = 'Checklist de operação para WhatsApp'
const description = 'Checklist para padronizar divulgação de ofertas e cupons em grupos de WhatsApp antes de escalar com automação.'
const dates = getEditorialDates(slug)

const faq = [
  { q: 'Quando usar o checklist de operação?', a: 'Use antes de ativar automação ou ampliar grupos para validar oferta, link, texto, destinos e acompanhamento.' },
  { q: 'O checklist elimina risco de spam?', a: 'Não. Ele ajuda a revisar cadência e autorização dos grupos, mas a operação deve respeitar regras do WhatsApp e de cada comunidade.' },
  { q: 'Como medir se a rotina está pronta?', a: 'Confira se o primeiro envio correto ocorreu com link validado, grupo certo, horário combinado e registro para análise posterior.' },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

// Fonte única com o .md e o PDF (lib/checklist-operacao.js).
const checklistBlocks = CHECKLIST_OPERACAO_BLOCKS

export default function Page() {
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl: getSiteUrl(), faq })

  return (
    <>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <PublicPage
        eyebrow="Material · Checklist"
        title="Checklist de operação para divulgar ofertas no WhatsApp"
        description="Use antes de ligar uma rotina de espelhamento: padronize oferta, link, copy, destinos e métricas para reduzir erro manual."
      >
        <p className="mb-6 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>
        <section className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm leading-7 text-emerald-950">
          <h2 className="text-lg font-black text-emerald-950">Resposta direta</h2>
          <p className="mt-2">Um checklist de operação para WhatsApp organiza a revisão de oferta, link, texto, grupos e acompanhamento antes da automação. Ele reduz esquecimento, mas não substitui consentimento, revisão humana e cadência responsável. No Espelha Grupos, os itens de link são automáticos nas 6 lojas suportadas: o código de afiliada entra antes de a oferta sair.</p>
        </section>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {checklistBlocks.map(([title, items]) => (
            <section key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-xl font-black text-gray-950">{title}</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-gray-700">
                {items.map((item) => (
                  <li key={item} className="flex gap-3"><span aria-hidden="true" className="mt-0.5 text-emerald-600">□</span><span>{item}</span></li>
                ))}
              </ul>
            </section>
          ))}
          <a href="/materiais/checklist-operacao-whatsapp.pdf" className="inline-flex min-h-12 items-center rounded-xl bg-gray-950 px-5 font-black text-white hover:bg-gray-800">
            Baixar PDF
          </a>
        </div>
        <div className="space-y-4">
          <LeadMagnetCard origin="lead_magnet_checklist_operacao_whatsapp" compact />
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="text-lg font-black text-gray-950">FAQ</h2>
            <div className="mt-4 space-y-3">
              {faq.map((item) => (
                <details key={item.q} className="rounded-xl bg-white p-4">
                  <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PublicPage>
    </>
  )
}
