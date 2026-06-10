import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Termos de Uso e Ciência de Riscos | BOTinho',
  description: 'Termos completos para uso responsável do BOTinho, incluindo ciência de riscos de automação no WhatsApp e responsabilidade do usuário.',
  alternates: { canonical: '/termos' },
}

const FALLBACK_TERMS = {
  title: 'Termos de Uso e Ciência de Riscos',
  summary: 'Leia com atenção antes de criar conta, conectar seu WhatsApp ou automatizar envios. Este documento explica responsabilidades, riscos de banimento e cuidados de uso responsável.',
  version: '2026-06-09-whatsapp-risk-acceptance',
  content: {
    lastUpdatedLabel: '09 de junho de 2026',
    intro: 'Resumo importante: o BOTinho pode ajudar a organizar e reduzir riscos operacionais, mas automação de mensagens em WhatsApp Web/grupos envolve risco real de bloqueio ou banimento. Ao usar, você confirma que entende esse risco e assume responsabilidade pela sua operação.',
    sections: [
      {
        title: 'Ciência expressa: automação no WhatsApp e ausência de API oficial',
        warning: true,
        body: [
          'Você reconhece que, como toda automação que envia mensagens para grupos/canais via WhatsApp Web ou mecanismos equivalentes de sessão, o BOTinho não utiliza a API oficial do WhatsApp/Meta para esse tipo de envio em grupos.',
          'O uso pode gerar bloqueios, limitações ou banimento do número conectado e dos grupos/canais. Pausas, pausa noturna, variações de texto e ajustes de imagem reduzem risco operacional, mas não eliminam risco nem substituem a responsabilidade do usuário.',
        ],
      },
    ],
    finalDeclaration: 'Ao marcar o aceite no cadastro, você declara que leu estes Termos, entende os riscos de automação não oficial no WhatsApp e assume responsabilidade pelo uso, conteúdo, consentimento, volume e consequências da operação.',
  },
}

function resolveApiBase() {
  const configured = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, '')
  const port = String(process.env.PORT || '').trim()
  const apiPort = port === '3006' ? '3004' : port === '3000' ? '3001' : '3001'
  return `http://127.0.0.1:${apiPort}`
}

async function getTerms() {
  try {
    const response = await fetch(`${resolveApiBase()}/api/public/legal/terms`, { cache: 'no-store' })
    if (!response.ok) return FALLBACK_TERMS
    const data = await response.json()
    return data?.terms || FALLBACK_TERMS
  } catch {
    return FALLBACK_TERMS
  }
}

export default async function TermsPage() {
  const terms = await getTerms()
  const content = terms.content || FALLBACK_TERMS.content
  const sections = Array.isArray(content.sections) && content.sections.length ? content.sections : FALLBACK_TERMS.content.sections

  return (
    <PublicPage title={terms.title || FALLBACK_TERMS.title}>
      <div className="space-y-8 text-lg leading-8 text-gray-800">
        <p>Última atualização: {content.lastUpdatedLabel || FALLBACK_TERMS.content.lastUpdatedLabel}</p>

        {sections.map((section, index) => (
          <section key={`${section.title}-${index}`} className="space-y-3">
            <h2 className="text-lg font-normal text-inherit">{section.title}</h2>
            {(Array.isArray(section.body) ? section.body : []).map((paragraph, paragraphIndex) => (
              <p key={`${index}-${paragraphIndex}`}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="text-lg font-normal text-inherit">Declaração final de ciência</h2>
          <p>{content.finalDeclaration || FALLBACK_TERMS.content.finalDeclaration}</p>
        </section>

        <p>
          Dúvidas sobre estes termos podem ser enviadas pela página de <Link href="/suporte" className="text-inherit underline hover:no-underline">suporte</Link>.
        </p>
      </div>
    </PublicPage>
  )
}
