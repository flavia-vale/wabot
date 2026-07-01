import './landing.css'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { IntroCard, RulesCard } from '@/components/landing/IntroCard'
import { BRAND_NAME, BRAND_SHORT_NAME, PRODUCT_DEFINITION, PRODUCT_LIMITATIONS, CORE_FAQ_ITEMS } from '@/lib/marketing-content'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { AffiliateLandingTracker } from '@/components/marketing/AffiliateLandingTracker'
import { selectHomeHeroVariant } from '@/lib/cro-experiments'
import { sanitizeAttributionValue } from '@/lib/marketing-attribution'

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
  const negatives = PRODUCT_LIMITATIONS.slice(0, 2)
  const positive = PRODUCT_LIMITATIONS[2]
  const rulesLabel = (
    <>Uso responsável · o que o {BRAND_NAME} <em className="serif" style={{ fontStyle: 'italic', textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>não faz</em></>
  )

  return (
    <section id="sobre" aria-labelledby="definicao-botinho">
      <div className="wrap">
        <IntroCard
          id="definicao-botinho"
          eyebrow={BRAND_SHORT_NAME}
          title={<>O que é o <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{BRAND_NAME}?</span></>}
          body={PRODUCT_DEFINITION}
          pills={['Revisão humana', 'Cadência responsável', 'Histórico de logs', 'Grupos de origem & destino']}
        >
          <RulesCard label={rulesLabel} negatives={negatives} positive={positive} />
        </IntroCard>
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


export default async function LandingPage({ searchParams = {} }) {
  const params = await searchParams
  const rawAffiliateCode = Array.isArray(params?.aff) ? params.aff[0] : params?.aff
  const affiliateCode = sanitizeAttributionValue(rawAffiliateCode, 96).toUpperCase()
  const { variant, tone } = selectHomeHeroVariant(params)
  const jsonLd = buildHomeJsonLd()
  return (
    <div className="landing-root">
      <OrganicPageTracker route={{ slug: 'home', path: '/', cluster: 'homepage', intent: 'commercial', template: 'landing', variant }} />
      <AffiliateLandingTracker affiliateCode={affiliateCode} />
      {jsonLd.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <Hero tone={tone} affiliateCode={affiliateCode} />
      <ProductDefinition />
      <How />
      <Features />
      <Social />
      <Pricing affiliateCode={affiliateCode} />
      <FAQ />
      <FinalCTA affiliateCode={affiliateCode} />
      <Footer />
    </div>
  )
}
