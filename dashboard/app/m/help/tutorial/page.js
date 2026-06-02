'use client'

import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { mobileRoutes } from '@/components/mobile/routes'

const steps = [
  { title: '1. Criar primeira oferta', text: 'Cole um link, gere a mensagem e valide o envio manual.', route: mobileRoutes.offer },
  { title: '2. Ajustar preferências', text: 'Configure delay, marca e palavras bloqueadas.', route: mobileRoutes.configPreferences },
  { title: '3. Conferir logs', text: 'Veja postagens, erros e links enviados.', route: mobileRoutes.logs },
]

export default function TutorialRedirectPage() {
  const router = useRouter()
  return (
    <MobileShell title="Guia rápido" active="conta" showBack onBack={() => router.back()}>
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Ativação</div>
        <div style={cfgStyles.pageTitle}>Guia rápido</div>
      </div>
      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>Siga estes passos para validar a operação pelo celular.</div>
          {steps.map((step) => (
            <button key={step.route} type="button" onClick={() => router.push(step.route)} style={{ ...cfgStyles.rowButton(false), border: '1px solid var(--line)', borderRadius: 14 }}>
              <span style={cfgStyles.rowMain}>
                <span style={cfgStyles.rowTitle}>{step.title}</span>
                <span style={cfgStyles.rowSub}>{step.text}</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
          <button type="button" onClick={() => router.push(mobileRoutes.checklistEspelhamento)} style={mobi.btn('accent', true)}>Abrir checklist completo</button>
        </div>
      </div>
    </MobileShell>
  )
}
