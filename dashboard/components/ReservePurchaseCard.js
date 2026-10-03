'use client'

/* Contratar o número reserva (assinatura separada de R$29/mês no Mercado
 * Pago — docs/rca/multi-numero.md). Aparece só para quem já pode usar (PRO em
 * dia) e ainda não contratou. */

import { useState } from 'react'
import { api } from '@/lib/api'
import { ProTag } from '@/components/pro/ProGate'

export function ReservePurchaseCard() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function subscribe() {
    setBusy(true)
    setError('')
    try {
      const data = await api.extraNumberSubscribe()
      if (!data?.checkout_url) throw new Error('Não conseguimos abrir a contratação agora. Tente de novo.')
      window.location.assign(data.checkout_url)
    } catch (err) {
      setError(err?.message || 'Não conseguimos abrir a contratação agora. Tente de novo.')
      setBusy(false)
    }
  }

  return (
    <section className="pnl-card" aria-labelledby="reserve-purchase-title">
      <p className="pnl-eyebrow">Número reserva <ProTag small /></p>
      <div className="pnl-card-title" id="reserve-purchase-title">Continue enviando mesmo se o WhatsApp cair</div>
      <p className="pnl-card-note" style={{ marginTop: 6 }}>
        Conecte um segundo número de prontidão. Se o número que envia cair ou for bloqueado, ele assume os envios sozinho e avisamos você por e-mail.
      </p>
      <p className="pnl-hint" style={{ marginTop: 6 }}>R$29/mês, cobrado à parte do seu plano. Cancele quando quiser.</p>
      {error && <p className="pnl-hint" role="alert" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
      <button type="button" className="pnl-btn is-pro" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} disabled={busy} onClick={subscribe}>
        {busy ? 'Abrindo…' : 'Contratar número reserva'}
      </button>
    </section>
  )
}
