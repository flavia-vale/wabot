import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

const slug = '/glossario'
const title = 'Glossário de automação para afiliados no WhatsApp'
const description = 'O que significam link monetizado, código de afiliada, conversão de link, grupo de origem e de destino, espelhamento, cadência e outros termos de quem divulga ofertas.'
const dates = getEditorialDates(slug)

const terms = [
  { term: 'Link monetizado', definition: 'Link de produto ou de cupom que leva o seu código de afiliada, para a loja saber a quem pagar a comissão. Deve ser conferido no destino final antes da divulgação.' },
  { term: 'Código de afiliada', definition: 'Identificador que cada loja usa para atribuir a venda: a tag da Amazon, o código de parceiro do Magalu, e assim por diante. Cada loja tem o seu formato e o seu jeito de creditar.' },
  { term: 'Conversão de link', definition: 'Troca de um link de produto ou de cupom pelo mesmo endereço com o seu código de afiliada. No Espelha Grupos é automática em Shopee, Mercado Livre, Amazon, Magalu, SHEIN e AliExpress; se não der para converter com segurança, a oferta não é publicada.' },
  { term: 'Grupo de origem', definition: 'Grupo ou canal que você acompanha como fonte de ofertas. Você escolhe quais são as origens; o que chega delas pode ser filtrado antes de ir para os destinos.' },
  { term: 'Grupo de destino', definition: 'Grupo ou canal onde você publica, com permissão de quem administra, e que recebe as ofertas conforme nicho, público e ritmo definidos.' },
  { term: 'Espelhamento', definition: 'Acompanhar grupos ou canais de origem e republicar as ofertas nos seus destinos, com o link trocado pelo seu código de afiliada, filtros e intervalo entre os envios.' },
  { term: 'Canal do WhatsApp', definition: 'Canal de transmissão do WhatsApp: só quem administra publica, e os seguidores recebem como vitrine, sem conversa entre membros. No Espelha Grupos, publicar em canal é do plano Pro.' },
  { term: 'Cadência', definition: 'Intervalo, horário e quantidade de envios planejados para publicar sem saturar os grupos nem repetir ofertas em excesso.' },
  { term: 'Módulo de Preservação Avançada', definition: 'Nome do conjunto de controles de ritmo do Espelha Grupos (plano Pro): intervalo entre envios, limite por dia, horário de descanso e variação do texto. Reduz o risco; não é garantia contra banimento.' },
  { term: 'Chip dedicado', definition: 'Número usado só na operação de ofertas, separado do número pessoal, para que um bloqueio não atinja as suas conversas pessoais.' },
  { term: 'UTM', definition: 'Parâmetros adicionados a um link para identificar de onde veio o clique (origem, mídia, campanha) nos relatórios.' },
  { term: 'Anti-spam operacional', definition: 'Conjunto de limites, filtros e revisões para evitar mensagens irrelevantes, repetitivas, sem consentimento ou fora das regras dos grupos e das plataformas.' },
  { term: 'Afiliado', definition: 'Pessoa que divulga links de produtos ou ofertas e recebe comissão da loja quando a venda é atribuída ao seu código, conforme as regras do programa de cada loja.' },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

function buildGlossaryJsonLd() {
  const siteUrl = getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: title,
    description,
    url: `${siteUrl}${slug}`,
    hasDefinedTerm: terms.map((item) => ({
      '@type': 'DefinedTerm',
      name: item.term,
      description: item.definition,
      inDefinedTermSet: `${siteUrl}${slug}`,
    })),
  }
}

export default function Page() {
  const schemas = [
    ...buildArticleJsonLd({ title, description, slug, siteUrl: getSiteUrl(), type: 'Article' }),
    buildGlossaryJsonLd(),
  ]

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Glossário</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Resposta direta</h2>
            <p className="mt-3 leading-8 text-gray-700">Este glossário define os termos para entender uma operação de afiliados no WhatsApp: link monetizado, código de afiliada, conversão de link, grupos de origem e de destino, espelhamento, Canal do WhatsApp, cadência, preservação, chip dedicado, UTM e anti-spam.</p>
          </section>

          <dl className="mt-8 grid gap-4 md:grid-cols-2">
            {terms.map((item) => (
              <div key={item.term} id={item.term.toLowerCase().replaceAll(' ', '-')} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <dt className="text-xl font-black text-gray-950">{item.term}</dt>
                <dd className="mt-3 leading-7 text-gray-700">{item.definition}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-8 rounded-2xl border border-emerald-100 bg-white p-5">
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Como usar essas definições</h2>
            <p className="mt-3 leading-8 text-gray-700">Use o glossário junto com a <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">metodologia de uso responsável</Link> e os <Link href="/materiais/checklist-divulgacao-ofertas-grupos-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">checklists públicos</Link> para padronizar comunicação entre marketing, operação e atendimento.</p>
          </section>
        </article>
      </main>
    </PublicShell>
  )
}
