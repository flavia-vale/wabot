import '../app/landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME, BRAND_SHORT_NAME, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION } from '@/lib/marketing-content'

import { LP_CONFIG, getLpType } from '@/lib/lp-config.mjs'

export { LP_CONFIG }

const LP_TYPE_THEME = {
  city: {
    badge: 'Operação por cidade',
    tone: 'direto',
    eyebrow: 'Modo Cidade',
    panelBg: 'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-strong) 35%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-3) 42%, white), transparent)',
  },
  niche: {
    badge: 'Operação por nicho',
    tone: 'animado',
    eyebrow: 'Modo Nicho',
    panelBg: 'color-mix(in oklab, var(--accent-3) 50%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-2) 30%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 24%, white), transparent)',
  },
  pain: {
    badge: 'Operação por dor',
    tone: 'direto',
    eyebrow: 'Modo Diagnóstico',
    panelBg: 'color-mix(in oklab, var(--accent-2) 18%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-strong) 28%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-2) 18%, white), transparent)',
  },
  default: {
    badge: 'Operação programática',
    tone: 'amigavel',
    eyebrow: 'Experimente grátis!',
    panelBg: 'var(--surface)',
    panelBorder: 'var(--line)',
    heroBg: 'transparent',
  },
}


function getHeroCopy(cfg, lpType) {
  if (lpType === 'city') {
    return {
      headline: <><span>Escala local com execução</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>consistente todo dia.</span></>,
      sub: `${cfg.description} Fluxo pensado para operação regional com menor retrabalho.`,
    }
  }
  if (lpType === 'niche') {
    return {
      headline: <><span>Seu nicho com campanhas</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>mais rápidas e previsíveis.</span></>,
      sub: `${cfg.description} Estruture rotinas por categoria e publique com frequência sem sobrecarga manual.`,
    }
  }
  if (lpType === 'pain') {
    return {
      headline: <><span>Resolva gargalos da operação</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>com automação de grupos.</span></>,
      sub: `${cfg.description} Diagnóstico prático, rotina com o ${BRAND_SHORT_NAME} e métricas para evoluir sem depender de esforço manual.`,
    }
  }
  return {
    headline: null,
    sub: null,
  }
}

export function getLpMetadata(slug) {
  const cfg = LP_CONFIG[slug]
  if (!cfg) return {}

  const siteUrl = getSiteUrl()
  const canonicalUrl = `${siteUrl}/${slug}`

  return {
    title: cfg.title,
    description: cfg.description,
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title: cfg.title,
      description: cfg.description,
      url: canonicalUrl,
      siteName: BRAND_NAME,
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: cfg.title,
      description: cfg.description,
    },
  }
}

export function LpTemplate({ slug }) {
  const cfg = LP_CONFIG[slug]
  const lpType = getLpType(slug, cfg)
  const theme = LP_TYPE_THEME[lpType] ?? LP_TYPE_THEME.default
  const heroCopy = getHeroCopy(cfg, lpType)
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: cfg.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) }
  const howToJsonLd = { '@context': 'https://schema.org', '@type': 'HowTo', name: `Como configurar ${cfg.title.replace(' | BOTinho', '')}`, step: cfg.howTo.map((text, index) => ({ '@type': 'HowToStep', name: `Passo ${index + 1}`, text })) }
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND_NAME,
    alternateName: ['Espelha Grupos'],
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: `${cfg.description} ${PRODUCT_DEFINITION}`,
    image: [`${getSiteUrl()}/botinho-logo.svg`],
    brand: { '@type': 'Brand', name: BRAND_SHORT_NAME },
    offers: DEFAULT_LANDING_PLANS.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      url: `${getSiteUrl()}/login?mode=register`,
      priceCurrency: 'BRL',
      price: String(plan.priceValue),
      availability: 'https://schema.org/InStock',
      category: 'SoftwareSubscription',
      description: `${plan.desc} Período: ${plan.period}.`,
    })),
  }
  const breadcrumbJsonLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: getSiteUrl() }, { '@type': 'ListItem', position: 2, name: cfg.title.replace(' | BOTinho', ''), item: `${getSiteUrl()}/${slug}` }] }

  return (
    <div className="landing-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      {lpType === 'pain' && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />}
      <Hero
        tone={theme.tone}
        primaryCtaLabel="Entrar na Lista VIP"
        eyebrowLabel={theme.eyebrow}
        headlineOverride={heroCopy.headline}
        subOverride={heroCopy.sub}
        heroStyle={{ background: theme.heroBg, borderRadius: 24, paddingInline: 20 }}
      />
      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: theme.panelBg, border: `1px solid ${theme.panelBorder}`, borderRadius: 24, padding: '28px 28px 22px', boxShadow: 'var(--shadow-soft)' }}>
            <span className="pill" style={{ marginBottom: 12 }}><span className="dot" />{BRAND_NAME} · {theme.badge}</span>
            <h2 style={{ fontSize: 'clamp(28px, 3vw, 42px)', lineHeight: 1.1, marginBottom: 10 }}>{cfg.uniqueHeadline}</h2>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 14 }}>{cfg.uniqueBody}</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
              {cfg.uniqueBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          </div>
        </div>
      </section>
      <section aria-labelledby={`como-configurar-${slug}`}>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '28px 28px 22px', boxShadow: 'var(--shadow-soft)' }}>
            <span className="pill" style={{ marginBottom: 12 }}><span className="dot" />Passo a passo</span>
            <h2 id={`como-configurar-${slug}`} style={{ fontSize: 'clamp(26px, 2.6vw, 38px)', lineHeight: 1.1, marginBottom: 10 }}>Como configurar essa rotina no {BRAND_NAME}</h2>
            <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', lineHeight: 1.7 }}>
              {cfg.howTo.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        </div>
      </section>
      <How />
      <Features />
      <Social />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
