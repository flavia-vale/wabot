import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'

const title = 'Conteúdos: blog e materiais para afiliados no WhatsApp'
const description = 'Central de conteúdos do BOTinho com artigos e materiais práticos para padronizar divulgação, validar links de afiliado e escalar grupos no WhatsApp com responsabilidade.'
const slug = '/conteudos'

const blogPosts = [
  {
    href: '/blog/conferir-converter-link-afiliado-whatsapp',
    title: 'Como conferir e converter link de afiliado para WhatsApp',
    description: 'Evite perda de comissão ao validar tag, redirecionamento e destino final antes da divulgação.',
  },
  {
    href: '/blog/bot-para-afiliados-whatsapp-grupos-cupons',
    title: 'Bot para afiliados no WhatsApp em grupos de cupons',
    description: 'Fluxo para organizar divulgação em grupos sem depender de operação manual.',
  },
  {
    href: '/blog/como-escalar-grupos-sem-operacao-manual',
    title: 'Como escalar grupos sem operação manual',
    description: 'Princípios de processo para crescer mantendo qualidade da mensagem.',
  },
  {
    href: '/blog/checklist-padronizar-divulgacao-whatsapp',
    title: 'Checklist para padronizar divulgação no WhatsApp',
    description: 'Padronize copy, horário e grupos de destino para reduzir retrabalho.',
  },
]

const nichePages = [
  {
    href: '/bot-ofertas-restaurantes-whatsapp',
    title: 'Bot de ofertas para restaurantes no WhatsApp',
    description: 'Calendário, copy e distribuição responsável para promoções de restaurantes.',
  },
  {
    href: '/bot-ofertas-marketplace-whatsapp',
    title: 'Bot de ofertas para marketplace no WhatsApp',
    description: 'Conferência de link monetizado, tag de afiliado e automação em grupos.',
  },
]

const methodologyPages = [
  {
    href: '/metodologia-uso-responsavel-whatsapp',
    title: 'Metodologia de uso responsável no WhatsApp',
    description: 'Critérios públicos para revisar ofertas, links, grupos, cadência e logs antes de escalar automação.',
  },
]


const comparisonPages = [
  {
    href: '/alternativas/bot-para-whatsapp-afiliados',
    title: 'Alternativas de bot para WhatsApp para afiliados',
    description: 'Comparativo equilibrado entre planilha, automação genérica, ferramentas oficiais e BOTinho.',
  },
  {
    href: '/botinho-vs-planilha-manual',
    title: 'BOTinho vs planilha manual',
    description: 'Quando a planilha basta e quando logs, cadência e origem/destino viram prioridade.',
  },
  {
    href: '/botinho-vs-ferramentas-genericas-automacao',
    title: 'BOTinho vs ferramentas genéricas de automação',
    description: 'Comparação para times que avaliam construir fluxos próprios ou usar ferramenta focada em grupos.',
  },
  {
    href: '/melhores-bots-para-afiliados-whatsapp',
    title: 'Melhores bots para afiliados no WhatsApp',
    description: 'Critérios transparentes para avaliar ferramentas sem ranking falso ou promessa de ganho.',
  },
]

const authorityPages = [
  {
    href: '/glossario',
    title: 'Glossário de automação para afiliados no WhatsApp',
    description: 'Definições parseáveis de link monetizado, origem, destino, espelhamento, cadência, UTM e anti-spam.',
  },
  {
    href: '/estudos-de-caso',
    title: 'Estudos de caso do BOTinho',
    description: 'Política pública para publicar cases somente com consentimento e dados verificáveis.',
  },
]

const materials = [
  {
    href: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp',
    title: 'Checklist de divulgação de ofertas em grupos de WhatsApp',
    description: 'Roteiro público para validar oferta, link, copy, grupo e medição.',
  },
  {
    href: '/materiais/checklist-operacao-whatsapp',
    title: 'Checklist de operação para WhatsApp',
    description: 'Material para padronizar rotina antes de escalar automação.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: {
    title,
    description,
    url: `${getSiteUrl()}${slug}`,
    type: 'website',
    locale: 'pt_BR',
  },
}

function ContentCard({ item }) {
  return (
    <li className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-black tracking-tight text-gray-950">{item.title}</h3>
      <p className="mt-3 text-sm leading-7 text-gray-700">{item.description}</p>
      <Link href={item.href} className="mt-4 inline-flex text-sm font-black text-emerald-700 underline underline-offset-4">
        Ler conteúdo
      </Link>
    </li>
  )
}

export default function Page() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <section className="rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Central de conteúdo</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">Blog e materiais para crescer com processo</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
            Se você publica ofertas em grupos de WhatsApp, esta página centraliza os guias e checklists para validar links, padronizar operação e escalar divulgação sem improviso.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-emerald-800">
            <Link href="/login?mode=register&utm_source=conteudos&utm_medium=organic&utm_campaign=content-hub&utm_content=hero-cta" className="rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700">
              Entrar na lista VIP
            </Link>
            <Link href="/materiais/checklist-divulgacao-ofertas-grupos-whatsapp" className="rounded-xl border border-emerald-200 px-4 py-3 hover:bg-emerald-50">
              Ver checklist principal
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Artigos do blog</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {blogPosts.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Páginas por nicho</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {nichePages.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Metodologia e uso responsável</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {methodologyPages.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>


        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Comparativos e alternativas</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {comparisonPages.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Autoridade e definições</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {authorityPages.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Materiais práticos</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {materials.map((item) => <ContentCard key={item.href} item={item} />)}
          </ul>
        </section>
      </main>
    </PublicShell>
  )
}
