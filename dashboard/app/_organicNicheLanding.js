import Link from 'next/link'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'

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
      title: page.title,
      description: page.description,
      url: `${siteUrl}${page.slug}`,
      siteName: 'BOTinho',
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
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

  return (
    <PublicShell>
      <OrganicPageTracker route={trackerRoute} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <section className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{page.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{page.h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-800">{page.directAnswer}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
            <Link href={`/login?mode=register&utm_source=seo&utm_medium=organic&utm_campaign=organic-marketing-sprint&utm_content=${pageKey}`} data-seo-cta="organic-niche-register" className="rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700">
              Entrar na lista VIP
            </Link>
            <Link href="/conteudos" data-seo-cta="organic-niche-content" className="rounded-xl border border-emerald-200 px-4 py-3 text-emerald-800 hover:bg-emerald-50">
              Ver guias e checklists
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          {page.bullets.map((bullet) => (
            <div key={bullet} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold leading-7 text-gray-800">{bullet}</p>
            </div>
          ))}
        </section>

        {page.affiliateBox && (
          <section className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-7">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">{page.affiliateBox.title}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-sm leading-7 text-gray-800">
              {page.affiliateBox.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        )}

        <section className="mt-8 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-emerald-100">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">{page.processTitle}</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-2">
            {page.process.map((step, index) => (
              <li key={step} className="rounded-2xl bg-emerald-50 p-5 text-sm leading-7 text-gray-800">
                <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-emerald-100">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">FAQ</h2>
            <div className="mt-5 space-y-4">
              {page.faq.map((item) => (
                <div key={item.q} className="rounded-2xl border border-emerald-100 p-5">
                  <h3 className="font-black text-gray-950">{item.q}</h3>
                  <p className="mt-2 text-sm leading-7 text-gray-700">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="rounded-[2rem] bg-emerald-950 p-8 text-white">
            <h2 className="text-2xl font-black tracking-tight">Links internos</h2>
            <p className="mt-3 text-sm leading-7 text-emerald-50">Continue pelo cluster de automação, afiliados e distribuição em grupos.</p>
            <ul className="mt-5 space-y-3">
              <li>
                <Link href="/bot-ofertas-whatsapp" data-seo-cta="organic-niche-parent-hub" className="text-sm font-bold text-emerald-100 underline underline-offset-4 hover:text-white">
                  Hub: bot de ofertas por nicho
                </Link>
              </li>
              {page.internalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} data-seo-cta="organic-niche-internal-link" className="text-sm font-bold text-emerald-100 underline underline-offset-4 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </section>
      </main>
    </PublicShell>
  )
}

export function getOrganicNichePage(key) {
  return pages[key]
}
