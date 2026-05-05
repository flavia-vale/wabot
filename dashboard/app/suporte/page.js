import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'

export const metadata = {
  title: 'Suporte | Wabot',
  description: 'Canais de suporte e orientações iniciais para usar o Wabot.',
}

const faqs = [
  ['Como começo?', 'Crie sua conta, acesse o painel, conecte o WhatsApp por QR Code ou número, cadastre suas credenciais de afiliado e configure os grupos monitorados e de destino.'],
  ['O QR Code não aparece. O que faço?', 'Atualize a página, confirme se sua sessão não expirou e tente reconectar. Se persistir, envie ao suporte o e-mail da conta e o horário aproximado da tentativa.'],
  ['Como sei se o bot está enviando?', 'Use a tela de envio para testar uma mensagem e acompanhe a tela de logs para confirmar sucesso ou identificar erros.'],
  ['Meu pagamento está pendente.', 'A ativação só aparece após confirmação do pagamento pelo backend. Aguarde o processamento do provedor e consulte a tela de planos novamente.'],
]

export default function SupportPage() {
  return (
    <PublicPage
      eyebrow="Suporte"
      title="Como podemos ajudar?"
      description="Encontre o canal oficial de atendimento e respostas rápidas para configurar sua operação."
    >
      <div className="space-y-8 text-sm leading-7 text-gray-600">
        <section className="rounded-2xl bg-green-50 p-5 text-green-900">
          <h2 className="text-xl font-bold">Canal oficial</h2>
          <p className="mt-2">Atendimento por e-mail: <a href="mailto:suporte@wabot.app" className="font-bold underline">suporte@wabot.app</a></p>
          <p className="mt-2">Expectativa de resposta: assim que possível em dias úteis. Ainda não há SLA formal na fase MVP.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900">Perguntas frequentes</h2>
          <div className="mt-4 space-y-4">
            {faqs.map(([question, answer]) => (
              <article key={question} className="rounded-2xl border border-green-100 p-4">
                <h3 className="font-bold text-gray-900">{question}</h3>
                <p className="mt-2">{answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-gray-50 p-5">
          <h2 className="text-xl font-bold text-gray-900">Já tem conta?</h2>
          <p className="mt-2">Entre no painel para verificar conexão, credenciais, grupos, planos e logs da sua operação.</p>
          <Link href="/login" className="mt-4 inline-flex rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700">
            Acessar painel
          </Link>
        </section>
      </div>
    </PublicPage>
  )
}
