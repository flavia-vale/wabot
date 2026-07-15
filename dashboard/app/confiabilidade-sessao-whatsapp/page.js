import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates, formatDatePtBr, EDITORIAL_AUTHOR } from '@/lib/editorial-content'

const title = 'Confiabilidade da sessão do WhatsApp no BOTinho'
const description = 'Como o BOTinho mantém sua sessão do WhatsApp conectada durante atualizações do sistema, com um processo dedicado ao ciclo de vida do bot e status honesto no painel.'
const slug = '/confiabilidade-sessao-whatsapp'
const dates = getEditorialDates(slug)

const layers = [
  ['Processo dedicado ao ciclo de vida da sessão', 'O gerenciamento da conexão do WhatsApp roda separado da aplicação principal. Quando o sistema recebe uma atualização, sua sessão ativa não é derrubada junto.'],
  ['Reconexão automática com janelas curtas', 'Quedas transitórias de rede disparam reconexão automática em segundos, sem exigir novo QR Code nem reabertura manual.'],
  ['Status honesto no painel', 'O painel mostra "conectando" durante uma reconexão em andamento e só reporta "desconectado" quando a tentativa automática realmente não teve sucesso — sem esconder problema, mas também sem alarme falso.'],
  ['Recuperação automática de grupo dessincronizado', 'Quando o sistema detecta falhas repetidas de decodificação vindas do mesmo grupo, atualiza o estado desse grupo sozinho, sem fechar sua conexão nem pedir novo QR Code.'],
]

const faq = [
  {
    q: 'Minha sessão do WhatsApp cai toda vez que o sistema é atualizado?',
    a: 'Não. O ciclo de vida da sessão roda em um processo separado da aplicação principal, então atualizar o sistema não desconecta uma sessão que já está ativa.',
  },
  {
    q: 'O que acontece se a conexão cair por instabilidade de rede?',
    a: 'O bot tenta reconectar automaticamente. O painel mostra o status de reconexão em andamento; só depois de um tempo sem sucesso ele reporta desconectado de fato.',
  },
  {
    q: 'Isso elimina qualquer risco de desconexão?',
    a: 'Não. Nenhum sistema elimina 100% do risco de queda de conexão — o objetivo aqui é reduzir desconexões evitáveis (como as causadas por deploy) e ser transparente sobre o que está de fato acontecendo.',
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
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl, faq, type: 'TechArticle' })

  return (
    <PublicShell>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/conteudos" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para conteúdos</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Engenharia · Confiabilidade</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-semibold text-gray-500">Por {EDITORIAL_AUTHOR} · Publicado em {formatDatePtBr(dates.publishedAt)} · Atualizado em {formatDatePtBr(dates.updatedAt)}</p>

          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_strong]:text-gray-950">
            <section>
              <h2>Resposta direta</h2>
              <p>Um dos problemas mais comuns em bots de WhatsApp é a sessão cair sempre que o sistema é atualizado — porque o próprio processo que fala com o WhatsApp reinicia junto com a aplicação. No BOTinho, o ciclo de vida da sessão roda em um processo separado, então atualizar o sistema não é mais sinônimo de desconectar sua operação.</p>
            </section>

            <section>
              <h2>Camadas de confiabilidade</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {layers.map(([heading, body]) => (
                  <div key={heading} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <h3 className="font-black text-gray-950">{heading}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-700">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2>O que isso não é</h2>
              <p>Confiabilidade de sessão reduz desconexões evitáveis e mostra o status real da operação — não é uma garantia de que o WhatsApp nunca vai desconectar por conta própria, nem substitui boas práticas de cadência e uso de grupos autorizados.</p>
            </section>

            <section>
              <h2>FAQ</h2>
              {faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <summary className="cursor-pointer font-black text-gray-950">{item.q}</summary>
                  <p className="mt-3 text-gray-700">{item.a}</p>
                </details>
              ))}
            </section>

            <section>
              <h2>Próximos passos</h2>
              <p>Veja também como o BOTinho protege <Link href="/seguranca-credenciais-afiliado" className="font-bold text-emerald-700 underline underline-offset-4">suas credenciais de afiliado</Link> e a <Link href="/metodologia-uso-responsavel-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">metodologia de uso responsável</Link> que orienta toda a operação.</p>
            </section>
          </div>
        </article>
      </main>
    </PublicShell>
  )
}
