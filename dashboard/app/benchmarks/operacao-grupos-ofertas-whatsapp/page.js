import Link from 'next/link'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { PublicPage } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { EDITORIAL_AUTHOR, formatDatePtBr, getEditorialDates } from '@/lib/editorial-content'

const slug = '/benchmarks/operacao-grupos-ofertas-whatsapp'
const title = 'Como medir a operação de um grupo de ofertas'
const description = 'Cinco medidas para afiliadas e admins compararem a operação de grupos de ofertas antes e depois de automatizar: tempo, revisão, falhas, grupos e ritmo.'
const dates = getEditorialDates(slug)
const siteUrl = getSiteUrl()

const metrics = [
  ['Tempo por oferta publicada', 'Minutos entre achar a oferta e ela estar em todos os seus grupos, com o seu link. Meça uma semana antes de automatizar e uma depois.'],
  ['Ofertas revisadas', 'De cada dez ofertas publicadas, quantas você conferiu (preço, cupom, link) antes de sair. Automatizar não dispensa conferir as primeiras.'],
  ['Falhas por loja', 'Link sem o seu código, oferta vencida, foto que não veio, link que não abre ou cadastro de afiliada incompleto — separado por loja, porque cada uma falha de um jeito.'],
  ['Grupos com regra definida', 'Quantos dos seus grupos de destino têm permissão de quem administra, um público claro e um ritmo de envio decidido.'],
  ['Dias com publicação', 'Em quantos dias da semana as ofertas saíram no ritmo planejado, sem depender de você lembrar ou estar no celular.'],
]

const stages = [
  { name: 'Base manual', signal: 'Tudo depende de copiar, colar e lembrar horários.', action: 'Medir tempo e erros antes de automatizar.' },
  { name: 'Processo padronizado', signal: 'Há checklist, grupos separados e texto revisado.', action: 'Automatizar o que já está conferido.' },
  { name: 'Escala controlada', signal: 'O histórico de envios e o ritmo de cada grupo guiam a próxima semana.', action: 'Comparar horários, nichos e grupos com o que o histórico mostra.' },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${siteUrl}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const route = {
    slug: 'benchmark-operacao-grupos-ofertas-whatsapp',
    path: slug,
    cluster: 'dados-proprietarios',
    intent: 'benchmark operacao grupos ofertas whatsapp',
    template: 'benchmark',
  }

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: { '@type': 'Organization', name: 'Equipe editorial do Espelha Grupos' },
    publisher: { '@type': 'Organization', name: 'Espelha Grupos' },
    datePublished: dates.publishedAt,
    dateModified: dates.updatedAt,
    mainEntityOfPage: `${siteUrl}${slug}`,
  }

  return (
    <>
      <OrganicPageTracker route={route} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
      <PublicPage eyebrow="Operação · Como medir" title={title} description={description}>
        <p className="mb-6 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>
        <div className="space-y-8 text-base leading-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Resposta direta</h2>
            <p className="mt-3">
              Para saber se a sua operação de grupos melhorou, meça cinco coisas antes e depois de automatizar: quanto tempo leva uma oferta até estar em todos os grupos, quantas você conferiu, quantas falharam e em qual loja, quantos grupos têm regra definida e em quantos dias a publicação saiu no ritmo planejado.
            </p>
            <p className="mt-3">
              No Espelha Grupos, o histórico de envios já mostra o que saiu, quando, o que foi bloqueado por repetição e o que falhou, com o motivo. É a base para as medidas de falhas e de dias com publicação.
            </p>
          </section>

          <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <h2 className="text-xl font-black text-gray-950">Por que esta página não traz números de clientes</h2>
            <p className="mt-3">
              Só publicamos número de operação real quando ele vier agregado de várias contas, sem nome de grupo, telefone, texto de mensagem ou link — e até agora não publicamos nenhum. É a mesma regra da página de <Link href="/estudos-de-caso" className="font-bold text-emerald-700 underline underline-offset-4">estudos de caso</Link>. Até lá, a comparação que vale é a da sua própria operação, antes e depois.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black tracking-tight text-gray-950">As cinco medidas</h2>
            <div className="mt-4 grid gap-4">
              {metrics.map(([metric, detail]) => (
                <div key={metric} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <h3 className="font-black text-gray-950">{metric}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Estágios de maturidade</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {stages.map((stage) => (
                <div key={stage.name} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <h3 className="font-black text-gray-950">{stage.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700"><strong>Sinal:</strong> {stage.signal}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-700"><strong>Ação:</strong> {stage.action}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Próximos passos</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li><Link href="/automacao-whatsapp-afiliados" data-seo-cta="benchmark-hub-pain" className="font-bold text-emerald-700 underline underline-offset-4">Ver hub de automação para afiliados</Link></li>
              <li><Link href="/bot-ofertas-whatsapp" data-seo-cta="benchmark-hub-niche" className="font-bold text-emerald-700 underline underline-offset-4">Comparar nichos de bot de ofertas</Link></li>
              <li><Link href="/materiais/checklist-operacao-whatsapp" data-seo-cta="benchmark-checklist" className="font-bold text-emerald-700 underline underline-offset-4">Usar checklist de operação</Link></li>
            </ul>
          </section>
        </div>
      </PublicPage>
    </>
  )
}
