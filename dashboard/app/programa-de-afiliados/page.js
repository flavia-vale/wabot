import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_PERSON_AUTHOR, EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '@/lib/editorial-content'

const slug = '/programa-de-afiliados'
// Título encurtado em 2026-08-19 (specs/013-inbound-leads-strategy, P1): era
// 73 chars de texto próprio. "Qual paga mais" é o motivo pra clicar.
const title = 'Shopee, Amazon ou Mercado Livre: qual paga mais'
const description = 'Compare Shopee, Amazon e Mercado Livre: quanto paga de comissão, prazo de atribuição e como divulgar no WhatsApp. Dados com fonte e data.'
const dates = getEditorialDates(slug)

// Resposta direta em 40–60 palavras: é o bloco que o Google usa como snippet e
// que os motores de IA extraem como citação. Não transformar em parágrafo longo.
const directAnswer =
  'Os três maiores programas de afiliados do Brasil para quem divulga ofertas são Shopee, Amazon Associados e Mercado Livre Afiliados. A entrada é gratuita nos três. A diferença está na comissão: o Mercado Livre paga de 0% a 16% por categoria, a Amazon de 0% a 13%, e a Shopee 3% na venda padrão, com até 30% em produtos do programa de Comissão Extra.'

// Dados conferidos nas fontes oficiais dos programas: Shopee e Amazon em
// 30/07/2026, Mercado Livre em 31/07/2026 (Central de Ajuda do Programa de
// Afiliados). Cuidado ao atualizar o ML: a tabela pública é a de "Afiliados
// generalistas"; quem se enquadra como "Afiliado Divulgador de Ofertas" recebe
// tabela própria por e-mail. NUNCA usar as tarifas de venda do ML (10-14%
// Clássico / 15-19% Premium) — aquilo é custo do vendedor, não comissão.
const programs = [
  {
    name: 'Shopee Afiliados',
    entry: 'Gratuita',
    commission: '3% na venda padrão (redes sociais, WhatsApp, lives e Shopee Vídeo). Até 30% em produtos do programa de Comissão Extra.',
    attribution: 'Até 7 dias após o clique',
    note: 'Comissão calculada sobre o valor líquido da venda, sem impostos, cupons e frete.',
    href: '/blog/como-ser-afiliado-shopee-whatsapp',
    hrefLabel: 'Guia completo do Shopee Afiliados',
  },
  {
    name: 'Amazon Associados',
    entry: 'Gratuita',
    commission: 'Varia por categoria: 13% (bebê, beleza, saúde, alimentos), 11% (roupas, pet shop), 10% (livros), 8% (eletrônicos, casa, esportes), 7% (calçados, automotivo e demais) e 0% na categoria Coach.',
    attribution: 'Definida pelo programa da Amazon',
    note: 'Também paga recompensas fixas por assinatura de Prime, Kindle Unlimited e Amazon Music.',
    href: '/blog/como-divulgar-ofertas-amazon-whatsapp',
    hrefLabel: 'Guia completo do Amazon Associados',
  },
  {
    name: 'Mercado Livre Afiliados',
    entry: 'Gratuita',
    commission: 'De 0% a 16% por categoria em venda direta (16% beleza, calçados e esportes; 12% na maioria; 5% em eletrônicos; 0% em alimentos). Em venda indireta o percentual cai pela metade.',
    attribution: 'Pagamento em até 60 dias após a entrega',
    note: 'Atenção: a tabela pública vale para Afiliados generalistas. Quem se enquadra como Afiliado Divulgador de Ofertas recebe percentuais próprios por e-mail.',
    href: '/blog/como-divulgar-ofertas-mercado-livre-whatsapp',
    hrefLabel: 'Guia completo do Mercado Livre Afiliados',
  },
]

const howToChoose = [
  'Comece pelo marketplace onde seu público já compra. Comissão alta em categoria que sua audiência ignora não vira venda.',
  'Compare a comissão da categoria específica que você divulga, não a média do programa — na Amazon a diferença vai de 0% a 13%.',
  'Verifique o prazo de atribuição: quanto maior a janela entre o clique e a compra, maior a chance de a comissão ser creditada a você.',
  'Nada impede operar os três ao mesmo tempo. O trabalho extra é manter cada link com o código de afiliado correto.',
]

const faq = [
  { q: 'Qual programa de afiliados paga mais?', a: 'Depende da categoria. O Mercado Livre paga até 16% em beleza, calçados, roupas e esportes, mas 0% em alimentos e bebidas. A Amazon paga até 13% em bebê, beleza e saúde, e 7% na maioria das categorias. A Shopee paga 3% na venda padrão, com até 30% em produtos do programa de Comissão Extra. Compare sempre a categoria que você realmente divulga.' },
  { q: 'Preciso pagar para entrar em algum deles?', a: 'Não. A entrada nos programas de afiliados de Shopee, Amazon e Mercado Livre é gratuita. Você ganha comissão sobre as vendas geradas pelos seus links.' },
  { q: 'Posso ser afiliado dos três ao mesmo tempo?', a: 'Sim, e é o mais comum em operações de grupos de ofertas. O cuidado é garantir que cada link enviado carregue o código de afiliado da loja certa — link sem código gera venda sem comissão.' },
  { q: 'Ser afiliado garante quanto de renda por mês?', a: 'Nenhum valor é garantido. A comissão depende de venda concluída, categoria do produto, regras do programa e comportamento do público. Qualquer promessa de ganho fixo em programa de afiliados deve ser tratada como alerta.' },
  { q: 'Onde vejo a comissão do Mercado Livre?', a: 'A tabela pública está na Central de Ajuda do Programa de Afiliados e vale para Afiliados generalistas. Atenção para não confundir com as tarifas de venda do Mercado Livre (10% a 19%), que são o custo pago pelo vendedor para anunciar — não a comissão do afiliado.' },
  { q: 'Quem opera grupo de ofertas recebe a comissão da tabela pública do Mercado Livre?', a: 'Não necessariamente. O Mercado Livre informa que afiliados enquadrados como Afiliados Divulgadores de Ofertas recebem uma tabela de percentuais própria, enviada ao e-mail cadastrado no Programa. Se você opera grupo de achadinhos ou promoções, confirme a sua tabela antes de projetar receita com base nos percentuais públicos.' },
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
      <main className="mx-auto w-full max-w-5xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Programas de afiliados · Comparativo</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">Programa de afiliados: Shopee, Amazon ou Mercado Livre?</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{directAnswer}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_PERSON_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <section className="mt-10">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Comparativo dos três programas</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-emerald-100">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">Programa</th>
                    <th className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">Entrada</th>
                    <th className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">Comissão</th>
                    <th className="border-b border-emerald-100 p-4 text-left font-black text-gray-950">Atribuição</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((program, i) => (
                    <tr key={program.name} className={i === programs.length - 1 ? '' : 'border-b border-emerald-50'}>
                      <td className="p-4 align-top font-semibold text-gray-950">{program.name}</td>
                      <td className="p-4 align-top text-gray-600">{program.entry}</td>
                      <td className="p-4 align-top text-gray-600">{program.commission}</td>
                      <td className="p-4 align-top text-gray-600">{program.attribution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-emerald-100 bg-emerald-50/60 p-3 text-xs text-gray-500">
                Dados de Shopee e Amazon conferidos nas fontes oficiais dos programas em 30/07/2026. Percentuais podem ser alterados pelos marketplaces sem aviso prévio — confirme na sua conta antes de decidir.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Guia completo de cada programa</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {programs.map((program) => (
                <div key={program.name} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <h3 className="text-lg font-black text-gray-950">{program.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{program.note}</p>
                  <Link className="mt-4 inline-block text-sm font-black text-emerald-700 no-underline hover:text-emerald-800" href={program.href}>
                    {program.hrefLabel} →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Como escolher entre eles</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-8 text-gray-700">
              {howToChoose.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Comissão de afiliado não é a mesma coisa que tarifa de venda</h2>
            <p className="mt-3 leading-8 text-gray-700">
              É uma confusão comum, principalmente no Mercado Livre. <strong>Tarifa de venda</strong> é o que o
              vendedor paga ao marketplace para anunciar o produto. <strong>Comissão de afiliado</strong> é o que
              o marketplace paga a você por divulgar. São números diferentes, em documentos diferentes: as tarifas
              ficam no material para vendedores, a comissão fica no painel de afiliado.
            </p>
            <p className="mt-3 leading-8 text-gray-700">
              Se você encontrar uma página prometendo &ldquo;comissão de 15% no Mercado Livre&rdquo; sem citar a fonte,
              desconfie: pode ser a tarifa do vendedor sendo apresentada como ganho do afiliado.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Depois de escolher: como divulgar sem perder comissão</h2>
            <p className="mt-3 leading-8 text-gray-700">
              O erro que mais custa dinheiro em grupo de ofertas não é escolher o programa errado — é enviar o link
              sem o seu código de afiliado. Isso acontece o tempo todo quando a oferta é copiada de outro grupo: o
              link encaminhado credita a comissão para quem publicou primeiro.
            </p>
            <p className="mt-3 leading-8 text-gray-700">
              O <Link className="font-black text-emerald-700 no-underline hover:text-emerald-800" href="/bot-afiliados-whatsapp">BOTinho</Link>{' '}
              converte automaticamente os links de Shopee, Amazon, Mercado Livre e Magalu para o seu código antes de
              publicar nos seus grupos e canais, com intervalos controlados entre envios.
            </p>
          </section>

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
        </article>
      </main>
    </PublicShell>
  )
}
