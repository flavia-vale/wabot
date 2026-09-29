'use client'

/* Card "Conhece outra afiliada?" — o link de indicação mostrado nos dois
 * momentos de maior satisfação (1ª oferta publicada, pagamento confirmado).
 * A regra do que mostrar mora em src/domain/painel/referralInvite.js; aqui só
 * buscamos os dados que a API já entrega (perfil de afiliada, percentuais do
 * programa, código da conta) e desenhamos com os tokens do design system. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel } from '../app/painel/PainelShell'
import {
  DEFAULT_AFFILIATE_CONFIG,
  FIRST_OFFER_INVITE_COPY,
  PAYMENT_INVITE_COPY,
  REFERRAL_INVITE_COPY,
  buildReferralInvite,
} from '../../src/domain/painel/referralInvite.js'

const COPIES = { 'first-offer': FIRST_OFFER_INVITE_COPY, payment: PAYMENT_INVITE_COPY }

export function ReferralInviteCard({ variant = 'first-offer', onDismiss = null, showCommission = true }) {
  const { user } = usePainel()
  const [affiliate, setAffiliate] = useState(undefined) // undefined = carregando
  const [config, setConfig] = useState(DEFAULT_AFFILIATE_CONFIG)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    api.affiliateMe()
      .then((d) => { if (active) setAffiliate(d?.profile ?? null) })
      .catch(() => { if (active) setAffiliate(null) })
    api.affiliateConfig()
      .then((c) => { if (active && c) setConfig(c) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  if (affiliate === undefined) return null
  const invite = buildReferralInvite({ affiliateProfile: affiliate, referralCode: user?.referralCode, config })
  if (!invite) return null

  const copy = COPIES[variant] ?? FIRST_OFFER_INVITE_COPY

  function copyLink() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(invite.link)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }

  return (
    <section
      className="pnl-card"
      aria-labelledby="referral-invite-title"
      data-referral-invite={variant}
      style={{ position: 'relative', borderColor: 'var(--line-strong)' }}
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={REFERRAL_INVITE_COPY.dismiss}
          className="pnl-btn pnl-btn-sm"
          style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', lineHeight: 1, color: 'var(--ink-soft)' }}
        >
          ×
        </button>
      )}
      <h2 id="referral-invite-title" className="pv-section-title" style={{ paddingRight: onDismiss ? 40 : 0 }}>{copy.title}</h2>
      <p className="pv-section-note">{copy.body}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <span className="pnl-hint" style={{ flexBasis: '100%' }}>{REFERRAL_INVITE_COPY.linkLabel}</span>
        <code
          style={{
            flex: '1 1 240px', minWidth: 0, overflowWrap: 'anywhere',
            padding: '9px 12px', borderRadius: 12, fontSize: 13,
            background: 'var(--bg-soft)', color: 'var(--ink)', border: '1px solid var(--line)',
          }}
        >
          {invite.link}
        </code>
        <button type="button" onClick={copyLink} className="pnl-btn is-primary" style={{ whiteSpace: 'nowrap' }}>
          {copied ? REFERRAL_INVITE_COPY.copied : REFERRAL_INVITE_COPY.copy}
        </button>
      </div>

      {showCommission && (
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)', margin: '12px 0 0' }}>
          {invite.promise}
          {invite.cta && (
            <>
              {' '}
              <Link href={invite.cta.href} style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{invite.cta.label}</Link>
            </>
          )}
        </p>
      )}
    </section>
  )
}
