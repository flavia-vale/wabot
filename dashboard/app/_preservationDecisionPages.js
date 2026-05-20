import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { buildOgImageUrl } from '@/lib/seo-og'

const siteUrl = getSiteUrl()
const campaign = 'canais-preservacao'

const sharedCtas = {
  diagnostic: `/diagnostico-antiban-whatsapp?utm_source=seo&utm_medium=decision&utm_campaign=${campaign}&utm_content=p2_diagnostic`,
  checklist: `/materiais/checklist-antiban-whatsapp?utm_source=seo&utm_medium=decision&utm_campaign=${campaign}&utm_content=p2_checklist`,
  calculator: `/ferramentas/calculadora-risco-whatsapp?utm_source=seo&utm_medium=decision&utm_campaign=${campaign}&utm_content=p2_calculator`,
  signup: `/login?mode=register&utm_source=seo&utm_medium=decision&utm_campaign=${campaign}&utm_content=p2_signup`,
  landing: `/bot-canais-whatsapp?utm_source=seo&utm_medium=decision&utm_campaign=${campaign}&utm_content=p2_landing`,
}

export const PRESERVATION_DECISION_PAGES = {
  '/bot-comum-vs-botinho': {
    slug: '/bot-comum-vs-botinho',
    template: 'comparison',
    eyebrow: 'Comparativo · Bot comum vs BOTinho',
    title: 'Bot comum vs BOTinho: qual preserva melhor sua operação no WhatsApp?',
    description: 'Compare bot comum e BOTinho para afiliados no WhatsApp: repostagem simples, cadência, variações, monitoramento, canais e preservação avançada.',
    intent: 'bot comum vs botinho',
    h1: 'Bot comum só espalha. BOTinho organiza uma operação com preservação.',
    intro: 'A diferença principal não é “postar mais”. É controlar fonte, destino, ritmo, variação, sinais de risco e recuperação para que grupos, canais e chip sejam tratados como ativos do negócio.',
    sections: [
      {
        title: 'Resposta direta',
        body: 'Um bot comum pode resolver repostagem simples. O BOTinho faz sentido quando a operação precisa de grupos e canais com papéis diferentes, cadência por destino, variações, monitoramento e plano de recuperação.',
      },
      {
        title: 'Quando um bot comum basta',
        bullets: ['Poucas ofertas por semana.', 'Poucos destinos e revisão manual simples.', 'Nenhuma dependência crítica de chip, canal ou audiência.', 'Operação ainda validando se WhatsApp será canal principal.'],
      },
      {
        title: 'Quando o BOTinho fica mais indicado',
        bullets: ['Vários grupos e Canais do WhatsApp.', 'Necessidade de publicar em horários e ritmos diferentes.', 'Risco de mensagem idêntica em massa.', 'Equipe precisa de logs, monitoramento e recuperação.'],
      },
    ],
    comparison: {
      columns: ['Critério', 'Bot comum', 'BOTinho'],
      rows: [
        ['Repostagem básica', 'Geralmente sim', 'Sim, com regras de origem e destino'],
        ['Grupos e canais juntos', 'Limitado ou manual', 'Fluxos grupo→canal, canal→grupo, canal→canal e grupo→grupo'],
        ['Cadência por destino', 'Pouco controle', 'Intervalos, limites e horários por operação'],
        ['Variações anti-fingerprint', 'Raro', 'Variações de chamada, emoji, ordem e contexto'],
        ['Monitoramento de saúde', 'Normalmente ausente', 'Sinais, cliques, erros e pausa preventiva'],
        ['Plano de recuperação', 'Improvisado', 'Chip dedicado, backup de configuração e plano B'],
      ],
    },
    faqs: [
      { q: 'BOTinho substitui qualquer bot comum?', a: 'Não necessariamente. Se a operação é pequena e manualmente controlável, um fluxo simples pode bastar. O BOTinho é mais indicado quando volume, cadência, canais e recuperação viram prioridade.' },
      { q: 'O BOTinho promete não banir?', a: 'Não. O diferencial é preservação avançada e redução de exposição operacional, não garantia contra decisões da plataforma.' },
      { q: 'Qual primeiro passo para comparar?', a: 'Calcule seu risco operacional e revise o checklist de preservação antes de escolher ferramenta.' },
    ],
  },
  '/faq-antiban-whatsapp': {
    slug: '/faq-antiban-whatsapp',
    template: 'faq',
    eyebrow: 'FAQ · “anti-ban” honesto',
    title: 'FAQ “anti-ban” WhatsApp: perguntas honestas sobre preservação avançada',
    description: 'Respostas diretas sobre “anti-ban” no WhatsApp, preservação avançada, chip dedicado, cadência, variações, monitoramento e recuperação.',
    intent: 'faq antiban whatsapp',
    h1: 'Perguntas honestas sobre “anti-ban” no WhatsApp e preservação avançada.',
    intro: 'O mercado pesquisa “anti-ban”, mas a resposta responsável é preservação avançada: reduzir exposição, monitorar sinais e preparar recuperação sem prometer controle absoluto sobre a plataforma.',
    sections: [
      { title: 'Como usar este FAQ', body: 'Use estas respostas para alinhar expectativa antes de configurar qualquer automação. Se alguém prometer “banimento zero”, trate como sinal de alerta.' },
    ],
    faqs: [
      { q: 'Existe bot “anti-ban” para WhatsApp?', a: 'Não como garantia absoluta. O que existe é uma combinação de práticas para reduzir exposição operacional: chip dedicado, cadência, variações, monitoramento, pausa preventiva e recuperação.' },
      { q: 'Por que o BOTinho usa o termo “anti-ban” em algumas páginas?', a: 'Porque muitos afiliados pesquisam esse termo quando sentem medo de perder chip, grupo ou canal. A comunicação do BOTinho explica o termo, mas posiciona a entrega como Módulo de Preservação Avançada.' },
      { q: 'Chip dedicado evita banimento?', a: 'Não. Chip dedicado reduz impacto e separa risco pessoal do risco operacional, mas precisa vir junto de cadência, uso responsável e monitoramento.' },
      { q: 'Mensagens variadas reduzem risco?', a: 'Elas reduzem padrões mecânicos de repetição, principalmente quando combinadas com intervalos, limites por destino e revisão humana. Não são garantia absoluta.' },
      { q: 'Canal do WhatsApp é mais seguro que grupo?', a: 'Canal e grupo têm papéis diferentes. Canais podem funcionar como vitrine organizada; grupos podem continuar como fonte ou comunidade. O risco depende do uso, volume e comportamento.' },
      { q: 'O que fazer se meu chip ou canal já está em risco?', a: 'Reduza volume, pause rajadas, revise mensagens idênticas, documente fontes e destinos, prepare recuperação e faça o diagnóstico antes de retomar escala.' },
    ],
  },
  '/como-funciona-botinho-canais': {
    slug: '/como-funciona-botinho-canais',
    template: 'howto',
    eyebrow: 'Como funciona · Canais',
    title: 'Como funciona o BOTinho para Canais do WhatsApp',
    description: 'Veja o fluxo operacional do BOTinho para Canais do WhatsApp: fontes, destinos, cadência, variações, monitoramento e preservação avançada.',
    intent: 'como funciona botinho canais',
    h1: 'Como o BOTinho transforma grupos e canais em uma operação controlada.',
    intro: 'O BOTinho conecta fontes e destinos para que ofertas possam circular entre grupos e Canais do WhatsApp com regras. O objetivo é tirar a operação do improviso antes de aumentar volume.',
    steps: [
      'Mapeie fontes de oferta, grupos de comunidade, canais de vitrine e destinos de backup.',
      'Defina o papel de cada ambiente: fonte, comunidade, vitrine principal, teste ou recuperação.',
      'Configure cadência: intervalo mínimo, limites por hora/dia e horário de silêncio.',
      'Ative variações de texto, emojis, ordem dos elementos e contexto por destino quando fizer sentido.',
      'Monitore sinais de saúde, cliques, erros e queda de entrega para pausar antes do prejuízo.',
      'Documente recuperação: chip dedicado, backup de configuração e processo de recriação.',
    ],
    sections: [
      { title: 'Fluxos possíveis', bullets: ['Grupo → Canal', 'Canal → Grupo', 'Canal → Canal', 'Grupo → Grupo', 'Múltiplas fontes → múltiplos destinos'] },
      { title: 'O que não é', body: 'Não é disparo sem limite, promessa de invisibilidade ou garantia contra banimento. É uma camada operacional para reduzir exposição e aumentar previsibilidade.' },
    ],
    faqs: [
      { q: 'Preciso abandonar meus grupos?', a: 'Não. Muitos afiliados usam grupos como fonte ou comunidade e Canais do WhatsApp como vitrine de ofertas.' },
      { q: 'O fluxo funciona para vários canais?', a: 'Sim. A ideia é escalonar destinos e evitar que todos recebam a mesma mensagem no mesmo minuto.' },
      { q: 'Onde entra a preservação avançada?', a: 'Ela entra nas regras de cadência, variação, monitoramento, pausa preventiva e recuperação.' },
    ],
  },
  '/protecao-antiban-botinho': {
    slug: '/protecao-antiban-botinho',
    template: 'module-deep-dive',
    eyebrow: 'Módulo · Preservação Avançada',
    title: 'Proteção “anti-ban” no BOTinho: o que o Módulo de Preservação Avançada faz',
    description: 'Entenda as camadas de proteção operacional do BOTinho: limites, cadência, variações, monitoramento, pausa preventiva e recuperação.',
    intent: 'protecao antiban botinho',
    h1: 'Proteção responsável não é promessa. É camada sobre camada.',
    intro: 'O Módulo de Preservação Avançada não controla decisões do WhatsApp. Ele reduz padrões frágeis da operação e prepara resposta quando algo sai do esperado.',
    sections: [
      { title: 'Camada 1 — limites e cadência', body: 'Define intervalos, limites por hora/dia, horário de silêncio e distribuição escalonada por destino.' },
      { title: 'Camada 2 — variações', body: 'Evita mensagens byte-idênticas em massa, alternando chamadas, emojis, ordem dos elementos e contexto.' },
      { title: 'Camada 3 — monitoramento', body: 'Acompanha sinais como erros, queda de cliques, destino em atenção e necessidade de pausa preventiva.' },
      { title: 'Camada 4 — recuperação', body: 'Recomenda chip dedicado, backup de configuração, lista de fontes/destinos e plano de recriação.' },
    ],
    faqs: [
      { q: 'Isso é proteção “anti-ban”?', a: 'É preservação avançada. O termo “anti-ban” aparece como linguagem de busca, mas a entrega não é promessa absoluta.' },
      { q: 'Qual camada devo configurar primeiro?', a: 'Comece por chip dedicado, limites por destino e redução de mensagens idênticas. Depois avance para monitoramento e recuperação.' },
      { q: 'O módulo substitui revisão humana?', a: 'Não. Ele organiza e reduz exposição, mas a operação ainda deve revisar ofertas, links, regras de grupos e políticas das plataformas.' },
    ],
  },
}

export function getPreservationDecisionMetadata(slug) {
  const page = PRESERVATION_DECISION_PAGES[slug]
  if (!page) return {}
  const ogImage = buildOgImageUrl({ slug: slug.replace(/^\//, ''), cluster: campaign, template: page.template })
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: slug },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${siteUrl}${slug}`,
      type: 'article',
      locale: 'pt_BR',
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.title }],
    },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [ogImage] },
  }
}

function buildJsonLd(page) {
  const graph = [
    {
      '@type': 'Article',
      headline: page.title,
      description: page.description,
      mainEntityOfPage: `${siteUrl}${page.slug}`,
      author: { '@type': 'Organization', name: 'Equipe editorial do BOTinho' },
      publisher: { '@type': 'Organization', name: 'BOTinho' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: page.title, item: `${siteUrl}${page.slug}` },
      ],
    },
  ]

  if (page.faqs?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  }

  if (page.steps?.length) {
    graph.push({
      '@type': 'HowTo',
      name: page.title,
      description: page.description,
      step: page.steps.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, text: step })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}

function DecisionCtas({ slug }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Link href={sharedCtas.diagnostic} data-seo-cta="p2_diagnostic" data-cta-position="decision_cta" data-cta-stage="diagnostic" data-cta-destination="diagnostic" className="rounded-2xl bg-emerald-600 px-5 py-4 text-center text-sm font-black text-white hover:bg-emerald-700">
        Fazer diagnóstico
      </Link>
      <Link href={sharedCtas.checklist} data-seo-cta="p2_checklist" data-cta-position="decision_cta" data-cta-stage="lead_magnet" data-cta-destination="checklist" className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-center text-sm font-black text-emerald-800 hover:bg-emerald-50">
        Ver checklist
      </Link>
      <Link href={sharedCtas.calculator} data-seo-cta="p2_calculator" data-cta-position="decision_cta" data-cta-stage="tool" data-cta-destination="calculator" className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-center text-sm font-black text-emerald-800 hover:bg-emerald-50">
        Calcular risco
      </Link>
      <Link href={`${sharedCtas.signup}&page=${encodeURIComponent(slug)}`} data-seo-cta="p2_signup" data-cta-position="decision_cta" data-cta-stage="conversion" data-cta-destination="signup" className="rounded-2xl border border-gray-200 bg-gray-950 px-5 py-4 text-center text-sm font-black text-white hover:bg-gray-800">
        Criar conta
      </Link>
    </div>
  )
}

export function PreservationDecisionPage({ slug }) {
  const page = PRESERVATION_DECISION_PAGES[slug]
  const related = Object.values(PRESERVATION_DECISION_PAGES).filter((item) => item.slug !== slug)
  const trackerRoute = { slug: slug.replace(/^\//, ''), path: slug, cluster: campaign, intent: page.intent, template: page.template }

  return (
    <PublicShell>
      <OrganicPageTracker route={trackerRoute} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(page)).replace(/</g, '\\u003c') }} />
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <section className="rounded-[2rem] bg-emerald-950 p-7 text-white shadow-sm md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{page.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">{page.h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50">{page.intro}</p>
          <DecisionCtas slug={slug} />
        </section>

        {page.comparison ? (
          <section className="mt-8 overflow-x-auto rounded-[2rem] border border-emerald-100 bg-white shadow-sm">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-emerald-50 text-left text-gray-950">
                <tr>{page.comparison.columns.map((column) => <th key={column} className="p-4 font-black">{column}</th>)}</tr>
              </thead>
              <tbody>
                {page.comparison.rows.map((row) => (
                  <tr key={row[0]} className="border-t border-emerald-100">
                    {row.map((cell, index) => <td key={cell} className={`p-4 align-top ${index === 0 ? 'font-black text-gray-950' : 'text-gray-700'}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {page.steps?.length ? (
          <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Passo a passo</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Como aplicar na prática</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-2">
              {page.steps.map((step, index) => (
                <li key={step} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm leading-7 text-gray-700">
                  <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-tight text-gray-950">{section.title}</h2>
              {section.body ? <p className="mt-3 text-sm leading-7 text-gray-700">{section.body}</p> : null}
              {section.bullets ? (
                <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                  {section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span className="text-emerald-600">•</span><span>{bullet}</span></li>)}
                </ul>
              ) : null}
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">FAQ</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Dúvidas de decisão</h2>
          <div className="mt-5 grid gap-3">
            {page.faqs.map((item) => (
              <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                <p className="mt-3 text-sm leading-7 text-gray-700">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6 shadow-sm md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Próximas páginas P2</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Continue a avaliação</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <Link key={item.slug} href={`${item.slug}?utm_source=seo&utm_medium=internal&utm_campaign=${campaign}&utm_content=p2_related`} data-seo-cta="p2_related_page" data-cta-position="related" data-cta-stage="consideration" data-cta-destination="decision_page" className="rounded-2xl bg-white p-5 text-sm font-bold text-gray-800 shadow-sm ring-1 ring-emerald-100 hover:ring-emerald-300">
                {item.title}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </PublicShell>
  )
}
