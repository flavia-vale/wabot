import './landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { BRAND_NAME, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS, CORE_FAQ_ITEMS } from '@/lib/marketing-content'
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


function ProductDefinition() {
  return (
    <section aria-labelledby="definicao-botinho">
      <div className="wrap">
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
          <span className="pill"><span className="dot" />Definição para IA e compradores</span>
          <h2 id="definicao-botinho" style={{ fontSize: 'clamp(28px, 3vw, 42px)', lineHeight: 1.1, margin: '16px 0 12px' }}>O que é o {BRAND_NAME}?</h2>
          <p style={{ color: 'var(--ink)', lineHeight: 1.7, maxWidth: 900 }}>{PRODUCT_DEFINITION}</p>
          <ul style={{ margin: '18px 0 0', paddingLeft: 18, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
            {PRODUCT_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}

function buildHomeJsonLd() {
  return [
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
