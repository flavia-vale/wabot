'use client'

/* Número reserva (vários números por conta, Fase 1 — docs/rca/multi-numero.md).
 * A reserva fica conectada de prontidão e assume os envios se o número que
 * envia cair ou for bloqueado. Texto: "continuidade", nunca "anti-ban". */

import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { api } from '@/lib/api'
import { ProTag } from '@/components/pro/ProGate'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ReservePurchaseCard } from '@/components/ReservePurchaseCard'
import { RotationCard } from '@/components/RotationCard'

const QR_POLL_MS = 3000
const STATE_POLL_MS = 10000

function formatPhone(phone) {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (d.length < 12) return phone || '—'
  const local = d.slice(4)
  return `(${d.slice(2, 4)}) ${local.slice(0, local.length - 4)}-${local.slice(-4)}`
}

function statusLabel(row) {
  if (!row) return 'Não conectado'
  if (row.status === 'connected') return 'Conectado'
  if (row.status === 'connecting') return 'Conectando…'
  return 'Desconectado'
}

function NameList({ items }) {
  return <ul style={{ marginTop: 6, paddingLeft: 18 }}>{items.map(g => <li key={g.waJid}>{g.name || g.waJid}</li>)}</ul>
}

// Destinos (onde a reserva publica) e origens (de onde ela precisa receber).
// Origem fora da reserva = para de ser copiada se ela assumir (Fase 2.1).
function ReserveCoverage({ coverage, busy, onFollow, followResult }) {
  const src = coverage.sources
  const channelsPending = src ? src.missingChannels.length + src.unknownChannels.length : 0
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {coverage.missing.length === 0
        ? <p className="pnl-hint">Publica: a reserva está em todos os {coverage.total} grupos de destino.</p>
        : (
          <div className="pnl-note-box is-warn" role="status">
            <strong style={{ fontWeight: 600, display: 'block' }}>A reserva não está em {coverage.missing.length} de {coverage.total} grupos de destino</strong>
            <span>Se assumir, ela não envia nesses grupos. Adicione o número reserva neles:</span>
            <NameList items={coverage.missing} />
          </div>
        )}
      {src && src.total > 0 && (
        src.ok === src.total
          ? <p className="pnl-hint">Recebe: a reserva recebe de todas as {src.total} origens.</p>
          : (
            <div className="pnl-note-box is-warn" role="status">
              <strong style={{ fontWeight: 600, display: 'block' }}>A reserva recebe de {src.ok} de {src.total} origens</strong>
              <span>Se a reserva assumir, estas origens param de ser copiadas.</span>
              {src.missingGroups.length > 0 && (
                <>
                  <span style={{ display: 'block', marginTop: 6 }}>Grupos: entre com o número reserva pelo celular.</span>
                  <NameList items={src.missingGroups} />
                </>
              )}
              {src.missingChannels.length > 0 && (
                <>
                  <span style={{ display: 'block', marginTop: 6 }}>Canais que a reserva não segue:</span>
                  <NameList items={src.missingChannels} />
                </>
              )}
              {src.unknownChannels.length > 0 && (
                <>
                  <span style={{ display: 'block', marginTop: 6 }}>Canais que não deu para conferir agora:</span>
                  <NameList items={src.unknownChannels} />
                </>
              )}
              {channelsPending > 0 && (
                <button type="button" className="pnl-btn" style={{ marginTop: 8 }} disabled={Boolean(busy)} onClick={onFollow}>
                  {busy === 'follow' ? 'Seguindo…' : 'Seguir os canais com a reserva'}
                </button>
              )}
            </div>
          )
      )}
      {followResult && (
        <p className="pnl-hint" role="status">
          {followResult.followed.length > 0 ? `A reserva passou a seguir ${followResult.followed.length} ${followResult.followed.length === 1 ? 'canal' : 'canais'}.` : 'Nenhum canal novo seguido.'}
          {followResult.failed.length > 0 ? ` ${followResult.failed.length} não deu certo; tente de novo.` : ''}
          {followResult.remaining > 0 ? ` Faltam ${followResult.remaining}: aguarde meio minuto e clique de novo.` : ''}
        </p>
      )}
    </div>
  )
}

export function ReserveNumberCard({ initialState }) {
  const [state, setState] = useState(initialState)
  const [qr, setQr] = useState(null)
  const [pairPhone, setPairPhone] = useState('')
  const [pairCode, setPairCode] = useState('')
  const [missing, setMissing] = useState(null)
  const [followResult, setFollowResult] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const next = await api.reserveState()
      if (alive.current) setState(next)
    } catch {}
  }, [])

  useEffect(() => {
    alive.current = true
    const timer = setInterval(refresh, STATE_POLL_MS)
    return () => { alive.current = false; clearInterval(timer) }
  }, [refresh])

  const standby = state?.standby
  const standbyConnected = standby?.status === 'connected'
  const waitingQr = state?.running && !standbyConnected

  useEffect(() => {
    if (!waitingQr) return undefined
    let stop = false
    const poll = async () => {
      try {
        const data = await api.reserveQr()
        if (!stop) setQr(data?.qr ?? null)
      } catch {}
    }
    poll()
    const timer = setInterval(poll, QR_POLL_MS)
    return () => { stop = true; clearInterval(timer) }
  }, [waitingQr])

  async function run(label, action) {
    setBusy(label)
    setError('')
    try {
      await action()
      await refresh()
    } catch (err) {
      setError(err?.message || 'Não consegui agora. Tente de novo.')
    } finally {
      setBusy('')
    }
  }

  // Cancelou (ou o plano deixou de permitir) com a tela aberta.
  if (state?.access && !state.access.allowed) return state.access.reason === 'not_purchased' ? <ReservePurchaseCard /> : null

  const activeIsTwo = state?.activeWaSlot === 2
  const sameNumber = standby?.blockNotice?.reason === 'same_number'

  return (
    <section className="pnl-card" aria-labelledby="reserve-number-title">
      <p className="pnl-eyebrow">Número reserva <ProTag small /></p>
      <div className="pnl-card-title" id="reserve-number-title">Continue enviando mesmo se o WhatsApp cair</div>
      <p className="pnl-card-note" style={{ marginTop: 6 }}>
        O número reserva fica conectado de prontidão. Se o número que envia cair ou for bloqueado, ele assume os envios sozinho e avisamos você por e-mail.
      </p>

      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', marginTop: 12 }}>
        <dt className="pnl-hint">Enviando agora</dt>
        <dd>{formatPhone(state?.active?.phone)} · <span className={`pnl-tag ${state?.active?.status === 'connected' ? 'is-success' : 'is-error'}`}>{statusLabel(state?.active)}</span></dd>
        <dt className="pnl-hint">De prontidão</dt>
        <dd>{standby?.phone ? formatPhone(standby.phone) : '—'} · <span className={`pnl-tag ${standbyConnected ? 'is-success' : 'is-skip'}`}>{statusLabel(standby)}</span></dd>
      </dl>

      {activeIsTwo && (
        <div className="pnl-note-box is-warn" role="status" style={{ marginTop: 12 }}>
          <strong style={{ fontWeight: 600, display: 'block' }}>A reserva assumiu os envios</strong>
          <span>Quando o seu número de antes estiver conectado de novo, você pode voltar para ele.</span>
        </div>
      )}

      {sameNumber && (
        <div className="pnl-note-box is-error" role="alert" style={{ marginTop: 12 }}>
          <strong style={{ fontWeight: 600, display: 'block' }}>Use outro celular</strong>
          <span>A reserva precisa ser um número diferente do que já envia.</span>
        </div>
      )}

      {!state?.running && !standbyConnected && (
        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 12, justifyContent: 'center', width: '100%' }} disabled={Boolean(busy)} onClick={() => run('start', () => api.reserveStart())}>
          {busy === 'start' ? 'Ligando…' : 'Conectar número reserva'}
        </button>
      )}

      {waitingQr && (
        <div style={{ marginTop: 12, display: 'grid', gap: 12, justifyItems: 'center' }}>
          <p className="pnl-hint">No celular da reserva: WhatsApp → Dispositivos conectados → Conectar dispositivo.</p>
          {qr && waitingQr ? <QRCode value={qr} size={200} /> : <p className="pnl-hint">Gerando o código…</p>}
          <form
            style={{ display: 'grid', gap: 8, width: '100%' }}
            onSubmit={(e) => { e.preventDefault(); run('pair', async () => { const r = await api.reservePairingCode(pairPhone); setPairCode(r?.code || '') }) }}
          >
            <label className="pnl-label" htmlFor="reserve-pair-phone">Ou receba um código no número da reserva</label>
            <input id="reserve-pair-phone" className="pnl-input" inputMode="numeric" placeholder="Ex: 5511999999999" value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} />
            <button type="submit" className="pnl-btn" disabled={Boolean(busy) || !pairPhone}>{busy === 'pair' ? 'Gerando…' : 'Gerar código'}</button>
            {pairCode && <p className="pnl-card-title" style={{ textAlign: 'center' }}>{pairCode}</p>}
          </form>
        </div>
      )}

      {standbyConnected && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <button type="button" className="pnl-btn" disabled={Boolean(busy)} onClick={() => run('missing', async () => setMissing(await api.reserveMissingGroups()))}>
            {busy === 'missing' ? 'Conferindo…' : 'Conferir grupos e canais da reserva'}
          </button>
          {missing && (
            <ReserveCoverage
              coverage={missing}
              busy={busy}
              onFollow={() => run('follow', async () => {
                const res = await api.reserveFollowSourceChannels()
                setFollowResult(res)
                setMissing(await api.reserveMissingGroups())
              })}
              followResult={followResult}
            />
          )}
          <button type="button" className="pnl-btn" disabled={Boolean(busy)} onClick={() => setConfirmSwitch(true)}>
            {activeIsTwo ? 'Voltar para o número de antes' : 'Usar a reserva para enviar agora'}
          </button>
          <RotationCard />
        </div>
      )}

      {(state?.running || standbyConnected) && (
        <button type="button" className="pnl-link-btn" style={{ marginTop: 12 }} disabled={Boolean(busy)} onClick={() => setConfirmStop(true)}>Desconectar número reserva</button>
      )}

      {error && <p className="pnl-hint" role="alert" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}

      <button type="button" className="pnl-link-btn" style={{ marginTop: 12, display: 'block', color: 'var(--ink-soft)' }} disabled={Boolean(busy)} onClick={() => setConfirmCancel(true)}>Cancelar o número reserva (R$29/mês)</button>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar número reserva"
        message="A reserva é desconectada agora e a cobrança de R$29/mês para. Se o seu WhatsApp cair depois disso, os envios param até você reconectar."
        confirmLabel="Cancelar número reserva"
        danger
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => { setConfirmCancel(false); run('cancel', () => api.extraNumberCancel()) }}
      />
      <ConfirmDialog
        open={confirmSwitch}
        title="Trocar o número que envia"
        message="Os dois números reconectam por alguns segundos e o outro passa a enviar. Ele só envia nos grupos em que está."
        confirmLabel="Trocar agora"
        onCancel={() => setConfirmSwitch(false)}
        onConfirm={() => { setConfirmSwitch(false); run('switch', () => api.reserveSwitch()) }}
      />
      <ConfirmDialog
        open={confirmStop}
        title="Desconectar número reserva"
        message="Sem a reserva, se o seu WhatsApp cair os envios param até você reconectar."
        confirmLabel="Desconectar"
        danger
        onCancel={() => setConfirmStop(false)}
        onConfirm={() => { setConfirmStop(false); run('stop', () => api.reserveStop()) }}
      />
    </section>
  )
}
