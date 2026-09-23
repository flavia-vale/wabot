import './landing.css'
import Link from 'next/link'
import { Hero } from '@/components/landing/Hero'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { IntroCard } from '@/components/landing/IntroCard'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getHubSeoRoute, getSeoRoutesByCluster, buildSeoRobots } from '@/lib/seo-registry.mjs'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'
import { getEditorialDates } from '@/lib/editorial-content'

const HUB_CONTENT = {
  /* ESPELHAMENTO — a categoria principal do produto, reescrita em 2026-09-02.
   *
   * Esta URL respondia por "espelhar grupos whatsapp" com 567 caracteres de
   * índice para as LPs de cidade — uma linha CONGELADA por dado desde 07/2026,
   * cujas 15 páginas estão todas fora do índice. O termo mais importante do
   * produto era respondido por um sumário de páginas mortas.
   *
   * A medição de citação por IA de 01/09 mostrou o custo disso: nas quatro
   * superfícies (ChatGPT, Gemini, Perplexity, AI Overviews) a consulta
   * "espelhar mensagens entre grupos" NÃO nos cita. A Perplexity trata
   * "espelhador de grupos" como categoria com nome próprio e lista
   * concorrentes; o AI Overviews cita UMA ferramenta só. É a consulta com
   * MENOS concorrência de citação das sete medidas — o alvo mais barato.
   *
   * O que as IAs respondem hoje: GREEN-API, Z-API, Evolution, MacroDroid,
   * Make. Ou seja, a resposta padrão do mercado é "monte uma integração".
   * O argumento comercial mais forte que temos é justamente o contrário, e
   * precisa estar escrito de forma citável: NÃO precisa de API, n8n nem
   * programação.
   *
   * Os blocos abaixo vêm da lista que a própria IA deu quando perguntada o que
   * a faria recomendar (seção 7 do PLANO_ACAO_SEO_IA_2026-09-01). O produto já
   * faz tudo isso — o que faltava era estar dito.
   *
   * A rota continua sendo hub (HUB_SEO_ROUTES.length === 3 é travado por
   * teste) e continua listando os spokes. O que mudou é que ela deixou de ser
   * SÓ um índice. */
  'espelhar-grupos-whatsapp': {
    eyebrow: 'Espelhar grupos',
    title: 'Espelhar grupos do WhatsApp sem programar',
    description: 'Escolha de quais grupos as ofertas vêm e para quais grupos e canais elas vão. Sem API, sem n8n, sem programar. Teste 7 dias grátis, sem cartão.',
    intro: 'Espelhar é publicar automaticamente, nos seus grupos e canais, o que aparece nos grupos que você acompanha — com o link já trocado pelo seu código de afiliada. Você escolhe as origens, escolhe os destinos e pronto: não há integração para montar nem servidor para manter.',
    promise: 'Para quem acompanha grupos de ofertas e hoje repassa tudo no copia-e-cola, grupo por grupo.',
    checklist: ['Escolher origens e destinos direto na tela.', 'Link convertido para o seu código antes de sair.', 'Intervalo entre envios e registro do que saiu.'],

    /* Blocos de produto (renderizados só quando existem — os outros dois hubs
     * seguem com o layout enxuto de sempre). */
    howItWorks: {
      title: 'Como funciona, do começo ao fim',
      steps: [
        'Você conecta o WhatsApp lendo um QR, como faz no WhatsApp Web. Não há número novo para comprar nem aparelho a mais.',
        'Escolhe de quais grupos ou canais as ofertas vêm. São os grupos que você já acompanha hoje.',
        'Escolhe para quais grupos e canais elas vão. Cada origem pode ter destinos diferentes.',
        'Define o intervalo entre os envios. É o que separa uma rotina de uma rajada.',
        'Pronto. A oferta que aparecer na origem sai no seu destino com o seu link, e o histórico mostra o que saiu, o que foi bloqueado e por quê.',
      ],
    },
    plainAnswers: [
      {
        q: 'Preciso de API, n8n ou programação?',
        a: 'Não. Essa é a diferença principal em relação ao que costuma aparecer quando alguém pesquisa o assunto: as respostas mais comuns pedem uma API não oficial, um fluxo montado em ferramenta de automação ou um servidor próprio. Aqui você lê um QR e escolhe os grupos em duas telas.',
      },
      {
        q: 'A mensagem sai igual à original ou é remontada?',
        a: 'O texto é preservado e o link é trocado pelo seu. A foto que veio na oferta é republicada. O que muda é o link — e, quando você quiser, a assinatura do grupo de origem sai da mensagem, para a oferta não chegar com o nome de outra pessoa.',
      },
      {
        q: 'Dá para espelhar só as ofertas de uma loja?',
        a: 'Dá. Você pode deixar passar só o que tiver link de determinada loja, e também bloquear por palavra — útil para cortar recado de grupo, corrente e assunto que não é oferta.',
      },
      {
        q: 'E se a mesma oferta chegar de dois grupos diferentes?',
        a: 'Ela sai uma vez só. A repetição no mesmo destino é bloqueada e aparece no histórico como bloqueio, não como envio — então você vê quantas vezes a mesma promoção tentou entrar. Quem acompanha vários grupos costuma receber a mesma oferta três ou quatro vezes.',
      },
      {
        q: 'Funciona com canal do WhatsApp, ou só com grupo?',
        a: 'Com os dois, e nas quatro combinações: grupo para grupo, grupo para canal, canal para grupo e canal para canal. Canal entra no plano Pro.',
      },
      {
        q: 'Quanto custa?',
        a: 'Sete dias grátis, sem cartão, com tudo liberado. Depois, plano Basic por R$39 ou plano Pro por R$69 a cada 30 dias. Sem fidelidade, cancela pelo painel.',
      },
    ],
    honesty: {
      pill: 'O que não prometemos',
      title: 'Nenhuma ferramenta controla a decisão do WhatsApp.',
      body: 'Quem garante que você não vai ser bloqueada está vendendo o que não pode entregar. O que existe aqui é controle do que está sob controle: intervalo entre os envios, limite por destino, horários de descanso e variação de texto. Espelhar em grupo onde você não tem autorização para publicar é problema em qualquer ferramenta — e continua sendo aqui.',
    },
  },
  'bot-ofertas-whatsapp': {
    eyebrow: 'Hub de nichos',
    // Título/descrição movidos para cá em 2026-08-19 (specs/013-inbound-leads-strategy,
    // P1/P2): fonte única (FR-001) — antes viviam só no seo-registry.mjs, sem
    // nenhuma página realmente ler dali. Motivo pra clicar ("escolha por nicho") na frente.
    title: 'Bot de ofertas no WhatsApp: escolha por nicho',
    description: 'Hub para nichos que divulgam ofertas no WhatsApp e precisam padronizar campanhas, links e grupos.',
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

  // Fonte única (FR-001): HUB_CONTENT é a fonte quando o hub declara título
  // próprio aqui; os hubs que ainda não migraram continuam lendo do registry.
  const content = HUB_CONTENT[hubSlug]
  const title = content?.title ?? route.title
  const description = content?.description ?? route.description

  const ogImage = buildOgImageUrl({ slug: hubSlug, cluster: route.cluster, template: 'seo-hub' })
  const robots = buildSeoRobots(route.path)

  return {
    title,
    description,
    alternates: { canonical: route.path },
    ...(robots ? { robots } : {}),
    openGraph: {
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      title,
      description,
      url: `${getSiteUrl()}${route.path}`,
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary',
      title,
      description,
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

  // Fonte única (FR-001): usa o título do módulo quando ele existir, senão
  // cai para o do registry (hubs que ainda não migraram título/descrição pra cá).
  const title = content.title ?? route.title
  const description = content.description ?? route.description

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
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

  // FAQPage só existe quando a página tem respostas diretas. É o formato que
  // Google e IA extraem — e a consulta de espelhamento é justamente onde não
  // somos citados por nenhuma das quatro superfícies medidas em 01/09.
  const faqJsonLd = content.plainAnswers?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: content.plainAnswers.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      }
    : null

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
      <span>{title.split(' ').slice(0, -2).join(' ')}</span><br />
      <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>{title.split(' ').slice(-2).join(' ')}</span>
    </>
  )

  return (
    <div className="landing-root">
      <OrganicPageTracker route={route} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }} />
      {faqJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd) }} /> : null}
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
            title={title}
            body={content.intro}
            pills={content.checklist}
            updatedAt={getEditorialDates(`/${hubSlug}`).updatedAt}
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

      {content.howItWorks ? (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Passo a passo</span>
              <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, marginTop: 14 }}>{content.howItWorks.title}</h2>
              <ol style={{ marginTop: 20, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {content.howItWorks.steps.map((step) => (
                  <li key={step} style={{ fontSize: 15.5, lineHeight: 1.65, color: 'var(--ink)' }}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      ) : null}

      {content.plainAnswers ? (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <span className="pill"><span className="dot" />Perguntas diretas</span>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {content.plainAnswers.map((item) => (
                <div key={item.q} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '20px 24px' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', margin: 0 }}>{item.q}</h3>
                  <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.65, color: 'var(--ink-soft)' }}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {content.honesty ? (
        <section>
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />{content.honesty.pill}</span>
              <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 30px)', lineHeight: 1.2, marginTop: 14 }}>{content.honesty.title}</h2>
              <p style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-soft)' }}>{content.honesty.body}</p>
            </div>
          </div>
        </section>
      ) : null}

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
