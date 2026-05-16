import './landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { Icon } from '@/components/landing/Icon'
import { BRAND_NAME, BRAND_SHORT_NAME, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS, CORE_FAQ_ITEMS } from '@/lib/marketing-content'
import { getSiteUrl } from '@/lib/site-url'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { selectHomeHeroVariant } from '@/lib/cro-experiments'

export const metadata = {
  title: 'BOTinho | Bot para Afiliados no WhatsApp',
  description: PRODUCT_DEFINITION,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'BOTinho | Bot para Afiliados no WhatsApp',
    description: PRODUCT_DEFINITION,
    url: '/',
  },
}


const productDefStyles = {
  wrap: { display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 32, alignItems: 'stretch' },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 28,
    padding: 40,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 },
  brandMark: {
    width: 48, height: 48, borderRadius: 14,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 20,
    boxShadow: '0 6px 16px -4px color-mix(in oklab, var(--accent-strong) 50%, transparent)',
    flexShrink: 0,
  },
  brandName: { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' },
  brandTitle: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2 },
  body: { fontSize: 16, lineHeight: 1.6, color: 'var(--ink)', maxWidth: 560, margin: 0 },
  rulesCard: {
    background: 'color-mix(in oklab, var(--accent-3) 50%, var(--surface))',
    border: '1px solid var(--line)',
    borderRadius: 28,
    padding: 36,
  },
  rulesLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 18 },
  iconNo: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'color-mix(in oklab, #D97757 18%, var(--surface))',
    color: '#C77758',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
    transform: 'rotate(45deg)',
  },
  iconCheck: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'color-mix(in oklab, var(--accent) 26%, var(--surface))',
    color: 'var(--accent-strong)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  ruleText: { fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' },
}

function ProductDefinition() {
  const negatives = PRODUCT_LIMITATIONS.slice(0, 2)
  const positive = PRODUCT_LIMITATIONS[2]

  return (
    <section id="sobre" aria-labelledby="definicao-botinho">
      <div className="wrap">
        <div style={productDefStyles.wrap} className="landing-about-wrap">
          <div style={productDefStyles.card}>
            <div aria-hidden style={{
              position: 'absolute', top: -80, right: -80,
              width: 260, height: 260, borderRadius: '50%',
              background: 'radial-gradient(circle, color-mix(in oklab, var(--accent-2) 70%, transparent), transparent 65%)',
              filter: 'blur(20px)', pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={productDefStyles.brand}>
                <div style={productDefStyles.brandMark}>b</div>
                <div>
                  <div style={productDefStyles.brandName}>{BRAND_SHORT_NAME}</div>
                  <h2 id="definicao-botinho" style={productDefStyles.brandTitle}>
                    O que é o <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{BRAND_NAME}?</span>
                  </h2>
                </div>
              </div>
              <p style={productDefStyles.body}>{PRODUCT_DEFINITION}</p>
              <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Revisão humana', 'Cadência responsável', 'Histórico de logs', 'Grupos de origem & destino'].map((tag) => (
                  <span key={tag} className="pill">{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={productDefStyles.rulesCard}>
            <div style={productDefStyles.rulesLabel}>
              Uso responsável · o que o {BRAND_NAME} <em className="serif" style={{ fontStyle: 'italic', textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>não faz</em>
            </div>
            {negatives.map((item, idx) => (
              <div key={item} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0', borderBottom: idx === negatives.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <div style={productDefStyles.iconNo}><Icon name="plus" size={12} /></div>
                <div style={productDefStyles.ruleText}>{item}</div>
              </div>
            ))}
            {positive && (
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 0 0', borderTop: '1px solid var(--line)' }}>
                <div style={productDefStyles.iconCheck}><Icon name="check" size={12} /></div>
                <div style={productDefStyles.ruleText}>{positive}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function buildHomeJsonLd() {
  const siteUrl = getSiteUrl()
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: BRAND_NAME,
      alternateName: ['Espelha Grupos'],
      url: siteUrl,
      logo: `${siteUrl}/botinho-logo.svg`,
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', url: `${siteUrl}/suporte` }],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: BRAND_NAME,
      alternateName: ['Espelha Grupos'],
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: siteUrl,
      description: PRODUCT_DEFINITION,
      offers: DEFAULT_LANDING_PLANS.map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        priceCurrency: 'BRL',
        price: String(plan.priceValue),
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/login?mode=register`,
        description: `${plan.desc} Período: ${plan.period}.`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: CORE_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ]
}

export default function LandingPage({ searchParams = {} }) {
  const { variant, tone } = selectHomeHeroVariant(searchParams)
  const jsonLd = buildHomeJsonLd()
  return (
    <div className="landing-root">
      <OrganicPageTracker route={{ slug: 'home', path: '/', cluster: 'homepage', intent: 'commercial', template: 'landing', variant }} />
      {jsonLd.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <Hero tone={tone} />
      <ProductDefinition />
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
