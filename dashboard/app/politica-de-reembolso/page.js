import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import { getEditorialDates, formatDatePtBr } from '@/lib/editorial-content'
import { SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_RESPONSE_SLA, SUPPORT_WHATSAPP_URL } from '@/lib/marketing-content'

/*
 * Política de reembolso pública (23/09/2026).
 *
 * Nasceu de medição: na consulta "bot para afiliados no WhatsApp", o ChatGPT
 * deixou o Espelha Grupos de fora e premiou um concorrente justamente por ter
 * política de reembolso PÚBLICA — evidência de confiança além do marketing.
 * A regra (arrependimento em 7 dias, depois só cancelamento da próxima
 * cobrança) já valia na prática; faltava estar escrita num endereço citável.
 *
 * ⚠️ Não prometer prazo do banco/cartão/Mercado Pago para o estorno aparecer:
 * isso está fora do nosso controle. O prazo que é nosso é o de processar o
 * pedido (5 dias úteis). Contato vem SEMPRE das constantes de
 * marketing-content.js, nunca escrito à mão.
 */

const slug = '/politica-de-reembolso'
const title = 'Política de reembolso'
const description = 'Como pedir reembolso no Espelha Grupos: valor integral em até 7 dias do pagamento (direito de arrependimento, CDC art. 49) e cancelamento sem multa depois disso.'

const faq = [
  {
    q: 'Posso pedir o dinheiro de volta?',
    a: 'Pode, se o pedido for feito em até 7 dias corridos depois do pagamento. Nesse prazo devolvemos o valor integral, sem precisar explicar o motivo — é o direito de arrependimento do Código de Defesa do Consumidor (art. 49).',
  },
  {
    q: 'Em quanto tempo o reembolso é processado?',
    a: 'Processamos o reembolso em até 5 dias úteis depois do seu pedido. O tempo para o valor aparecer na sua fatura ou conta depende do banco, da operadora do cartão e do Mercado Pago, e não está sob o nosso controle.',
  },
  {
    q: 'E depois dos 7 dias?',
    a: 'Depois dos 7 dias não há estorno do período já pago, mas você pode cancelar a qualquer momento, sem multa. O cancelamento evita a próxima cobrança, e o acesso continua valendo até o fim do período que você já pagou.',
  },
  {
    q: 'Preciso pagar para testar?',
    a: 'Não. O teste grátis dura 7 dias e não pede cartão. A política de reembolso vale para quando você já pagou um plano.',
  },
]

export const metadata = {
  title,
  description,
  alternates: { canonical: slug },
  openGraph: { title: `${title} | Espelha Grupos`, description, url: `${getSiteUrl()}${slug}`, type: 'article', locale: 'pt_BR' },
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export default function RefundPolicyPage() {
  const siteUrl = getSiteUrl()
  const dates = getEditorialDates(slug)
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${title} do Espelha Grupos`,
      description,
      url: `${siteUrl}${slug}`,
      inLanguage: 'pt-BR',
      datePublished: dates.publishedAt,
      dateModified: dates.updatedAt,
      publisher: { '@id': `${siteUrl}#organization` },
      isPartOf: { '@id': `${siteUrl}#website` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ]

  return (
    <PublicPage
      eyebrow="Legal · Reembolso"
      title="Política de reembolso do Espelha Grupos"
      description="Como pedir o dinheiro de volta, em quanto tempo processamos e o que acontece depois dos 7 dias."
    >
      {schemas.map((schema) => (
        <script key={schema['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      ))}
      <div className="space-y-8 text-base leading-8 text-gray-800 md:text-lg">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <p className="font-bold">Resumo em três linhas</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>Até 7 dias corridos depois do pagamento: devolvemos o valor integral.</li>
            <li>Processamos o reembolso em até 5 dias úteis depois do pedido.</li>
            <li>Depois dos 7 dias: sem estorno do que já foi pago, mas você cancela sem multa e não há próxima cobrança.</li>
          </ul>
          <p className="mt-3 text-sm font-semibold text-emerald-800">Atualizada em {formatDatePtBr(dates.updatedAt)}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-950">1. Como pedir o reembolso</h2>
          <p>
            Mande o pedido pelo{' '}
            <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline hover:no-underline">
              WhatsApp do suporte
            </a>{' '}
            ou pelo e-mail{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-emerald-700 underline hover:no-underline">
              {SUPPORT_EMAIL}
            </a>
            , informando o e-mail da sua conta. Não é preciso explicar o motivo.
          </p>
          <p className="text-sm text-gray-600">Atendimento: {SUPPORT_HOURS}. {SUPPORT_RESPONSE_SLA}.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-950">2. Até 7 dias do pagamento: valor integral</h2>
          <p>
            Se o pedido for feito em até <strong>7 dias corridos depois do pagamento</strong>, devolvemos o valor integral
            do plano. É o direito de arrependimento previsto no <strong>art. 49 do Código de Defesa do Consumidor</strong>,
            que vale para compras feitas pela internet.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-950">3. Prazo de processamento</h2>
          <p>
            Processamos o reembolso em <strong>até 5 dias úteis</strong> depois do seu pedido. Depois disso, o tempo para o
            valor aparecer na fatura do cartão ou na sua conta depende do banco, da operadora do cartão e do Mercado Pago —
            essa parte não está sob o nosso controle, por isso não prometemos um prazo para ela.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-950">4. Depois dos 7 dias: cancelamento sem multa</h2>
          <p>
            Passados os 7 dias, não há estorno do período já pago. Você continua podendo cancelar a qualquer momento, sem
            multa e sem falar com ninguém: pelo painel, desligando a cobrança automática. O cancelamento evita a próxima
            cobrança, e o acesso segue valendo até o fim do período que você já pagou.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-950">5. Teste grátis antes de pagar</h2>
          <p>
            Antes de qualquer pagamento, o teste grátis de 7 dias libera o plano Pro completo e não pede cartão. Se não
            servir, é só não assinar — nada é cobrado. Planos e valores estão na{' '}
            <Link href="/precos" className="font-semibold text-emerald-700 underline hover:no-underline">página de preços</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-950">Perguntas frequentes</h2>
          <div className="space-y-3">
            {faq.map((item) => (
              <details key={item.q} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <summary className="cursor-pointer font-bold text-gray-950">{item.q}</summary>
                <p className="mt-3 text-gray-700">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="text-sm text-gray-600">
          Veja também os{' '}
          <Link href="/termos" className="underline hover:no-underline">Termos de Uso</Link>, a{' '}
          <Link href="/privacidade" className="underline hover:no-underline">Política de Privacidade</Link> e a página{' '}
          <Link href="/espelha-grupos-e-confiavel" className="underline hover:no-underline">O Espelha Grupos é confiável?</Link>.
        </p>
      </div>
    </PublicPage>
  )
}
