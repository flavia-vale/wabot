import '../landing.css'
import Link from 'next/link'
import Footer from '@/components/landing/Footer'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'

const pagePath = '/bot-canais-whatsapp'
const siteUrl = getSiteUrl()
const pageUrl = `${siteUrl}${pagePath}`
const primaryCtaHref = '/login?mode=register&utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=hero'
const diagnosticHref = '/diagnostico-antiban-whatsapp?utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=modulo_preservacao'
const checklistHref = '/materiais/checklist-antiban-whatsapp?utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=landing_checklist'
const riskCalculatorHref = '/ferramentas/calculadora-risco-whatsapp?utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=landing_calculadora_risco'
const decisionPages = [
  { href: '/bot-comum-vs-botinho?utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=p2_bot_comum', title: 'Bot comum vs Espelha Grupos', description: 'Compare repostagem simples com operação preservada.' },
  { href: '/faq-antiban-whatsapp?utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=p2_faq', title: 'FAQ “anti-ban” honesto', description: 'Respostas diretas sem promessa de banimento zero.' },
  { href: '/como-funciona-botinho-canais?utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=p2_como_funciona', title: 'Como funciona em canais', description: 'Fluxo de fontes, destinos, cadência e monitoramento.' },
  { href: '/protecao-antiban-botinho?utm_source=seo&utm_medium=landing&utm_campaign=canais-preservacao&utm_content=p2_protecao', title: 'Proteção avançada', description: 'Limites, variações, pausa preventiva e recuperação.' },
]

const title = 'Bot para Canais do WhatsApp com Módulo de Preservação Avançada'
const description = 'Migre achadinhos para Canais do WhatsApp com o Espelha Grupos: espelhamento entre grupos e canais, ritmo humano, variações, monitoramento e Módulo de Preservação Avançada (o chamado "anti-ban").'

export const metadata = {
  title,
  description,
  alternates: { canonical: pagePath },
  openGraph: {
    title,
    description,
    url: pageUrl,
    siteName: 'Espelha Grupos',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: buildOgImageUrl({ slug: 'bot-canais-whatsapp', cluster: 'canais-preservacao', template: 'landing' }),
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [buildOgImageUrl({ slug: 'bot-canais-whatsapp', cluster: 'canais-preservacao', template: 'landing' })],
  },
}

const painPoints = [
  'Grupos de achadinhos desativados sem aviso claro.',
  'Chip pessoal segurando uma operação que já virou renda.',
  'Mensagens idênticas publicadas em massa e no mesmo minuto.',
  'Queda de entrega percebida só depois que os cliques somem.',
  'Nenhum plano B quando um grupo, canal ou número fica em risco.',
]

const flows = [
  'Grupo → Canal',
  'Canal → Grupo',
  'Canal → Canal',
  'Grupo → Grupo',
  'Múltiplas fontes → múltiplos canais',
]

const pillars = [
  {
    icon: '🛡️',
    title: 'Ritmo humano de publicação',
    body: 'Configure intervalo mínimo, limites por hora/dia, horário de silêncio e distribuição escalonada para evitar posts colados em todos os canais.',
  },
  {
    icon: '🎭',
    title: 'Variações contra fingerprint',
    body: 'Alterne chamadas, emojis, ordem dos elementos e versões de conteúdo para reduzir o padrão de mensagem byte-idêntica em vários destinos.',
  },
  {
    icon: '🔍',
    title: 'Detecção precoce de risco',
    body: 'Acompanhe sinais de saúde por canal, erros, atraso de entrega, queda de cliques e camada de conta-sentinela quando disponível.',
  },
  {
    icon: '🪂',
    title: 'Plano de recuperação',
    body: 'Trate canal, chip e audiência como ativos: use chip dedicado, mantenha configuração registrada e prepare recriação rápida se algo acontecer.',
  },
]

const steps = [
  'Mapeie grupos, canais, fontes de oferta e destinos que hoje sustentam sua operação.',
  'Defina quais grupos continuam como fonte/comunidade e quais canais viram vitrine principal.',
  'Configure limites, pausas, horário de silêncio e variações antes de aumentar volume.',
  'Espelhe ofertas entre grupos e canais com cadência diferente para cada destino.',
  'Monitore sinais de saúde e pause a publicação quando um canal entrar em zona de risco.',
]

const comparisons = [
  ['Postar oferta convertida', '✅', '✅'],
  ['Espelhar de grupos para canais', '⚠️ limitado', '✅'],
  ['Espelhar de canais para grupos', '⚠️ limitado', '✅'],
  ['Ritmo humano com pausas', '❌', '✅'],
  ['Variação automática de texto', '❌', '✅'],
  ['Variação de imagem por destino', '❌', '✅'],
  ['Horário de silêncio', '❌', '✅'],
  ['Painel de saúde dos canais', '❌', '✅'],
  ['Pausa preventiva por risco', '❌', '✅'],
  ['Plano de recuperação', '❌', '✅'],
]

const faqs = [
  {
    question: 'O Módulo de Preservação Avançada garante que meu WhatsApp nunca será banido?',
    answer: 'Não. Nenhuma ferramenta séria pode prometer 100% contra banimento. O Módulo de Preservação Avançada reduz risco com defesa em profundidade: cadência, limites, variações, monitoramento, alertas e plano de recuperação. O termo "anti-ban" aparece apenas como referência de busca, não como promessa absoluta.',
  },
  {
    question: 'Preciso abandonar meus grupos de achadinhos?',
    answer: 'Não. A estratégia recomendada é usar grupos e canais juntos quando fizer sentido: grupos como fonte ou comunidade, e canais como vitrine mais organizada para ofertas.',
  },
  {
    question: 'O Espelha Grupos consegue postar de grupos para canais?',
    answer: 'Sim. O fluxo da campanha cobre espelhamento flexível: grupo para canal, canal para grupo, canal para canal e grupo para grupo, respeitando regras de cadência configuradas.',
  },
  {
    question: 'Por que usar chip dedicado?',
    answer: 'Porque o número que opera seus canais é um ativo do negócio. Usar o número pessoal mistura risco operacional com vida pessoal e dificulta recuperação caso aconteça um bloqueio ou incidente.',
  },
]

const s = {
  section: { padding: '64px 0' },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 36,
    alignItems: 'center',
    padding: '48px 0 72px',
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    border: '1px solid var(--line)',
    borderRadius: 999,
    background: 'color-mix(in oklab, var(--accent-3) 62%, var(--surface))',
    color: 'var(--ink)',
    fontSize: 13,
    fontWeight: 700,
  },
  h1: {
    fontSize: 'clamp(42px, 6vw, 76px)',
    lineHeight: 0.95,
    letterSpacing: '-0.055em',
    margin: '20px 0 18px',
    maxWidth: 780,
  },
  h2: {
    fontSize: 'clamp(30px, 3.6vw, 50px)',
    lineHeight: 1.02,
    letterSpacing: '-0.045em',
    margin: '14px 0 16px',
  },
  lead: { fontSize: 'clamp(18px, 2vw, 22px)', lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: 720 },
  small: { fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-soft)' },
  ctaRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 26, boxShadow: '0 10px 28px rgba(63, 63, 70, 0.04)' },
  softCard: { background: 'color-mix(in oklab, var(--accent) 12%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 26 },
}

function JsonLd() {
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Espelha Grupos',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      description,
      offers: { '@type': 'Offer', availability: 'https://schema.org/InStock', url: pageUrl },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Bot para Canais do WhatsApp', item: pageUrl },
      ],
    },
  ]

  return schemas.map((schema) => (
    <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
  ))
}

function MiniDashboard() {
  return (
    <div style={{ ...s.card, padding: 20, background: 'linear-gradient(160deg, var(--surface), color-mix(in oklab, var(--accent-3) 34%, var(--surface)))' }} aria-label="Prévia do painel de preservação avançada">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}>
        <div>
          <strong style={{ display: 'block', fontSize: 18 }}>Painel de canais</strong>
          <span style={s.small}>Saúde por destino · hoje</span>
        </div>
        <span className="pill"><span className="dot" />preservação ativa</span>
      </div>
      {[
        ['Achadinhos Casa', '🟢 Saudável', '12 posts · cadência OK'],
        ['Ofertas Relâmpago', '🟡 Atenção', 'queda de cliques em 38%'],
        ['Promo VIP Tech', '🔴 Em risco', 'pausa preventiva sugerida'],
      ].map(([name, status, meta]) => (
        <div key={name} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--line)' }}>
          <div>
            <strong style={{ display: 'block', fontSize: 15 }}>{name}</strong>
            <span style={s.small}>{meta}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{status}</span>
        </div>
      ))}
      <div style={{ marginTop: 18, padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.72)', border: '1px solid var(--line)' }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>Próxima ação recomendada</strong>
        <p style={s.small}>Reduzir frequência no canal em risco e manter distribuição escalonada nos canais saudáveis.</p>
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <div style={{ maxWidth: 820, marginBottom: 28 }}>
      <span className="pill"><span className="dot" />{eyebrow}</span>
      <h2 style={s.h2}>{title}</h2>
      {body ? <p style={s.lead}>{body}</p> : null}
    </div>
  )
}

export default function BotCanaisWhatsAppPage() {
  const trackerRoute = {
    slug: 'bot-canais-whatsapp',
    path: pagePath,
    cluster: 'canais-preservacao',
    intent: 'bot para canais do whatsapp',
    template: 'campaign-landing',
  }

  return (
    <div className="landing-root">
      <OrganicPageTracker route={trackerRoute} />
      <JsonLd />

      <main>
        <section aria-labelledby="hero-title">
          <div className="wrap" style={s.hero}>
            <div>
              <span style={s.eyebrow}>Canais do WhatsApp + Módulo de Preservação Avançada</span>
              <h1 id="hero-title" style={s.h1}>
                Migre seus achadinhos para <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>Canais do WhatsApp</span> com preservação avançada.
              </h1>
              <p style={s.lead}>
                O Espelha Grupos espelha ofertas entre grupos e canais, publica em ritmo humano, cria variações naturais e monitora sinais de risco para preservar sua operação de afiliados.
              </p>
              <div style={s.ctaRow}>
                <Link className="btn btn-accent" href={primaryCtaHref} data-seo-cta="signup_preservar_canais" data-cta-position="hero_primary" data-cta-stage="conversion" data-cta-destination="signup">Quero preservar meus canais</Link>
                <Link className="btn btn-ghost" href={diagnosticHref} data-seo-cta="diagnostico_preservacao" data-cta-position="hero_secondary" data-cta-stage="diagnostic" data-cta-destination="diagnostic">Fazer diagnóstico de preservação</Link>
              </div>
              <p style={{ ...s.small, marginTop: 16 }}>
                Aviso honesto: nenhuma automação séria garante banimento zero. O Espelha Grupos trabalha com redução de risco, uso responsável, monitoramento preventivo e plano de recuperação.
              </p>
            </div>
            <MiniDashboard />
          </div>
        </section>

        <section style={s.section} aria-labelledby="risco-title">
          <div className="wrap">
            <SectionHeader
              eyebrow="O problema"
              title="O jeito antigo de divulgar achadinhos está ficando frágil."
              body="Quando uma operação depende de um único grupo, um único chip e publicações repetidas demais, qualquer penalização vira risco de receita."
            />
            <div style={s.grid2}>
              <div style={s.softCard}>
                <h3 id="risco-title" style={{ fontSize: 26, marginBottom: 14 }}>Seus canais são ativos, não improviso.</h3>
                <p style={s.small}>Grupo, canal, chip e audiência precisam ser tratados como partes de uma operação. O Espelha Grupos organiza esse fluxo para reduzir comportamento robótico e preparar um plano B.</p>
              </div>
              <ul style={{ ...s.card, margin: 0, paddingLeft: 44, lineHeight: 1.75 }}>
                {painPoints.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section style={s.section} aria-labelledby="canais-title">
          <div className="wrap">
            <SectionHeader
              eyebrow="A virada"
              title="Use grupos e canais juntos, com cada um no papel certo."
              body="Grupos podem continuar como fonte ou comunidade. Canais podem virar a vitrine organizada das ofertas. O diferencial do Espelha Grupos é conectar os dois lados com regras de cadência."
            />
            <div style={s.grid3}>
              {flows.map((flow) => (
                <div key={flow} style={s.card}>
                  <strong style={{ fontSize: 22 }}>{flow}</strong>
                  <p style={{ ...s.small, marginTop: 10 }}>Espelhamento com destino configurável, intervalo entre publicações e controle para evitar tudo ao mesmo tempo.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={s.section} aria-labelledby="como-funciona-title">
          <div className="wrap">
            <SectionHeader
              eyebrow="Como funciona"
              title="Da operação vulnerável para uma rotina monitorada."
              body="A Sprint 1 da campanha apresenta o fluxo comercial: diagnóstico, migração para canais, regras do Módulo de Preservação Avançada e monitoramento contínuo."
            />
            <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, listStyle: 'none', margin: 0, padding: 0, counterReset: 'step' }}>
              {steps.map((step, index) => (
                <li key={step} style={s.card}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-strong)', color: 'white', fontWeight: 800, marginBottom: 14 }}>{index + 1}</span>
                  <p style={{ ...s.small, color: 'var(--ink)' }}>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section style={s.section} aria-labelledby="pilares-title">
          <div className="wrap">
            <SectionHeader
              eyebrow="Preservação avançada"
              title="Defesa em profundidade: camada sobre camada."
              body="O Espelha Grupos não promete mágica. O Módulo de Preservação Avançada reduz risco combinando comportamento mais natural, controle de volume, monitoramento e recuperação."
            />
            <div style={s.grid2}>
              {pillars.map((pillar) => (
                <article key={pillar.title} style={s.card}>
                  <div style={{ fontSize: 34, marginBottom: 12 }}>{pillar.icon}</div>
                  <h3 style={{ fontSize: 24, marginBottom: 10 }}>{pillar.title}</h3>
                  <p style={s.small}>{pillar.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={s.section} aria-labelledby="comparativo-title">
          <div className="wrap">
            <SectionHeader
              eyebrow="Comparativo"
              title="Bot comum espalha. Espelha Grupos opera com preservação."
              body="A diferença não está apenas em postar ofertas. Está em publicar com cadência, variações, sinais de saúde e plano de recuperação."
            />
            <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 24, background: 'var(--surface)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                  <tr style={{ background: 'color-mix(in oklab, var(--accent-3) 42%, var(--surface))' }}>
                    <th style={{ textAlign: 'left', padding: 18 }}>Recurso</th>
                    <th style={{ textAlign: 'center', padding: 18 }}>Bots comuns</th>
                    <th style={{ textAlign: 'center', padding: 18 }}>Espelha Grupos</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map(([feature, common, botinho]) => (
                    <tr key={feature}>
                      <td style={{ padding: 16, borderTop: '1px solid var(--line)' }}>{feature}</td>
                      <td style={{ padding: 16, borderTop: '1px solid var(--line)', textAlign: 'center' }}>{common}</td>
                      <td style={{ padding: 16, borderTop: '1px solid var(--line)', textAlign: 'center', fontWeight: 800 }}>{botinho}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section style={s.section} aria-labelledby="honestidade-title">
          <div className="wrap">
            <div style={{ ...s.softCard, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22, alignItems: 'center' }}>
              <div>
                <span className="pill"><span className="dot" />Recado honesto</span>
                <h2 id="honestidade-title" style={s.h2}>Promessa absoluta é sinal de alerta.</h2>
              </div>
              <p style={{ ...s.lead, fontSize: 18 }}>
                O Espelha Grupos não controla decisões da plataforma. O Módulo de Preservação Avançada — buscado por muitos afiliados como “anti-ban” — entrega processo: chip dedicado, cadência responsável, variações, monitoramento, pausa preventiva e plano de recuperação para reduzir exposição.
              </p>
            </div>
          </div>
        </section>

        <section style={s.section} aria-labelledby="ativos-p1-title">
          <div className="wrap">
            <SectionHeader
              eyebrow="Ferramentas P1"
              title="Antes de escalar, transforme risco em checklist e número."
              body="Use a calculadora para estimar exposição operacional e o checklist para aplicar as camadas de preservação no dia a dia."
            />
            <div style={s.grid2}>
              <article style={s.card}>
                <h3 id="ativos-p1-title" style={{ fontSize: 24, marginBottom: 10 }}>Checklist de Preservação Avançada</h3>
                <p style={s.small}>Revise chip dedicado, fontes, destinos, cadência, variações, monitoramento e recuperação sem prometer “anti-ban” absoluto.</p>
                <Link className="btn btn-accent" style={{ marginTop: 18 }} href={checklistHref} data-seo-cta="landing_checklist" data-cta-position="p1_assets_primary" data-cta-stage="lead_magnet" data-cta-destination="checklist">Ver checklist</Link>
              </article>
              <article style={s.card}>
                <h3 style={{ fontSize: 24, marginBottom: 10 }}>Calculadora de risco operacional</h3>
                <p style={s.small}>Estime exposição por volume, intervalo, repetição de mensagens, chip, monitoramento e plano de recuperação.</p>
                <Link className="btn btn-ghost" style={{ marginTop: 18 }} href={riskCalculatorHref} data-seo-cta="landing_risk_calculator" data-cta-position="p1_assets_secondary" data-cta-stage="tool" data-cta-destination="calculator">Calcular risco</Link>
              </article>
            </div>
          </div>
        </section>

        <section style={s.section} aria-labelledby="decisao-p2-title">
          <div className="wrap">
            <SectionHeader
              eyebrow="Decisão P2"
              title="Compare, tire objeções e entenda o funcionamento antes de configurar."
              body="Estas páginas fecham as dúvidas de decisão: diferença contra bot comum, FAQ honesto, fluxo de canais e detalhes do Módulo de Preservação Avançada."
            />
            <div style={s.grid2}>
              {decisionPages.map((page) => (
                <article key={page.href} style={s.card}>
                  <h3 id={page.title === 'Bot comum vs Espelha Grupos' ? 'decisao-p2-title' : undefined} style={{ fontSize: 22, marginBottom: 10 }}>{page.title}</h3>
                  <p style={s.small}>{page.description}</p>
                  <Link className="btn btn-ghost" style={{ marginTop: 18 }} href={page.href} data-seo-cta="landing_p2_decision" data-cta-position="p2_assets" data-cta-stage="decision" data-cta-destination="decision_page">Abrir página</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={s.section} aria-labelledby="faq-title">
          <div className="wrap">
            <SectionHeader eyebrow="FAQ" title="Perguntas frequentes antes de migrar para canais." />
            <div style={{ display: 'grid', gap: 14 }}>
              {faqs.map((item) => (
                <details key={item.question} style={s.card}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 18 }}>{item.question}</summary>
                  <p style={{ ...s.small, marginTop: 12 }}>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section style={{ ...s.section, paddingBottom: 88 }} aria-labelledby="cta-final-title">
          <div className="wrap">
            <div style={{ ...s.card, textAlign: 'center', background: 'linear-gradient(135deg, color-mix(in oklab, var(--accent) 24%, var(--surface)), var(--surface))' }}>
              <span className="pill"><span className="dot" />Próximo passo</span>
              <h2 id="cta-final-title" style={{ ...s.h2, marginInline: 'auto', maxWidth: 820 }}>Seu WhatsApp virou ativo de negócio. Preserve como ativo.</h2>
              <p style={{ ...s.lead, margin: '0 auto', maxWidth: 760 }}>Configure canais, espelhamento e camadas de preservação antes que uma queda de grupo ou chip vire prejuízo.</p>
              <div style={{ ...s.ctaRow, justifyContent: 'center' }}>
                <Link className="btn btn-accent" href={primaryCtaHref} data-seo-cta="signup_preservar_canais" data-cta-position="final_primary" data-cta-stage="conversion" data-cta-destination="signup">Quero preservar meus canais</Link>
                <Link className="btn btn-ghost" href={diagnosticHref} data-seo-cta="diagnostico_preservacao" data-cta-position="final_secondary" data-cta-stage="diagnostic" data-cta-destination="diagnostic">Fazer diagnóstico antes de escalar</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
