'use client'

/* Rodízio de envio (vários números, Fase 2 — docs/rca/multi-numero.md). Cada
 * grupo tem um número que envia; o outro só entra se o dono passar do limite
 * por hora e também estiver no grupo. Some sozinho quando o recurso está
 * desligado no servidor (404). */

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

function numberLabel(slot, activeWaSlot) {
  if (slot == null) return 'Nenhum'
  return slot === activeWaSlot ? 'Principal' : 'Reserva'
}

export function RotationCard() {
  const [state, setState] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setState(await api.rotationState())
    } catch {
      setState(null)
    }
  }, [])

  useEffect(() => {
    let alive = true
    api.rotationState()
      .then((data) => { if (alive) setState(data) })
      .catch(() => { if (alive) setState(null) })
    return () => { alive = false }
  }, [])

  if (!state) return null

  async function toggle() {
    setBusy(true)
    setError('')
    try {
      await api.rotationSet(!state.enabled)
      await load()
    } catch (err) {
      setError(err?.message || 'Não consegui salvar agora. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const groups = state.groups || []
  const orphan = groups.filter(g => !g.members?.[1] && !g.members?.[2])
  const sent = state.sent24h || {}

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
      <div className="pnl-card-title">Dividir os envios entre os números</div>
      <p className="pnl-card-note" style={{ marginTop: 6 }}>
        Cada grupo passa a receber sempre do mesmo número, e cada número envia menos por hora.
        {state.mirrorRotation ? ' Vale também para as ofertas espelhadas.' : ' As ofertas espelhadas continuam saindo pelo número principal.'}
      </p>
      <button type="button" className={`pnl-btn ${state.enabled ? '' : 'is-primary'}`} style={{ marginTop: 10 }} disabled={busy} onClick={toggle} aria-pressed={state.enabled}>
        {busy ? 'Salvando…' : state.enabled ? 'Desligar divisão dos envios' : 'Ligar divisão dos envios'}
      </button>
      {error && <p className="pnl-hint" role="alert" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}

      {state.enabled && (
        <>
          <p className="pnl-hint" style={{ marginTop: 12 }}>
            Últimas 24 h: principal {sent[state.activeWaSlot] ?? 0} envios · reserva {sent[state.activeWaSlot === 1 ? 2 : 1] ?? 0} envios
          </p>
          {orphan.length > 0 && (
            <div className="pnl-note-box is-warn" role="status" style={{ marginTop: 10 }}>
              <strong style={{ fontWeight: 600, display: 'block' }}>Nenhum dos seus números está em {orphan.length} grupo(s)</strong>
              <span>Nesses grupos as ofertas não saem. Adicione um dos números a eles.</span>
            </div>
          )}
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, display: 'grid', gap: 6 }}>
            {groups.map(g => (
              <li key={g.waJid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{g.name}</span>
                <span className={`pnl-tag ${g.senderSlot == null ? 'is-skip' : 'is-info'}`}>{numberLabel(g.senderSlot, state.activeWaSlot)}</span>
              </li>
            ))}
          </ul>
          <p className="pnl-hint" style={{ marginTop: 8 }}>A divisão é atualizada a cada minuto, conforme os grupos de cada número.</p>
        </>
      )}
    </div>
  )
}
