import Link from 'next/link'
import '../landing.css'
import { Pricing } from '@/components/landing/Pricing'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { getLandingPlans } from '@/lib/plans-server'
import {
  BRAND_ORG_NAME,
  BRAND_PRODUCT_NAME,
  PRICING_PRODUCT_DESCRIPTION,
  SUPPORT_HOURS,
  SUPPORT_RESPONSE_SLA,
  SUPPORT_WHATSAPP_URL,
} from '@/lib/marketing-content'

/* PÁGINA DE PREÇO (auditoria de funil 2026-08-05, §1.4).
 *
 * Antes o preço só existia na âncora `#planos` da home. Três perdas somadas:
 * (1) "quanto custa" / "preço" / "valor" são as buscas mais comerciais do
 * nicho e não havia página de produto para rankear — só um post de blog;
 * (2) não existia link para mandar no WhatsApp de quem pergunta preço;
 * (3) o valor era resolvido só no cliente, então o HTML carregava o fallback.
 *
 * Esta rota resolve os três: URL própria e indexável, preço vindo do servidor
 * (`getLandingPlans`) e schema Offer para Google/IA lerem valor e moeda.
 * `#planos` na home continua existindo e aponta para cá.
 */

export const metadata = {
  title: 'Preços e planos: quanto custa o robô de ofertas para WhatsApp',
  description:
    'Quanto custa automatizar a divulgação de ofertas de afiliado no WhatsApp: 7 dias grátis sem cartão, plano Basic por R$39 e plano Pro por R$69 a cada 30 dias. Sem fidelidade, cancela pelo painel.',
  alternates: { canonical: '/precos' },
  openGraph: {
    title: 'Preços e planos | Quanto custa o robô de ofertas para WhatsApp',
    description:
      'Teste 7 dias grátis sem cartão. Depois, Basic ou Pro — sem fidelidade e com cancelamento pelo painel.',
    url: '/precos',
  },
}

const BILLING_FAQ = [
  {
    q: 'Precisa de cartão de crédito para testar?',
    a: 'Não. Os 7 dias de teste liberam tudo do plano Pro e não pedem cartão. Se você não assinar, o acesso simplesmente encerra — nada é cobrado.',
  },
  {
    q: 'O que acontece quando os 7 dias acabam?',
    a: 'O robô para de enviar e seus dados de configuração continuam salvos. Quando você assinar, tudo volta do jeito que estava — grupos, credenciais, modelos de mensagem e histórico.',
  },
  {
    q: 'Tem fidelidade ou multa para cancelar?',
    a: 'Não. A assinatura é de 30 dias e você cancela pelo próprio painel, sem falar com ninguém e sem multa. O acesso segue até o fim do período já pago.',
  },
  {
    q: 'Como eu pago?',
    a: 'O pagamento é pelo Mercado Pago, com Pix ou cartão de crédito. A liberação do acesso é automática assim que o pagamento é aprovado.',
  },
  {
    q: 'Qual a diferença entre o Basic e o Pro?',
    a: 'O Basic cobre a operação em grupos: espelhamento, conversão dos links de Shopee, Amazon, Mercado Livre e Magalu, criação de oferta e agendamento. O Pro acrescenta canais do WhatsApp, ofertas automáticas da Shopee por palavra-chave, filas com limite por hora e por dia, e o controle fino de intervalo entre os envios.',
  },
  {
    q: 'Dá para trocar de plano depois?',
    a: 'Dá. Você pode subir do Basic para o Pro (ou descer) a qualquer momento pelo painel, e a diferença é ajustada na renovação seguinte.',
  },
  {
    q: 'Preciso de um chip novo, só para o robô?',
    a: 'Não é obrigatório, mas é o que recomendamos. Usar um número dedicado separa a sua conta pessoal da operação de divulgação e reduz o impacto caso o número de divulgação seja restringido pelo WhatsApp.',
  },
  {
    q: 'Vocês garantem que meu número não vai ser banido?',
    a: 'Não, e desconfie de quem garantir. O banimento é decisão do WhatsApp e ninguém de fora controla isso. O que o produto faz é reduzir o que está sob seu controle: intervalo entre envios, horários de descanso, variação de texto e limites por hora e por dia.',
  },
]

/* "plano Basic por R$39 ou plano Pro por R$69 a cada 30 dias" — em texto
 * corrido, no HTML servido, sem depender de JS. Só planos pagos entram (o teste
 * grátis é anunciado na frase anterior). Sem plano pago resolvido, devolve uma
 * frase honesta em vez de um valor inventado. */
export function formatPlanPricingSentence(plans) {
  const pagos = (plans ?? []).filter((plan) => Number(plan.priceValue) > 0)
  if (!pagos.length) return 'os planos ficam abaixo'
  const periodo = pagos[0].period ? ` a cada ${pagos[0].period}` : ''
  const partes = pagos.map((plan) => `plano ${plan.name} por ${plan.price}`)
  const lista =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} ou ${partes[partes.length - 1]}`
  return `${lista}${periodo}`
}

function buildPricingJsonLd(plans) {
  const paid = plans.filter((plan) => Number(plan.priceValue) > 0)
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: BRAND_PRODUCT_NAME,
      brand: { '@type': 'Brand', name: BRAND_ORG_NAME },
      // Lojas vêm da mesma constante do FAQ (6, não 4 — RCA 2026-09-18).
      description: PRICING_PRODUCT_DESCRIPTION,
      offers: paid.map((plan) => ({
        '@type': 'Offer',
        name: plan.name,
        price: String(plan.priceValue),
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
        url: 'https://espelhagrupos.com.br/precos',
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: BILLING_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ]
}

export default async function PrecosPage() {
  const plans = await getLandingPlans()
  const jsonLd = buildPricingJsonLd(plans)
  // Frase de preço montada a partir dos planos REAIS. Hardcodar "R$39 ou R$69"
  // aqui faria a abertura da página mentir na primeira troca de preço feita no
  // painel — e é justamente esta frase que o robô lê antes de qualquer card.
  // Nomear o plano junto do valor é o que faltava: "a partir de R$39" não diz
  // se R$39 É o Basic ou só o piso, e foi assim que o preço do Basic ficou
  // ilegível para as IAs (medição de 01/09).
  const precoPorPlano = formatPlanPricingSentence(plans)

  return (
    <div className="landing-root">
      <OrganicPageTracker
        route={{ slug: 'precos', path: '/precos', cluster: 'pricing', intent: 'transactional', template: 'pricing' }}
      />
      {jsonLd.map((schema) => (
        <script
          key={schema['@type']}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <section style={{ paddingTop: 56, paddingBottom: 8 }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <span className="pill"><span className="dot" />Preços</span>
          <h1 style={{ fontSize: 'clamp(38px, 4.5vw, 62px)', lineHeight: 1.05, marginTop: 16 }}>
            Quanto custa o robô de ofertas{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>
              para WhatsApp
            </span>
            ?
          </h1>
          <p
            style={{
              fontSize: 17.5,
              color: 'var(--ink-soft)',
              maxWidth: 640,
              margin: '18px auto 0',
              lineHeight: 1.6,
            }}
          >
            Teste 7 dias com tudo liberado, sem cartão. Depois, {precoPorPlano},
            sem fidelidade e com cancelamento pelo próprio painel.
          </p>
        </div>
      </section>

      <Pricing initialPlans={plans} showHeading={false} />

      <section style={{ paddingTop: 64 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, marginBottom: 28 }}>
            Perguntas sobre cobrança
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {BILLING_FAQ.map((item) => (
              <details
                key={item.q}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 18,
                  padding: '18px 22px',
                }}
              >
                <summary style={{ cursor: 'pointer', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
                  {item.q}
                </summary>
                <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
            Ficou com dúvida sobre cobrança?{' '}
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-strong)', fontWeight: 600 }}
            >
              Chame no WhatsApp
            </a>{' '}
            — {SUPPORT_HOURS.toLowerCase()}. {SUPPORT_RESPONSE_SLA}. Você também pode ver{' '}
            <Link href="/" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>
              como o robô funciona
            </Link>
            .
          </p>
        </div>
      </section>

      <FinalCTA />
      <Footer />
    </div>
  )
}
