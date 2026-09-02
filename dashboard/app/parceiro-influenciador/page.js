import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'
import { buildRegisterHref } from '@/lib/marketing-attribution'

const slug = '/parceiro-influenciador'
const title = 'Parceria para criadores: robô grátis + 30% de comissão recorrente'
const description = 'Se você ensina afiliação ou tem audiência de afiliados: use o Espelha Grupos de graça e ganhe 30% de comissão recorrente de cada pessoa que assinar pelo seu link. Todo mês, enquanto ela for cliente.'

// Resposta direta em 40–60 palavras — bloco usado como snippet e citado por
// motores de IA. Não transformar em parágrafo longo.
const directAnswer =
  'A parceria do Espelha Grupos para criadores tem duas partes: você usa o robô de graça e recebe 30% de comissão recorrente de cada pessoa que assinar pelo seu link. Recorrente significa todo mês, enquanto a pessoa continuar cliente — não é comissão de uma venda só. O saque é por PIX.'

// Valores derivados dos planos vigentes (dashboard/lib/marketing-content.js:
// Basic R$39, Pro R$69) e do percentual configurado em AffiliateSettings
// (commissionPercent / commissionRecurringPercent = 30). Se o preço ou o
// percentual mudar, ESTES NÚMEROS PRECISAM MUDAR JUNTO.
const PLAN_BASIC_PRICE = 39
const PLAN_PRO_PRICE = 69
const COMMISSION_PERCENT = 30

const commissionPerMonth = (price) => (price * COMMISSION_PERCENT) / 100

const scenarios = [
  { indicados: 5, label: '5 indicados' },
  { indicados: 10, label: '10 indicados' },
  { indicados: 25, label: '25 indicados' },
  { indicados: 50, label: '50 indicados' },
]

const formatBrl = (value) => `R$${value.toFixed(2).replace('.', ',')}`

const forWhom = [
  {
    title: 'Você ensina afiliação',
    body: 'Mentoria, curso, canal ou comunidade de gente que quer ganhar dinheiro como afiliado de Shopee, Amazon ou Mercado Livre. O robô é a ferramenta que seus alunos precisam depois que aprendem o método.',
  },
  {
    title: 'Você opera grupos de ofertas em escala',
    body: 'Já tem vários grupos ou canais e o pessoal te pergunta "como você dá conta de postar em tudo isso?". A resposta vira renda recorrente pra você.',
  },
  {
    title: 'Você cria conteúdo sobre renda extra',
    body: 'Sua audiência quer começar algo. Divulgar oferta em grupo com link de afiliado é uma das portas de entrada mais baratas — e o robô tira o trabalho manual da conta.',
  },
]

const howItWorks = [
  'Você se cadastra no programa de afiliados e recebe um link com o seu código.',
  'A gente libera o robô na sua conta, sem cobrar, para você usar de verdade na sua operação.',
  'Você divulga como quiser — vídeo, story, aula, comunidade. Sem roteiro obrigatório.',
  'Cada pessoa que assinar pelo seu link gera 30% de comissão pra você, todos os meses em que ela pagar.',
  'A comissão fica em carência de 30 dias (prazo de cancelamento/estorno) e depois pode ser sacada por PIX a partir de R$50.',
]

const faq = [
  {
    q: 'A comissão é mesmo recorrente ou só na primeira venda?',
    a: 'Recorrente. Você recebe 30% na primeira mensalidade e 30% em cada mensalidade seguinte, enquanto a pessoa continuar cliente. Se ela cancelar, a comissão daquele mês em diante para — mas o que já foi liberado é seu.',
  },
  {
    q: 'Quanto isso dá em reais?',
    a: `No plano Pro (R$${PLAN_PRO_PRICE}/mês) são ${formatBrl(commissionPerMonth(PLAN_PRO_PRICE))} por mês por indicado. No Basic (R$${PLAN_BASIC_PRICE}/mês), ${formatBrl(commissionPerMonth(PLAN_BASIC_PRICE))}. Dez indicados no Pro somam ${formatBrl(commissionPerMonth(PLAN_PRO_PRICE) * 10)} por mês, todo mês.`,
  },
  {
    q: 'O robô grátis tem prazo?',
    a: 'A cortesia começa em 90 dias e é renovada automaticamente enquanto você tiver pelo menos dois indicados pagantes ativos. Se ficar abaixo disso, você não perde o acesso de uma hora para outra: passa a ter 50% de desconto. A comissão de 30% não depende da cortesia — ela continua enquanto seus indicados pagarem.',
  },
  {
    q: 'Preciso ter quantos seguidores?',
    a: 'Não existe número mínimo. O que pesa é o tipo de audiência: mil pessoas que querem virar afiliadas valem mais que cem mil pessoas que só querem comprar barato.',
  },
  {
    q: 'Quando e como eu recebo?',
    a: 'Cada comissão passa por uma carência de 30 dias — é o prazo para garantir que a assinatura não foi cancelada nem estornada. Depois disso ela entra no seu saldo disponível e você solicita o saque por PIX direto no painel, a partir de R$50.',
  },
  {
    q: 'Preciso assinar exclusividade ou seguir um roteiro?',
    a: 'Não. Você não fica impedido de divulgar outras ferramentas e não existe roteiro obrigatório. A gente só pede uma coisa: não prometer que o WhatsApp não bane. Ninguém pode garantir isso, e prometer prejudica você e a gente.',
  },
  {
    q: 'E se eu quiser mais que 30%?',
    a: 'Trinta por cento recorrente já é o teto que fecha a conta depois da taxa de pagamento e do custo de servidor por cliente. O que dá para fazer é bônus por volume — um valor fixo quando você passa de uma quantidade de indicados ativos. Fale com a gente.',
  },
  {
    q: 'O que exatamente o robô faz?',
    a: 'Ele acompanha um grupo ou canal de ofertas que você escolhe e republica essas ofertas nos seus grupos e canais já com o seu link de afiliado no lugar do link de terceiro — Shopee, Amazon, Mercado Livre e Magalu. Os envios saem espaçados, com limite por grupo e respeito a horário, em vez de sair tudo de uma vez.',
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
  const author = { type: 'Person', name: EDITORIAL_PERSON_AUTHOR, description: EDITORIAL_PERSON_AUTHOR_DESCRIPTION }
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl, faq, type: 'Article', author })
  const registerHref = buildRegisterHref({
    source: 'parceiro-influenciador',
    medium: 'organic',
    campaign: 'parceria-influenciador-2026q3',
  })

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Parceria para criadores</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">
            Robô grátis pra você + 30% de comissão recorrente
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{directAnswer}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={registerHref}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white no-underline hover:bg-emerald-700"
            >
              Quero ser parceiro
            </Link>
            <Link href="/termos-parceria-influenciador" className="text-sm font-black text-emerald-700 no-underline hover:text-emerald-800">
              Ler as regras da parceria →
            </Link>
          </div>

          <section className="mt-12">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Quanto isso dá por mês</h2>
            <p className="mt-3 leading-8 text-gray-700">
              A conta é simples: {COMMISSION_PERCENT}% da mensalidade de cada indicado, todo mês em que ele pagar.
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-emerald-100">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">Seus indicados</th>
                    <th className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">No plano Basic (R${PLAN_BASIC_PRICE})</th>
                    <th className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">No plano Pro (R${PLAN_PRO_PRICE})</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((scenario, i) => (
                    <tr key={scenario.label} className={i === scenarios.length - 1 ? '' : 'border-b border-emerald-50'}>
                      <td className="p-4 align-top font-semibold text-gray-950">{scenario.label}</td>
                      <td className="p-4 align-top text-gray-600">{formatBrl(commissionPerMonth(PLAN_BASIC_PRICE) * scenario.indicados)}/mês</td>
                      <td className="p-4 align-top text-gray-600">{formatBrl(commissionPerMonth(PLAN_PRO_PRICE) * scenario.indicados)}/mês</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-emerald-100 bg-emerald-50/60 p-3 text-xs text-gray-500">
                Valores por mês, enquanto os indicados seguirem pagando. Não é projeção de ganho nem promessa de
                resultado: quantas pessoas assinam pelo seu link depende do seu público e da sua divulgação.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Para quem essa parceria faz sentido</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {forWhom.map((item) => (
                <div key={item.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <h3 className="text-lg font-black text-gray-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Como funciona, passo a passo</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-6 leading-8 text-gray-700">
              {howItWorks.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </section>

          <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">O que a gente pede em troca</h2>
            <p className="mt-3 leading-8 text-gray-700">
              Uma coisa só, e ela é séria: <strong>não prometa que o WhatsApp não bane</strong>. Nenhuma ferramenta
              pode garantir isso, e quem promete está mentindo. O que o Espelha Grupos faz é reduzir o risco — espaça os
              envios, limita volume por grupo, respeita horário e varia as mensagens. Isso é o oposto de disparo em
              massa, e é assim que a gente fala no site inteiro.
            </p>
            <p className="mt-3 leading-8 text-gray-700">
              Divulgar prometendo imunidade queima a sua credibilidade quando alguém for banido — e a nossa junto.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Perguntas frequentes</h2>
            <div className="mt-4 space-y-3">
              {faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                  <p className="mt-3 leading-7 text-gray-700">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-2xl bg-emerald-600 p-6 md:p-8">
            <h2 className="text-2xl font-black tracking-tight text-white">Bora começar?</h2>
            <p className="mt-3 max-w-2xl leading-8 text-emerald-50">
              Crie sua conta, ative o programa de afiliados e fale com a gente para liberar a cortesia do robô. Se
                depois de testar você achar que não é pra você, a gente encerra sem ressentimento.
            </p>
            <Link
              href={registerHref}
              className="mt-5 inline-block rounded-2xl bg-white px-6 py-3 text-sm font-black text-emerald-700 no-underline hover:bg-emerald-50"
            >
              Criar minha conta de parceiro
            </Link>
          </section>

          <p className="mt-8 text-sm text-gray-500">
            Regras completas em{' '}
            <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/termos-parceria-influenciador">
              termos da parceria
            </Link>
            . Quer comparar os programas de afiliados das lojas?{' '}
            <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/programa-de-afiliados">
              Veja o comparativo
            </Link>
            .
          </p>
        </article>
      </main>
    </PublicShell>
  )
}
