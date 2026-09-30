'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { guidanceForPath, robotDiagnostic, shouldShowRobotDiagnostic } from '../../../src/domain/painel/screenGuidance.js'

const DISMISS_KEY = 'pnl-robot-diagnostic-dismissed-step'
const DISMISS_EVENT = 'eg:robot-diagnostic-dismissed'

function readDismissedStep() {
  try { return window.localStorage.getItem(DISMISS_KEY) } catch { return null }
}
function rememberDismissedStep(step) {
  try { window.localStorage.setItem(DISMISS_KEY, step) } catch { /* sem armazenamento, volta a aparecer ao recarregar */ }
  try { window.dispatchEvent(new Event(DISMISS_EVENT)) } catch { /* ambiente sem Event */ }
}
function subscribeDismissedStep(onChange) {
  window.addEventListener('storage', onChange)
  window.addEventListener(DISMISS_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(DISMISS_EVENT, onChange)
  }
}
// No servidor não há navegador: `undefined` = "ainda não sei", e o card espera
// (não pisca o aviso que a cliente já fechou).
const serverDismissedStep = () => undefined

export function ScreenAssistant({ pathname, online, hasAnyCredential, destinationCount }) {
  const guide = guidanceForPath(pathname)
  const diagnostic = robotDiagnostic({ online, hasAnyCredential, destinationCount })
  const dismissedStep = useSyncExternalStore(subscribeDismissedStep, readDismissedStep, serverDismissedStep)

  const showDiagnostic = dismissedStep !== undefined && shouldShowRobotDiagnostic(diagnostic, dismissedStep)

  function dismiss() {
    rememberDismissedStep(String(diagnostic.step))
  }

  return (
    <div className="pnl-screen-assistant">
      <details className="pnl-screen-guide">
        <summary>Como usar esta tela</summary>
        <p>{guide.description}</p>
        <strong>{guide.nextStep}</strong>
      </details>
      {showDiagnostic && (
        <section className={`pnl-robot-diagnostic is-${diagnostic.state}`} aria-label="Seu robô está funcionando?">
          <div className="pnl-robot-step" aria-label={`Passo ${diagnostic.step} de 3`}>{diagnostic.step}/3</div>
          <div>
            <strong>Seu robô está funcionando?</strong>
            <h2>{diagnostic.title}</h2>
            <p>{diagnostic.body} <span>{diagnostic.eta}</span></p>
          </div>
          <div className="pnl-robot-actions">
            <Link href={diagnostic.href} className="pnl-btn is-primary">{diagnostic.action}</Link>
            <button type="button" className="pnl-drawer-close" onClick={dismiss} aria-label="Fechar aviso">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
