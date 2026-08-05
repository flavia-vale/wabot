import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'

const slug = '/termos-parceria-influenciador'
const title = 'Regras da parceria com criadores: cortesia e comissão recorrente'
const description = 'As regras da parceria do BOTinho com criadores: como funciona a cortesia do robô, por quanto tempo ela vale, o que renova, como é calculada a comissão de 30% recorrente e quando ela é paga.'

// Esta página existe para que a cortesia possa ser encerrada sem virar briga:
// se as condições não estão escritas em lugar público, qualquer corte é lido
// como quebra de combinado. Ao mudar prazo/percentual aqui, conferir também
// /parceiro-influenciador (os números aparecem nos dois lugares) e
// AffiliateSettings no banco (commissionPercent / commissionRecurringPercent).
const directAnswer =
  'A parceria tem duas partes independentes: a cortesia do robô, que vale 90 dias e é renovada enquanto houver pelo menos dois indicados pagantes ativos; e a comissão de 30% recorrente, que não depende da cortesia e continua sendo paga enquanto os indicados forem clientes.'

const sections = [
  {
    id: 'cortesia',
    heading: '1. A cortesia do robô',
    items: [
      'A cortesia libera o plano Pro na conta do parceiro, sem cobrança, pelo prazo de 90 dias contados da ativação.',
      'Ao fim dos 90 dias, a cortesia é renovada automaticamente por mais 90 dias se o parceiro tiver pelo menos 2 (dois) indicados pagantes ativos no momento da renovação.',
      'Se não houver esse mínimo, a conta não é bloqueada: o parceiro passa a ter 50% de desconto na mensalidade do plano que estiver usando. Avisamos antes, nunca cortamos de surpresa.',
      'A cortesia é pessoal e vale para uma conta. Ela não é transferível nem revendável.',
      'A cortesia pode ser encerrada a qualquer momento se o parceiro divulgar a ferramenta com promessa que a gente não faz — em especial, promessa de que o WhatsApp não bane (ver seção 4).',
    ],
  },
  {
    id: 'comissao',
    heading: '2. A comissão de 30% recorrente',
    items: [
      'O parceiro recebe 30% do valor de cada mensalidade paga por qualquer pessoa que se cadastrar pelo link com o código dele.',
      'A comissão é recorrente: incide sobre a primeira mensalidade e sobre todas as seguintes, enquanto a pessoa continuar cliente.',
      'A comissão não depende da cortesia. Mesmo que a cortesia do robô termine, as comissões dos indicados continuam sendo pagas normalmente.',
      'A atribuição é por último clique não direto, com janela de 30 dias entre o clique e o cadastro. Se a pessoa chegou por outro canal depois do seu link dentro da janela, a comissão vai para o último.',
      'O percentual é o mesmo para todos os parceiros: não trabalhamos com comissão negociada caso a caso nem com bônus por volume. Se um dia o percentual padrão mudar, a mudança nunca é aplicada de forma retroativa a comissões já geradas.',
    ],
  },
  {
    id: 'pagamento',
    heading: '3. Quando e como o parceiro recebe',
    items: [
      'Cada comissão fica em carência de 30 dias a partir do pagamento do indicado. A carência existe para cobrir cancelamento, reembolso e estorno.',
      'Passada a carência, o valor entra no saldo disponível e o parceiro solicita o saque pelo painel.',
      'O saque é feito por PIX, para a chave cadastrada pelo próprio parceiro, a partir de R$50 de saldo disponível.',
      'Se o pagamento do indicado for estornado ou reembolsado depois, a comissão correspondente é revertida. Se já tiver sido paga, o valor é descontado do saldo seguinte — nunca cobrado de volta do parceiro.',
      'A chave PIX do parceiro não pode ser a mesma do indicado. Auto-indicação não gera comissão.',
    ],
  },
  {
    id: 'divulgacao',
    heading: '4. O que não pode ser dito na divulgação',
    items: [
      'Não prometa que o WhatsApp não bane, nem use termos como "anti-ban garantido", "100% seguro" ou "nunca bloqueia". Nenhuma ferramenta pode garantir isso.',
      'Pode-se dizer que a ferramenta reduz o risco, e explicar como: envios espaçados, limite por grupo, respeito a horário e variação de mensagem.',
      'Não prometa valor de ganho ("faça R$X por mês com o robô"). O resultado depende do público e da operação de cada pessoa.',
      'Não apresente a ferramenta como disparo em massa ou envio para lista comprada. Não é isso que ela faz, e esse uso é contra nossos termos.',
      'Não use o nome ou a marca do BOTinho em perfil, domínio ou anúncio de forma que pareça um canal oficial da empresa.',
    ],
  },
  {
    id: 'encerramento',
    heading: '5. Encerramento',
    items: [
      'O parceiro pode encerrar a parceria quando quiser, sem multa e sem aviso prévio.',
      'A gente pode encerrar a cortesia com aviso de 15 dias, exceto nos casos da seção 4, em que o encerramento pode ser imediato.',
      'Em qualquer encerramento, as comissões já geradas e fora da carência continuam sendo pagas normalmente.',
      'Estas regras podem ser atualizadas. Mudanças que reduzam o percentual ou o prazo da cortesia são avisadas com 30 dias de antecedência e não valem para trás.',
    ],
  },
]

const faq = [
  {
    q: 'Perdi a cortesia. Perco também as comissões?',
    a: 'Não. As duas coisas são independentes. A comissão de 30% continua sendo paga enquanto seus indicados forem clientes, mesmo que a cortesia do robô tenha terminado.',
  },
  {
    q: 'Preciso de quantos indicados para manter o robô de graça?',
    a: 'Dois indicados pagantes ativos no momento da renovação, a cada 90 dias. Abaixo disso a conta não é bloqueada: passa a ter 50% de desconto.',
  },
  {
    q: 'Posso divulgar outras ferramentas também?',
    a: 'Pode. Não há exclusividade na parceria.',
  },
  {
    q: 'Se o meu indicado cancelar, eu devolvo o dinheiro?',
    a: 'Não. Se o pagamento for estornado ou reembolsado, a comissão daquele mês é revertida e descontada do saldo seguinte. Nunca é cobrada de volta de você.',
  },
  {
    q: 'Por que não posso prometer que não bane?',
    a: 'Porque não é verdade e ninguém consegue garantir isso — a decisão é do WhatsApp. Prometer imunidade queima sua credibilidade com a sua audiência no dia em que alguém for banido, e a nossa junto.',
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

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Parceria com criadores · Regras</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">
            Regras da parceria com criadores
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{directAnswer}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">
            Escrito em português simples de propósito. Se alguma regra aqui ficou ambígua, ela vale a favor do parceiro.
          </p>

          {sections.map((section) => (
            <section key={section.id} id={section.id} className="mt-10">
              <h2 className="text-2xl font-black tracking-tight text-gray-950">{section.heading}</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6 leading-8 text-gray-700">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}

          <section className="mt-10">
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

          <p className="mt-10 text-sm text-gray-500">
            Voltar para{' '}
            <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/parceiro-influenciador">
              a página da parceria
            </Link>
            .
          </p>
        </article>
      </main>
    </PublicShell>
  )
}
