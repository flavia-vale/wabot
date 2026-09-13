'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const STATUS_LABEL = { awaiting_review: 'Para revisar', approved: 'Aprovada', failed: 'Falhou' }

export function ReviewQueue({ automation }) {
  const [data, setData] = useState({ items: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try { setData(await api.offerAutomationReviewItems(automation.id)); setError('') }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [automation.id])

  async function act(key, operation) {
    setBusy(key); setError('')
    try { await operation(); await load() } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
      <div className="pnl-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>Fila para você revisar</strong>
          <p className="pnl-hint">{data.counts.awaiting_review || 0} para revisar · {data.counts.approved || 0} aprovadas</p>
        </div>
        <button className="pnl-btn" disabled={busy === 'discover'} onClick={() => act('discover', () => api.offerAutomationReviewDiscover(automation.id))}>{busy === 'discover' ? 'Buscando…' : 'Buscar mais ofertas'}</button>
      </div>
      {error && <div className="pnl-note-box is-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
      {loading ? <p className="pnl-hint" style={{ marginTop: 12 }}>Carregando fila…</p> : data.items.length === 0 ? <p className="pnl-hint" style={{ marginTop: 12 }}>Nenhuma oferta aguardando. Busque produtos para começar a revisão.</p> : (
        <div className="pnl-grid" style={{ marginTop: 12 }}>
          {data.items.map(item => (
            <article key={item.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, display: 'grid', gridTemplateColumns: item.imageUrl ? '72px 1fr' : '1fr', gap: 12 }}>
              {item.imageUrl && <img src={item.imageUrl} alt="" width="72" height="72" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />}
              <div style={{ minWidth: 0 }}>
                <span className={`pnl-tag ${item.status === 'approved' ? 'is-on' : item.status === 'failed' ? 'is-danger' : 'is-flight'}`}>{STATUS_LABEL[item.status] || item.status}</span>
                <pre className="pnl-pre" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 8, maxHeight: 180, overflow: 'auto' }}>{item.renderedText}</pre>
                <div className="pnl-toolbar" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {item.status === 'awaiting_review' && <button className="pnl-btn is-primary" disabled={busy === item.id} onClick={() => act(item.id, () => api.offerAutomationReviewApprove(automation.id, item.id))}>Aprovar</button>}
                  {['awaiting_review', 'approved'].includes(item.status) && <button className="pnl-btn" disabled={busy === item.id} onClick={() => act(item.id, () => api.offerAutomationReviewRemove(automation.id, item.id))}>Remover</button>}
                  {item.status === 'failed' && <button className="pnl-btn" disabled={busy === item.id} onClick={() => act(item.id, () => api.offerAutomationReviewRetry(automation.id, item.id))}>Tentar novamente</button>}
                  <a className="pnl-link-btn" href={item.productUrl} target="_blank" rel="noreferrer">Abrir produto</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
