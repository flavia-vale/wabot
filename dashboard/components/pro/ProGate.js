'use client'

/* Divisão Basic/PRO do painel (2026-09-23) — peças visuais compartilhadas.
 *
 * O bloqueio de verdade é SEMPRE do backend (403 FEATURE_REQUIRES_PRO); isto é
 * a camada que mostra o que o PRO faz, sem esconder a tela. Cores: roxo do
 * PRO (--pro*) junto do verde do produto — tokens em painel.css.
 *
 * Texto de cada recurso: dashboard/lib/planFeatures.js (fonte única).
 */

import Link from 'next/link'
import { usePainel } from '@/app/painel/PainelShell'
import { PRO_FEATURES, PRO_FEATURE_LIST } from '@/lib/planFeatures'

const LOCK_PATH = <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>
const STAR_PATH = <path d="M12 2.5l2.9 6 6.6.6-5 4.4 1.5 6.5L12 16.9 5.5 20.5 7 14 2 9.6l6.6-.6z" />
const CHECK_PATH = <path d="M5 12.5 10 17 19 7" />

export function ProIcon({ path, size = 16, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  )
}

export const PRO_ICONS = { lock: LOCK_PATH, star: STAR_PATH, check: CHECK_PATH }

export function ProTag({ small = false }) {
  return (
    <span className={`pnl-pro-tag${small ? ' is-sm' : ''}`}>
      <ProIcon path={LOCK_PATH} size={small ? 10 : 12} stroke={2.4} />PRO
    </span>
  )
}

/* Trava um pedaço de tela para quem não tem o PRO: esmaece, põe o cadeado e,
 * ao clicar, abre a janela que explica o recurso. Com o PRO, some sem deixar
 * rastro. `locked` explícito vence o plano (usado nas prévias). */
export function ProLock({ feature, children, tag = true, locked }) {
  const { isPro, openPro } = usePainel()
  const isLocked = locked ?? !isPro
  if (!isLocked) return children
  return (
    <div className="pnl-pro-lock">
      <div className="pnl-pro-lock-content" aria-hidden="true" inert>{children}</div>
      <button type="button" className="pnl-pro-lock-hit" aria-label={`${PRO_FEATURES[feature]?.title ?? 'Recurso'} — disponível no plano PRO`} onClick={() => openPro(feature)} />
      {tag && <span className="pnl-pro-lock-tag"><ProTag small /></span>}
    </div>
  )
}

export function ProModal({ feature, onClose }) {
  const info = PRO_FEATURES[feature] ?? { title: 'Recurso do PRO', desc: '' }
  const extras = PRO_FEATURE_LIST.slice(1, 5)
  return (
    <div className="pnl-pro-backdrop" role="presentation" onClick={onClose}>
      <div className="pnl-pro-modal" role="dialog" aria-modal="true" aria-labelledby="pnl-pro-modal-title" onClick={e => e.stopPropagation()}>
        <div className="pnl-pro-modal-body">
          <div className="pnl-pro-modal-top">
            <span className="pnl-pro-iconbox is-lg"><ProIcon path={STAR_PATH} size={22} /></span>
            <button type="button" className="pnl-pro-close" aria-label="Fechar" onClick={onClose}>×</button>
          </div>
          <div>
            <div className="pnl-pro-modal-title-row">
              <h3 id="pnl-pro-modal-title">{info.title}</h3>
              <ProTag />
            </div>
            <p className="pnl-pro-muted">{info.desc}</p>
          </div>
          <div className="pnl-pro-soft-card">
            <div className="pnl-pro-soft-title">No PRO você também tem</div>
            <ul className="pnl-pro-checks">
              {extras.map(item => (
                <li key={item}><ProIcon path={CHECK_PATH} size={14} stroke={2.6} />{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pnl-pro-modal-foot">
          <button type="button" className="pnl-btn" onClick={onClose}>Agora não</button>
          <Link href="/painel/plano" className="pnl-btn is-pro" onClick={onClose}><ProIcon path={STAR_PATH} size={14} /> Ver planos</Link>
        </div>
      </div>
    </div>
  )
}

export function ProBanner({ feature }) {
  return (
    <div className="pnl-pro-banner">
      <span className="pnl-pro-iconbox"><ProIcon path={LOCK_PATH} size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pnl-pro-banner-title">Recurso PRO</div>
        <div className="pnl-pro-banner-text">Atualize para o plano PRO para usar {feature}. Abaixo você vê como funciona.</div>
      </div>
      <Link href="/painel/plano" className="pnl-btn is-pro is-sm"><ProIcon path={STAR_PATH} size={14} /> Ver planos</Link>
    </div>
  )
}

export function Steps({ title = 'Como funciona', items = [] }) {
  return (
    <section className="pnl-pro-card">
      <div className="pnl-pro-steps-title">{title} em {items.length} passos</div>
      <ol className="pnl-pro-steps">
        {items.map((step, index) => (
          <li key={step.title} className="pnl-pro-step">
            <span className="pnl-pro-step-n">{index + 1}</span>
            <strong>{step.title}</strong>
            <p className="pnl-pro-muted">{step.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* Página inteira do PRO vista por quem não tem o plano: faixa, passos e uma
 * PRÉVIA esmaecida de como a tela fica — nunca uma tela vazia. A prévia é
 * ilustrativa (`children` com exemplo), nunca dado de outra conta. */
export function LockedPage({ feature, featureLabel, steps, children }) {
  const info = PRO_FEATURES[feature] ?? {}
  return (
    <div className="pnl-pro-page">
      <ProBanner feature={featureLabel} />
      <Steps items={steps} />
      <div className="pnl-pro-preview-label">PRÉVIA · COMO FICA NO PRO</div>
      <div className="pnl-pro-preview">
        <div className="pnl-pro-preview-content" aria-hidden="true" inert>{children}</div>
        <div className="pnl-pro-preview-overlay">
          <div className="pnl-pro-preview-card">
            <span className="pnl-pro-iconbox is-lg"><ProIcon path={LOCK_PATH} size={22} /></span>
            <strong>Disponível no plano PRO</strong>
            <p className="pnl-pro-muted">{info.desc}</p>
            <Link href="/painel/plano" className="pnl-btn is-pro"><ProIcon path={STAR_PATH} size={14} /> Ver planos</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
