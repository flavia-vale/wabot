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
    eyebrow: 'WhatsApp banido · perguntas e respostas',
    title: 'WhatsApp banido divulgando ofertas: perguntas e respostas',
    description: 'Por que o WhatsApp bane número que divulga ofertas em grupo, se existe bot “anti-ban”, se chip dedicado resolve e o que fazer quando o número já foi bloqueado.',
    intent: 'whatsapp banido',
    h1: 'WhatsApp banido divulgando ofertas: as perguntas que todo afiliado faz.',
    intro: 'Quem divulga oferta em grupo de WhatsApp convive com o medo de perder o número. Aqui estão as respostas diretas: o que realmente aumenta o risco, o que ajuda a reduzir e por que ninguém pode prometer que você não será banido.',
    sections: [
      { title: 'Se o seu número já foi banido, comece por aqui', body: 'Ao abrir o app você vê a mensagem de banimento e, na maioria dos casos, um botão para pedir revisão. Peça a revisão pelo próprio WhatsApp — é ele quem decide, nenhuma ferramenta ou serviço de terceiro consegue reverter isso por você. Enquanto espera, não tente criar conta nova no mesmo número: reativar por fora costuma piorar. Se o número era o da operação e não o pessoal, o prejuízo para na operação.' },
      { title: 'Se ainda não aconteceu, o que realmente importa', body: 'Volume não é o vilão que parece. O que mais derruba é mensagem idêntica repetida em sequência, gente denunciando porque não pediu para receber, e adição em grupo sem consentimento. Cem mensagens espaçadas e variadas, para quem quer receber, são mais seguras que vinte iguais em dois minutos.' },
    ],
    faqs: [
      { q: 'Por que o WhatsApp bane quem divulga ofertas?', a: 'Não é por vender. É por comportamento que parece automatizado ou não solicitado: muitas mensagens iguais em sequência, denúncias de quem recebeu sem pedir, e adição de pessoas em grupos sem consentimento. O WhatsApp não informa o motivo exato de cada banimento, mas são esses os padrões que ele descreve nas próprias regras de uso.' },
      { q: 'Como recuperar um número banido do WhatsApp?', a: 'Pelo próprio app: ao tentar entrar, aparece a opção de solicitar revisão do banimento. Quem analisa é o WhatsApp, e não há prazo garantido nem certeza de retorno. Desconfie de qualquer serviço que cobre para "desbanir" — isso não existe como serviço legítimo.' },
      { q: 'Quanto tempo dura um banimento do WhatsApp?', a: 'Depende do tipo. Existem bloqueios temporários, que expiram sozinhos e mostram uma contagem regressiva no app, e banimentos permanentes, que só saem por revisão. A mensagem que aparece ao abrir o app indica qual é o seu caso.' },
      { q: 'O que é shadowban no WhatsApp?', a: 'É o nome que o mercado dá para a queda silenciosa de entrega: nada avisa, o número continua funcionando, mas as mensagens param de chegar para parte das pessoas. Diferente do banimento, não há confirmação oficial — você percebe pela queda de cliques e por membros dizendo que não viram a publicação.' },
      { q: 'Quantas mensagens posso enviar por dia sem tomar ban?', a: 'Não existe número oficial, e quem cita um está chutando. O padrão pesa mais que a quantidade: mensagens espaçadas, com texto variado, para grupos que aceitaram receber, são bem mais seguras que um lote idêntico disparado de uma vez.' },
      { q: 'Existe bot “anti-ban” para WhatsApp?', a: 'Não como garantia. Nenhuma ferramenta controla a decisão do WhatsApp. O que dá para controlar é o ritmo de envio, a variação do texto, o limite por grupo e o consentimento de quem recebe — e é isso que uma ferramenta séria oferece.' },
      { q: 'Chip dedicado evita banimento?', a: 'Não evita, mas limita o estrago. Se o número da operação cair, seus contatos pessoais, conversas e histórico continuam intactos em outro número. É a medida mais barata e a primeira a tomar.' },
      { q: 'Usar WhatsApp Business reduz o risco?', a: 'Não por si só. A conta Business dá ferramentas de atendimento, mas as regras sobre mensagem não solicitada e comportamento automatizado são as mesmas. Trocar de tipo de conta sem mudar o padrão de envio não muda o risco.' },
      { q: 'Canal do WhatsApp é mais seguro que grupo?', a: 'Tem uma diferença prática: em canal ninguém é adicionado sem querer — a pessoa escolhe seguir. Isso reduz a chance de denúncia, que é um dos fatores que mais derruba número. Mas canal não é imune, e o risco continua dependendo de volume e comportamento.' },
      { q: 'Meu número está em risco. O que faço agora?', a: 'Reduza o volume imediatamente, pare de mandar mensagem idêntica para vários grupos, saia dos grupos onde você não foi convidado a divulgar e prepare o plano B: segundo chip, backup da lista de grupos e das configurações. Depois retome devagar.' },
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
    eyebrow: 'Como não tomar ban · o que dá para controlar',
    title: 'Como evitar que o WhatsApp seja banido divulgando ofertas',
    description: 'As quatro camadas que reduzem o risco de o número ser banido divulgando ofertas: intervalo entre envios, variação de mensagem, monitoramento e plano de recuperação.',
    intent: 'como nao tomar ban no whatsapp',
    h1: 'Como reduzir o risco de banimento divulgando ofertas no WhatsApp.',
    intro: 'Não existe fórmula que impeça o WhatsApp de banir um número — quem promete isso está vendendo o que não controla. O que existe são quatro camadas que reduzem os padrões que mais chamam atenção, e um plano para quando algo dá errado.',
    sections: [
      { title: 'Antes das camadas: use um chip só para a operação', body: 'É a medida mais barata e a que mais limita prejuízo. Não impede o banimento, mas se o número cair você não perde seus contatos, suas conversas e seu histórico pessoal. Quem divulga oferta pelo número pessoal está apostando o WhatsApp da vida inteira numa operação comercial.' },
      { title: 'Camada 1 — espaçar os envios', body: 'Disparar a mesma oferta para dez grupos em dois minutos é o padrão mais fácil de identificar como automação. Deixar intervalo entre um envio e outro, e não publicar de madrugada, aproxima o comportamento do que uma pessoa faria. Nesta camada entram intervalo mínimo, limite por hora e por dia, e horário de silêncio.' },
      { title: 'Camada 2 — não repetir a mensagem idêntica', body: 'Mensagem byte a byte igual, repetida em vários destinos, é o segundo padrão mais visível. Variar a chamada, a ordem dos elementos e o texto de abertura faz a mesma oferta chegar diferente em cada grupo. Não é disfarce: é o que uma pessoa naturalmente faria ao repostar.' },
      { title: 'Camada 3 — só divulgar para quem aceitou receber', body: 'Esta é a camada que mais gente ignora e a que mais derruba número. Denúncia de membro pesa mais que volume de envio: um grupo irritado gera mais risco que mil mensagens em grupo que quer receber. Adicionar gente em grupo sem pedir é o caminho mais rápido para o banimento.' },
      { title: 'Camada 4 — perceber a queda antes do prejuízo', body: 'Erros de envio subindo, cliques caindo sem mudança de oferta, membros dizendo que não viram a publicação. Esses sinais aparecem antes do banimento e dão tempo de reduzir o volume. Sem histórico de envio, você só descobre quando já perdeu o número.' },
      { title: 'Camada 5 — ter o plano B pronto antes de precisar', body: 'Segundo chip já verificado, backup da lista de grupos e das configurações, e um jeito de avisar a audiência. Montar isso depois que o número caiu é quando dói. Montar antes custa uma tarde.' },
    ],
    faqs: [
      { q: 'Por onde começo se só puder fazer uma coisa?', a: 'Chip dedicado. Não reduz a chance de banimento, mas é o que separa o prejuízo da operação do prejuízo da sua vida pessoal. Depois disso, espaçar os envios.' },
      { q: 'Isso garante que eu não seja banido?', a: 'Não, e nenhuma ferramenta pode garantir. O WhatsApp decide sozinho e não explica o critério. O que estas camadas fazem é reduzir os padrões que sabidamente chamam atenção — o resto está fora do controle de qualquer um.' },
      { q: 'Se eu enviar devagar, posso mandar para quantos grupos quiser?', a: 'Não é assim que funciona. Ritmo ajuda, mas não anula os outros fatores: se os grupos não pediram para receber, a denúncia continua sendo o maior risco, por mais espaçado que seja o envio.' },
      { q: 'O BOTinho aplica essas camadas sozinho?', a: 'Ele cuida do que é mecânico: intervalo entre envios, variação de texto, limite por destino e histórico do que saiu. As camadas 3 e 5 dependem de você — só você decide em quais grupos divulgar e prepara o plano B.' },
      { q: 'Isso substitui revisar as ofertas antes de publicar?', a: 'Não. As camadas reduzem exposição, mas a operação ainda deve conferir oferta, link, preço e as regras de cada grupo e plataforma antes de distribuir.' },
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
      author: { '@type': 'Organization', name: 'Equipe editorial do Espelha Grupos' },
      publisher: { '@type': 'Organization', name: 'Espelha Grupos' },
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
