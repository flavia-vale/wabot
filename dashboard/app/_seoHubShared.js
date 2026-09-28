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
import { SUPPORTED_STORES } from '@/lib/marketing-content'
import { AUTOMATION_MODELS, BASIC_PRICE_LABEL, PRO_PRICE_LABEL, OUR_MODEL_COVERAGE, buildCompetitorModelRows } from '@/lib/automation-models'

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
  /* AUTOMAÇÃO PARA AFILIADAS — reescrito em 2026-09-27 (PLANO_SEO_GEO, B7).
   *
   * Medido em 27/09: em "bot para afiliados no WhatsApp" Gemini e AI
   * Overviews não nos citam; a Perplexity nos lista em 6º com "lojas
   * suportadas variam" e classifica o mercado em TRÊS modelos — espelhador de
   * grupos, garimpo/curadoria automática e formatador/divulgador. O produto
   * tem os três (fontes em lib/automation-models.js), mas nenhuma página
   * dizia isso com essa palavra. Esta URL (35 impressões, posição 12,6) vira
   * a página canônica da categoria; /melhores-bots-para-afiliados-whatsapp
   * segue no ar (67 impressões, posição 7,5) e aponta para cá como "veja
   * também" — apagar ou redirecionar perderia o histórico.
   *
   * Tabela só com ferramenta que tem FICHA datada em competitors-data.js. O
   * que a ficha não diz fica "—" (não inferir do site do concorrente).
   * Continua sendo hub (HUB_SEO_ROUTES.length === 3 é travado por teste) e
   * continua listando os spokes de dores operacionais. */
  'automacao-whatsapp-afiliados': {
    eyebrow: 'Automação para afiliadas',
    title: 'Automação para afiliados no WhatsApp: 3 modelos, 8 bots',
    description: 'Espelhador de grupos, garimpo automático e formatador: o que cada modelo faz, para quem serve e 8 ferramentas comparadas com preço datado. A partir de R$ 39.',
    intro: `Automação para afiliados no WhatsApp é um software que publica ofertas com o seu código de afiliada nos seus grupos e canais, sem copiar e colar. O mercado se divide em três modelos: espelhador de grupos, garimpo automático e formatador de oferta. O Espelha Grupos tem os três numa conta só, em ${SUPPORTED_STORES.length} lojas, a partir de ${BASIC_PRICE_LABEL} (Basic) ou ${PRO_PRICE_LABEL} (Pro), com 7 dias grátis sem cartão.`,
    promise: 'Para afiliada que divulga em grupos de WhatsApp e quer saber qual modelo de automação resolve o seu caso antes de assinar qualquer ferramenta.',
    checklist: ['Espelhador: republica o que já circula nos grupos que você segue.', 'Garimpo: o robô acha a oferta sozinho por tema e desconto.', 'Formatador: cola o link e a oferta sai montada.'],
    models: {
      title: 'Os 3 modelos de automação, e qual serve para você',
      body: 'Cada modelo resolve um gargalo diferente. Antes de comparar preço, veja em qual deles está o seu trabalho manual de hoje: repassar oferta que já circula, achar oferta nova ou montar a mensagem.',
    },
    toolsTable: {
      title: 'Espelha Grupos e 8 ferramentas do mercado, por modelo',
      body: 'Só entram ferramentas com ficha própria, conferida na página de planos de cada uma na data indicada. Onde a ficha não informa, a célula fica "—": não inferimos do site de ninguém. O comparativo completo de cada uma está no link da linha.',
    },
    seeAlso: {
      title: 'Veja também',
      links: [
        { href: '/melhores-bots-para-afiliados-whatsapp', label: 'Como comparar bots para afiliados no WhatsApp', note: 'Os critérios de avaliação, sem ranking falso.' },
        { href: '/bot-afiliados-whatsapp', label: 'Bot para afiliados no WhatsApp', note: 'O espelhador com conversão em 6 lojas, preço e teste grátis.' },
        { href: '/bot-que-busca-ofertas-shopee-whatsapp', label: 'Bot que busca ofertas da Shopee sozinho', note: 'O garimpo por tema e desconto mínimo, plano Pro.' },
        { href: '/espelhar-grupos-de-ofertas-vale-a-pena', label: 'Espelhar grupos vale a pena?', note: 'Quando compensa e quando não.' },
        { href: '/precos', label: 'Preços e planos', note: 'Basic, Pro e o que entra em cada um.' },
      ],
    },
    plainAnswers: [
      {
        q: 'O que é automação para afiliados no WhatsApp?',
        a: `É um software que publica ofertas com o seu código de afiliada nos seus grupos e canais do WhatsApp sem você copiar e colar. Existem três modelos: o espelhador republica o que aparece nos grupos que você já segue; o garimpo procura a oferta sozinho na loja por tema e desconto; o formatador monta a oferta a partir de um link que você cola. O Espelha Grupos faz os três, em ${SUPPORTED_STORES.length} lojas.`,
      },
      {
        q: 'Qual dos três modelos eu preciso?',
        a: 'Se você já acompanha grupos de ofertas e o seu trabalho é repassar, precisa do espelhador. Se você não segue grupo nenhum e quer um fluxo constante de um tema, precisa do garimpo. Se você escolhe a oferta na mão e só quer ganhar tempo montando a mensagem, o formatador resolve. Muita afiliada usa dois: espelha os grupos que segue e deixa o garimpo preencher os horários vazios.',
      },
      {
        q: 'O Espelha Grupos é espelhador, garimpo ou formatador?',
        a: `Os três, na mesma conta. O espelhamento está no Basic e no Pro, em ${SUPPORTED_STORES.join(', ')}, sem teto de grupos. O garimpo automático está no Pro e hoje é só na Shopee, por palavra-chave e desconto mínimo. O "Criar oferta" a partir de um link está no Basic e no Pro.`,
      },
      {
        q: 'Quanto custa?',
        a: `Sete dias grátis, sem cartão, com o Pro completo. Depois, Basic por ${BASIC_PRICE_LABEL} (espelhamento, conversão de link e criar oferta) ou Pro por ${PRO_PRICE_LABEL} (acrescenta Canais do WhatsApp, garimpo automático da Shopee e filas de envio). Sem fidelidade, cancela pelo painel.`,
      },
      {
        q: 'Preciso de API, n8n ou programação?',
        a: 'Não. Você lê um QR Code como no WhatsApp Web, escolhe os grupos de origem e de destino em duas telas e o robô roda no servidor. Não há integração para montar nem servidor para manter.',
      },
      {
        q: 'Qual ferramenta cobre mais lojas?',
        a: `Pela ficha de cada uma: o Gigi Bot lista 9 lojas no plano gratuito (mas só envia sozinho para o WhatsApp no plano mais caro); a Afilira soma Awin, Terabyte e SHEIN a partir do Professional; o Espelha Grupos converte ${SUPPORTED_STORES.length} lojas desde o plano de entrada, sem cobrar por grupo. A tabela acima mostra loja por loja.`,
      },
      {
        q: 'Automação para afiliados é o mesmo que disparo em massa?',
        a: 'Não. Disparo em massa é enviar a mesma mensagem para muita gente que não pediu. Automação para afiliada publica ofertas nos seus próprios grupos e canais, com intervalo entre envios, limite por destino e histórico. Espelhar em grupo onde você não tem autorização para publicar é problema em qualquer ferramenta.',
      },
    ],
    honesty: {
      pill: 'O que não prometemos',
      title: 'Nenhuma ferramenta controla a decisão do WhatsApp.',
      body: 'Quem garante que você não vai ser bloqueada está vendendo o que não pode entregar. O que existe aqui é controle do que está sob controle: intervalo entre os envios, limite por destino, horários de descanso e variação de texto (Pro). Volume sem contexto aumenta ruído em qualquer modelo dos três.',
    },
  },
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// Tabela dos 3 modelos × ferramentas (hub de automação). Mesmos tokens da
// tabela de preço de _preservationCommercialPages.js.
const hubTable = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14.5, minWidth: 880 },
  th: { textAlign: 'left', padding: '12px 10px', borderBottom: '2px solid var(--line)', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-soft)' },
  td: { padding: '12px 10px', borderTop: '1px solid var(--line)', verticalAlign: 'top', lineHeight: 1.55, color: 'var(--ink)' },
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
  const dates = getEditorialDates(route.path)

  // Fonte única (FR-001): usa o título do módulo quando ele existir, senão
  // cai para o do registry (hubs que ainda não migraram título/descrição pra cá).
  const title = content.title ?? route.title
  const description = content.description ?? route.description
  // Linhas da tabela de ferramentas: lidas da ficha em tempo de render
  // (preço e data nunca digitados aqui).
  const toolRows = content.toolsTable ? buildCompetitorModelRows() : []

  // ItemList das ferramentas comparadas (o hub de automação): a IA extrai a
  // lista com nome e página de comparação de cada uma.
  const toolsItemListJsonLd = toolRows.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: content.toolsTable.title,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: OUR_MODEL_COVERAGE.name, url: `${siteUrl}${OUR_MODEL_COVERAGE.href}` },
          ...toolRows.map((row, index) => ({ '@type': 'ListItem', position: index + 2, name: row.name, url: `${siteUrl}${row.href}` })),
        ],
      }
    : null

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: `${siteUrl}${route.path}`,
    datePublished: dates.publishedAt,
    dateModified: dates.updatedAt,
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
      {toolsItemListJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(toolsItemListJsonLd) }} /> : null}
      <Hero
        eyebrowLabel={content.eyebrow}
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
            updatedAt={dates.updatedAt}
          />
        </div>
      </section>

      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'color-mix(in oklab, var(--accent-3) 50%, var(--surface))', border: '1px solid var(--line)', borderRadius: 28, padding: 36 }}>
            <span className="pill"><span className="dot" />Promessa do hub</span>
            <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.65, color: 'var(--ink)', fontWeight: 500 }}>{content.promise}</p>
            <Link href="/login?mode=register" data-seo-cta="hub-register" className="btn btn-accent" style={{ marginTop: 20 }}>
              Testar 7 dias grátis
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

      {content.models ? (
        <section aria-labelledby="hub-models-title">
          <div className="wrap" style={{ marginTop: 28 }}>
            <span className="pill"><span className="dot" />Os 3 modelos</span>
            <h2 id="hub-models-title" style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, marginTop: 14 }}>{content.models.title}</h2>
            <p style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-soft)', maxWidth: 760 }}>{content.models.body}</p>
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {AUTOMATION_MODELS.map((model) => (
                <article key={model.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 24 }}>
                  <h3 style={{ fontSize: 20, lineHeight: 1.2, margin: 0 }}>{model.name}</h3>
                  <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-soft)' }}>{model.what}</p>
                  <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink)' }}><strong>Melhor para:</strong> {model.bestFor}</p>
                  <p style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink)' }}><strong>Não é ideal para:</strong> {model.notIdealFor}</p>
                  <p style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.65, color: 'var(--ink-soft)' }}><strong style={{ color: 'var(--accent-strong)' }}>No Espelha Grupos:</strong> {model.ours}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {content.toolsTable ? (
        <section aria-labelledby="hub-tools-title">
          <div className="wrap" style={{ marginTop: 28 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Ferramentas com ficha</span>
              <h2 id="hub-tools-title" style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, marginTop: 14 }}>{content.toolsTable.title}</h2>
              <p style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink-soft)', maxWidth: 760 }}>{content.toolsTable.body}</p>
              <div style={{ overflowX: 'auto', marginTop: 20 }}>
                <table style={hubTable.table}>
                  <thead>
                    <tr>
                      <th style={hubTable.th}>Ferramenta</th>
                      <th style={hubTable.th}>Espelhador</th>
                      <th style={hubTable.th}>Garimpo automático</th>
                      <th style={hubTable.th}>Formatador (oferta do link)</th>
                      <th style={hubTable.th}>Lojas</th>
                      <th style={hubTable.th}>Preço de entrada (data da ficha)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={hubTable.td}><strong>{OUR_MODEL_COVERAGE.name}</strong></td>
                      <td style={hubTable.td}>{OUR_MODEL_COVERAGE.espelhador}</td>
                      <td style={hubTable.td}>{OUR_MODEL_COVERAGE.garimpo}</td>
                      <td style={hubTable.td}>{OUR_MODEL_COVERAGE.formatador}</td>
                      <td style={hubTable.td}>{OUR_MODEL_COVERAGE.stores}</td>
                      <td style={hubTable.td}>{OUR_MODEL_COVERAGE.entryPrice}</td>
                    </tr>
                    {toolRows.map((row) => (
                      <tr key={row.slug}>
                        <td style={hubTable.td}><Link href={row.href} data-seo-cta="hub-tool-comparison" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{row.name}</Link></td>
                        <td style={hubTable.td}>{row.espelhador}</td>
                        <td style={hubTable.td}>{row.garimpo}</td>
                        <td style={hubTable.td}>{row.formatador}</td>
                        <td style={hubTable.td}>{row.stores}</td>
                        <td style={hubTable.td}>{row.entryPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                &quot;—&quot; = a ficha da ferramenta não informa. Preço de entrada é o primeiro plano com preço publicado, no valor recorrente, conferido na data entre parênteses; o Shozap não tem preço citado aqui. O Espelha Grupos cobra {BASIC_PRICE_LABEL} no Basic e {PRO_PRICE_LABEL} no Pro, sem cobrar por grupo.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {content.seeAlso ? (
        <section aria-labelledby="hub-see-also-title">
          <div className="wrap" style={{ marginTop: 28 }}>
            <span className="pill"><span className="dot" />{content.seeAlso.title}</span>
            <h2 id="hub-see-also-title" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{content.seeAlso.title}</h2>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {content.seeAlso.links.map((item) => (
                <Link key={item.href} href={item.href} data-seo-cta="hub-see-also" style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '18px 22px', color: 'var(--ink)', textDecoration: 'none' }}>
                  <span style={{ display: 'block', fontSize: 16.5, fontWeight: 600, lineHeight: 1.3 }}>{item.label}</span>
                  <span style={{ display: 'block', marginTop: 8, fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)' }}>{item.note}</span>
                </Link>
              ))}
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
