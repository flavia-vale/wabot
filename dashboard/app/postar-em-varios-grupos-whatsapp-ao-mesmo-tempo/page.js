import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'
import { BRAND_LEGACY_NAME, BRAND_NAME, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION, SUPPORTED_STORES } from '@/lib/marketing-content'
import { getProgrammaticSeoRoute, getRelatedProgrammaticSeoRoutes } from '@/lib/seo-registry.mjs'
import { LP_CONFIG, getLpMetadata } from '../_lpShared'

// Frente B do PLANO_SEO_GEO_2026-09-27 (B1). Medição de 27/09: para "como
// postar em vários grupos de WhatsApp ao mesmo tempo sem spam" as 4 IAs
// respondem como problema de EMPRESA (Comunidades, API oficial, extensão de
// navegador, CRM) e não nos citam. A intenção corporativa é linha congelada
// (docs/rca/seo-marketing.md); aqui a MESMA pergunta é respondida para
// afiliada com grupos próprios, na página que já existia (279 impressões).
//
// Título e descrição moram em LP_CONFIG (_lpShared.js) — fonte única que os
// validadores de SEO leem. Só o corpo é próprio desta página.
//
// Limites que não se cruzam: nenhuma promessa de "não bane"; fila, intervalo,
// horário de descanso, limite por dia e variação de texto são do plano Pro
// (src/billing/plans.js); sem Telegram; sem preço de concorrente.

const slug = 'postar-em-varios-grupos-whatsapp-ao-mesmo-tempo'
const path = `/${slug}`
const cfg = LP_CONFIG[slug]
const dates = getEditorialDates(path)
const basic = DEFAULT_LANDING_PLANS.find((plan) => plan.id === 'basic')
const pro = DEFAULT_LANDING_PLANS.find((plan) => plan.id === 'pro')
const lojas = `${SUPPORTED_STORES.slice(0, -1).join(', ')} e ${SUPPORTED_STORES[SUPPORTED_STORES.length - 1]}`

export const metadata = getLpMetadata(slug)

const h1 = 'Como postar em vários grupos de WhatsApp ao mesmo tempo sem spam (para afiliadas)'

const caminhos = [
  {
    nome: 'Encaminhar a mensagem à mão',
    como: 'Seleciona a oferta, toca em encaminhar e escolhe os grupos.',
    pros: 'Não custa nada e não instala nada.',
    contras: 'O WhatsApp limita o encaminhamento a 5 conversas por vez e marca a mensagem como "encaminhada". O link continua com o código de quem publicou primeiro, então a comissão não é sua.',
    para: 'Quem tem até 3 grupos e publica poucas ofertas por dia.',
  },
  {
    nome: 'Comunidades do WhatsApp',
    como: 'Junta grupos que você administra em uma comunidade e publica no grupo de avisos.',
    pros: 'Recurso oficial; uma publicação chega a todos os membros da comunidade.',
    contras: 'Só entram grupos em que você é administradora, com limite de grupos por comunidade definido pelo WhatsApp. O aviso sai em um grupo separado, não dentro de cada grupo de ofertas, e o link segue sem conversão.',
    para: 'Marca ou loja que administra todos os grupos e quer um mural de avisos.',
  },
  {
    nome: 'Extensão de navegador (WhatsApp Web)',
    como: 'Uma extensão dispara a mesma mensagem para uma lista de grupos pelo computador.',
    pros: 'Rápido de começar; alguns têm intervalo entre envios.',
    contras: 'O computador precisa ficar ligado com o WhatsApp Web aberto. Não troca o link pelo seu código, não sabe o que já saiu em cada grupo e o disparo em lista é o padrão que mais gera denúncia.',
    para: 'Quem manda avisos pontuais e aceita o risco de disparo em lista.',
  },
  {
    nome: `Robô de afiliada com fila e intervalo (${BRAND_NAME})`,
    como: `Você escolhe de onde as ofertas vêm e para quais grupos vão. O robô troca o link pelo seu código em ${SUPPORTED_STORES.length} lojas e publica grupo a grupo, com intervalo.`,
    pros: 'Roda no servidor 24 h, sem celular ou computador ligado. A mesma oferta não sai duas vezes no mesmo grupo, e tudo fica no histórico.',
    contras: `Não é ferramenta oficial do WhatsApp e não elimina o risco de bloqueio — nenhum software elimina. É pago (${basic.price} ou ${pro.price} a cada ${basic.period}) e a fila com intervalo, horário de descanso e limite por dia é do plano Pro.`,
    para: 'Afiliada com grupos próprios que publica várias ofertas por dia e quer a comissão no seu link.',
  },
]

const spam = [
  {
    h: 'Consentimento',
    p: 'Grupo que a pessoa entrou porque quis, com a descrição dizendo que ali saem ofertas, é diferente de grupo onde ela foi adicionada sem pedir. O WhatsApp pesa denúncia e saída em massa. Publicar só nos seus grupos, com gente que escolheu estar lá, é o primeiro filtro.',
  },
  {
    h: 'Ritmo',
    p: 'Dez grupos recebendo a mesma mensagem no mesmo segundo é o padrão de disparo em massa. O mesmo conteúdo, publicado um grupo por vez com intervalo entre os envios, com pausa à noite e um teto por dia, é o padrão de quem publica à mão. É por isso que a fila importa mais do que a velocidade.',
  },
  {
    h: 'Conteúdo repetido',
    p: 'A mesma oferta duas vezes no mesmo grupo, ou o texto idêntico em todos, cansa quem lê e aumenta a chance de denúncia. Bloquear repetição e variar o texto entre os envios reduz isso; o produto faz as duas coisas, a segunda no plano Pro.',
  },
  {
    h: 'Denúncias e bloqueios',
    p: 'É o sinal que o WhatsApp mais usa. Ele vem de gente que não queria receber, de link que parece golpe e de número novo publicando muito de uma vez. Número dedicado, aquecido aos poucos, publicando oferta com link da loja e o seu nome, recebe menos denúncia. Não existe promessa de zero.',
  },
]

const passos = [
  'Conecte um número dedicado pelo QR Code. O robô roda no servidor; o celular pode desligar.',
  `Cadastre seu código de afiliada das lojas que você divulga (${lojas}).`,
  'Escolha os grupos ou canais de origem (de onde as ofertas vêm) e os seus grupos de destino.',
  'No plano Pro, defina o intervalo entre envios, o horário de descanso e o máximo de ofertas por dia. No Basic a publicação é imediata ou agendada.',
  'Acompanhe no histórico o que saiu em cada grupo, o que foi bloqueado por repetição e o que não converteu.',
]

const faq = [
  {
    q: 'Posso postar em grupos que não administro?',
    a: 'Depende do grupo. Se ele permite que qualquer membro publique e a descrição aceita ofertas, tecnicamente sim, e o robô consegue publicar. Mas grupo alheio é onde a denúncia acontece: você não controla as regras, não conhece o público e o administrador pode remover o seu número. Nossa recomendação, e a nossa metodologia, é publicar nos grupos que são seus ou onde você tem autorização explícita.',
  },
  {
    q: 'Quantos grupos dá para postar ao mesmo tempo?',
    a: 'Encaminhando à mão, 5 conversas por vez. Com o robô não há limite de grupos por plano, mas ele não publica "ao mesmo tempo" de propósito: entra um grupo por vez, com intervalo, para não repetir o padrão de disparo em massa. O tempo total depende do intervalo que você escolher e da quantidade de grupos.',
  },
  {
    q: 'Isso é seguro contra bloqueio?',
    a: 'Não como promessa. Nenhuma ferramenta, oficial ou não, garante que o WhatsApp não vai bloquear um número. O que existe é controle do que está sob controle: intervalo entre envios, horário de descanso, limite por dia, variação do texto, bloqueio de repetição e um número dedicado. Quem garante banimento zero está vendendo o que não pode entregar.',
  },
  {
    q: 'O robô encaminha a mensagem ou publica como minha?',
    a: `Publica como sua. A oferta sai reescrita no seu modelo de mensagem, sem o selo de "encaminhada", com a foto e o link já trocado pelo seu código de afiliada em ${SUPPORTED_STORES.length} lojas. Se a troca do link falhar, a oferta não é publicada: o link de outra pessoa nunca vai para o seu grupo.`,
  },
]

const entradas = [
  { href: '/bot-afiliados-whatsapp', label: 'Como funciona o robô para afiliadas', note: 'origens, conversão do link, destinos e histórico.' },
  { href: '/padronizar-divulgacao-afiliado-whatsapp', label: 'Como padronizar a divulgação de cupons', note: 'o modelo de mensagem pronto e a mesma mensagem em todos os grupos.' },
  { href: '/metodologia-uso-responsavel-whatsapp', label: 'Metodologia de uso responsável', note: 'o que fazemos e o que não prometemos.' },
  { href: '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp', label: 'Melhores horários para postar ofertas', note: 'quando o grupo lê e quando descansar.' },
]

function buildSchemas(siteUrl) {
  const url = `${siteUrl}${path}`
  const dates = getEditorialDates(path)
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Como postar em vários grupos de WhatsApp com intervalo, sem disparo em massa',
      step: passos.map((text, index) => ({ '@type': 'HowToStep', name: `Passo ${index + 1}`, text })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}#software`,
      name: BRAND_NAME,
      alternateName: [BRAND_LEGACY_NAME],
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: `${cfg.description} ${PRODUCT_DEFINITION}`,
      url,
      mainEntityOfPage: url,
      datePublished: dates.publishedAt,
      dateModified: dates.updatedAt,
      image: [`${siteUrl}/botinho-logo.svg`],
      brand: { '@id': `${siteUrl}#organization` },
      publisher: { '@id': `${siteUrl}#organization` },
      offers: DEFAULT_LANDING_PLANS.map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        url: `${siteUrl}/login?mode=register`,
        priceCurrency: 'BRL',
        price: String(plan.priceValue),
        availability: 'https://schema.org/InStock',
        category: 'SoftwareSubscription',
        description: `${plan.desc} Período: ${plan.period}.`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: cfg.title, item: url },
      ],
    },
  ]
}

export default function Page() {
  const siteUrl = getSiteUrl()
  const schemas = buildSchemas(siteUrl)
  const seoRoute = getProgrammaticSeoRoute(slug)
  // Mesmas 3 vizinhas que as demais páginas de dor mostram: esta página deixou
  // de usar o template compartilhado, e sem isto as vizinhas ficam órfãs
  // (test/marketing-paginas-orfas.test.js).
  const relatedRoutes = getRelatedProgrammaticSeoRoutes(seoRoute, 3)

  return (
    <PublicShell>
      <OrganicPageTracker route={seoRoute} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/automacao-whatsapp-afiliados" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Automação para afiliadas no WhatsApp</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Grupos de ofertas · Publicar em vários grupos</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{cfg.description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Revisado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p><strong>Sim, dá para publicar a mesma oferta em vários grupos de WhatsApp sem virar spam</strong>: o que separa publicação de spam não é a quantidade de grupos, é publicar só onde as pessoas escolheram estar, um grupo por vez com intervalo, sem repetir a mesma oferta no mesmo grupo.</p>
              <p>Para afiliada com grupos próprios, o caminho que faz isso sozinho é um robô com fila de envio que também troca o link pelo seu código de afiliada em {SUPPORTED_STORES.length} lojas. O {BRAND_NAME} faz isso a partir de {basic.price} a cada {basic.period}, com 7 dias grátis; a fila com intervalo, horário de descanso e limite por dia está no plano Pro ({pro.price}).</p>
              <p>Os outros três caminhos que aparecem em toda resposta sobre o assunto (encaminhar à mão, Comunidades e extensão de navegador) resolvem parte do problema. A tabela abaixo diz o que cada um faz e para quem serve, sem esconder o que não faz.</p>
            </section>

            <section>
              <h2>Os 4 caminhos, lado a lado</h2>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full border-collapse text-sm leading-6">
                  <thead>
                    <tr className="bg-emerald-50 text-left text-gray-950">
                      <th className="border border-emerald-100 px-3 py-2">Caminho</th>
                      <th className="border border-emerald-100 px-3 py-2">Como funciona</th>
                      <th className="border border-emerald-100 px-3 py-2">A favor</th>
                      <th className="border border-emerald-100 px-3 py-2">Contra</th>
                      <th className="border border-emerald-100 px-3 py-2">Para quem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caminhos.map((c) => (
                      <tr key={c.nome} className="align-top">
                        <th scope="row" className="border border-emerald-100 px-3 py-2 text-left font-black text-gray-950">{c.nome}</th>
                        <td className="border border-emerald-100 px-3 py-2">{c.como}</td>
                        <td className="border border-emerald-100 px-3 py-2">{c.pros}</td>
                        <td className="border border-emerald-100 px-3 py-2">{c.contras}</td>
                        <td className="border border-emerald-100 px-3 py-2">{c.para}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-gray-600">Comunidades, API oficial e ferramentas de atendimento (CRM) resolvem o problema de uma empresa falando com clientes. Afiliada tem outro problema: uma rede de grupos próprios recebendo várias ofertas por dia, cada uma com o link certo. Esta página responde ao segundo.</p>
            </section>

            <section>
              <h2>O que o WhatsApp trata como spam</h2>
              <p>O WhatsApp não publica a regra exata, mas os sinais que pesam são conhecidos e são os mesmos que fazem um grupo esvaziar. Quatro deles importam para quem publica ofertas:</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {spam.map((s) => (
                  <div key={s.h} className="rounded-2xl bg-emerald-50/60 p-5 ring-1 ring-emerald-100">
                    <h3>{s.h}</h3>
                    <p className="mt-2 text-sm leading-7">{s.p}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4">Nada disso é garantia. A decisão de bloquear é do WhatsApp, e nenhuma ferramenta, inclusive esta, promete o contrário. O que dá para fazer é tirar da sua operação os sinais que estão sob o seu controle.</p>
            </section>

            <section>
              <h2>Como publicar em vários grupos com intervalo, passo a passo</h2>
              <ol>
                {passos.map((p) => <li key={p}>{p}</li>)}
              </ol>
            </section>

            <section>
              <h2>Quanto custa</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl p-5 ring-1 ring-emerald-100">
                  <h3>{basic.name} · {basic.price} a cada {basic.period}</h3>
                  <p className="mt-2 text-sm leading-7">{basic.desc} Publica nos seus grupos com o link trocado pelo seu código nas {SUPPORTED_STORES.length} lojas, oferta reescrita no seu modelo e histórico completo. A publicação é imediata ou agendada.</p>
                </div>
                <div className="rounded-2xl bg-emerald-50/60 p-5 ring-1 ring-emerald-100">
                  <h3>{pro.name} · {pro.price} a cada {pro.period}</h3>
                  <p className="mt-2 text-sm leading-7">{pro.desc} É aqui que entram a fila de envio com intervalo entre mensagens, o horário de descanso, o máximo de ofertas por dia e a variação do texto, o conjunto que responde à pergunta desta página.</p>
                </div>
              </div>
              <p className="mt-4">Os 7 dias grátis são com o Pro completo, sem cartão. Depois, cancela quando quiser e usa até o fim do período pago.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/login?mode=register" className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-black text-white hover:bg-emerald-800">Testar 7 dias grátis</Link>
                <Link href="/precos" className="rounded-full px-6 py-3 text-sm font-black text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">Ver planos e ficha técnica</Link>
              </div>
            </section>

            <section>
              <h2>Perguntas frequentes</h2>
              <div className="mt-4 space-y-5">
                {faq.map((item) => (
                  <div key={item.q}>
                    <h3>{item.q}</h3>
                    <p className="mt-1">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2>Continue lendo</h2>
              <ul>
                {entradas.map((l) => (
                  <li key={l.href}><Link href={l.href} className="font-bold text-emerald-700 hover:text-emerald-800">{l.label}</Link> — {l.note}</li>
                ))}
                {relatedRoutes.filter((route) => !entradas.some((l) => l.href === route.path)).map((route) => (
                  <li key={route.path}><Link href={route.path} className="font-bold text-emerald-700 hover:text-emerald-800">{route.label}</Link></li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
