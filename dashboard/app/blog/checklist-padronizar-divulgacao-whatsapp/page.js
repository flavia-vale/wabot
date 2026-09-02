import Link from 'next/link'
import { ArticleShell } from '@/components/marketing/ArticleShell'
import { getSiteUrl } from '@/lib/site-url'
import { buildArticleJsonLd, getEditorialDates } from '@/lib/editorial-content'

const title = 'Checklist para padronizar divulgação em WhatsApp'
const description = 'Um checklist operacional para reduzir erro humano em campanhas de ofertas, cupons e links de afiliado distribuídos em grupos de WhatsApp.'
const slug = '/blog/checklist-padronizar-divulgacao-whatsapp'
const dates = getEditorialDates(slug)

const faq = [
  { q: 'Por que padronizar divulgação antes de automatizar?', a: 'Porque automação amplia o processo existente. Se oferta, link, copy e destino não estiverem padronizados, o erro também escala para mais grupos.' },
  { q: 'O checklist substitui revisão humana?', a: 'Não. Ele organiza a revisão humana antes da automação e reduz esquecimento de pontos como preço, cupom, tag de afiliado, grupo e horário.' },
  { q: 'Como usar o checklist com o Espelha Grupos?', a: 'Use o checklist para aprovar a mensagem e os grupos; depois configure origem, destino, filtros e intervalos no Espelha Grupos e revise os primeiros logs.' },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const schemas = buildArticleJsonLd({ title, description, slug, siteUrl: getSiteUrl(), faq })

  return (
    <>
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleShell eyebrow="Conteúdo de dor · Cluster 1" title={title} description={description} origin="artigo_checklist_padronizar_divulgacao_whatsapp" publishedAt={dates.publishedAt} updatedAt={dates.updatedAt}>
        <section>
          <h2>Resposta direta</h2>
          <p>
            Padronizar divulgação no WhatsApp significa definir uma régua mínima para oferta, link, copy, destino, horário e medição antes de escalar a rotina com automação. O checklist reduz erro humano e ajuda o operador a automatizar apenas mensagens já revisadas.
          </p>
        </section>

        <section>
          <h2>Por que padronizar antes de automatizar?</h2>
          <p>
            Automação acelera o que já existe. Se o processo estiver confuso, ela também acelera erros: link errado, copy incompleta, post fora do horário e mensagens duplicadas. A padronização cria uma régua mínima para cada campanha antes de escalar.
          </p>
          <p>
            O ponto não é engessar o operador. O objetivo é transformar decisões repetitivas em um roteiro simples, para que a equipe gaste energia em curadoria, negociação e otimização.
          </p>
        </section>

        <section>
          <h2>Checklist pré-envio</h2>
          <ul>
            <li><strong>Oferta validada:</strong> preço, estoque, cupom, prazo e categoria conferidos.</li>
            <li><strong>Link conferido:</strong> URL final testada, parâmetros de afiliado presentes e encurtador revisado.</li>
            <li><strong>Copy padrão:</strong> benefício principal, urgência real, CTA e aviso de variação de preço.</li>
            <li><strong>Destino correto:</strong> grupos separados por cidade, nicho, ticket médio e tolerância de frequência.</li>
            <li><strong>Janela de horário:</strong> envio alinhado com pico do grupo e intervalo mínimo entre mensagens.</li>
            <li><strong>Registro:</strong> campanha marcada com UTM ou tag interna para análise posterior.</li>
          </ul>
        </section>

        <section>
          <h2>Template de copy recomendado</h2>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm leading-7 text-gray-700">
            <p><strong>[Categoria/Nicho]</strong> Oferta rápida para quem acompanha o grupo.</p>
            <p><strong>Produto:</strong> nome curto + diferencial.</p>
            <p><strong>Preço/benefício:</strong> valor, cupom ou condição especial.</p>
            <p><strong>Validade:</strong> enquanto durar estoque ou até o horário definido.</p>
            <p><strong>CTA:</strong> acessar link conferido.</p>
          </div>
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
          <h2>Como conectar esse checklist ao Espelha Grupos</h2>
          <ol>
            <li>Use o checklist para definir quais grupos são origem e quais são destino.</li>
            <li>Transforme a copy padrão em modelo de campanha recorrente.</li>
            <li>Configure a rotina de espelhamento e revise os primeiros envios em logs.</li>
            <li>Ajuste frequência e destinos a partir dos dados do primeiro dia.</li>
          </ol>
          <p>
            Para usar a versão operacional em uma página, acesse o <Link href="/materiais/checklist-operacao-whatsapp" className="font-bold text-emerald-700 underline underline-offset-4">checklist online</Link> e envie para a pessoa responsável pela rotina de grupos.
          </p>
        </section>
      </ArticleShell>
    </>
  )
}
