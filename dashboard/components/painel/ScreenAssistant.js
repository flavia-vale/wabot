'use client'

import Link from 'next/link'
import { guidanceForPath, robotDiagnostic } from '../../../src/domain/painel/screenGuidance.js'

export function ScreenAssistant({ pathname, online, hasAnyCredential, destinationCount }) {
  const guide = guidanceForPath(pathname)
  const diagnostic = robotDiagnostic({ online, hasAnyCredential, destinationCount })

  return (
    <div className="pnl-screen-assistant">
      <details className="pnl-screen-guide">
        <summary>Como usar esta tela</summary>
        <p>{guide.description}</p>
        <strong>{guide.nextStep}</strong>
      </details>
      <section className={`pnl-robot-diagnostic is-${diagnostic.state}`} aria-label="Seu robô está funcionando?">
        <div className="pnl-robot-step" aria-label={`Passo ${diagnostic.step} de 3`}>{diagnostic.step}/3</div>
        <div>
          <strong>Seu robô está funcionando?</strong>
          <h2>{diagnostic.title}</h2>
          <p>{diagnostic.body} <span>{diagnostic.eta}</span></p>
        </div>
        <Link href={diagnostic.href} className="pnl-btn is-primary">{diagnostic.action}</Link>
      </section>
    </div>
  )
}
