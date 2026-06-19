'use client'
/* Card compacto de onboarding no topo da sidebar.
 *
 * Espelha a lógica de progresso de ActivationChecklist (mesmas 4 etapas de
 * pré-requisito + ativação = 5 passos), mas numa pílula enxuta que leva ao
 * /painel/checklist. Aplica goal-gradient/Zeigarnik: o recém-chegado vê um
 * caminho único e o progresso puxa para concluir. Some sozinho quando o bot
 * está ativo — o usuário experiente não carrega esse peso. Mas REAPARECE em
 * modo "religar" se um pré-requisito regredir depois (ex.: WhatsApp caiu),
 * mesmo para quem já concluiu o onboarding (ver lib/onboardingProgress.js).
 *
 * Puramente visual + uma chamada a api.dashboardStatus(); nenhuma regra nova
 * de negócio. Mantém os testes db-free (o componente só roda no cliente).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { TOTAL_STEPS, countCompletedPrereqs, isBotActive } from '@/lib/onboardingProgress'

const ONBOARDING_DONE_KEY = 'wb_onboarding_done'

function isOnboardingDone(userId) {
  try {
    const key = userId ? `${ONBOARDING_DONE_KEY}_${userId}` : ONBOARDING_DONE_KEY
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export default function SidebarOnboarding({ userId, onNavigate }) {
  // Lazy init: a sidebar só monta depois que a auth resolve no cliente (o shell
  // mostra um loader durante `checking`), então ler o localStorage aqui é seguro
  // e não causa mismatch de hidratação.
  const [doneBefore] = useState(() => isOnboardingDone(userId))
  const [status, setStatus] = useState(null)

  // Sonda sempre (inclusive quem já concluiu) para detectar regressão — ex.: o
  // WhatsApp caiu e o bot ficou offline. A sidebar persiste entre navegações,
  // então um intervalo garante que o card "religar" apareça sem reload.
  useEffect(() => {
    let cancelled = false
    const poll = () =>
      api.dashboardStatus()
        .then((data) => { if (!cancelled) setStatus(data) })
        .catch(() => {})
    poll()
    const id = setInterval(poll, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const botActive = isBotActive(status)
  // Tudo concluído → não mostra o card (a home cuida da celebração + localStorage).
  if (botActive) return null
  // Quem já concluiu o onboarding só revê o card se algo regrediu (status
  // carregado e bot inativo). Enquanto o status não chega, não pisca.
  if (doneBefore && status === null) return null

  const recovery = doneBefore
  const done = countCompletedPrereqs(status)
  const displayCount = done
  const pct = Math.round((displayCount / TOTAL_STEPS) * 100)
  const remaining = TOTAL_STEPS - displayCount
  const sub = recovery
    ? 'Bot offline — toque para religar'
    : displayCount === 0
    ? 'Configure seu bot em 5 passos'
    : `${remaining} ${remaining === 1 ? 'passo' : 'passos'} para ativar`

  return (
    <Link href="/painel/checklist" className="pnl-onboard" onClick={onNavigate}>
      <div className="pnl-onboard-head">
        <span className="pnl-onboard-title">
          <svg className="pnl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
          </svg>
          {recovery ? 'Religar o bot' : 'Primeiros passos'}
        </span>
        <span className="pnl-onboard-count">{displayCount}/{TOTAL_STEPS}</span>
      </div>
      <div className="pnl-onboard-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="pnl-onboard-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pnl-onboard-sub">{sub}</span>
    </Link>
  )
}
