import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'
import { getSiteUrl } from '@/lib/site-url'
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_NUMBER,
  SUPPORT_WHATSAPP_URL,
  SUPPORT_HOURS,
  SUPPORT_RESPONSE_SLA,
} from '@/lib/marketing-content'

export const metadata = {
  title: 'Suporte | BOTinho',
  description: 'Canais de suporte e orientações iniciais para usar o BOTinho.',
  alternates: { canonical: '/suporte' },
}

const faqs = [
  ['como-conectar-whatsapp-qr-code', 'Como conectar WhatsApp por QR Code?', 'No painel, abra Conexão WhatsApp, clique em Conectar via QR Code e escaneie pelo WhatsApp em Dispositivos vinculados.'],
  ['como-conectar-pelo-numero', 'Como conectar pelo número?', 'No painel, escolha Conectar pelo número, informe DDI + DDD + número sem símbolos e use o código gerado em Dispositivos vinculados.'],
  ['como-cadastrar-grupos', 'Como cadastrar grupos?', 'Conecte o WhatsApp, carregue grupos existentes e marque grupos de origem como monitorados e grupos de destino como postagem.'],
  ['como-configurar-credenciais', 'Como configurar credenciais?', 'Abra Credenciais e preencha os campos obrigatórios de cada plataforma. Nunca envie chaves, cookies ou tokens por canais não oficiais.'],
  ['como-testar-envio', 'Como testar se o bot está enviando?', 'Use Envio para disparar uma mensagem teste para os grupos de destino e confira a tela de Logs para confirmar sucesso ou erro.'],
  ['qr-nao-aparece', 'O QR Code não aparece. O que faço?', 'Atualize a página, tente gerar novamente, confirme sua conexão e verifique se a sessão não ficou presa em outro dispositivo.'],
  ['pagamento-pendente', 'Meu pagamento está pendente.', 'A ativação só aparece após confirmação do pagamento pelo backend. Aguarde o processamento do provedor e consulte Planos novamente.'],
  ['renovar-acesso', 'Como renovar acesso/plano?', 'Acesse Planos, escolha Basic ou Pro e finalize uma nova compra. No MVP o acesso é por 30 dias renovável manualmente.'],
]

function buildSupportJsonLd() {
  const siteUrl = getSiteUrl()
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([id, question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
      url: `${siteUrl}/suporte#${id}`,
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Suporte', item: `${siteUrl}/suporte` },
    ],
  }

  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Suporte BOTinho',
    url: `${siteUrl}/suporte`,
    mainEntity: {
      '@type': 'Organization',
      name: 'BOTinho',
      url: siteUrl,
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: SUPPORT_EMAIL,
          url: SUPPORT_WHATSAPP_URL,
          availableLanguage: ['Portuguese'],
        },
      ],
    },
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [faqSchema, breadcrumbSchema, contactSchema],
  }
}

export default function SupportPage() {
  const supportSchemaGraph = buildSupportJsonLd()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(supportSchemaGraph) }} />
      <PublicPage
        eyebrow="Suporte"
        title="Como podemos ajudar?"
        description="Encontre o canal oficial de atendimento e respostas rápidas para configurar sua operação."
      >
        <div className="space-y-8 text-sm leading-7 text-gray-600">
          <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
            <ol className="flex items-center gap-2">
              <li><Link href="/" className="hover:underline">Início</Link></li>
              <li aria-hidden="true">/</li>
              <li className="font-semibold text-gray-700">Suporte</li>
            </ol>
          </nav>
          <section className="rounded-2xl bg-green-50 p-5 text-green-900">
            <h2 className="text-xl font-bold">Canais oficiais</h2>
            <p className="mt-2">WhatsApp: <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-bold underline">{SUPPORT_WHATSAPP_NUMBER}</a></p>
            <p className="mt-2">E-mail: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">{SUPPORT_EMAIL}</a></p>
            <p className="mt-2"><span className="font-semibold">Horário de atendimento:</span> {SUPPORT_HOURS}.</p>
            <p className="mt-1"><span className="font-semibold">Tempo de resposta:</span> {SUPPORT_RESPONSE_SLA}. Fora do horário, respondemos no próximo dia útil.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">Perguntas frequentes</h2>
            <div className="mt-4 space-y-4">
              {faqs.map(([id, question, answer]) => (
                <article id={id} key={id} className="scroll-mt-20 rounded-2xl border border-green-100 p-4">
                  <h3 className="font-bold text-gray-900">{question}</h3>
                  <p className="mt-2">{answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-gray-50 p-5">
            <h2 className="text-xl font-bold text-gray-900">Já tem conta?</h2>
            <p className="mt-2">Entre no painel para verificar conexão, credenciais, grupos, planos e logs da sua operação.</p>
            <Link href="/painel" className="mt-4 inline-flex rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">
              Acessar painel
            </Link>
          </section>
        </div>
      </PublicPage>
    </>
  )
}
