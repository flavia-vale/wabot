import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'

export const metadata = {
  title: 'Política de Privacidade',
  description: 'Política mínima de privacidade do Espelha Grupos para usuários e visitantes.',
  alternates: { canonical: '/privacidade' },
}

const privacyItems = [
  ['Dados de conta', 'Coletamos informações necessárias para cadastro, autenticação e suporte, como e-mail e dados técnicos de sessão.'],
  ['Dados operacionais', 'Podemos tratar configurações do bot, grupos cadastrados, status de conexão e logs de envio para entregar as funcionalidades contratadas.'],
  ['Credenciais', 'Credenciais de afiliados e integrações são usadas apenas para executar a operação configurada pelo usuário e não devem ser compartilhadas fora do painel.'],
  ['Pagamentos', 'Informações de checkout e status de pagamento podem ser processadas por provedores externos, como Mercado Pago, para liberar acesso por 30 dias quando aprovado.'],
  ['Segurança', 'Aplicamos medidas razoáveis para proteger dados, mas o usuário também deve manter senha, cookies e chaves em ambiente seguro.'],
  ['Retenção e exclusão', 'Dados podem ser mantidos enquanto a conta estiver ativa ou pelo período necessário para operação, segurança, suporte e obrigações legais. Solicitações podem ser feitas pelo suporte.'],
]

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacidade"
      title="Política de Privacidade"
      description="Resumo transparente sobre quais dados usamos para operar o Espelha Grupos e prestar suporte."
    >
      <div className="space-y-6 text-sm leading-7 text-gray-600">
        <p className="rounded-2xl bg-green-50 p-4 text-green-800">
          Última atualização: 05 de maio de 2026. Esta política descreve o tratamento mínimo esperado na fase MVP.
        </p>
        {privacyItems.map(([title, text]) => (
          <section key={title}>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="mt-2">{text}</p>
          </section>
        ))}
        <p>
          Para dúvidas, solicitações de acesso, correção ou exclusão de dados, fale com o <Link href="/suporte" className="font-semibold text-green-700 hover:underline">suporte do Espelha Grupos</Link>.
        </p>
      </div>
    </PublicPage>
  )
}
