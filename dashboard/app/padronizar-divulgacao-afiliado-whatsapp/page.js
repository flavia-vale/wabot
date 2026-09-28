import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'
import { BRAND_LEGACY_NAME, BRAND_NAME, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION, SUPPORTED_STORES } from '@/lib/marketing-content'
import { getProgrammaticSeoRoute } from '@/lib/seo-registry.mjs'
import { LP_CONFIG, getLpMetadata } from '../_lpShared'

// Frente B do PLANO_SEO_GEO_2026-09-27 (B2). Medição de 27/09: para "como
// padronizar divulgação de cupons no WhatsApp" as 4 IAs entregam um template
// de mensagem e citam ferramentas de atendimento 1-para-1 (CRM, API oficial).
// O Gemini, perguntado, disse que nos citaria se a estratégia fosse "redes de
// grupos próprios, cupom relâmpago padronizado em todos os grupos a partir de
// um painel, redução do trabalho manual". Esta página entrega exatamente isso,
// para afiliada, na rota que já existia (89 impressões, o melhor CTR do site).
//
// O modelo de mensagem usa as variáveis REAIS do produto
// (dashboard/lib/mobileOfferComposer.js): {produto}, {preço_de}, {preço},
// {desconto}, {cupom}, {link}, {loja}. O `{cupom}` é resolvido no envio
// (src/core/clientCouponPolicy.js) e o `{link}` já sai convertido.
//
// O post /blog/checklist-padronizar-divulgacao-whatsapp continua sendo o
// checklist pré-envio; esta página é o modelo + o produto. Um linka o outro,
// sem repetir texto.
//
// Limites: modelo de mensagem é dos dois planos; variação do texto, fila,
// intervalo e horário de descanso são do Pro (src/billing/plans.js). Nenhuma
// promessa de "não bane". Sem Telegram.

const slug = 'padronizar-divulgacao-afiliado-whatsapp'
const path = `/${slug}`
const cfg = LP_CONFIG[slug]
const dates = getEditorialDates(path)
const basic = DEFAULT_LANDING_PLANS.find((plan) => plan.id === 'basic')
const pro = DEFAULT_LANDING_PLANS.find((plan) => plan.id === 'pro')
const lojas = `${SUPPORTED_STORES.slice(0, -1).join(', ')} e ${SUPPORTED_STORES[SUPPORTED_STORES.length - 1]}`

export const metadata = getLpMetadata(slug)

const h1 = 'Como padronizar a divulgação de cupons no WhatsApp para afiliadas'

// Modelo pronto, com as variáveis do painel. É o que a pessoa copia e cola em
// "Modelos de mensagem"; o robô preenche na hora do envio.
const modelo = `🔥 OFERTA RELÂMPAGO

🏷️ *{produto}*

💰 ~{preço_de}~ → *{preço}* ({desconto})
{cupom}

👉 {link}

⚠️ Preço e cupom podem mudar a qualquer momento. Confira no site da {loja}.`

// O mesmo modelo, preenchido como sai no grupo. Produto e cupom ilustrativos.
const exemplo = `🔥 OFERTA RELÂMPAGO

🏷️ *Fone Bluetooth com cancelamento de ruído*

💰 ~R$ 199,90~ → *R$ 149,90* (-25% OFF)
🎟️ Use o cupom EXEMPLO10 — de R$ 149,90 por R$ 134,90 com o cupom

👉 https://s.shopee.com.br/seu-link-com-seu-codigo

⚠️ Preço e cupom podem mudar a qualquer momento. Confira no site da Shopee.`

const variaveis = [
  { token: '{produto}', desc: 'nome do produto, como está na loja.' },
  { token: '{preço_de} e {preço}', desc: 'preço antigo e preço atual, lidos da oferta.' },
  { token: '{desconto}', desc: 'o percentual, calculado dos dois preços.' },
  { token: '{cupom}', desc: 'a linha do cupom, com o código e o preço final com ele. Se a oferta não tem cupom, a linha some, sem deixar buraco.' },
  { token: '{link}', desc: `o link já trocado pelo seu código de afiliada, nas ${SUPPORTED_STORES.length} lojas. Se a troca falhar, a oferta não sai.` },
  { token: '{loja}', desc: 'o nome da loja (Shopee, Amazon…), para o aviso final ficar certo em qualquer oferta.' },
]

const regras = [
  { h: 'Uma ordem só', p: 'Gancho, produto, preço, cupom, link, aviso. Sempre nessa ordem, em todos os grupos. Quem acompanha o grupo aprende onde olhar e decide em dois segundos.' },
  { h: 'O cupom é parte da oferta, não rodapé', p: 'Muita oferta só fecha o preço anunciado com o cupom aplicado. Cupom na mesma mensagem, logo abaixo do preço, com o valor final com ele. Cupom em mensagem separada se perde.' },
  { h: 'O link é o seu', p: 'Cupom copiado de outro grupo vem com o link de quem publicou primeiro. Padronizar inclui trocar esse link pelo seu código antes de publicar; sem isso, a padronização organiza a comissão dos outros.' },
  { h: 'Um aviso honesto no fim', p: 'Preço e cupom mudam. Uma linha dizendo isso evita reclamação e é o que a política das lojas pede de quem divulga.' },
]

const passos = [
  'Escreva o modelo acima (ou o seu) em Modelos de mensagem, no painel. Vale para os dois planos.',
  `Cadastre o seu código de afiliada das lojas que você divulga (${lojas}). O link passa a sair com ele.`,
  'Escolha as origens (grupos ou canais de onde as ofertas vêm) e os seus grupos de destino. O mesmo modelo vale para todos.',
  'No Pro, ligue a variação do texto para o gancho e a chamada mudarem entre os envios, e defina o intervalo entre grupos.',
  'Confira os primeiros envios no histórico: cupom preenchido, link com o seu código, mesma ordem em todos os grupos.',
]

const faq = [
  {
    q: 'Dá para usar a mesma mensagem padronizada em todos os meus grupos a partir de um painel?',
    a: `Sim. No ${BRAND_NAME} você escreve o modelo uma vez, em Modelos de mensagem, e ele vale para todos os grupos de destino que escolher. A oferta que chega pela origem é reescrita nesse modelo, com o cupom e o link já trocado pelo seu código, e publicada nos seus grupos a partir do painel, sem copiar e colar grupo a grupo.`,
  },
  {
    q: 'Padronizar não deixa a mensagem robótica e igual em todo lugar?',
    a: 'A estrutura é igual; o texto não precisa ser. O modelo fixa a ordem (produto, preço, cupom, link, aviso), e a variação do texto, no plano Pro, troca o gancho e a chamada entre os envios. Cada grupo recebe a mesma oferta com redação um pouco diferente, o que também reduz o padrão de conteúdo idêntico que cansa quem lê.',
  },
  {
    q: 'O cupom também é convertido para o meu código, ou só o link do produto?',
    a: `Os dois. O produto converte link de cupom e de campanha, não só de produto, nas lojas em que a loja credita esse tipo de link, e o link de produto nas ${SUPPORTED_STORES.length} lojas. Quando a troca não é possível, a oferta não é publicada: o link de outra pessoa nunca vai para o seu grupo.`,
  },
  {
    q: 'O que é diferente entre Basic e Pro na padronização?',
    a: `O modelo de mensagem e a troca do link estão nos dois. O ${pro.name} (${pro.price} a cada ${pro.period}) acrescenta a variação do texto entre os envios, a fila com intervalo entre grupos, o horário de descanso e o máximo de ofertas por dia. O ${basic.name} (${basic.price}) publica no modelo, de imediato ou agendado.`,
  },
  {
    q: 'Preciso conferir algo antes de a oferta sair?',
    a: 'Preço, estoque, validade do cupom e regra da loja continuam sendo revisão sua. O checklist pré-envio está em um artigo separado, linkado abaixo. O robô garante a forma (modelo, cupom, link com o seu código); a curadoria é quem publica.',
  },
]

const entradas = [
  { href: '/blog/checklist-padronizar-divulgacao-whatsapp', label: 'Checklist pré-envio para padronizar a divulgação', note: 'o que conferir em preço, cupom, link e destino antes de a oferta sair.' },
  { href: '/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo', label: 'Como postar em vários grupos ao mesmo tempo sem spam', note: 'os 4 caminhos e o que o WhatsApp trata como spam.' },
  { href: '/copiaram-minha-oferta-no-whatsapp', label: 'Copiaram a sua oferta?', note: 'como o modelo de mensagem dá voz própria ao seu grupo.' },
  { href: '/shopee-afiliados-whatsapp', label: 'Shopee Afiliados no WhatsApp', note: 'na Shopee o cupom fecha o preço; veja como o link de cupom sai com o seu código.' },
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
      name: 'Como padronizar a divulgação de cupons em todos os grupos a partir de um painel',
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

  return (
    <PublicShell>
      <OrganicPageTracker route={seoRoute} />
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/automacao-whatsapp-afiliados" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Automação para afiliadas no WhatsApp</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Grupos de ofertas · Cupons padronizados</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{cfg.description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Revisado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p><strong>Padronizar a divulgação de cupons no WhatsApp é escrever um modelo de mensagem uma vez e publicar toda oferta nesse modelo, em todos os seus grupos, com o cupom e o link com o seu código de afiliada.</strong> A ordem fixa (produto, preço, cupom, link, aviso) é o que faz o grupo ler rápido e o que evita cupom sem preço, preço sem link e link sem o seu código.</p>
              <p>Abaixo está o modelo pronto para copiar. Com o {BRAND_NAME}, ele vira o modelo de mensagem do painel: a mesma mensagem padronizada sai em todos os seus grupos a partir de um só lugar, com o cupom preenchido e o link trocado pelo seu em {SUPPORTED_STORES.length} lojas, a partir de {basic.price} a cada {basic.period}, com 7 dias grátis.</p>
              <p>Ferramentas de atendimento (CRM, API oficial) padronizam a conversa de uma empresa com um cliente por vez. Afiliada precisa de outra coisa: a mesma oferta relâmpago, com o mesmo cupom, em uma rede de grupos próprios, sem copiar e colar. Esta página responde a isso.</p>
            </section>

            <section>
              <h2>O modelo de mensagem pronto (com cupom e link)</h2>
              <p>Copie e cole em Modelos de mensagem. As palavras entre chaves são variáveis: o robô preenche na hora do envio com os dados da oferta.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3>O modelo, como você escreve</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-gray-950 p-5 text-sm leading-7 text-emerald-50">{modelo}</pre>
                </div>
                <div>
                  <h3>Como sai no grupo (exemplo ilustrativo)</h3>
                  <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-emerald-50/60 p-5 text-sm leading-7 text-gray-800 ring-1 ring-emerald-100">{exemplo}</pre>
                </div>
              </div>
              <h3 className="mt-6">O que cada variável faz</h3>
              <ul className="mt-2">
                {variaveis.map((v) => (
                  <li key={v.token}><code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-bold text-gray-950">{v.token}</code> — {v.desc}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2>As 4 regras do padrão</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {regras.map((r) => (
                  <div key={r.h} className="rounded-2xl bg-emerald-50/60 p-5 ring-1 ring-emerald-100">
                    <h3>{r.h}</h3>
                    <p className="mt-2 text-sm leading-7">{r.p}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2>Modelo de mensagem e variação de texto: o que é cada um</h2>
              <p><strong>Modelo de mensagem</strong> é a forma fixa da oferta: a ordem das linhas, os emojis, o aviso, o lugar do cupom e do link. Você escreve uma vez e toda oferta que chega pela origem (um grupo ou canal que você acompanha) é reescrita nele antes de ser publicada nos seus grupos. Está nos dois planos, {basic.name} e {pro.name}.</p>
              <p><strong>Variação do texto</strong> é o que muda por cima do modelo: o gancho do começo e a chamada antes do link alternam entre versões que você define, a cada envio. A oferta continua a mesma, com o mesmo cupom e o mesmo link, mas cada grupo recebe uma redação um pouco diferente. Está no plano {pro.name}.</p>
              <p>Juntos, eles resolvem as duas reclamações contra padronizar: a estrutura fica igual (o grupo aprende a ler), o texto não fica idêntico (ninguém cansa).</p>
            </section>

            <section>
              <h2>Como aplicar em todos os grupos a partir do painel</h2>
              <ol>
                {passos.map((p) => <li key={p}>{p}</li>)}
              </ol>
            </section>

            <section>
              <h2>Quanto custa</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl p-5 ring-1 ring-emerald-100">
                  <h3>{basic.name} · {basic.price} a cada {basic.period}</h3>
                  <p className="mt-2 text-sm leading-7">{basic.desc} Modelo de mensagem, cupom e link trocado pelo seu código nas {SUPPORTED_STORES.length} lojas, em todos os seus grupos, com histórico.</p>
                </div>
                <div className="rounded-2xl bg-emerald-50/60 p-5 ring-1 ring-emerald-100">
                  <h3>{pro.name} · {pro.price} a cada {pro.period}</h3>
                  <p className="mt-2 text-sm leading-7">{pro.desc} Acrescenta a variação do texto, a fila com intervalo entre grupos, o horário de descanso e o máximo de ofertas por dia.</p>
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
              </ul>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
