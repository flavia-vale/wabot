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
const checklistHref = '/materiais/checklist-antiban-whatsapp?utm_source=seo&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=commercial_checklist'
const riskCalculatorHref = '/ferramentas/calculadora-risco-whatsapp?utm_source=seo&utm_medium=organic&utm_campaign=canais-preservacao&utm_content=commercial_calculadora_risco'

export const PRESERVATION_COMMERCIAL_PAGES = {
  'bot-afiliados-whatsapp': {
    path: '/bot-afiliados-whatsapp',
    title: 'Bot para Afiliados no WhatsApp: Shopee, Amazon e Mercado Livre',
    description: 'Converta links de afiliado da Shopee, Amazon, Mercado Livre e Magalu e publique as ofertas nos seus grupos e Canais do WhatsApp automaticamente. Teste grátis por 7 dias.',
    eyebrow: 'Bot para afiliados',
    h1: 'Bot para afiliados no WhatsApp que converte seus links automaticamente',
    lead: 'Um bot para afiliados no WhatsApp monitora grupos de origem, converte cada link de produto ou cupom para o seu código de afiliado e republica a oferta nos seus grupos e canais. O BOTinho faz isso com Shopee, Amazon, Mercado Livre e Magalu, com intervalos controlados e histórico de envio.',
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
    title: 'Bot para Achadinhos no WhatsApp: automatize seus grupos de ofertas',
    description: 'Automatize seu grupo de achadinhos no WhatsApp: o bot captura as ofertas, troca o link pelo seu código de afiliado e publica sozinho nos seus grupos e canais. Teste grátis por 7 dias.',
    eyebrow: 'Bot para achadinhos',
    h1: 'Bot para achadinhos no WhatsApp: as ofertas saem sozinhas',
    lead: 'Um bot de achadinhos acompanha os grupos onde as promoções aparecem primeiro, troca o link pelo seu código de afiliado e publica a oferta nos seus próprios grupos e canais do WhatsApp. Você deixa de copiar e colar oferta por oferta e passa a revisar o que já foi enviado.',
    intent: 'bot para achadinhos whatsapp',
    about: ['Achadinhos', 'Afiliados', 'Grupos de WhatsApp'],
    aside: {
      pill: 'Como funciona na prática',
      title: 'Você escolhe as fontes. O resto sai sozinho.',
      body: 'O bot acompanha os grupos que você indicou como fonte, troca o link pelo seu código de afiliado e publica nos seus grupos e canais — com intervalo entre envios e sem repetir a mesma oferta no mesmo grupo.',
    },
    primaryCta: 'Testar grátis por 7 dias',
    secondaryCta: 'Ver como funciona',
    problemTitle: 'O achadinho bom dura minutos — e você não está sempre no celular.',
    problem: 'Promoção de achadinho é por tempo limitado e estoque curto. Quem depende de ver a oferta, copiar o link, trocar pelo seu código de afiliado e colar em cada grupo sempre chega atrasado — ou desiste de postar em metade dos grupos.',
    bullets: ['A oferta sai nos seus grupos no mesmo minuto em que aparece na fonte, não meia hora depois.', 'O link já vai com o seu código de afiliado, sem você trocar nada na mão.', 'A mesma promoção não é repostada duas vezes no mesmo grupo no mesmo dia.'],
    process: ['Escolha os grupos onde os achadinhos aparecem primeiro — eles viram sua fonte.', 'Escolha os seus grupos e canais que vão receber as ofertas.', 'Defina o intervalo entre envios e quais palavras você não quer repassar.', 'Acompanhe no histórico o que saiu, para onde e o que foi bloqueado por repetição.'],
    faqs: [
      ['O que é um bot de achadinhos?', 'É um programa que acompanha os grupos onde as promoções aparecem primeiro, troca o link pelo seu código de afiliado e publica a oferta nos seus próprios grupos e canais do WhatsApp — sem você copiar e colar oferta por oferta.'],
      ['De onde vêm os achadinhos?', 'Dos grupos que você já acompanha e escolhe como fonte. O bot não inventa oferta nem busca em lugar nenhum sozinho: ele repassa o que aparece nas fontes que você indicou, com o seu link no lugar do original.'],
      ['A comissão fica comigo mesmo se a oferta veio de outro grupo?', 'Fica, desde que o link seja convertido antes de sair. É esse o ponto: encaminhar o link do jeito que veio credita a venda para quem publicou primeiro. O BOTinho troca pelo seu código de Shopee, Amazon, Mercado Livre ou Magalu antes de publicar.'],
      ['Ele posta a mesma promoção várias vezes?', 'Não no mesmo grupo dentro da janela de repetição. Se a mesma oferta chega por duas fontes diferentes, ela sai uma vez só — e o histórico mostra quantas repetições foram bloqueadas.'],
      ['Preciso ficar com o celular ligado?', 'O aparelho precisa estar conectado à internet, como no WhatsApp Web. Mas você não precisa estar olhando: as ofertas saem sozinhas conforme as regras que você definiu.'],
      ['Serve para cupom, ou só para produto?', 'Serve para os dois. Links de cupom e campanha também são convertidos para o seu código, não só links de produto — que é onde muita ferramenta simplesmente remove o link.'],
      ['Quantos grupos posso usar?', 'Não há limite de grupos. O que muda entre os planos é o acesso a Canais, ofertas automáticas da Shopee e filas de envio.'],
      ['Corro risco de perder o número?', 'Existe risco em qualquer operação de divulgação, e ninguém pode prometer o contrário. O que dá para controlar é o ritmo: intervalo entre envios, variação de texto e limite por grupo. Vale ler antes o guia sobre WhatsApp banido.'],
    ],
  },
  'anti-ban-whatsapp': {
    path: '/anti-ban-whatsapp',
    title: 'WhatsApp banido por divulgar ofertas: como reduzir o risco',
    description: 'Por que o WhatsApp bane quem divulga ofertas em grupos, o que aumenta o risco e o que dá para controlar de verdade. Sem promessa de “anti-ban 100%” — isso ninguém pode garantir.',
    eyebrow: 'WhatsApp banido: o que dá para controlar',
    h1: 'Teve o WhatsApp banido divulgando ofertas? Veja o que dá para controlar',
    lead: 'Contas de WhatsApp usadas para divulgar ofertas costumam ser banidas quando o comportamento parece automático demais: muitas mensagens iguais em sequência, links repetidos e denúncias de membros. Nenhuma ferramenta garante imunidade — o que dá para controlar é ritmo, variação de texto e volume por destino.',
    intent: 'anti-ban whatsapp',
    about: ['WhatsApp banido', 'Banimento de conta', 'Divulgação em grupos'],
    aside: {
      pill: 'Sem promessa de imunidade',
      title: 'Ninguém pode garantir que você não será banido.',
      body: 'O WhatsApp decide sozinho e não explica o critério. Quem promete banimento zero está vendendo o que não controla. O que dá para controlar é ritmo de envio, variação de texto, limite por grupo e divulgar só para quem aceitou receber.',
    },
    primaryCta: 'Testar grátis por 7 dias',
    secondaryCta: 'Fazer o teste de risco',
    problemTitle: 'O que faz o WhatsApp banir um número que divulga oferta.',
    problem: 'O WhatsApp não bane por você vender — bane por comportamento que parece robô. Na prática, três coisas pesam mais: mandar muitas mensagens iguais em sequência, ter gente clicando em "denunciar" ou "bloquear", e adicionar pessoas em grupo sem elas pedirem. Volume sozinho não é o problema; volume com mensagem idêntica é.',
    bullets: ['Mensagem repetida no mesmo formato para vários grupos seguidos é o padrão mais fácil de detectar.', 'Denúncia de membro pesa mais que quantidade de envio — um grupo irritado derruba mais rápido que mil mensagens.', 'Número novo tem menos margem que número antigo com histórico de conversa real.'],
    process: ['Use um chip só para a operação, nunca o número pessoal — se cair, você não perde seus contatos.', 'Deixe intervalo entre os envios em vez de disparar tudo de uma vez.', 'Varie o texto: a mesma oferta com chamadas diferentes por grupo.', 'Só divulgue em grupo que aceitou receber oferta — denúncia é o que mais derruba.', 'Tenha um plano B pronto: segundo chip, backup da lista de grupos e das configurações.'],
    faqs: [
      ['Por que meu WhatsApp foi banido divulgando ofertas?', 'Quase sempre por um destes três: mensagens iguais disparadas em sequência, denúncias de membros que não queriam receber, ou adição de pessoas em grupos sem consentimento. O WhatsApp não divulga o motivo exato, mas esses são os padrões que ele descreve como uso automatizado ou não solicitado.'],
      ['Dá para recuperar um número banido do WhatsApp?', 'Às vezes. O próprio app oferece a opção de pedir revisão quando você tenta entrar e vê a mensagem de banimento. A revisão é feita pelo WhatsApp, não por nenhuma ferramenta, e não há prazo garantido nem certeza de retorno. Se o número era o da operação e não o pessoal, o prejuízo fica limitado.'],
      ['Qual a diferença entre número banido, conta banida e shadowban?', 'Banimento de número ou conta é explícito: você não consegue mais usar e vê o aviso ao abrir o app. O que o mercado chama de shadowban é diferente e mais difícil de identificar — nada avisa, mas a entrega cai e as mensagens param de aparecer para parte das pessoas. O primeiro é um evento; o segundo, uma queda silenciosa.'],
      ['Existe bot “anti-ban” de verdade?', 'Não. Nenhuma ferramenta controla a decisão do WhatsApp, e quem promete banimento zero está vendendo o que não pode entregar. O que existe é reduzir os padrões que chamam atenção: ritmo, variação de texto, limite por grupo e consentimento de quem recebe.'],
      ['Usar um bot aumenta o risco de tomar ban?', 'Depende de como ele envia. Uma ferramenta que dispara tudo de uma vez, com texto idêntico, aumenta. Uma que espaça os envios, varia o texto e respeita limite por grupo tende a parecer mais com uso humano do que a pessoa copiando e colando às pressas em vinte grupos seguidos.'],
      ['Quantas mensagens posso mandar por dia sem risco?', 'Não existe número oficial, e desconfie de quem cita um. O que importa mais que a quantidade é o padrão: cem mensagens espaçadas, com texto variado, para grupos que pediram para receber, são mais seguras que vinte idênticas em dois minutos.'],
      ['Chip dedicado resolve?', 'Não impede o banimento, mas limita o estrago. Se o número da operação cair, seus contatos pessoais, suas conversas e seu histórico continuam intactos em outro número. É a medida mais barata de todas.'],
      ['O BOTinho garante que eu não seja banido?', 'Não, e desconfie de qualquer ferramenta que garanta. O que ele faz é controlar o que está sob controle: intervalo entre envios, variação de texto, limite por destino e histórico do que saiu.'],
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
      about: page.about ?? ['Canais do WhatsApp', 'Afiliados', 'Módulo de Preservação Avançada'],
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
  // Barra lateral configurável por página. O default preserva o texto da campanha
  // "Canais + Preservação" para as páginas que continuam sendo sobre isso; páginas
  // que entram por outra intenção (achadinhos, WhatsApp banido) sobrescrevem, para
  // o corpo não contradizer o título.
  const aside = page.aside ?? {
    pill: 'Módulo de Preservação Avançada',
    title: 'Redução de risco sem promessa absoluta.',
    body: 'O BOTinho usa cadência, variações, limites, monitoramento e plano de recuperação. Quando falamos de “anti-ban”, é como termo de busca do mercado, não garantia.',
  }
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
            <aside style={s.softCard} aria-label={`Resumo: ${aside.pill}`}>
              <span className="pill"><span className="dot" />{aside.pill}</span>
              <h2 style={{ ...s.h2, fontSize: 'clamp(24px, 2.5vw, 34px)' }}>{aside.title}</h2>
              <p style={s.small}>{aside.body}</p>
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
            <SectionHeader eyebrow="Ferramentas gratuitas" title="Quer medir antes de decidir?" body="Use os ativos P1 para transformar a dor de preservação em próximo passo concreto: checklist ou cálculo de exposição." />
            <div style={s.grid}>
              <article style={s.card}>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Checklist de Preservação Avançada</h3>
                <p style={s.small}>Um roteiro rápido para revisar chip, cadência, variações, monitoramento e recuperação.</p>
                <Link className="btn btn-accent" style={{ marginTop: 18 }} href={checklistHref} data-seo-cta="commercial_checklist" data-cta-position="p1_assets_primary" data-cta-stage="lead_magnet" data-cta-destination="checklist">Abrir checklist</Link>
              </article>
              <article style={s.card}>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>Calculadora de risco</h3>
                <p style={s.small}>Estime exposição por volume, intervalo, repetição, chip e monitoramento.</p>
                <Link className="btn btn-ghost" style={{ marginTop: 18 }} href={riskCalculatorHref} data-seo-cta="commercial_risk_calculator" data-cta-position="p1_assets_secondary" data-cta-stage="tool" data-cta-destination="calculator">Calcular risco</Link>
              </article>
            </div>
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
