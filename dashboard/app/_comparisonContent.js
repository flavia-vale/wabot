import './landing.css'
import Link from 'next/link'
import { Hero } from '@/components/landing/Hero'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { IntroCard } from '@/components/landing/IntroCard'
import { BRAND_NAME, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS } from '@/lib/marketing-content'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'
import { getSiteUrl } from '@/lib/site-url'
import { getCompetitorBySlug } from '@/lib/competitors-data'
import { ComparisonPageTracker } from '@/components/marketing/ComparisonPageTracker'

export const COMPARISON_SOURCE_LINKS = [
  { label: 'Política de Mensagens do WhatsApp Business', href: 'https://whatsappbusiness.com/pt-br/policy/' },
  { label: 'Termos do Programa de Afiliados e Criadores do Mercado Livre', href: 'https://www.mercadolivre.com.br/ajuda/30228' },
  { label: 'Amazon Associates Program Operating Agreement', href: 'https://affiliate-program.amazon.com/help/operating/agreement/' },
]

export const COMPARISON_PAGES = {
  '/alternativas/bot-para-whatsapp-afiliados': {
    format: 'alternative-plural',
    eyebrow: 'Alternativas · Afiliados',
    title: 'Alternativas de bot para WhatsApp para afiliados',
    description: 'Compare caminhos para divulgar ofertas em grupos de WhatsApp: operação manual, planilha, automação genérica, ferramenta oficial de mensagens e BOTinho.',
    competitorSlugs: ['divulgador-inteligente', 'divulga-ninja', 'gigi-prime-bot', 'busqy', 'divulga-links', 'manual-spreadsheet-workflow', 'generic-automation-tools', 'official-service-api-tools'],
    tldr: 'Se você está pesquisando alternativas de bot para WhatsApp, compare foco operacional, capacidade de governança e custo de manutenção contínua antes de decidir.',
    directAnswer: 'A melhor alternativa de bot para WhatsApp para afiliados depende do estágio da operação. Para poucos grupos, planilha e revisão manual podem bastar. Para rotina com origem, destino, link monetizado, filtros, cadência e logs, o BOTinho foi desenhado para organizar esse fluxo sem prometer ganho financeiro ou burlar regras das plataformas.',
    rows: [
      ['Planilha + envio manual', 'Baixo custo e controle humano total.', 'Não escala bem, depende de lembrar horários e dificulta auditoria por campanha.'],
      ['Automação genérica', 'Flexível para equipes técnicas.', 'Pode exigir integrações frágeis, manutenção e atenção extra a regras do WhatsApp.'],
      ['Ferramentas de atendimento/API oficial', 'Boas para atendimento, templates e conversas com clientes.', 'Nem sempre resolvem curadoria de oferta, grupos de origem/destino e link de afiliado.'],
      ['BOTinho', 'Foco em afiliados, curadores de ofertas e admins de grupos com filtros, cadência, conversão de links suportados e logs.', 'Não substitui revisão humana nem autorização dos grupos e plataformas.'],
    ],
    criteria: ['Revisão de link monetizado', 'Controle de grupos de origem e destino', 'Cadência anti-ruído', 'Histórico de envios', 'Limites claros contra spam'],
    botinhoDifferentials: ['Menor preço do mercado', 'Grupos ilimitados', 'Plataformas suportadas: 4', 'Conversão de links avançada', 'Funcionamento 24/7 sem limites', 'Broadcast em massa', 'Mensagem de boas-vindas', 'Canais & Comunidades', 'Histórico de logs', 'Suporte por WhatsApp', 'Sem cartão de crédito', 'Pronto em 5 minutos', 'Cancele quando quiser', 'Teste grátis'],
    bestFit: [
      'Escolha BOTinho quando o foco principal é rotina recorrente de ofertas em grupos com filtros, cadência e histórico operacional.',
      'Escolha automação genérica quando sua equipe já mantém integrações customizadas e precisa máxima flexibilidade técnica.',
      'Escolha processo manual quando o volume ainda é baixo e a revisão humana cobre toda a operação sem atraso.',
    ],
    notIdealFit: [
      'BOTinho não é ideal para quem busca automação irrestrita sem revisão humana e sem limites de uso responsável.',
      'Automação genérica não é ideal para times sem capacidade de manutenção técnica contínua.',
      'Processo manual não é ideal para operação com muitos grupos e publicação diária em escala.',
    ],
    migrationPath: [
      'Mapeie grupos de origem/destino e critérios mínimos de qualidade de link.',
      'Rode uma semana em paralelo (manual + fluxo novo) para validar cadência e qualidade.',
      'Mantenha checklist de revisão humana e compare resultado por campanha antes do corte final.',
    ],
    faq: [
      { q: 'BOTinho é a melhor opção para qualquer afiliado?', a: 'Não. Se você divulga poucas ofertas por semana, um processo manual bem revisado pode ser suficiente. O BOTinho faz mais sentido quando há grupos, frequência e necessidade de logs.' },
      { q: 'Automação genérica substitui uma ferramenta especializada?', a: 'Pode substituir em operações técnicas, mas normalmente exige manutenção e definição manual de regras para link monetizado, grupos e cadência.' },
      { q: 'Essas alternativas garantem comissão?', a: 'Não. Comissão depende de oferta, público, regras da plataforma, rastreio correto e comportamento dos compradores.' },
    ],
  },
  '/botinho-vs-planilha-manual': {
    format: 'vs',
    eyebrow: 'Comparativo · Operação manual',
    title: 'BOTinho vs planilha manual para divulgar ofertas no WhatsApp',
    description: 'Compare BOTinho e planilha manual para organizar grupos, links de afiliado, cadência e logs de divulgação em WhatsApp.',
    competitorSlugs: ['manual-spreadsheet-workflow'],
    tldr: 'Planilha manual funciona para operação pequena; BOTinho tende a ganhar quando volume e repetição aumentam e você precisa de logs e consistência.',
    directAnswer: 'Planilha manual é indicada para validar processo com baixo volume e revisão próxima. O BOTinho é indicado quando a operação precisa repetir a rotina com mais consistência: separar origem e destino, revisar links suportados, aplicar filtros, controlar cadência e consultar histórico de logs.',
    rows: [
      ['Organização de grupos', 'Planilha exige atualização manual de nomes, regras e prioridades.', 'BOTinho centraliza origem/destino na rotina operacional.'],
      ['Conferência de link', 'Depende de checklist e disciplina da pessoa operadora.', 'Ajuda a converter links suportados, mas ainda exige revisão humana do destino final.'],
      ['Cadência', 'Horários e intervalos ficam sujeitos a esquecimento.', 'Intervalos configuráveis ajudam a reduzir repetição excessiva.'],
      ['Auditoria', 'Histórico depende de anotações manuais.', 'Logs ajudam a conferir execução e falhas de envio.'],
    ],
    criteria: ['Volume semanal de ofertas', 'Número de grupos', 'Risco de erro humano', 'Necessidade de logs', 'Tempo disponível para revisão'],
    bestFit: [
      'BOTinho é melhor para operação diária com múltiplos grupos e necessidade de trilha de execução.',
      'Planilha manual é melhor para estágio inicial de validação com poucas publicações semanais.',
    ],
    notIdealFit: [
      'BOTinho não é ideal se você ainda não definiu processo base de revisão humana.',
      'Planilha manual não é ideal quando atrasos e erros de rotina já impactam performance.',
    ],
    migrationPath: [
      'Use a planilha como calendário editorial, não como executor principal.',
      'Configure primeiro os grupos prioritários e a cadência mínima.',
      'Valide logs de execução por 7 dias e ajuste regras de publicação antes de ampliar.',
    ],
    faq: [
      { q: 'Quando continuar na planilha?', a: 'Continue na planilha se a operação ainda é pequena, tem poucos grupos e a revisão manual não atrasa a publicação.' },
      { q: 'Quando migrar para o BOTinho?', a: 'Considere migrar quando houver repetição diária, vários destinos, risco de link errado e necessidade de histórico.' },
      { q: 'A planilha deixa de ser útil?', a: 'Não. Ela pode continuar como planejamento editorial, enquanto o BOTinho organiza a execução recorrente.' },
    ],
  },
  '/botinho-vs-ferramentas-genericas-automacao': {
    format: 'vs',
    eyebrow: 'Comparativo · Automação genérica',
    title: 'BOTinho vs ferramentas genéricas de automação',
    description: 'Entenda quando usar BOTinho ou ferramentas genéricas como automações de fluxo, conectores e scripts para rotinas de WhatsApp com afiliados.',
    competitorSlugs: ['generic-automation-tools'],
    tldr: 'Ferramentas genéricas priorizam flexibilidade técnica; BOTinho prioriza velocidade de operação para grupos de ofertas sem projeto técnico do zero.',
    directAnswer: 'Ferramentas genéricas são úteis quando a equipe técnica precisa conectar muitos sistemas diferentes. O BOTinho é mais indicado quando o problema central é operação de ofertas em grupos: link monetizado, origem, destino, filtros, cadência, revisão humana e logs sem construir uma automação do zero.',
    rows: [
      ['Setup', 'Automação genérica costuma exigir desenho técnico e testes de integração.', 'BOTinho entrega fluxo mais específico para grupos e ofertas.'],
      ['Manutenção', 'Scripts e conectores podem quebrar quando páginas, APIs ou regras mudam.', 'BOTinho concentra regras do produto e ajustes operacionais em uma experiência única.'],
      ['Governança', 'Depende de documentação própria da equipe.', 'Metodologia pública reforça limites, revisão e cadência responsável.'],
      ['Flexibilidade', 'Alta para times técnicos.', 'Focada no caso de uso de afiliados e admins de grupos.'],
    ],
    criteria: ['Capacidade técnica interna', 'Número de integrações externas', 'Foco em grupos de ofertas', 'Necessidade de governança', 'Custo de manutenção'],
    bestFit: [
      'BOTinho é melhor quando a dor principal é execução de ofertas em grupos com governança operacional.',
      'Automação genérica é melhor quando você precisa orquestrar vários sistemas além do WhatsApp.',
    ],
    notIdealFit: [
      'BOTinho não é ideal para pipelines altamente customizados que exigem lógica técnica complexa fora do escopo do produto.',
      'Automação genérica não é ideal para times que precisam de resultado rápido sem sobrecarga de manutenção.',
    ],
    migrationPath: [
      'Mapeie quais integrações realmente precisam continuar externas.',
      'Migre os fluxos de maior frequência primeiro para reduzir risco operacional.',
      'Mantenha monitoramento paralelo por uma janela de validação antes de desativar scripts antigos.',
    ],
    faq: [
      { q: 'Ferramentas genéricas são ruins?', a: 'Não. Elas são fortes para fluxos amplos. A comparação é sobre foco: BOTinho prioriza rotina de ofertas em grupos.' },
      { q: 'Posso usar as duas abordagens?', a: 'Sim. Uma equipe pode manter BI, CRM ou planilhas fora do BOTinho e usar o produto para execução de grupos.' },
      { q: 'Qual tem menor risco?', a: 'O risco depende do uso. Qualquer abordagem precisa respeitar regras do WhatsApp, consentimento, cadência e políticas de afiliados.' },
    ],
  },
  '/melhores-bots-para-afiliados-whatsapp': {
    format: 'alternative-plural',
    eyebrow: 'Critérios · Avaliação de ferramentas',
    title: 'Melhores bots para afiliados no WhatsApp: critérios transparentes',
    description: 'Lista de critérios para avaliar bots e ferramentas de WhatsApp para afiliados sem ranking falso, promessa de ganho ou prova social inventada.',
    tldr: 'Não escolha por promessa de ganho: escolha por processo confiável, rastreabilidade e aderência às políticas das plataformas.',
    directAnswer: 'Os melhores bots para afiliados no WhatsApp devem ser avaliados por critérios de processo, não por promessa de comissão. Priorize revisão de link monetizado, controle de grupos, filtros, cadência, logs, limites contra spam, clareza de preço e suporte a plataformas realmente usadas pela operação.',
    rows: [
      ['Link monetizado', 'A ferramenta ajuda a conferir ou converter links suportados sem remover tags?', 'Reduz risco operacional, mas não elimina revisão humana.'],
      ['Grupos e destinos', 'Existe separação clara entre origem, destino, nicho e prioridade?', 'Evita publicar no público errado.'],
      ['Cadência', 'Há intervalos, filtros e controle para evitar repetição?', 'Ajuda a proteger experiência dos grupos.'],
      ['Logs', 'A operação consegue auditar envio, falha e campanha?', 'Permite aprender e corrigir processo.'],
    ],
    criteria: ['Transparência de preço', 'Limites de uso responsável', 'Logs e auditoria', 'Suporte a afiliados', 'Ausência de promessa de ganho garantido'],
    bestFit: [
      'A melhor ferramenta será a que reduzir erros operacionais mantendo revisão humana e trilha de auditoria.',
    ],
    migrationPath: [
      'Defina critérios mínimos de compliance e qualidade de link antes da troca de ferramenta.',
      'Execute piloto com um subconjunto de grupos e só depois amplie para o restante da operação.',
    ],
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

function getRelatedComparisonPages(slug, limit = 3) {
  const current = COMPARISON_PAGES[slug]
  if (!current) return []
  const currentCompetitors = new Set(current.competitorSlugs || [])

  return Object.entries(COMPARISON_PAGES)
    .filter(([href]) => href !== slug)
    .map(([href, page]) => {
      const competitors = new Set(page.competitorSlugs || [])
      let overlap = 0
      currentCompetitors.forEach((competitor) => {
        if (competitors.has(competitor)) overlap += 1
      })
      const sameFormatBoost = page.format === current.format ? 1 : 0
      const score = overlap * 10 + sameFormatBoost * 3
      return { href, title: page.title, score }
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export function ComparisonPage({ slug }) {
  const page = COMPARISON_PAGES[slug]
  const relatedPages = getRelatedComparisonPages(slug, 3)
  const siteUrl = getSiteUrl()
  const dates = getEditorialDates(slug)
  const schemas = buildArticleJsonLd({ title: page.title, description: page.description, slug, siteUrl, faq: page.faq, type: 'Article' })

  const headline = (
    <>
      <span>{page.title.split(' ').slice(0, -2).join(' ')}</span><br />
      <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{page.title.split(' ').slice(-2).join(' ')}</span>
    </>
  )

  return (
    <div className="landing-root">
      <ComparisonPageTracker slug={slug} format={page.format} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <Hero
        eyebrowLabel={page.eyebrow}
        primaryCtaLabel="Entrar na Lista VIP"
        headlineOverride={headline}
        subOverride={page.description}
        heroStyle={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-2) 18%, white), transparent)', borderRadius: 24, paddingInline: 20 }}
      />

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <IntroCard
            eyebrow={page.eyebrow}
            title={page.title}
            body={page.directAnswer}
            pills={[`Por ${EDITORIAL_AUTHOR}`, `Publicado em ${formatDatePtBr(dates.publishedAt)}`, `Atualizado em ${formatDatePtBr(dates.updatedAt)}`]}
            accent
          />
        </div>
      </section>

      {Array.isArray(page.botinhoDifferentials) && page.botinhoDifferentials.length > 0 && (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Diferenciais BOTinho</span>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Veja como nos comparamos com Divulgador Inteligente, Divulga Ninja, Gigi Prime Bot, Busqy e DivulgaLinks</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.8 }}>
                {page.botinhoDifferentials.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Veja também</span>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Outros comparativos relacionados</h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li><Link href="/comparativos" data-comparison-cta="related-hub" style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>Hub de comparativos do BOTinho</Link></li>
              {relatedPages.map((related) => (
                <li key={related.href}>
                  <Link href={related.href} data-comparison-cta="related-page" style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                    {related.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'color-mix(in oklab, var(--accent) 14%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />TL;DR</span>
            <p style={{ margin: '12px 0 0', color: 'var(--ink)', lineHeight: 1.7 }}>{page.tldr || page.directAnswer}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Comparativo</span>
            <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', lineHeight: 1.12, margin: '14px 0 18px' }}>Comparativo equilibrado</h2>
            <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid var(--line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left', color: 'var(--ink)' }}>
                <thead style={{ background: 'var(--bg-soft)' }}>
                  <tr>
                    <th style={{ padding: 16, fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Critério</th>
                    <th style={{ padding: 16, fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Alternativa</th>
                    <th style={{ padding: 16, fontWeight: 700, borderBottom: '1px solid var(--line)' }}>Leitura responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map(([criterion, alternative, reading], i, arr) => (
                    <tr key={criterion} style={{ borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--line)' }}>
                      <td style={{ padding: 16, fontWeight: 600 }}>{criterion}</td>
                      <td style={{ padding: 16, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{alternative}</td>
                      <td style={{ padding: 16, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{reading}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Decisão</span>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Critérios de decisão</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                {page.criteria.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div style={{ background: 'color-mix(in oklab, var(--accent-2) 24%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Limites</span>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Limites importantes</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                {PRODUCT_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            {Array.isArray(page.bestFit) && page.bestFit.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
                <span className="pill"><span className="dot" />Melhor encaixe</span>
                <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Quem deve usar o quê</h2>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {page.bestFit.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            {Array.isArray(page.notIdealFit) && page.notIdealFit.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
                <span className="pill"><span className="dot" />Quando não usar</span>
                <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 12px', letterSpacing: '-0.01em' }}>Cenários não ideais</h2>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                  {page.notIdealFit.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Perfis de alternativa</span>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Resumo centralizado dos caminhos avaliados</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {(page.competitorSlugs || []).map((slug) => {
                const competitor = getCompetitorBySlug(slug)
                return (
                  <article key={slug} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 16, background: 'color-mix(in oklab, var(--surface) 92%, white)' }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{competitor.name}</h3>
                    <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{competitor.positioning}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink)', lineHeight: 1.6 }}><strong>Melhor para:</strong> {competitor.bestFor}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink)', lineHeight: 1.6 }}><strong>Não ideal para:</strong> {competitor.notIdealFor}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', lineHeight: 1.6 }}><strong>Nota de migração:</strong> {competitor.migrationNotes}</p>
                    <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', lineHeight: 1.6 }}><strong>Fonte:</strong> {competitor.source}</p>
                    <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', lineHeight: 1.6 }}><strong>Verificado em:</strong> {competitor.verifiedAt}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {Array.isArray(page.migrationPath) && page.migrationPath.length > 0 && (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Migração</span>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Caminho de migração recomendado</h2>
              <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', lineHeight: 1.8 }}>
                {page.migrationPath.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Fontes</span>
            <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.15, margin: '14px 0 12px' }}>Fontes e políticas para revisar antes de operar</h2>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.65 }}>Use as políticas oficiais como referência operacional. Elas podem mudar e devem ser revisadas pela pessoa responsável antes de ampliar volume.</p>
            <ul style={{ margin: '14px 0 0', paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.8 }}>
              {COMPARISON_SOURCE_LINKS.map((source) => (
                <li key={source.href}>
                  <a href={source.href} data-comparison-cta="source-link" style={{ color: 'var(--accent-strong)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }} rel="noreferrer">{source.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />FAQ</span>
            <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', lineHeight: 1.12, margin: '14px 0 16px' }}>Perguntas frequentes</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {page.faq.map((item) => (
                <details key={item.q} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', background: 'color-mix(in oklab, var(--surface) 92%, white)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--ink)' }}>{item.q}</summary>
                  <p style={{ marginTop: 10, color: 'var(--ink-soft)', lineHeight: 1.65 }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'color-mix(in oklab, var(--accent) 22%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />{BRAND_NAME}</span>
            <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 34px)', lineHeight: 1.12, margin: '14px 0 12px' }}>Onde o {BRAND_NAME} se encaixa?</h2>
            <p style={{ color: 'var(--ink)', lineHeight: 1.7 }}>{PRODUCT_DEFINITION}</p>
            <Link href="/login?mode=register&utm_source=comparativo&utm_medium=organic&utm_campaign=ai-seo-p2" data-comparison-cta="bottom-register" className="btn btn-accent" style={{ marginTop: 20 }}>
              Entrar na Lista VIP
            </Link>
          </div>
        </div>
      </section>

      <FinalCTA />
      <Footer />
    </div>
  )
}
