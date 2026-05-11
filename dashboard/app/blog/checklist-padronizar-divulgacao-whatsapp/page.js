import Link from 'next/link'
import { ArticleShell } from '@/components/marketing/ArticleShell'
import { getSiteUrl } from '@/lib/site-url'

const title = 'Checklist para padronizar divulgação em WhatsApp'
const description = 'Um checklist operacional para reduzir erro humano em campanhas de ofertas, cupons e links de afiliado distribuídos em grupos de WhatsApp.'
const slug = '/blog/checklist-padronizar-divulgacao-whatsapp'

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

export default function Page() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: { '@type': 'Organization', name: 'wabot' },
    publisher: { '@type': 'Organization', name: 'wabot' },
    datePublished: '2026-05-11',
    dateModified: '2026-05-11',
    mainEntityOfPage: `${getSiteUrl()}${slug}`,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <ArticleShell eyebrow="Conteúdo de dor · Cluster 1" title={title} description={description} origin="artigo_checklist_padronizar_divulgacao_whatsapp">
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
          <h2>Como conectar esse checklist ao wabot</h2>
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
