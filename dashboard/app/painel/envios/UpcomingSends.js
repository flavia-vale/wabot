'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const STATUS = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  queued: { label: 'Na fila', className: 'bg-blue-100 text-blue-700' },
}

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function destinationCount(item) {
  return Array.isArray(item.targetJids) ? item.targetJids.length : 0
}

export default function UpcomingSends() {
  const [items, setItems] = useState(null)
  const [requestState, setRequestState] = useState('loading')
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const load = useCallback(async () => {
    setRequestState('loading')
    setError('')
    try {
      const result = await api.scheduledList()
      setItems(Array.isArray(result) ? result : (result?.items ?? []))
      setRequestState('ready')
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar os próximos envios.')
      setRequestState('error')
    }
  }, [])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => { if (active) load() }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [load])

  async function cancelScheduled(id) {
    setCancellingId(id)
    setConfirmId(null)
    setError('')
    try {
      await api.scheduledCancel(id)
      await load()
    } catch (err) {
      setError(err?.message || 'Não foi possível cancelar o agendamento.')
    } finally {
      setCancellingId(null)
    }
  }

  const list = items ?? []
  const loading = requestState === 'loading'

  return (
    <section className="pnl-grid" aria-labelledby="upcoming-sends-title">
      <div className="pnl-toolbar">
        <div>
          <h2 id="upcoming-sends-title" className="pnl-card-title">Próximos envios</h2>
          <p className="pnl-card-note">Agendamentos pendentes e mensagens que já entraram na fila.</p>
        </div>
        <span className="pnl-spacer" />
        <button type="button" className="pnl-btn" onClick={load} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {error && <Alert type="error" title="Erro ao carregar" message={error} />}

      {loading && !items && (
        <div className="pnl-grid" aria-label="Carregando próximos envios">
          {[0, 1, 2].map((key) => <div key={key} className="pnl-skel" style={{ height: 104 }} />)}
        </div>
      )}

      {!loading && list.length === 0 && !error && (
        <div className="pnl-card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="pnl-card-title" style={{ fontSize: 16 }}>Nenhum envio programado</p>
          <p className="pnl-card-note" style={{ margin: '6px auto 18px', maxWidth: 480 }}>
            Quando você agendar uma oferta ou mensagem, ela aparecerá aqui até entrar no histórico.
          </p>
          <Link href="/painel/criar-oferta" className="pnl-btn" style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
            Criar oferta
          </Link>
        </div>
      )}

      {list.length > 0 && (
        <ul className="pnl-grid" aria-label="Lista de próximos envios">
          {list.map((item) => {
            const status = STATUS[item.status] ?? { label: item.status || '—', className: 'bg-gray-100 text-gray-600' }
            const destinations = destinationCount(item)
            const isPending = item.status === 'pending'
            const isCancelling = cancellingId === item.id

            return (
              <li key={item.id} className="pnl-card">
                <div className="pnl-toolbar" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: '1 1 420px' }}>
                    <div className="pnl-toolbar" style={{ marginBottom: 10 }}>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                      <time className="pnl-faint" dateTime={item.scheduledAt}>{formatWhen(item.scheduledAt)}</time>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.55 }}>
                      {item.text || '(sem texto)'}
                    </p>
                    <p className="pnl-card-note" style={{ marginTop: 10 }}>
                      {destinations} {destinations === 1 ? 'destino' : 'destinos'}
                      {item.imageUrl ? ' · com imagem' : ''}
                    </p>
                  </div>
                  {isPending && (
                    <button
                      type="button"
                      className="pnl-btn is-danger"
                      onClick={() => setConfirmId(item.id)}
                      disabled={isCancelling}
                    >
                      {isCancelling ? 'Cancelando…' : 'Cancelar'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmId != null}
        title="Cancelar agendamento"
        message="O envio programado será cancelado e não sairá. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar envio"
        danger
        onCancel={() => setConfirmId(null)}
        onConfirm={() => cancelScheduled(confirmId)}
      />
    </section>
  )
}
