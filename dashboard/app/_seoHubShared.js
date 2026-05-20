import './landing.css'
import Link from 'next/link'
import { Hero } from '@/components/landing/Hero'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { IntroCard } from '@/components/landing/IntroCard'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getHubSeoRoute, getSeoRoutesByCluster } from '@/lib/seo-registry.mjs'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'

const HUB_CONTENT = {
  'espelhar-grupos-whatsapp': {
    eyebrow: 'Hub de localizações',
    intro: 'Compare rotinas regionais antes de criar novas campanhas. O objetivo é escolher grupos, horários e cadência por cidade sem transformar automação em disparo indiscriminado.',
    promise: 'Ideal para operações que têm grupos em várias cidades ou querem sair do copia-e-cola regional.',
    checklist: ['Separar grupos por cidade, região e perfil de compra.', 'Definir janelas de postagem para evitar repetição excessiva.', 'Validar preço, estoque e link antes de escalar a mensagem.'],
  },
  'bot-ofertas-whatsapp': {
    eyebrow: 'Hub de nichos',
    intro: 'Use este hub para adaptar a divulgação de ofertas ao calendário comercial de cada nicho, com copy, link, plataforma e revisão adequados antes da automação.',
    promise: 'Ideal para afiliados, curadores e admins que publicam ofertas por categoria.',
    checklist: ['Criar checklist de validação por nicho.', 'Padronizar benefício, preço, validade e CTA da oferta.', 'Medir quais categorias justificam mais frequência.'],
  },
  'automacao-whatsapp-afiliados': {
    eyebrow: 'Hub de dores operacionais',
    intro: 'Diagnostique gargalos de escala, consistência, tempo operacional e rastreamento antes de automatizar. A automação deve ampliar um processo correto, não esconder falhas.',
    promise: 'Ideal para quem já divulga em grupos e quer transformar esforço manual em rotina controlada.',
    checklist: ['Identificar o gargalo principal antes de configurar automação.', 'Acompanhar logs, falhas e aprendizados por campanha.', 'Escalar apenas grupos permitidos e com mensagens relevantes.'],
  },
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function getSeoHubMetadata(hubSlug) {
  const route = getHubSeoRoute(`/${hubSlug}`)
  if (!route) return {}

  const ogImage = buildOgImageUrl({ slug: hubSlug, cluster: route.cluster, template: 'seo-hub' })

  return {
    title: route.title,
    description: route.description,
    alternates: { canonical: route.path },
    openGraph: {
      images: [{ url: ogImage, width: 1200, height: 630, alt: route.title }],
      title: route.title,
      description: route.description,
      url: `${getSiteUrl()}${route.path}`,
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary',
      title: route.title,
      description: route.description,
      images: [ogImage],
    },
  }
}

export function SeoHubPage({ hubSlug }) {
  const route = getHubSeoRoute(`/${hubSlug}`)
  const content = HUB_CONTENT[hubSlug]
  const spokes = route ? getSeoRoutesByCluster(route.cluster) : []
  const siteUrl = getSiteUrl()

  if (!route || !content) return null

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: route.title,
    description: route.description,
    url: `${siteUrl}${route.path}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: spokes.map((spoke, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: spoke.label,
        url: `${siteUrl}${spoke.path}`,
      })),
    },
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: spokes.map((spoke, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: spoke.label,
      url: `${siteUrl}${spoke.path}`,
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: route.label, item: `${siteUrl}${route.path}` },
    ],
  }

  const headline = (
    <>
      <span>{route.title.split(' ').slice(0, -2).join(' ')}</span><br />
      <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{route.title.split(' ').slice(-2).join(' ')}</span>
    </>
  )

  return (
    <div className="landing-root">
      <OrganicPageTracker route={route} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }} />
      <Hero
        eyebrowLabel={content.eyebrow}
        primaryCtaLabel="Entrar na Lista VIP"
        headlineOverride={headline}
        subOverride={content.intro}
        heroStyle={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-3) 42%, white), transparent)', borderRadius: 24, paddingInline: 20 }}
      />

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <IntroCard
            eyebrow={content.eyebrow}
            title={route.title}
            body={content.intro}
            pills={content.checklist}
          />
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'color-mix(in oklab, var(--accent-3) 50%, var(--surface))', border: '1px solid var(--line)', borderRadius: 28, padding: 36 }}>
            <span className="pill"><span className="dot" />Promessa do hub</span>
            <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.65, color: 'var(--ink)', fontWeight: 500 }}>{content.promise}</p>
            <Link href="/login?mode=register" data-seo-cta="hub-register" className="btn btn-accent" style={{ marginTop: 20 }}>
              Entrar na Lista VIP
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <span className="pill"><span className="dot" />Spokes do hub</span>
                <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, marginTop: 14 }}>Páginas relacionadas</h2>
              </div>
              <Link href="/conteudos" data-seo-cta="hub-content-center" className="btn btn-ghost">Ver central de conteúdos</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {spokes.map((spoke) => (
                <Link
                  key={spoke.path}
                  href={spoke.path}
                  data-seo-cta="hub-spoke"
                  style={{
                    display: 'block',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 24,
                    padding: 28,
                    color: 'var(--ink)',
                    textDecoration: 'none',
                    transition: 'background 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  <span className="mono" style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 500, color: 'var(--accent-strong)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{spoke.template}</span>
                  <span style={{ display: 'block', marginTop: 12, fontSize: 18, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{spoke.label}</span>
                  <span style={{ display: 'block', marginTop: 10, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)' }}>Intenção: {spoke.intent}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <FinalCTA />
      <Footer />
    </div>
  )
}
