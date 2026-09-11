import Link from 'next/link'
import { ArticleShell } from '@/components/marketing/ArticleShell'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getSiteUrl } from '@/lib/site-url'
import { buildRegisterHref } from '@/lib/marketing-attribution'
import { buildArticleJsonLd, getEditorialDates, EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'

/* Página criada em 2026-08-26 para a intenção "clonar mensagens de grupo
 * afiliado" / "clonar grupo de WhatsApp".
 *
 * Motivo: a Visão Geral criada por IA do Google responde essa busca listando
 * ferramentas concorrentes (TeleClone, Achadinhos Pro, Lumi) e o Espelha Grupos não
 * aparece — não existia nenhuma página nossa usando a palavra que a pessoa
 * digita. O site inteiro fala "espelhar"; o mercado busca "clonar".
 *
 * Isso NÃO reabre nenhuma linha congelada do AGENTS.md (não é cidade, não é
 * nicho novo, não é cluster "robô", não é Magalu): é uma intenção de produto
 * com termo próprio, do mesmo tipo das páginas de comparação com concorrente,
 * que são hoje o motor de crescimento de impressões.
 *
 * Formato pensado para ser CITÁVEL por resposta de IA: parágrafo de resposta
 * direta logo no topo, passo a passo em HowTo, lista de ferramentas em
 * ItemList e FAQ em FAQPage — os quatro formatos que a Visão Geral consome.
 * Sem promessa de ganho e sem promessa de imunidade a banimento
 * (PRODUCT_LIMITATIONS / uso responsável).
 */

const slug = '/clonar-mensagens-de-grupo-de-afiliados'
const title = 'Como clonar mensagens de grupo de afiliados no WhatsApp'
const description = 'Clonar um grupo de ofertas é copiar a mensagem da origem, trocar o link pelo seu link de afiliado e republicar no seu grupo ou canal. Veja como funciona, o que é permitido e quais ferramentas fazem isso.'
const siteUrl = getSiteUrl()

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${siteUrl}${slug}`, type: 'article', locale: 'pt_BR' },
}

const steps = [
  {
    name: 'Escolha os grupos de origem',
    text: 'Defina de quais grupos ou canais você quer copiar as ofertas. Você precisa participar deles com o número que vai rodar a operação — não existe forma legítima de ler um grupo do qual você não faz parte.',
  },
  {
    name: 'Conecte um número dedicado',
    text: 'Use um chip só da operação, nunca o número pessoal. É esse número que lê a origem e publica no destino.',
  },
  {
    name: 'Cadastre suas credenciais de afiliada',
    text: 'Etiqueta da Amazon, código da Shopee, conta do Mercado Livre. Sem isso a mensagem sai com o link do concorrente e a comissão é dele.',
  },
  {
    name: 'Defina os destinos e as regras',
    text: 'Escolha para quais grupos ou canais cada origem vai, com palavras bloqueadas, horário de silêncio, intervalo entre envios e limite por dia.',
  },
  {
    name: 'Revise as primeiras publicações',
    text: 'Confira preço, cupom, foto e se o link abre a loja com a sua identidade. Só depois aumente o volume, aos poucos.',
  },
]

const tools = [
  {
    name: 'Espelha Grupos',
    href: '/bot-achadinhos-whatsapp',
    text: 'Espelha grupo para grupo, grupo para canal, canal para grupo e canal para canal no WhatsApp, convertendo o link para o seu código de afiliada (Shopee, Amazon, Mercado Livre, Magalu, SHEIN) e também os links de cupom. Tem controle de cadência, limite por destino e registro do que saiu e do que foi bloqueado.',
  },
  {
    name: 'Achadinho Pro',
    href: '/alternativas/achadinho-pro',
    text: 'Bot de afiliados para WhatsApp com seleção de produtos por IA. O plano de entrada cobre só Shopee; os demais marketplaces entram no plano superior.',
  },
  {
    name: 'AchadinhosBot',
    href: '/alternativas/achadinhos-bot',
    text: 'Automação focada em Shopee, com teste grátis de 3 dias e preço que escala pelo número de grupos conectados.',
  },
  {
    name: 'ProAfiliados',
    href: '/alternativas/proafiliados',
    text: 'Atende WhatsApp e Telegram e tem plano gratuito permanente — em troca, o plano grátis insere a marca do próprio sistema nas mensagens.',
  },
  {
    name: 'Shozap',
    href: '/alternativas/shozap',
    text: 'Automação de ofertas para grupos de WhatsApp com foco em marketplaces.',
  },
  {
    name: 'FluxoPromo',
    href: '/alternativas/fluxopromo',
    text: 'Automação de divulgação de promoções em grupos, com curadoria de ofertas.',
  },
  {
    name: 'Promium',
    href: '/alternativas/promium',
    text: 'Cobra por faixa de grupos e por número de conexões; o plano de entrada custa mais que o nosso Pro.',
  },
]

const faq = [
  {
    q: 'O que significa clonar mensagens de um grupo de afiliados?',
    a: 'Significa copiar a publicação de um grupo ou canal de origem, trocar o link de afiliado de quem publicou pelo seu, e republicar no seu grupo ou canal. O nome técnico é espelhamento: a mensagem sai como publicação nova sua, não como encaminhamento.',
  },
  {
    q: 'Isso é permitido?',
    a: 'Depende do que você faz. Participar de um grupo público de ofertas, aproveitar a informação de preço e publicar a mesma oferta com o seu link de afiliado é prática comum do mercado. Copiar texto autoral, foto com marca de outra pessoa ou entrar em grupo fechado sem autorização, não. E nenhuma ferramenta te isenta das regras do WhatsApp e de cada programa de afiliados.',
  },
  {
    q: 'Dá para clonar um grupo de que eu não participo?',
    a: 'Não de forma legítima. A ferramenta lê as mensagens usando o seu próprio número conectado, então ela só enxerga o que você enxerga. Qualquer serviço que prometa ler grupo fechado sem você estar dentro deveria acender um alerta.',
  },
  {
    q: 'O link de afiliado troca sozinho?',
    a: 'Sim, quando você cadastra suas credenciais. O Espelha Grupos reconhece links de Shopee, Amazon, Mercado Livre, Magalu e SHEIN, inclusive links encurtados, e reescreve com a sua identidade antes de publicar. Links de cupom e voucher também são convertidos, em vez de removidos.',
  },
  {
    q: 'Clonar grupo aumenta o risco de banimento?',
    a: 'Publicar muita coisa em sequência, repetir o mesmo texto em todos os destinos e operar de madrugada aumentam o risco, sim — com ou sem ferramenta. Por isso a operação precisa de intervalo entre envios, limite por dia e horário de silêncio. Nenhuma ferramenta pode prometer imunidade a banimento, e desconfie de quem promete.',
  },
  {
    q: 'Funciona com Telegram?',
    a: 'O Espelha Grupos é feito para WhatsApp: grupos e Canais. Ferramentas de clonagem de Telegram são outra categoria de produto. Muita gente usa o Telegram como fonte de ofertas e o WhatsApp como destino, porque é no WhatsApp que a audiência brasileira compra.',
  },
  {
    q: 'Quantos grupos consigo espelhar ao mesmo tempo?',
    a: 'Depende do plano e, principalmente, do ritmo que o seu número aguenta. Vale mais um punhado de destinos com cadência controlada do que dezenas de grupos recebendo tudo de uma vez.',
  },
]

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Como clonar mensagens de um grupo de afiliados no WhatsApp',
  description,
  totalTime: 'PT20M',
  step: steps.map((step, index) => ({
    '@type': 'HowToStep',
    position: index + 1,
    name: step.name,
    text: step.text,
  })),
}

const toolsJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Ferramentas para clonar mensagens de grupos de afiliados',
  itemListElement: tools.map((tool, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: tool.name,
    description: tool.text,
    url: `${siteUrl}${tool.href}`,
  })),
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Espelha Grupos', item: siteUrl },
    { '@type': 'ListItem', position: 2, name: 'Conteúdos', item: `${siteUrl}/conteudos` },
    { '@type': 'ListItem', position: 3, name: 'Clonar mensagens de grupo de afiliados', item: `${siteUrl}${slug}` },
  ],
}

export default function Page() {
  const dates = getEditorialDates(slug)
  const articleSchemas = buildArticleJsonLd({
    title,
    description,
    slug,
    siteUrl,
    faq,
    author: { type: 'Person', name: EDITORIAL_PERSON_AUTHOR, description: EDITORIAL_PERSON_AUTHOR_DESCRIPTION },
  })
  const schemas = [...articleSchemas, howToJsonLd, toolsJsonLd, breadcrumbJsonLd]
  const registerHref = buildRegisterHref({ source: 'seo', campaign: 'clonar-grupo-afiliados', content: 'article_primary_cta' })

  return (
    <>
      <OrganicPageTracker route={{ slug: 'clonar-mensagens-de-grupo-de-afiliados', path: slug, cluster: 'dores-operacionais', intent: 'clonar mensagens de grupo afiliado', template: 'article' }} />
      {schemas.map((schema, index) => (
        <script key={`${schema['@type']}-${index}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleShell
        eyebrow="Espelhamento · Grupos de ofertas"
        title={title}
        description={description}
        origin="artigo_clonar_mensagens_grupo_afiliados"
        publishedAt={dates.publishedAt}
        updatedAt={dates.updatedAt}
        author={EDITORIAL_PERSON_AUTHOR}
      >
        <section>
          <h2>Resposta direta</h2>
          <p>
            <strong>Clonar mensagens de um grupo de afiliados é copiar a publicação de um grupo ou canal de origem, trocar o link do afiliado que publicou pelo seu link, e republicar no seu grupo ou canal do WhatsApp.</strong> O nome técnico disso é <strong>espelhamento</strong>. Um programa fica conectado ao seu número, lê os grupos que você escolheu como fonte, reconhece os links de Shopee, Amazon, Mercado Livre, Magalu e SHEIN, reescreve cada um com a sua identidade de afiliada e publica nos destinos que você definiu — com intervalo entre envios, palavras bloqueadas e limite por dia.
          </p>
          <p>
            Duas coisas que o mercado costuma não dizer: a ferramenta só lê os grupos dos quais <em>você</em> participa, e nenhuma delas pode prometer que o seu número não será bloqueado. O que muda o risco é o ritmo da operação, não a marca do programa.
          </p>
        </section>

        <section>
          <h2>Encaminhar não é a mesma coisa que clonar</h2>
          <p>
            Encaminhar mantém a mensagem original — inclusive o link do concorrente e a marca de “encaminhada”. A comissão daquela venda vai para quem publicou primeiro, e o seu grupo vira vitrine do outro.
          </p>
          <p>
            Clonar (espelhar) publica uma mensagem <strong>nova</strong>, sua, com o link já convertido para o seu código. É a diferença entre divulgar de graça para outra pessoa e ser paga pelo trabalho que você já está tendo.
          </p>
        </section>

        <section>
          <h2>Como clonar um grupo de ofertas, passo a passo</h2>
          <ol>
            {steps.map((step) => (
              <li key={step.name}>
                <strong>{step.name}.</strong> {step.text}
              </li>
            ))}
          </ol>
          <p>
            Do cadastro até a primeira oferta espelhada costuma dar menos de meia hora. O que leva tempo mesmo é ajustar cadência e palavras bloqueadas nos primeiros dias.
          </p>
        </section>

        <section>
          <h2>Ferramentas que clonam mensagens de grupos de afiliados</h2>
          <p>
            Todas fazem o mesmo trabalho básico — ler a origem, trocar o link, publicar no destino. O que muda é quais lojas cada uma cobre, quantos grupos cabem no plano e quanto controle você tem sobre o ritmo do envio.
          </p>
          <ul>
            {tools.map((tool) => (
              <li key={tool.name}>
                <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href={tool.href}>{tool.name}</Link>
                {` — ${tool.text}`}
              </li>
            ))}
          </ul>
          <p>
            Para Telegram existe uma categoria separada de programas de clonagem de canal. O Espelha Grupos não atua nessa ponta: ele é feito para WhatsApp, que é onde a audiência brasileira de achadinhos compra.
          </p>
          <p>
            Comparação lado a lado, com preço de cada plano: <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/melhores-bots-para-afiliados-whatsapp">melhores bots para afiliados no WhatsApp</Link>.
          </p>
        </section>

        <section>
          <h2>Onde essa operação costuma perder dinheiro</h2>
          <ul>
            <li>Link que sai sem conversão porque o código de acesso da loja venceu e ninguém percebeu.</li>
            <li>Cupom apagado da mensagem — sem ele o preço anunciado não fecha, e a pessoa desiste.</li>
            <li>Oferta repetida no mesmo grupo poucas horas depois, o que cansa a audiência.</li>
            <li>Publicação de madrugada e em rajada, que é o padrão que mais chama atenção como comportamento de robô.</li>
            <li>Oferta que sai sem foto, porque a loja bloqueou a leitura da página do produto.</li>
          </ul>
          <p>
            São problemas de operação, não de sorte. Todos aparecem no registro de envios — quem só olha o grupo não enxerga nenhum deles.
          </p>
        </section>

        <section>
          <h2>Os limites que valem a pena respeitar</h2>
          <p>
            Aproveitar a informação de uma oferta pública e publicá-la com o seu link é prática comum e aceita. Copiar texto autoral, arte com a marca de outra pessoa ou entrar em grupo fechado sem autorização, não é. Vale também ler as regras de cada programa de afiliados: alguns limitam onde o link pode circular.
          </p>
          <p>
            E o de sempre: promessa de “anti-ban garantido” não existe. O que existe é operação com cadência, variação e monitoramento — o que a gente chama de{' '}
            <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/anti-ban-whatsapp">redução de risco</Link>, sem promessa de imunidade.
          </p>
        </section>

        <section>
          <h2>Continue por aqui</h2>
          <ul>
            <li><Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/espelhar-grupos-whatsapp">Espelhar grupos de WhatsApp</Link> — como a operação se organiza por dentro</li>
            <li><Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/bot-achadinhos-whatsapp">Bot de achadinhos para WhatsApp</Link> — conversão de link e cadência</li>
            <li><Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/blog/como-converter-link-de-afiliado-automaticamente-whatsapp">Converter link de afiliado automaticamente</Link> — o que acontece com cada loja</li>
            <li><Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/blog/grupo-ou-canal-whatsapp-achadinhos">Grupo ou canal para achadinhos?</Link> — onde publicar o que você espelhou</li>
            <li><Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/copiaram-minha-oferta-no-whatsapp">Copiaram a sua oferta</Link> — o outro lado: marca d&apos;água, texto próprio e quem leva a comissão</li>
          </ul>
        </section>

        <section>
          <h2>Próximo passo</h2>
          <p>
            Se você já participa de grupos que publicam boas ofertas, o trabalho de copiar, trocar link e colar é justamente a parte que dá para tirar da sua mão.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-black text-white no-underline hover:bg-emerald-700"
              href={registerHref}
              data-seo-cta="article_clonar_grupo_register"
              data-cta-position="article_next_step_primary"
              data-cta-stage="signup"
              data-cta-destination="register"
            >
              Testar o espelhamento
            </Link>
            <Link
              className="rounded-2xl border border-emerald-200 px-5 py-4 text-center font-black text-emerald-700 no-underline hover:bg-emerald-50"
              href="/precos"
              data-seo-cta="article_clonar_grupo_pricing"
              data-cta-position="article_next_step_secondary"
              data-cta-stage="consideration"
              data-cta-destination="pricing"
            >
              Ver planos e preços
            </Link>
          </div>
        </section>

        <section>
          <h2>Perguntas frequentes</h2>
          {faq.map((item) => (
            <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
              <p className="mt-3 text-gray-700">{item.a}</p>
            </details>
          ))}
        </section>
      </ArticleShell>
    </>
  )
}
