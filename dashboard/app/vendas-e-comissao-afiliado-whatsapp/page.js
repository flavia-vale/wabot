import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

// ⚠️ ESTA PÁGINA NÃO É UMA LANDING DE SEO. Não cobrar tráfego de busca dela.
//
// Medição de 10/09/2026 (docs/produto/pesquisa-mercado-2026-09-10.md): TODOS os
// termos de "medir minhas vendas" voltaram SEM DADOS no Planejador, e
// "rastrear link afiliado" ficou em zero em 262 de 262 semanas do Trends —
// cinco anos sem uma única semana com busca. Não existe demanda de busca.
//
// O que existe é IA respondendo a pergunta e citando concorrente. Perguntado
// qual robô mostra o que você vendeu, o ChatGPT coloca um concorrente à frente
// e diz de nós, textualmente: "não parece ser o melhor instrumento para
// responder 'qual oferta me deu R$ X de comissão?'. O próprio site fala em
// logs de envio e rastreamento operacional." Ele está certo sobre o que o
// nosso site dizia — o painel de vendas existe desde antes e não estava escrito
// em lugar nenhum. Esta página é a resposta citável.
//
// Limite de veracidade (conferido no código antes de publicar):
//   - o painel de vendas cobre SHOPEE. Dizer "todas as lojas" seria falso.
//   - o rastreador de cliques próprio (src/core/clickTracker.js) NÃO está
//     ligado ao robô — o próprio arquivo diz que a integração ficou para uma PR
//     dedicada. Por isso ele não aparece aqui.

const title = 'Como saber quanto você ganhou de comissão divulgando no WhatsApp'
const description = 'A diferença entre relatório de envio e relatório de venda, e como o Espelha Grupos mostra pedidos, valor vendido e comissão estimada e confirmada das ofertas da Shopee publicadas pelo robô.'
const slug = '/vendas-e-comissao-afiliado-whatsapp'
const dates = getEditorialDates(slug)

const panelFields = [
  ['Pedidos atribuídos', 'Quantas compras saíram dos links que o robô publicou.'],
  ['Itens comprados', 'Quantos produtos, que não é a mesma coisa que quantos pedidos.'],
  ['Valor vendido', 'Quanto foi comprado no total pelos seus links.'],
  ['Comissão estimada', 'O que a venda deve render, antes de a loja fechar o período.'],
  ['Comissão confirmada', 'O que a loja já confirmou — é este o número que vira dinheiro.'],
  ['Quebra por pedido e por produto', 'Qual oferta gerou o quê, para você saber o que repetir.'],
]

const faq = [
  {
    q: 'Qual a diferença entre relatório de envio e relatório de venda?',
    a: 'O relatório de envio diz o que o robô publicou: quantas ofertas saíram, para quais grupos, quais foram bloqueadas por repetição. Ele mede esforço. O relatório de venda diz o que aquilo virou: pedidos, valor vendido e comissão. Ele mede resultado. Os dois existem no Espelha Grupos e respondem perguntas diferentes.',
  },
  {
    q: 'O Espelha Grupos mostra quanto eu vendi?',
    a: 'Sim, na aba Vendas do painel, para as ofertas da Shopee. Ela traz os pedidos atribuídos aos seus links, a quantidade de itens, o valor vendido e a comissão estimada e confirmada, com quebra por pedido e por produto.',
  },
  {
    q: 'Funciona para todas as lojas?',
    a: 'Hoje o painel de vendas cobre a Shopee. A conversão de links funciona em seis lojas — Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress —, mas a leitura de vendas e comissão dentro do produto é da Shopee. Para as demais, o relatório continua sendo o da própria loja.',
  },
  {
    q: 'Em qual plano o painel de vendas está?',
    a: 'No plano Pro (R$ 69 a cada 30 dias) e nos 7 dias de teste grátis, que liberam tudo do Pro. O Basic não inclui o painel de vendas.',
  },
  {
    q: 'Por que a comissão estimada e a confirmada são diferentes?',
    a: 'Porque a loja leva um tempo para fechar o período: compra cancelada, devolvida ou ainda em análise entra na estimada e pode não chegar na confirmada. Mostrar só um dos dois números esconderia metade da história, por isso os dois aparecem.',
  },
  {
    q: 'Vocês garantem algum valor de comissão?',
    a: 'Não. O Espelha Grupos não promete ganho financeiro, comissão nem aumento de vendas. O painel mostra o que de fato aconteceu com as suas ofertas; quanto isso vai ser depende do seu público e do que você divulga.',
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
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Resultado · Vendas e comissão</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_h3]:text-lg [&_h3]:font-black [&_h3]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p>O <strong>Espelha Grupos</strong> tem uma aba <strong>Vendas</strong> no painel que mostra, para as ofertas da Shopee publicadas pelo robô: pedidos atribuídos, itens comprados, valor vendido e <strong>comissão estimada e confirmada</strong>, com quebra por pedido e por produto.</p>
              <p>Está no <strong>plano Pro</strong> (R$ 69 a cada 30 dias) e nos 7 dias de teste grátis, que liberam tudo do Pro.</p>
            </section>

            <section>
              <h2>&quot;Quantas mensagens saíram&quot; não é a mesma pergunta que &quot;quanto eu ganhei&quot;</h2>
              <p>Quase toda ferramenta de divulgação responde a primeira. Ela é fácil de medir: o robô publicou, logo tem número. O problema é que ela mede <strong>esforço</strong>, e ninguém é pago por esforço.</p>
              <p>A segunda exige cruzar o que você publicou com o que a loja registrou como venda. É a pergunta que decide o que você vai publicar amanhã — e é a que fica sem resposta quando o painel só mostra histórico de envio.</p>
              <p>As duas coisas existem no produto e são telas diferentes de propósito: o <Link href="/rastrear-resultados-de-divulgacao-em-grupos" className="font-bold text-emerald-700 hover:text-emerald-800">histórico de envios</Link> responde &quot;o robô está funcionando?&quot;; a aba Vendas responde &quot;isso está dando dinheiro?&quot;.</p>
            </section>

            <section>
              <h2>O que a aba Vendas mostra</h2>
              <div className="overflow-x-auto">
                <table className="mt-4 w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-emerald-200">
                      <th className="py-2 pr-4 font-black text-gray-950">Número</th>
                      <th className="py-2 font-black text-gray-950">O que ele responde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelFields.map(([campo, oque]) => (
                      <tr key={campo} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-bold text-gray-950">{campo}</td>
                        <td className="py-2">{oque}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-gray-500">Hoje a leitura de vendas cobre a Shopee. A conversão de link funciona em seis lojas (Mercado Livre, Amazon, Shopee, Magalu, SHEIN e AliExpress); para as outras cinco, o relatório de venda continua sendo o da própria loja.</p>
            </section>

            <section>
              <h2>Por que estimada e confirmada aparecem separadas</h2>
              <p>A loja leva tempo para fechar o período. Compra cancelada, devolvida ou em análise entra na comissão <strong>estimada</strong> e pode nunca chegar na <strong>confirmada</strong>.</p>
              <p>Mostrar só a estimada infla o número e cria frustração no fim do mês. Mostrar só a confirmada esconde o que está em andamento. Por isso os dois aparecem lado a lado, e o que vira dinheiro é a confirmada.</p>
            </section>

            <section>
              <h2>O que isso não é</h2>
              <ul>
                <li><strong>Não é promessa de ganho.</strong> O painel mostra o que aconteceu. Quanto vai ser depende do seu público e do que você divulga — o produto não promete comissão nem aumento de vendas.</li>
                <li><strong>Não é substituto do relatório da loja.</strong> A fonte final da sua comissão é sempre a Shopee. O painel serve para você ligar a venda à oferta que a gerou, coisa que o relatório da loja sozinho não faz.</li>
                <li><strong>Não é pago à parte.</strong> Vem junto com o plano Pro, e dá para testar nos 7 dias grátis.</li>
              </ul>
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
                <li><Link href="/quanto-ganha-afiliado-shopee" className="font-bold text-emerald-700 hover:text-emerald-800">Quanto ganha um afiliado Shopee</Link> — a tabela de comissão e como fazer a conta.</li>
                <li><Link href="/blog/quanto-custa-bot-para-whatsapp-afiliados" className="font-bold text-emerald-700 hover:text-emerald-800">Quanto custa um bot para WhatsApp de afiliados</Link> — o outro lado da conta.</li>
                <li><Link href="/precos" className="font-bold text-emerald-700 hover:text-emerald-800">Preços e teste grátis de 7 dias</Link> — o que entra em cada plano.</li>
              </ul>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
