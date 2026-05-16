import Link from 'next/link'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { PublicPage } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'

const slug = '/benchmarks/operacao-grupos-ofertas-whatsapp'
const title = 'Benchmark de operação em grupos de ofertas no WhatsApp'
const description = 'Modelo editorial de benchmark para afiliados e admins medirem cadência, revisão, falhas e tempo operacional antes de escalar automação em grupos de ofertas.'
const siteUrl = getSiteUrl()

const metrics = [
  ['Tempo operacional por campanha', 'Minutos gastos para conferir oferta, link, copy, grupos e logs antes/depois da automação.'],
  ['Taxa de mensagens revisadas', 'Percentual de ofertas validadas manualmente antes de entrar em cadência de distribuição.'],
  ['Falhas por plataforma', 'Ocorrências de link sem tag, oferta vencida, imagem ausente, redirecionamento quebrado ou credencial incompleta.'],
  ['Cobertura de grupos autorizados', 'Quantidade de grupos de destino com contexto, permissão e frequência definida para cada campanha.'],
  ['Consistência semanal', 'Dias com rotina publicada conforme calendário, sem depender de memória ou copia-e-cola manual.'],
]

const stages = [
  { name: 'Base manual', signal: 'Tudo depende de copiar, colar e lembrar horários.', action: 'Medir tempo e erros antes de automatizar.' },
  { name: 'Processo padronizado', signal: 'Há checklist, grupos separados e copy revisada.', action: 'Automatizar apenas campanhas aprovadas.' },
  { name: 'Escala controlada', signal: 'Logs, cadência e aprendizados guiam a próxima semana.', action: 'Comparar clusters, horários e nichos com dados agregados.' },
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
    author: { '@type': 'Organization', name: 'BOTinho' },
    publisher: { '@type': 'Organization', name: 'BOTinho' },
    datePublished: '2026-05-15',
    dateModified: '2026-05-15',
    mainEntityOfPage: `${siteUrl}${slug}`,
  }

  return (
    <>
      <OrganicPageTracker route={route} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, '\\u003c') }} />
      <PublicPage eyebrow="Benchmark editorial" title={title} description={description}>
        <div className="space-y-8 text-base leading-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Resposta direta</h2>
            <p className="mt-3">
              Este benchmark é um modelo inicial para transformar a operação de grupos em métricas comparáveis sem expor usuários, telefones, grupos, mensagens ou links. Ele deve ser usado em staging e na rotina editorial antes de qualquer publicação baseada em dados reais agregados.
            </p>
          </section>

          <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <h2 className="text-xl font-black text-gray-950">Regra de privacidade para dados proprietários</h2>
            <p className="mt-3">
              Quando houver dados agregados do produto, publique apenas métricas anonimizadas e agrupadas. Nunca exiba nome de grupo, telefone, e-mail, texto de mensagem, URL original, tag de afiliado ou credencial.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black tracking-tight text-gray-950">Métricas que viram vantagem de SEO</h2>
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
