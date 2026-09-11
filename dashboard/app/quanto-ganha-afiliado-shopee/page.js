import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

// Única frente desta rodada sustentada por VOLUME DE BUSCA medido: a família
// "quanto ganha afiliado shopee" soma ~3.050 buscas/mês com concorrência baixa
// (16-25) no Planejador de 10/09/2026, e não havia página nossa respondendo.
// Ver docs/produto/pesquisa-mercado-2026-09-10.md.
//
// Os números de comissão NÃO são inventados aqui: são os mesmos já publicados
// em /blog/como-ser-afiliado-shopee-whatsapp, com a mesma fonte e a mesma data
// de consulta. Fonte única — se a Shopee mudar a tabela, os dois lugares mudam
// juntos, senão o site passa a discordar de si mesmo.
//
// Limite que não se cruza: a página explica COMO a conta é feita e nunca
// promete quanto alguém vai ganhar. A política de uso responsável já publicada
// diz que não prometemos comissão nem aumento de vendas.

const title = 'Quanto ganha um afiliado Shopee? A conta real, sem promessa'
const description = 'Quanto a Shopee paga de comissão, em quanto tempo a venda é atribuída a você e como fazer a conta do quanto dá para ganhar por mês — com a tabela oficial e sem promessa de resultado.'
const slug = '/quanto-ganha-afiliado-shopee'
const dates = getEditorialDates(slug)

const COMMISSION_SOURCE =
  'Fonte: Shopee Affiliate Program, "Entenda o Comissionamento da Shopee" (consultado em 30/07/2026). A comissão é calculada sobre o valor líquido da venda, sem impostos, cupons ou frete, e está sujeita a alteração sem aviso prévio da Shopee.'

const commissionRows = [
  ['Venda padrão (redes sociais, grupos e canais de WhatsApp)', '3%'],
  ['Vendas em lives', '3%'],
  ['Vendas via Shopee Vídeo', '3%'],
  ['Produtos do programa de Comissão Extra', 'até 30% (a comissão padrão soma com a extra paga pelo vendedor)'],
]

// A conta é ILUSTRATIVA e está escrita como tal. Ela existe para a pessoa
// conseguir fazer a própria conta, não para sugerir um resultado esperado.
const mathRows = [
  ['R$ 2.000', '3%', 'R$ 60'],
  ['R$ 5.000', '3%', 'R$ 150'],
  ['R$ 10.000', '3%', 'R$ 300'],
  ['R$ 10.000', '10% (parte em Comissão Extra)', 'R$ 1.000'],
]

const faq = [
  {
    q: 'Quanto ganha um afiliado Shopee por venda?',
    a: 'A comissão-base é de 3% sobre o valor líquido da venda. Em produtos do programa de Comissão Extra ela pode chegar a até 30%, porque a comissão padrão da Shopee soma com uma comissão extra paga pelo próprio vendedor. Numa venda de R$ 100 no valor líquido, 3% são R$ 3.',
  },
  {
    q: 'Dá para viver de afiliado Shopee?',
    a: 'Isso depende inteiramente de quanto você vende, e ninguém honesto consegue prometer um número. O que dá para dizer é a conta: o seu ganho é a comissão multiplicada pelo valor que passa pelos seus links. Para tirar R$ 1.000 por mês a 3%, seria preciso gerar cerca de R$ 33 mil em vendas líquidas no mês. Nós não prometemos comissão, ganho financeiro nem aumento de vendas.',
  },
  {
    q: 'Quanto tempo depois do clique a venda ainda conta para mim?',
    a: 'Até 7 dias. Se a pessoa clicar no seu link, colocar o produto no carrinho e só finalizar a compra dias depois, a comissão continua sendo sua desde que a compra aconteça dentro desse prazo.',
  },
  {
    q: 'É preciso pagar alguma coisa para ser afiliado Shopee?',
    a: 'Não. A entrada no programa de afiliados é gratuita. O que costuma custar dinheiro é a ferramenta que você usa para divulgar, não o programa em si.',
  },
  {
    q: 'Como eu sei quanto já ganhei de comissão?',
    a: 'Pelo relatório da própria Shopee e, se você usa o Espelha Grupos, também pelo painel de vendas dentro do produto: ele mostra os pedidos atribuídos aos seus links, o valor vendido e a comissão estimada e confirmada, separados por pedido e por produto.',
  },
  {
    q: 'Comprar pelo meu próprio link gera comissão?',
    a: 'Não. Nenhum programa de afiliado paga comissão sobre compra feita com o próprio link, e tentar isso costuma levar à suspensão da conta de afiliado.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const siteUrl = getSiteUrl()
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl, faq, type: 'Article' })

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/conteudos" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para conteúdos</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Shopee Afiliados · Comissão</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p>A Shopee paga <strong>3% sobre o valor líquido da venda</strong> na divulgação comum, e <strong>até 30%</strong> em produtos do programa de Comissão Extra. A venda conta para você por <strong>até 7 dias</strong> depois do clique.</p>
              <p>Então &quot;quanto ganha um afiliado Shopee&quot; não tem um número: tem uma conta. O seu ganho é a comissão multiplicada pelo valor que passa pelos seus links. Quem responde com um valor fixo está chutando ou vendendo alguma coisa.</p>
            </section>

            <section>
              <h2>Tabela de comissão da Shopee</h2>
              <div className="overflow-x-auto">
                <table className="mt-4 w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-emerald-200">
                      <th className="py-2 pr-4 font-black text-gray-950">Tipo de venda</th>
                      <th className="py-2 font-black text-gray-950">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionRows.map(([tipo, valor]) => (
                      <tr key={tipo} className="border-b border-gray-100">
                        <td className="py-2 pr-4">{tipo}</td>
                        <td className="py-2 font-bold text-emerald-700">{valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-gray-500">{COMMISSION_SOURCE}</p>
            </section>

            <section>
              <h2>Como fazer a sua própria conta</h2>
              <p>A fórmula é simples: <strong>valor vendido pelos seus links × comissão = o que você recebe</strong>. Os números abaixo são exemplos de cálculo para você usar com os seus próprios valores — não são resultado típico, média de cliente nem promessa nossa.</p>
              <div className="overflow-x-auto">
                <table className="mt-4 w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-emerald-200">
                      <th className="py-2 pr-4 font-black text-gray-950">Vendido no mês</th>
                      <th className="py-2 pr-4 font-black text-gray-950">Comissão média</th>
                      <th className="py-2 font-black text-gray-950">Você recebe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mathRows.map(([vendido, taxa, recebe]) => (
                      <tr key={`${vendido}-${taxa}`} className="border-b border-gray-100">
                        <td className="py-2 pr-4">{vendido}</td>
                        <td className="py-2 pr-4">{taxa}</td>
                        <td className="py-2 font-bold text-emerald-700">{recebe}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-gray-500">Exemplos de cálculo, não projeção de ganho. Quanto você vai vender depende do seu público, do que você divulga e da sua constância — nenhuma ferramenta, incluindo a nossa, garante isso.</p>
            </section>

            <section>
              <h2>As três coisas que mais derrubam a comissão de quem já está divulgando</h2>
              <h3>1. Link sem o seu código</h3>
              <p>É o mais comum e o mais silencioso: a venda acontece, o cliente compra, e a comissão vai para outra pessoa. Costuma acontecer quando alguém copia a oferta de outro grupo e republica o link como veio — aquele link carrega o código de quem publicou primeiro.</p>
              <h3>2. Não saber quanto entrou</h3>
              <p>Sem ver quais ofertas viraram venda, não dá para repetir o que funcionou. Quem só olha &quot;quantas mensagens enviei&quot; está medindo esforço, não resultado.</p>
              <h3>3. Cadência que queima o número</h3>
              <p>Disparar dezenas de links iguais em sequência arrisca o número de WhatsApp e cansa o grupo. A comissão de quem perdeu o número é zero, independentemente da tabela.</p>
            </section>

            <section>
              <h2>Onde o Espelha Grupos entra nessa conta</h2>
              <p>O Espelha Grupos é o produto; <strong>BOTinho é o nome do robô do Espelha Grupos</strong> — mesmo produto, não são dois.</p>
              <p>Ele age nos três pontos acima: converte todo link para o seu código de afiliada antes de publicar, mostra num <Link href="/vendas-e-comissao-afiliado-whatsapp" className="font-bold text-emerald-700 hover:text-emerald-800">painel de vendas e comissão</Link> quanto cada oferta gerou, e espaça os envios por grupo com intervalo, horário de descanso e limite diário.</p>
              <p>O que ele não faz: prometer que você vai vender mais. Isso depende do seu público, e a nossa <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 hover:text-emerald-800">política de uso responsável</Link> diz isso com todas as letras.</p>
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
                <li><Link href="/blog/como-ser-afiliado-shopee-whatsapp" className="font-bold text-emerald-700 hover:text-emerald-800">Shopee Afiliados: como entrar e quanto paga</Link> — o cadastro passo a passo e as regras do programa.</li>
                <li><Link href="/shopee-afiliados-whatsapp" className="font-bold text-emerald-700 hover:text-emerald-800">Divulgar Shopee no WhatsApp sem copiar e colar</Link> — o que muda na prática depois do cadastro.</li>
                <li><Link href="/programa-de-afiliados" className="font-bold text-emerald-700 hover:text-emerald-800">Shopee, Amazon ou Mercado Livre: qual programa escolher</Link> — comissão e prazo de atribuição dos três lado a lado.</li>
              </ul>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
