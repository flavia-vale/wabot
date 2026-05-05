import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'

export const metadata = {
  title: 'Termos de Uso | Wabot',
  description: 'Termos mínimos para uso do Wabot, bot conversor para afiliados no WhatsApp.',
}

const sections = [
  {
    title: '1. Uso do produto',
    text: 'O Wabot é uma ferramenta de apoio para afiliados automatizarem conversão de links, organização de grupos e envios autorizados no WhatsApp. O usuário é responsável por usar o produto conforme as regras das plataformas de afiliados, do WhatsApp e da legislação aplicável.',
  },
  {
    title: '2. Conta e segurança',
    text: 'Você deve informar dados corretos, manter sua senha em sigilo e proteger credenciais, cookies, tags e chaves de afiliado cadastradas no painel. Se suspeitar de uso indevido, entre em contato com o suporte.',
  },
  {
    title: '3. Acesso pago',
    text: 'No MVP, os planos liberam acesso por 30 dias após confirmação do pagamento pelo backend. A renovação pode ser feita manualmente pelo checkout disponível no painel.',
  },
  {
    title: '4. Limites e responsabilidades',
    text: 'Não é permitido usar o Wabot para spam, golpes, conteúdo ilegal, violação de direitos, coleta indevida de dados ou mensagens sem autorização. Resultados comerciais dependem da operação do usuário e não são garantidos.',
  },
  {
    title: '5. Disponibilidade e suporte',
    text: 'A ferramenta pode passar por manutenções, ajustes e indisponibilidades pontuais. O suporte é prestado pelo canal oficial informado na página de suporte, sem promessa de SLA específico nesta fase MVP.',
  },
]

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="Legal"
      title="Termos de Uso"
      description="Condições mínimas para uso responsável do Wabot durante a fase MVP."
    >
      <div className="space-y-6 text-sm leading-7 text-gray-600">
        <p className="rounded-2xl bg-green-50 p-4 text-green-800">
          Última atualização: 05 de maio de 2026. Estes termos são uma versão operacional mínima e podem ser atualizados conforme o produto evoluir.
        </p>
        {sections.map(section => (
          <section key={section.title}>
            <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
            <p className="mt-2">{section.text}</p>
          </section>
        ))}
        <p>
          Dúvidas sobre estes termos podem ser enviadas pela página de <Link href="/suporte" className="font-semibold text-green-700 hover:underline">suporte</Link>.
        </p>
      </div>
    </PublicPage>
  )
}
