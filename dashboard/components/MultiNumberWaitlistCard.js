'use client'

/* Lista de espera do "vários números na mesma conta" (Fase 0 —
 * docs/rca/multi-numero.md). Só registra a intenção: não liga sessão nem
 * reserva vaga. O texto promete continuidade e envio dividido, nunca
 * "anti-ban garantido" — o rodízio reduz o risco, não elimina. */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ProTag } from '@/components/pro/ProGate'

export function MultiNumberWaitlistCard() {
  const [state, setState] = useState(null)
  const [extraNumbers, setExtraNumbers] = useState(1)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.multiNumberWaitlist()
      .then((data) => { if (alive) setState(data) })
      .catch(() => { if (alive) setState(null) })
    return () => { alive = false }
  }, [])

  if (!state) return null

  async function join(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      setState(await api.multiNumberWaitlistJoin({ extraNumbers, reason }))
    } catch (err) {
      setError(err?.message || 'Não consegui salvar agora. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  async function leave() {
    setSaving(true)
    setError('')
    try {
      setState(await api.multiNumberWaitlistLeave())
    } catch (err) {
      setError(err?.message || 'Não consegui salvar agora. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  const reasons = Object.entries(state.reasons || {})
  const options = state.extraNumberOptions || []
  const lastOption = options[options.length - 1]

  return (
    <section className="pnl-card" aria-labelledby="multi-number-title">
      <p className="pnl-eyebrow">Em breve <ProTag small /></p>
      <div className="pnl-card-title" id="multi-number-title">Mais números de WhatsApp na mesma conta</div>
      <p className="pnl-card-note" style={{ marginTop: 6 }}>
        Conecte outros números nesta conta. Se um cair, os outros continuam enviando, e as ofertas podem ser divididas entre eles para cada número enviar menos.
      </p>
      <p className="pnl-hint" style={{ marginTop: 6 }}>
        {state.priceLabel}/mês por número a mais, no plano PRO. Entrar na lista não cobra nada.
      </p>

      {state.joined ? (
        <div className="pnl-note-box is-success" role="status" style={{ marginTop: 12 }}>
          <strong style={{ fontWeight: 600, display: 'block' }}>Você está na lista</strong>
          <span>
            Pedido: {state.extraNumbers === lastOption ? `${lastOption} ou mais` : state.extraNumbers} número(s) a mais. Avisamos quando liberar.
          </span>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="pnl-link-btn" onClick={leave} disabled={saving}>Sair da lista</button>
          </div>
        </div>
      ) : (
        <form onSubmit={join} style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <div className="pnl-field">
            <span className="pnl-label" id="multi-number-qty">Quantos números a mais?</span>
            <div className="pnl-chips" role="group" aria-labelledby="multi-number-qty">
              {options.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`pnl-chip${extraNumbers === n ? ' is-active' : ''}`}
                  aria-pressed={extraNumbers === n}
                  onClick={() => setExtraNumbers(n)}
                >
                  {n === lastOption ? `${n}+` : n}
                </button>
              ))}
            </div>
          </div>
          <div className="pnl-field">
            <span className="pnl-label" id="multi-number-reason">Para que você quer?</span>
            <div className="pnl-chips" role="group" aria-labelledby="multi-number-reason">
              {reasons.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`pnl-chip${reason === value ? ' is-active' : ''}`}
                  aria-pressed={reason === value}
                  onClick={() => setReason(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {state.requiresUpgrade && (
            <p className="pnl-hint">Seu plano atual é o Basic: para usar, será preciso passar para o PRO.</p>
          )}
          {error && <p className="pnl-hint" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button type="submit" className="pnl-btn is-primary" style={{ justifyContent: 'center' }} disabled={saving || !reason}>
            {saving ? 'Salvando…' : 'Quero entrar na lista'}
          </button>
        </form>
      )}
    </section>
  )
}
