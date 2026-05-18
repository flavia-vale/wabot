import './landing.css'
import Link from 'next/link'
import Footer from '@/components/landing/Footer'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'

const siteUrl = getSiteUrl()
const registerHref = '/login?mode=register&utm_source=seo&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=sprint2'
const mainLandingHref = '/bot-canais-whatsapp?utm_source=seo&utm_medium=internal&utm_campaign=canais-preservacao&utm_content=sprint2_crosslink'
const diagnosticHref = '/diagnostico-antiban-whatsapp?utm_source=seo&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=commercial_secondary'

export const PRESERVATION_COMMERCIAL_PAGES = {
  'bot-afiliados-whatsapp': {
    path: '/bot-afiliados-whatsapp',
    title: 'Bot para afiliados no WhatsApp com preservação avançada',
    description: 'Automatize ofertas de afiliados no WhatsApp com espelhamento entre grupos e canais, cadência humana, variações e Módulo de Preservação Avançada.',
    eyebrow: 'Bot para afiliados',
    h1: 'Bot para afiliados no WhatsApp com operação preservada',
    lead: 'O BOTinho ajuda afiliados a sair do copia-e-cola em grupos e organizar uma distribuição mais profissional em Canais do WhatsApp, com limites, variações, monitoramento e plano de recuperação.',
    intent: 'bot para afiliados whatsapp',
    primaryCta: 'Ver operação para afiliados',
    secondaryCta: 'Conhecer preservação avançada',
    problemTitle: 'Afiliado que depende só de grupo fica exposto demais.',
    problem: 'Quando o WhatsApp é canal de receita, publicar tudo igual em todos os lugares vira risco operacional. A operação precisa de fontes, destinos, cadência e sinais de saúde.',
    bullets: ['Converter e redistribuir ofertas sem copiar manualmente cada mensagem.', 'Usar grupos e canais juntos, sem tratar todos os destinos como iguais.', 'Adicionar ritmo humano, pausa, variação e monitoramento antes de escalar volume.'],
    process: ['Conecte fontes de ofertas e destinos de publicação.', 'Separe grupos de comunidade, canais de vitrine e regras por destino.', 'Ative o Módulo de Preservação Avançada para controlar ritmo, variação e sinais de risco.'],
    faqs: [
      ['Serve para afiliados de marketplace?', 'Sim. A página foi pensada para afiliados que divulgam achadinhos e ofertas de marketplaces em grupos e Canais do WhatsApp.'],
      ['Preciso migrar tudo para canais?', 'Não. O BOTinho permite operar grupos e canais juntos, escolhendo o melhor papel para cada ambiente.'],
      ['Isso é o mesmo que “anti-ban”?', 'Não como promessa absoluta. O Módulo de Preservação Avançada é uma camada de redução de risco; “anti-ban” aparece apenas como termo de busca usado pelo mercado.'],
    ],
  },
  'bot-achadinhos-whatsapp': {
    path: '/bot-achadinhos-whatsapp',
    title: 'Bot para achadinhos no WhatsApp com canais e preservação',
    description: 'Use o BOTinho para operar achadinhos em grupos e Canais do WhatsApp com espelhamento, cadência, variações e Módulo de Preservação Avançada.',
    eyebrow: 'Bot para achadinhos',
    h1: 'Achadinhos no WhatsApp sem operação improvisada',
    lead: 'Transforme grupos e canais de achadinhos em uma rotina mais controlada: ofertas entram por fontes monitoradas, saem para canais certos e respeitam limites antes de virar comportamento de bot.',
    intent: 'bot para achadinhos whatsapp',
    primaryCta: 'Migrar achadinhos para canais',
    secondaryCta: 'Ver módulo de preservação',
    problemTitle: 'Achadinhos crescem rápido — e a rotina quebra rápido também.',
    problem: 'Muitos canais começam com publicação manual, depois viram uma rede de grupos, chips e mensagens repetidas. O BOTinho organiza essa expansão com regras claras.',
    bullets: ['Espelhar achadinhos entre grupos e Canais do WhatsApp.', 'Variar chamadas e cadência para evitar publicação mecânica.', 'Criar plano B para canal, chip e audiência.'],
    process: ['Mapeie seus grupos e canais atuais.', 'Defina canais como vitrine e grupos como fonte ou comunidade.', 'Use preservação avançada para publicar com limites e monitoramento.'],
    faqs: [
      ['Funciona para grupos de promoções e cupons?', 'Sim. O foco é operação de ofertas, achadinhos, cupons e afiliados que precisam controlar distribuição no WhatsApp.'],
      ['O canal substitui o grupo?', 'Nem sempre. Em muitos casos, o canal vira vitrine principal e o grupo continua como comunidade ou fonte de ofertas.'],
      ['Por que falar de preservação?', 'Porque a dor não é só postar. É manter chip, canal e audiência vivos com rotina menos robótica e mais monitorada.'],
    ],
  },
  'anti-ban-whatsapp': {
    path: '/anti-ban-whatsapp',
    title: 'Módulo de Preservação Avançada para WhatsApp',
    description: 'Entenda o que afiliados chamam de “anti-ban” no WhatsApp e por que o BOTinho usa Módulo de Preservação Avançada: cadência, variações, monitoramento e recuperação.',
    eyebrow: 'Busca “anti-ban” com promessa honesta',
    h1: 'Procurando “anti-ban” para WhatsApp? O nome correto aqui é preservação avançada.',
    lead: 'Nenhuma ferramenta séria garante banimento zero. O BOTinho usa o termo “anti-ban” apenas para atender à busca do mercado; a entrega real é um módulo de preservação com camadas de redução de risco.',
    intent: 'anti-ban whatsapp',
    primaryCta: 'Conhecer preservação avançada',
    secondaryCta: 'Ver canais protegidos',
    problemTitle: 'Promessa absoluta é o primeiro sinal de alerta.',
    problem: 'Quem vende “anti-ban 100%” promete controlar decisões que não controla. A abordagem correta é reduzir comportamento suspeito, monitorar sinais e preparar recuperação.',
    bullets: ['Cadência responsável e horário de silêncio.', 'Variações de texto e ordem da oferta.', 'Monitoramento de saúde e pausa preventiva por risco.'],
    process: ['Substitua promessa absoluta por camadas de preservação.', 'Configure limites, variações e alertas por canal.', 'Use chip dedicado e plano de recuperação como padrão operacional.'],
    faqs: [
      ['O BOTinho é “anti-ban”?', 'O BOTinho não promete “anti-ban” absoluto. Ele oferece Módulo de Preservação Avançada para reduzir risco e organizar recuperação.'],
      ['Por que manter o termo “anti-ban” na página?', 'Porque afiliados pesquisam assim. O termo aparece entre aspas para SEO e explicação, não como promessa comercial.'],
      ['Existe garantia contra banimento?', 'Não. Existe redução de risco com cadência, variações, monitoramento, chip dedicado e plano de recuperação.'],
    ],
  },
  'grupo-para-canal-whatsapp': {
    path: '/grupo-para-canal-whatsapp',
    title: 'Como migrar grupo de achadinhos para Canal do WhatsApp',
    description: 'Planeje a migração de grupos de achadinhos para Canais do WhatsApp com o BOTinho, mantendo grupos como fonte/comunidade e canais como vitrine preservada.',
    eyebrow: 'Migração grupo → canal',
    h1: 'Migre grupos de achadinhos para canais sem parar a operação',
    lead: 'O BOTinho permite uma transição gradual: grupos continuam úteis como comunidade ou fonte, enquanto os Canais do WhatsApp viram uma vitrine organizada com cadência e preservação avançada.',
    intent: 'migrar grupo para canal whatsapp',
    primaryCta: 'Planejar minha migração',
    secondaryCta: 'Ver fluxos grupo e canal',
    problemTitle: 'Migrar de uma vez pode derrubar alcance e rotina.',
    problem: 'A migração segura precisa preservar fontes, organizar destinos e preparar comunicação para a audiência, sem transformar todos os canais em cópias idênticas.',
    bullets: ['Definir grupos que continuam como origem ou comunidade.', 'Criar canais como vitrine principal de ofertas.', 'Configurar espelhamento com janelas e limites diferentes por destino.'],
    process: ['Faça inventário dos grupos e canais atuais.', 'Escolha o papel de cada ambiente: fonte, comunidade, vitrine ou backup.', 'Ative espelhamento gradual e monitore sinais de entrega e clique.'],
    faqs: [
      ['Preciso fechar meus grupos?', 'Não. A migração recomendada é gradual, com grupos e canais convivendo enquanto a audiência aprende o novo fluxo.'],
      ['O BOTinho publica de grupo para canal?', 'Sim. O fluxo cobre grupo para canal, canal para grupo, canal para canal e grupo para grupo.'],
      ['Como reduzir risco nessa migração?', 'Use Módulo de Preservação Avançada: limites, pausas, variações, chip dedicado e monitoramento por canal.'],
    ],
  },
  'bot-canal-whatsapp': {
    path: '/bot-canal-whatsapp',
    title: 'Bot para Canal do WhatsApp com cadência e preservação',
    description: 'Publique ofertas em Canal do WhatsApp com o BOTinho usando cadência humana, variações, monitoramento e Módulo de Preservação Avançada.',
    eyebrow: 'Bot para Canal do WhatsApp',
    h1: 'Canal do WhatsApp precisa de bot com cadência, não disparo',
    lead: 'O BOTinho transforma o canal em vitrine de ofertas com regras de publicação, variações e monitoramento. O objetivo é preservar a operação, não apenas postar mais rápido.',
    intent: 'bot para canal whatsapp',
    primaryCta: 'Criar operação com canal',
    secondaryCta: 'Conhecer preservação avançada',
    problemTitle: 'Canal que parece robô perde confiança e aumenta risco.',
    problem: 'Publicar ofertas sem ritmo, sem variação e sem monitoramento deixa o canal vulnerável. A operação precisa parecer administrada por gente, com controle por destino.',
    bullets: ['Publicar em canais com intervalo e janela natural.', 'Distribuir a mesma oferta em momentos diferentes.', 'Acompanhar sinais de saúde e pausar quando o risco aumenta.'],
    process: ['Conecte o canal e defina fontes de ofertas.', 'Configure limites por hora/dia, silêncio e variações.', 'Monitore desempenho e ajuste cadência antes de escalar.'],
    faqs: [
      ['O BOTinho funciona com Canal do WhatsApp?', 'Sim. O foco desta página é operação para Canais do WhatsApp com espelhamento e preservação avançada.'],
      ['Posso usar vários canais?', 'Sim. A distribuição pode ser escalonada para que cada canal receba ofertas em momentos diferentes.'],
      ['É melhor canal ou grupo?', 'Para achadinhos, canal funciona bem como vitrine; grupo pode continuar como comunidade ou fonte. O ideal é combinar os dois com estratégia.'],
    ],
  },
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function getPreservationCommercialMetadata(pageKey) {
  const page = PRESERVATION_COMMERCIAL_PAGES[pageKey]
  if (!page) return {}
  const ogImage = buildOgImageUrl({ slug: pageKey, cluster: 'canais-preservacao', template: 'commercial-seo' })
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${siteUrl}${page.path}`,
      siteName: 'BOTinho',
      locale: 'pt_BR',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [ogImage],
    },
  }
}

function buildSchemas(page) {
  const pageUrl = `${siteUrl}${page.path}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: pageUrl,
      inLanguage: 'pt-BR',
      about: ['Canais do WhatsApp', 'Afiliados', 'Módulo de Preservação Avançada'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Canais e preservação', item: `${siteUrl}/bot-canais-whatsapp` },
        { '@type': 'ListItem', position: 3, name: page.title, item: pageUrl },
      ],
    },
  ]
}

const s = {
  section: { padding: '56px 0' },
  hero: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 30, alignItems: 'center', padding: '44px 0 64px' },
  h1: { fontSize: 'clamp(40px, 5vw, 68px)', lineHeight: 0.98, letterSpacing: '-0.055em', margin: '18px 0' },
  h2: { fontSize: 'clamp(28px, 3vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.04em', margin: '12px 0 14px' },
  lead: { fontSize: 'clamp(17px, 2vw, 21px)', lineHeight: 1.55, color: 'var(--ink-soft)' },
  small: { fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-soft)' },
  card: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 24, boxShadow: '0 10px 28px rgba(63, 63, 70, 0.04)' },
  softCard: { background: 'color-mix(in oklab, var(--accent) 12%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 },
  ctas: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 },
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <div style={{ maxWidth: 820, marginBottom: 26 }}>
      <span className="pill"><span className="dot" />{eyebrow}</span>
      <h2 style={s.h2}>{title}</h2>
      {body ? <p style={s.lead}>{body}</p> : null}
    </div>
  )
}

export function PreservationCommercialPage({ pageKey }) {
  const page = PRESERVATION_COMMERCIAL_PAGES[pageKey]
  const schemas = buildSchemas(page)
  const trackerRoute = { slug: pageKey, path: page.path, cluster: 'canais-preservacao', intent: page.intent, template: 'commercial-seo' }

  return (
    <div className="landing-root">
      <OrganicPageTracker route={trackerRoute} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      ))}

      <main>
        <section aria-labelledby="page-title">
          <div className="wrap" style={s.hero}>
            <div>
              <span className="pill"><span className="dot" />{page.eyebrow}</span>
              <h1 id="page-title" style={s.h1}>{page.h1}</h1>
              <p style={s.lead}>{page.lead}</p>
              <div style={s.ctas}>
                <Link className="btn btn-accent" href={registerHref} data-seo-cta="commercial_signup" data-cta-position="hero_primary" data-cta-stage="conversion" data-cta-destination="signup">{page.primaryCta}</Link>
                <Link className="btn btn-ghost" href={diagnosticHref} data-seo-cta="commercial_diagnostic" data-cta-position="hero_secondary" data-cta-stage="diagnostic" data-cta-destination="diagnostic">Fazer diagnóstico</Link>
              </div>
            </div>
            <aside style={s.softCard} aria-label="Resumo do Módulo de Preservação Avançada">
              <span className="pill"><span className="dot" />Módulo de Preservação Avançada</span>
              <h2 style={{ ...s.h2, fontSize: 'clamp(24px, 2.5vw, 34px)' }}>Redução de risco sem promessa absoluta.</h2>
              <p style={s.small}>O BOTinho usa cadência, variações, limites, monitoramento e plano de recuperação. Quando falamos de “anti-ban”, é como termo de busca do mercado, não garantia.</p>
            </aside>
          </div>
        </section>

        <section style={s.section}>
          <div className="wrap">
            <SectionHeader eyebrow="Por que importa" title={page.problemTitle} body={page.problem} />
            <div style={s.grid}>
              {page.bullets.map((item) => (
                <div key={item} style={s.card}>
                  <strong style={{ display: 'block', fontSize: 18, marginBottom: 8 }}>{item}</strong>
                  <p style={s.small}>Pensado para afiliados que tratam canal, grupo, chip e audiência como ativos de negócio.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={s.section}>
          <div className="wrap">
            <SectionHeader eyebrow="Como começar" title="Um caminho prático antes de escalar volume." body="A próxima etapa não é postar mais: é estruturar a operação para que cada destino tenha papel, cadência e monitoramento." />
            <ol style={{ ...s.grid, listStyle: 'none', margin: 0, padding: 0 }}>
              {page.process.map((step, index) => (
                <li key={step} style={s.card}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-strong)', color: 'white', fontWeight: 800, marginBottom: 12 }}>{index + 1}</span>
                  <p style={{ ...s.small, color: 'var(--ink)' }}>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section style={s.section}>
          <div className="wrap">
            <div style={{ ...s.softCard, textAlign: 'center' }}>
              <span className="pill"><span className="dot" />Canais + preservação</span>
              <h2 style={{ ...s.h2, marginInline: 'auto', maxWidth: 760 }}>Quer transformar WhatsApp em uma operação menos frágil?</h2>
              <p style={{ ...s.lead, maxWidth: 760, margin: '0 auto' }}>Veja a landing principal da campanha e entenda como grupos, canais e Módulo de Preservação Avançada trabalham juntos.</p>
              <div style={{ ...s.ctas, justifyContent: 'center' }}>
                <Link className="btn btn-accent" href={mainLandingHref} data-seo-cta="commercial_campaign_landing" data-cta-position="final_primary" data-cta-stage="consideration" data-cta-destination="landing">Ver campanha Canais + Preservação</Link>
                <Link className="btn btn-ghost" href={diagnosticHref} data-seo-cta="commercial_diagnostic" data-cta-position="final_secondary" data-cta-stage="diagnostic" data-cta-destination="diagnostic">Diagnosticar minha operação</Link>
              </div>
            </div>
          </div>
        </section>

        <section style={s.section}>
          <div className="wrap">
            <SectionHeader eyebrow="FAQ" title="Dúvidas frequentes antes de configurar." />
            <div style={{ display: 'grid', gap: 14 }}>
              {page.faqs.map(([question, answer]) => (
                <details key={question} style={s.card}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 18 }}>{question}</summary>
                  <p style={{ ...s.small, marginTop: 12 }}>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
