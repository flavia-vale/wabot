import Link from 'next/link'
import { PublicPage } from '@/components/PublicShell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Termos de Uso e Ciência de Riscos',
  description: 'Termos completos para uso responsável do Espelha Grupos, incluindo ciência de riscos de automação no WhatsApp e responsabilidade do usuário.',
  alternates: { canonical: '/termos' },
}

import { FALLBACK_TERMS, getPublicTerms } from '@/lib/legalTerms'

export default async function TermsPage() {
  const terms = await getPublicTerms()
  const content = terms.content || FALLBACK_TERMS.content
  const sections = Array.isArray(content.sections) && content.sections.length ? content.sections : FALLBACK_TERMS.content.sections

  return (
    <PublicPage
      eyebrow="Legal"
      title={terms.title || FALLBACK_TERMS.title}
      description={terms.summary || FALLBACK_TERMS.summary}
    >
      <div className="space-y-8 text-base leading-8 text-gray-800 md:text-lg">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="font-bold">Última atualização: {content.lastUpdatedLabel || FALLBACK_TERMS.content.lastUpdatedLabel}</p>
          <p className="mt-3">{content.intro || FALLBACK_TERMS.content.intro}</p>
          {terms.version && <p className="mt-3 text-sm font-semibold text-amber-800">Versão: {terms.version}</p>}
        </div>

        {sections.map((section, index) => (
          <section
            key={`${section.title}-${index}`}
            className={`space-y-3 ${section.warning ? 'rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950' : ''}`}
          >
            <h2 className="text-xl font-bold text-gray-950">{section.title}</h2>
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
