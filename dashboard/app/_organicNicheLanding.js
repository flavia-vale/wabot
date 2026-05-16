import './landing.css'
import Link from 'next/link'
import { Hero } from '@/components/landing/Hero'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'

const pages = {
  'bot-ofertas-restaurantes-whatsapp': {
    slug: '/bot-ofertas-restaurantes-whatsapp',
    title: 'Bot de ofertas para restaurantes no WhatsApp | BOTinho',
    description: 'Organize divulgação de ofertas de restaurantes no WhatsApp com curadoria, calendário, grupos certos e automação responsável.',
    eyebrow: 'Nicho restaurantes',
    h1: 'Bot de ofertas para restaurantes no WhatsApp',
    directAnswer: 'Um bot de ofertas para restaurantes no WhatsApp ajuda a transformar promoções de delivery, combos, cupons e horários de baixa demanda em uma rotina de divulgação organizada: você valida a oferta, define os grupos certos e usa automação para distribuir com cadência sem depender de copia-e-cola manual.',
    primaryKeyword: 'bot ofertas restaurantes whatsapp',
    bullets: [
      'Calendário para almoço, jantar, fim de semana e campanhas sazonais.',
      'Padronização de copy com preço, condição, validade e CTA claro.',
      'Distribuição em grupos com intervalo para evitar repetição excessiva.',
    ],
    processTitle: 'Fluxo recomendado para restaurantes',
    process: [
      'Conferir se a oferta ainda está ativa, com preço e disponibilidade corretos.',
      'Separar grupos por região, perfil de compra e momento de consumo.',
      'Padronizar a mensagem com benefício direto, validade e instrução de pedido.',
      'Automatizar a distribuição no BOTinho mantendo revisão humana das campanhas.',
      'Registrar cliques, pedidos informados e aprendizados para ajustar os próximos envios.',
    ],
    affiliateBox: null,
    internalLinks: [
      { href: '/automatizar-divulgacao-em-grupos-whatsapp', label: 'Automatizar divulgação em grupos WhatsApp' },
      { href: '/organizar-calendario-de-ofertas-no-whatsapp', label: 'Organizar calendário de ofertas' },
      { href: '/melhorar-alcance-em-grupos-de-promocoes', label: 'Melhorar alcance em grupos de promoções' },
      { href: '/conteudos', label: 'Central de conteúdos' },
    ],
    faq: [
      { q: 'Restaurante precisa revisar cada oferta antes de automatizar?', a: 'Sim. A automação deve começar depois da validação de preço, disponibilidade, área de entrega, horário e regra do cupom.' },
      { q: 'O BOTinho substitui a estratégia comercial do restaurante?', a: 'Não. Ele apoia a rotina de distribuição e padronização; a curadoria da oferta e os claims comerciais continuam sob responsabilidade humana.' },
      { q: 'Posso divulgar em vários grupos ao mesmo tempo?', a: 'A recomendação é distribuir com cadência, segmentação e respeito às regras de cada grupo para evitar excesso de repetição.' },
    ],
    social: {
      linkedin: 'Restaurante não precisa depender de lembrete manual para divulgar combo, cupom e promoção de horário fraco. Primeiro valide oferta e região; depois automatize a distribuição com cadência.',
      instagram: 'Promo de restaurante sem processo vira esquecimento. Oferta validada + grupo certo + cadência = rotina de divulgação melhor.',
      utm: 'http://espelhagrupos.com.br/bot-ofertas-restaurantes-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-botinho&utm_content=nicho-restaurantes',
    },
  },
  'bot-ofertas-marketplace-whatsapp': {
    slug: '/bot-ofertas-marketplace-whatsapp',
    title: 'Bot de ofertas para marketplace no WhatsApp | BOTinho',
    description: 'Padronize ofertas de marketplace no WhatsApp com conferência de link monetizado, tag de afiliado, copy e distribuição em grupos.',
    eyebrow: 'Marketplace e afiliados',
    h1: 'Bot de ofertas para marketplace no WhatsApp',
    directAnswer: 'Um bot de ofertas para marketplace no WhatsApp deve entrar depois da conferência do link monetizado: a operação valida se a tag ou código de afiliado continua no destino final, confirma preço e estoque, padroniza a copy e só então automatiza a distribuição em grupos para reduzir erro e perda de comissão.',
    primaryKeyword: 'bot ofertas marketplace whatsapp',
    bullets: [
      'Conferência de link monetizado, tag/código e redirecionamentos antes do envio.',
      'Copy com preço, cupom, prazo e alerta de estoque sem prometer condição não verificada.',
      'Automação de espelhamento/distribuição para manter frequência sem aumentar equipe.',
    ],
    processTitle: 'Fluxo seguro para ofertas de marketplace',
    process: [
      'Abrir o link no celular e confirmar se o destino final mantém a tag ou código de afiliado correto.',
      'Validar preço, frete, cupom, estoque e prazo antes de aprovar a mensagem.',
      'Registrar a versão aprovada da copy e evitar alterar parâmetros monetizados por engano.',
      'Distribuir nos grupos certos com intervalo e contexto, sem prometer integração não aprovada com marketplaces.',
      'Acompanhar logs e resultados para ajustar categorias, horários e grupos prioritários.',
    ],
    affiliateBox: {
      title: 'Atenção ao link de afiliado',
      items: [
        'O link monetizado precisa manter tag, código ou parâmetro de afiliado após redirecionamentos.',
        'Link encurtado, copiado errado ou sem tag pode fazer a comissão ser atribuída a outra origem ou simplesmente não ser registrada.',
        'Esta página descreve processo operacional de conferência e distribuição; não promete integração oficial não aprovada com Amazon, Mercado Livre, Shopee ou qualquer marketplace.',
      ],
    },
    internalLinks: [
      { href: '/bot-ofertas-afiliados-whatsapp', label: 'Bot de ofertas para afiliados' },
      { href: '/blog/conferir-converter-link-afiliado-whatsapp', label: 'Conferir e converter link de afiliado' },
      { href: '/padronizar-divulgacao-afiliado-whatsapp', label: 'Padronizar divulgação de afiliado' },
      { href: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', label: 'Checklist de divulgação de ofertas' },
    ],
    faq: [
      { q: 'O bot garante comissão em marketplaces?', a: 'Não. A comissão depende das regras do programa e do link correto. O BOTinho ajuda a padronizar conferência, copy e distribuição.' },
      { q: 'Como reduzir o risco de perder comissão?', a: 'Valide o link monetizado no celular, confira tag/código no destino final, teste redirecionamentos e não remova parâmetros antes de divulgar.' },
      { q: 'Existe promessa de integração oficial com marketplaces?', a: 'Não. O conteúdo fala de processo operacional e não promete integração não aprovada com plataformas externas.' },
    ],
    social: {
      linkedin: 'Marketplace exige velocidade, mas afiliado não pode pular conferência. Link monetizado, tag, preço e estoque vêm antes da automação em grupos.',
      instagram: 'Link sem tag = risco de comissão perdida. Confere primeiro. Automatiza depois.',
      utm: 'http://espelhagrupos.com.br/bot-ofertas-marketplace-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=prelaunch-botinho&utm_content=nicho-marketplace',
    },
  },
}

export function getOrganicNicheMetadata(key) {
  const page = pages[key]
  const siteUrl = getSiteUrl()

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.slug },
    openGraph: {
      images: [{ url: buildOgImageUrl({ slug: page.slug.replace(/^\//, ''), cluster: 'nichos', template: 'organic-niche' }), width: 1200, height: 630, alt: page.title }],
      title: page.title,
      description: page.description,
      url: `${siteUrl}${page.slug}`,
      siteName: 'BOTinho',
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      images: [buildOgImageUrl({ slug: page.slug.replace(/^\//, ''), cluster: 'nichos', template: 'organic-niche' })],
      title: page.title,
      description: page.description,
    },
  }
}

function buildSchema(page) {
  const siteUrl = getSiteUrl()
  const url = `${siteUrl}${page.slug}`

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.h1,
      description: page.description,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'BOTinho' },
      publisher: { '@type': 'Organization', name: 'BOTinho', logo: { '@type': 'ImageObject', url: `${siteUrl}/botinho-logo.svg` } },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: page.h1, item: url },
      ],
    },
  ]
}

export function OrganicNicheLanding({ pageKey }) {
  const page = pages[pageKey]
  const schemas = buildSchema(page)
  const trackerRoute = { slug: pageKey, path: page.slug, cluster: 'nichos', intent: page.primaryKeyword, template: 'organic-niche' }
  const registerHref = `/login?mode=register&utm_source=seo&utm_medium=organic&utm_campaign=organic-marketing-sprint&utm_content=${pageKey}`

  const headline = (
    <>
      <span>{page.h1.split(' ').slice(0, -2).join(' ')}</span><br />
      <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{page.h1.split(' ').slice(-2).join(' ')}</span>
    </>
  )

  return (
    <div className="landing-root">
      <OrganicPageTracker route={trackerRoute} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <Hero
        eyebrowLabel={page.eyebrow}
        primaryCtaLabel="Entrar na Lista VIP"
        headlineOverride={headline}
        subOverride={page.directAnswer}
        heroStyle={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-3) 50%, var(--surface)), transparent)', borderRadius: 24, paddingInline: 20 }}
      />

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {page.bullets.map((bullet) => (
              <div key={bullet} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
                <span className="pill"><span className="dot" />Critério</span>
                <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6, color: 'var(--ink)' }}>{bullet}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {page.affiliateBox && (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'color-mix(in oklab, var(--accent-2) 24%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Atenção</span>
              <h2 style={{ fontSize: 'clamp(24px, 2.4vw, 32px)', lineHeight: 1.15, margin: '14px 0 14px' }}>{page.affiliateBox.title}</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.65 }}>
                {page.affiliateBox.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Processo</span>
            <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', lineHeight: 1.12, margin: '14px 0 18px' }}>{page.processTitle}</h2>
            <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, listStyle: 'none', margin: 0, padding: 0, counterReset: 'step' }}>
              {page.process.map((step, index) => (
                <li key={step} style={{ background: 'color-mix(in oklab, var(--accent) 14%, var(--surface))', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-strong)', color: 'white', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{index + 1}</span>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)' }}>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20, alignItems: 'flex-start' }} className="landing-faq-wrap">
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
            <aside style={{ background: 'color-mix(in oklab, var(--accent) 22%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Links internos</span>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: '14px 0 14px', letterSpacing: '-0.01em' }}>Continue pelo cluster</h2>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li>
                  <Link href="/bot-ofertas-whatsapp" data-seo-cta="organic-niche-parent-hub" style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 14.5, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                    Hub: bot de ofertas por nicho
                  </Link>
                </li>
                {page.internalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} data-seo-cta="organic-niche-internal-link" style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 14.5, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={registerHref} data-seo-cta="organic-niche-register" className="btn btn-accent" style={{ marginTop: 20 }}>
                Entrar na Lista VIP
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <FinalCTA />
      <Footer />
    </div>
  )
}

export function getOrganicNichePage(key) {
  return pages[key]
}
