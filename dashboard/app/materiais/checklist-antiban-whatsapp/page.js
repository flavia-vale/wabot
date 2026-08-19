import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

const slug = '/materiais/checklist-antiban-whatsapp'
const title = 'Checklist: reduzir o risco de ban no WhatsApp'
const description = 'Checklist prático de quem divulga ofertas: chip separado, ritmo entre envios, variação de texto, limite por grupo e o que fazer se o número cair. Nenhuma ferramenta garante imunidade.'
const dates = getEditorialDates(slug)

const checklistBlocks = [
  ['1. Chip e acesso', ['Chip dedicado separado do número pessoal', 'Responsável pelo chip registrado', 'Aparelho/conexão documentados', 'Credenciais e recuperação protegidas']],
  ['2. Fontes e destinos', ['Grupos, canais e fontes mapeados', 'Papel de cada destino definido: fonte, comunidade, vitrine ou backup', 'Destinos sensíveis fora de rajadas', 'Migração gradual planejada antes de aumentar volume']],
  ['3. Cadência', ['Intervalo mínimo por destino definido', 'Limite diário e por hora registrado', 'Horário de silêncio configurado', 'Distribuição escalonada entre canais']],
  ['4. Variações', ['Chamadas e emojis alternados', 'Ordem de preço, link e benefício variada', 'Mensagens idênticas reduzidas', 'Imagens e contexto revisados quando aplicável']],
  ['5. Monitoramento', ['Cliques acompanhados por canal', 'Erros e queda de entrega revisados', 'Conta-sentinela usada quando fizer sentido', 'Pausa preventiva definida para sinais de risco']],
  ['6. Recuperação', ['Backup de configuração dos canais', 'Lista de fontes e destinos exportável', 'Processo de recriação documentado', 'Plano de comunicação se grupo/canal cair']],
]

const faq = [
  { q: 'Este checklist é “anti-ban” 100%?', a: 'Não. O checklist usa a linguagem que o mercado pesquisa, mas a entrega correta é preservação avançada: camadas para reduzir exposição, não garantia absoluta.' },
  { q: 'Preciso aplicar tudo antes de usar o BOTinho?', a: 'Não precisa travar a operação, mas chip dedicado, cadência e monitoramento deveriam vir antes de escalar volume.' },
  { q: 'O checklist substitui a calculadora de risco?', a: 'Não. A calculadora estima a exposição; o checklist transforma o resultado em rotina operacional.' },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl: getSiteUrl(), faq, type: 'Article' })
  const trackerRoute = {
    slug: 'checklist-antiban-whatsapp',
    path: slug,
    cluster: 'canais-preservacao',
    intent: 'checklist antiban whatsapp',
    template: 'lead-magnet',
  }

  return (
    <>
      <OrganicPageTracker route={trackerRoute} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      ))}
      <PublicPage
        eyebrow="Lead magnet · Preservação Avançada"
        title="Checklist de Preservação Avançada para WhatsApp"
        description="Use este roteiro antes de aumentar volume em grupos e Canais do WhatsApp. O objetivo é reduzir exposição operacional — não prometer banimento zero."
      >
        <p className="mb-6 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>
        <section className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm leading-7 text-emerald-950">
          <h2 className="text-lg font-black text-emerald-950">Resposta direta</h2>
          <p className="mt-2">Preservação avançada é um conjunto de camadas: chip dedicado, cadência, variações, monitoramento e recuperação. O termo “anti-ban” aparece como busca do mercado, mas nenhuma ferramenta séria deve prometer proteção absoluta.</p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
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

            <section className="rounded-2xl border border-emerald-100 bg-white p-5">
              <h2 className="text-xl font-black text-gray-950">Como usar depois da calculadora</h2>
              <p className="mt-3 text-sm leading-7 text-gray-700">Se a calculadora indicar risco moderado, alto ou crítico, comece pelos itens com maior impacto: chip dedicado, intervalos, redução de mensagens idênticas e plano de recuperação.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/ferramentas/calculadora-risco-whatsapp?utm_source=materiais&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=checklist_calculadora"
                  className="inline-flex min-h-12 items-center rounded-xl border border-emerald-200 px-5 font-black text-emerald-800 hover:bg-emerald-50"
                  data-seo-cta="checklist_risk_calculator"
                  data-cta-position="body_secondary"
                  data-cta-stage="tool"
                  data-cta-destination="calculator"
                >
                  Calcular meu risco
                </Link>
                <Link
                  href="/diagnostico-antiban-whatsapp?utm_source=materiais&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=checklist_diagnostico"
                  className="inline-flex min-h-12 items-center rounded-xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700"
                  data-seo-cta="checklist_diagnostic"
                  data-cta-position="body_primary"
                  data-cta-stage="diagnostic"
                  data-cta-destination="diagnostic"
                >
                  Fazer diagnóstico guiado
                </Link>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Captura leve</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-gray-950">Receber o checklist no cadastro</h2>
              <p className="mt-3 text-sm leading-6 text-gray-700">Informe e-mail e perfil para levar este checklist como contexto da sua conta BOTinho.</p>
              <form action="/login" method="get" className="mt-5 grid gap-3" data-crm-stage="Lead" data-crm-source="checklist_antiban_whatsapp">
                <input type="hidden" name="mode" value="register" />
                <input type="hidden" name="source" value="checklist_antiban_whatsapp" />
                <input type="hidden" name="utm_source" value="materiais" />
                <input type="hidden" name="utm_medium" value="organic" />
                <input type="hidden" name="utm_campaign" value="canais-preservacao" />
                <input type="hidden" name="utm_content" value="checklist_preservacao" />
                <label className="text-sm font-bold text-gray-800" htmlFor="preservation-checklist-email">E-mail</label>
                <input id="preservation-checklist-email" name="email" type="email" required placeholder="voce@empresa.com" className="min-h-12 rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2" />
                <label className="text-sm font-bold text-gray-800" htmlFor="preservation-checklist-profile">Perfil da operação</label>
                <select id="preservation-checklist-profile" name="segmento" defaultValue="" className="min-h-12 rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2">
                  <option value="" disabled>Selecione uma opção</option>
                  <option value="afiliado-achadinhos">Afiliado de achadinhos</option>
                  <option value="admin-canais">Admin de canais/grupos</option>
                  <option value="ecommerce-ofertas">E-commerce/ofertas</option>
                  <option value="agencia-growth">Agência/growth</option>
                </select>
                <button className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700" type="submit">
                  Receber checklist e criar conta
                </button>
              </form>
              <p className="mt-4 text-xs leading-5 text-gray-500">Você pode cancelar quando quiser. O checklist reduz exposição operacional, mas nenhuma ferramenta garante que uma conta não seja banida.</p>
            </section>

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
          </aside>
        </div>
      </PublicPage>
    </>
  )
}
