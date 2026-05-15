import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { BRAND_NAME, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS } from '@/lib/marketing-content'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'
import { getSiteUrl } from '@/lib/site-url'

export const COMPARISON_SOURCE_LINKS = [
  { label: 'Política de Mensagens do WhatsApp Business', href: 'https://whatsappbusiness.com/pt-br/policy/' },
  { label: 'Termos do Programa de Afiliados e Criadores do Mercado Livre', href: 'https://www.mercadolivre.com.br/ajuda/30228' },
  { label: 'Amazon Associates Program Operating Agreement', href: 'https://affiliate-program.amazon.com/help/operating/agreement/' },
]

export const COMPARISON_PAGES = {
  '/alternativas/bot-para-whatsapp-afiliados': {
    eyebrow: 'Alternativas · Afiliados',
    title: 'Alternativas de bot para WhatsApp para afiliados',
    description: 'Compare caminhos para divulgar ofertas em grupos de WhatsApp: operação manual, planilha, automação genérica, ferramenta oficial de mensagens e BOTinho.',
    directAnswer: 'A melhor alternativa de bot para WhatsApp para afiliados depende do estágio da operação. Para poucos grupos, planilha e revisão manual podem bastar. Para rotina com origem, destino, link monetizado, filtros, cadência e logs, o BOTinho foi desenhado para organizar esse fluxo sem prometer ganho financeiro ou burlar regras das plataformas.',
    rows: [
      ['Planilha + envio manual', 'Baixo custo e controle humano total.', 'Não escala bem, depende de lembrar horários e dificulta auditoria por campanha.'],
      ['Automação genérica', 'Flexível para equipes técnicas.', 'Pode exigir integrações frágeis, manutenção e atenção extra a regras do WhatsApp.'],
      ['Ferramentas de atendimento/API oficial', 'Boas para atendimento, templates e conversas com clientes.', 'Nem sempre resolvem curadoria de oferta, grupos de origem/destino e link de afiliado.'],
      ['BOTinho', 'Foco em afiliados, curadores de ofertas e admins de grupos com filtros, cadência, conversão de links suportados e logs.', 'Não substitui revisão humana nem autorização dos grupos e plataformas.'],
    ],
    criteria: ['Revisão de link monetizado', 'Controle de grupos de origem e destino', 'Cadência anti-ruído', 'Histórico de envios', 'Limites claros contra spam'],
    faq: [
      { q: 'BOTinho é a melhor opção para qualquer afiliado?', a: 'Não. Se você divulga poucas ofertas por semana, um processo manual bem revisado pode ser suficiente. O BOTinho faz mais sentido quando há grupos, frequência e necessidade de logs.' },
      { q: 'Automação genérica substitui uma ferramenta especializada?', a: 'Pode substituir em operações técnicas, mas normalmente exige manutenção e definição manual de regras para link monetizado, grupos e cadência.' },
      { q: 'Essas alternativas garantem comissão?', a: 'Não. Comissão depende de oferta, público, regras da plataforma, rastreio correto e comportamento dos compradores.' },
    ],
  },
  '/botinho-vs-planilha-manual': {
    eyebrow: 'Comparativo · Operação manual',
    title: 'BOTinho vs planilha manual para divulgar ofertas no WhatsApp',
    description: 'Compare BOTinho e planilha manual para organizar grupos, links de afiliado, cadência e logs de divulgação em WhatsApp.',
    directAnswer: 'Planilha manual é indicada para validar processo com baixo volume e revisão próxima. O BOTinho é indicado quando a operação precisa repetir a rotina com mais consistência: separar origem e destino, revisar links suportados, aplicar filtros, controlar cadência e consultar histórico de logs.',
    rows: [
      ['Organização de grupos', 'Planilha exige atualização manual de nomes, regras e prioridades.', 'BOTinho centraliza origem/destino na rotina operacional.'],
      ['Conferência de link', 'Depende de checklist e disciplina da pessoa operadora.', 'Ajuda a converter links suportados, mas ainda exige revisão humana do destino final.'],
      ['Cadência', 'Horários e intervalos ficam sujeitos a esquecimento.', 'Intervalos configuráveis ajudam a reduzir repetição excessiva.'],
      ['Auditoria', 'Histórico depende de anotações manuais.', 'Logs ajudam a conferir execução e falhas de envio.'],
    ],
    criteria: ['Volume semanal de ofertas', 'Número de grupos', 'Risco de erro humano', 'Necessidade de logs', 'Tempo disponível para revisão'],
    faq: [
      { q: 'Quando continuar na planilha?', a: 'Continue na planilha se a operação ainda é pequena, tem poucos grupos e a revisão manual não atrasa a publicação.' },
      { q: 'Quando migrar para o BOTinho?', a: 'Considere migrar quando houver repetição diária, vários destinos, risco de link errado e necessidade de histórico.' },
      { q: 'A planilha deixa de ser útil?', a: 'Não. Ela pode continuar como planejamento editorial, enquanto o BOTinho organiza a execução recorrente.' },
    ],
  },
  '/botinho-vs-ferramentas-genericas-automacao': {
    eyebrow: 'Comparativo · Automação genérica',
    title: 'BOTinho vs ferramentas genéricas de automação',
    description: 'Entenda quando usar BOTinho ou ferramentas genéricas como automações de fluxo, conectores e scripts para rotinas de WhatsApp com afiliados.',
    directAnswer: 'Ferramentas genéricas são úteis quando a equipe técnica precisa conectar muitos sistemas diferentes. O BOTinho é mais indicado quando o problema central é operação de ofertas em grupos: link monetizado, origem, destino, filtros, cadência, revisão humana e logs sem construir uma automação do zero.',
    rows: [
      ['Setup', 'Automação genérica costuma exigir desenho técnico e testes de integração.', 'BOTinho entrega fluxo mais específico para grupos e ofertas.'],
      ['Manutenção', 'Scripts e conectores podem quebrar quando páginas, APIs ou regras mudam.', 'BOTinho concentra regras do produto e ajustes operacionais em uma experiência única.'],
      ['Governança', 'Depende de documentação própria da equipe.', 'Metodologia pública reforça limites, revisão e cadência responsável.'],
      ['Flexibilidade', 'Alta para times técnicos.', 'Focada no caso de uso de afiliados e admins de grupos.'],
    ],
    criteria: ['Capacidade técnica interna', 'Número de integrações externas', 'Foco em grupos de ofertas', 'Necessidade de governança', 'Custo de manutenção'],
    faq: [
      { q: 'Ferramentas genéricas são ruins?', a: 'Não. Elas são fortes para fluxos amplos. A comparação é sobre foco: BOTinho prioriza rotina de ofertas em grupos.' },
      { q: 'Posso usar as duas abordagens?', a: 'Sim. Uma equipe pode manter BI, CRM ou planilhas fora do BOTinho e usar o produto para execução de grupos.' },
      { q: 'Qual tem menor risco?', a: 'O risco depende do uso. Qualquer abordagem precisa respeitar regras do WhatsApp, consentimento, cadência e políticas de afiliados.' },
    ],
  },
  '/melhores-bots-para-afiliados-whatsapp': {
    eyebrow: 'Critérios · Avaliação de ferramentas',
    title: 'Melhores bots para afiliados no WhatsApp: critérios transparentes',
    description: 'Lista de critérios para avaliar bots e ferramentas de WhatsApp para afiliados sem ranking falso, promessa de ganho ou prova social inventada.',
    directAnswer: 'Os melhores bots para afiliados no WhatsApp devem ser avaliados por critérios de processo, não por promessa de comissão. Priorize revisão de link monetizado, controle de grupos, filtros, cadência, logs, limites contra spam, clareza de preço e suporte a plataformas realmente usadas pela operação.',
    rows: [
      ['Link monetizado', 'A ferramenta ajuda a conferir ou converter links suportados sem remover tags?', 'Reduz risco operacional, mas não elimina revisão humana.'],
      ['Grupos e destinos', 'Existe separação clara entre origem, destino, nicho e prioridade?', 'Evita publicar no público errado.'],
      ['Cadência', 'Há intervalos, filtros e controle para evitar repetição?', 'Ajuda a proteger experiência dos grupos.'],
      ['Logs', 'A operação consegue auditar envio, falha e campanha?', 'Permite aprender e corrigir processo.'],
    ],
    criteria: ['Transparência de preço', 'Limites de uso responsável', 'Logs e auditoria', 'Suporte a afiliados', 'Ausência de promessa de ganho garantido'],
    faq: [
      { q: 'Por que esta página não ranqueia marcas como primeiro, segundo e terceiro lugar?', a: 'Sem testes públicos equivalentes e consentimento de dados, ranking numérico seria pouco confiável. A página usa critérios para avaliação responsável.' },
      { q: 'BOTinho entra nesses critérios?', a: 'Sim. O BOTinho foi desenhado para grupos, links suportados, cadência e logs, mas ainda exige revisão humana e autorização dos grupos.' },
      { q: 'O que evitar ao escolher um bot?', a: 'Evite promessa de comissão garantida, disparo sem consentimento, ausência de logs e ferramenta que não explica limites de uso.' },
    ],
  },
}

export function getComparisonMetadata(slug) {
  const page = COMPARISON_PAGES[slug]
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: slug },
    openGraph: { title: page.title, description: page.description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
  }
}

export function ComparisonPage({ slug }) {
  const page = COMPARISON_PAGES[slug]
  const siteUrl = getSiteUrl()
  const dates = getEditorialDates(slug)
  const schemas = buildArticleJsonLd({ title: page.title, description: page.description, slug, siteUrl, faq: page.faq, type: 'Article' })

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{page.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{page.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{page.description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Resposta direta</h2>
            <p className="mt-3 leading-8 text-gray-700">{page.directAnswer}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Comparativo equilibrado</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-gray-950">
                  <tr>
                    <th className="p-4 font-black">Critério</th>
                    <th className="p-4 font-black">Alternativa</th>
                    <th className="p-4 font-black">Leitura responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {page.rows.map(([criterion, alternative, reading]) => (
                    <tr key={criterion}>
                      <td className="p-4 font-bold text-gray-950">{criterion}</td>
                      <td className="p-4 leading-7 text-gray-700">{alternative}</td>
                      <td className="p-4 leading-7 text-gray-700">{reading}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-xl font-black text-gray-950">Critérios de decisão</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                {page.criteria.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-xl font-black text-gray-950">Limites importantes</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
                {PRODUCT_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Fontes e políticas para revisar antes de operar</h2>
            <p className="mt-3 leading-8 text-gray-700">Use as políticas oficiais como referência operacional. Elas podem mudar e devem ser revisadas pela pessoa responsável antes de ampliar volume.</p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
              {COMPARISON_SOURCE_LINKS.map((source) => (
                <li key={source.href}><a href={source.href} className="font-bold text-emerald-700 underline underline-offset-4" rel="noreferrer">{source.label}</a></li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">FAQ</h2>
            <div className="mt-4 space-y-3">
              {page.faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                  <p className="mt-3 leading-7 text-gray-700">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-emerald-100 bg-white p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Onde o {BRAND_NAME} se encaixa?</h2>
            <p className="mt-3 leading-8 text-gray-700">{PRODUCT_DEFINITION}</p>
            <Link href="/login?mode=register&utm_source=comparativo&utm_medium=organic&utm_campaign=ai-seo-p2" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700">Entrar na lista VIP</Link>
          </section>
        </article>
      </main>
    </PublicShell>
  )
}
