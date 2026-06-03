'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard, MobileSpinner } from '@/components/mobile/MobileAsyncState'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { cfgStyles, mobi, tint, tintBorder } from '@/components/mobile/mobileStyles'
import { api } from '@/lib/api'

const STATUS_PILL_TONE = {
  sent: 'success',
  failed: 'danger',
  cancelled: 'neutro',
  pending: 'warn',
  queued: 'warn',
  sending: 'warn',
}

const STATUS_LABEL_PT = {
  sent: 'Enviado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
  pending: 'Pendente',
  queued: 'Na fila',
  sending: 'Enviando',
}

const CANCELLABLE_STATUSES = new Set(['pending', 'queued'])

const schedStyles = {
  pageH: {
    padding: '18px 20px 14px',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16,
  },
  pageEyebrow: { fontSize: 12, color: 'var(--ink-soft)' },
  pageTitle: { fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginTop: 2 },
  refreshBtn: {
    padding: '9px 13px', borderRadius: 999,
    background: 'var(--surface)', border: '1px solid var(--line)',
    color: 'var(--ink)', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  itemCard: {
    margin: '0 16px 10px',
    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
    padding: '14px 16px',
  },
  itemText: {
    fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: '100%',
    marginBottom: 8,
  },
  itemMeta: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    flexWrap: 'wrap',
  },
  itemDate: { fontSize: 11.5, color: 'var(--ink-soft)' },
  cancelBtn: {
    padding: '6px 12px', borderRadius: 999,
    background: tint('--danger', 10),
    border: tintBorder('--danger', 35),
    color: 'var(--danger)', fontSize: 11.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  emptyWrap: {
    padding: '40px 24px', textAlign: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 },
  emptyText: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 },
}

export default function ScheduledPage() {
  useMobileRoutePerf('m/op/scheduled')
  const router = useRouter()
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  const loadScheduled = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await api.scheduledList()
      setItems(Array.isArray(result) ? result : (result?.items ?? []))
    } catch (e) {
      setLoadError(e.message || 'Não foi possível carregar agendamentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => { if (active) loadScheduled() }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [loadScheduled])

  async function cancelScheduled(id) {
    setCancellingId(id)
    try {
      await api.scheduledCancel(id)
      await loadScheduled()
    } catch (e) {
      setLoadError(e.message || 'Não foi possível cancelar o agendamento.')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <MobileShell title="Agendamentos" active="envios" showBack onBack={() => router.back()}>
      <div style={schedStyles.pageH}>
        <div>
          <div style={schedStyles.pageEyebrow}>Envios</div>
          <div style={schedStyles.pageTitle}>Agendamentos</div>
        </div>
        <button type="button" style={schedStyles.refreshBtn} onClick={loadScheduled} disabled={loading}>
          {loading ? '...' : 'Atualizar'}
        </button>
      </div>

      {loading && (
        <div style={{ padding: '0 16px' }}>
          <MobileLoadingCard label="Carregando agendamentos..." />
        </div>
      )}

      {!loading && loadError && (
        <div style={{ padding: '0 16px' }}>
          <MobileErrorCard message={loadError} onRetry={() => loadScheduled()} />
        </div>
      )}

      {!loading && !loadError && items && items.length === 0 && (
        <div style={schedStyles.emptyWrap}>
          <div style={schedStyles.emptyTitle}>Sem agendamentos</div>
          <div style={schedStyles.emptyText}>Agendamentos criados na tela &quot;Criar oferta&quot; aparecem aqui.</div>
        </div>
      )}

      {!loading && !loadError && items && items.length > 0 && (
        <div style={{ paddingTop: 6 }}>
          {items.map((item) => {
            const statusTone = STATUS_PILL_TONE[item.status] ?? 'neutro'
            const statusLabel = STATUS_LABEL_PT[item.status] ?? item.status
            const isCancellable = CANCELLABLE_STATUSES.has(item.status)
            const isCancelling = cancellingId === item.id

            return (
              <div key={item.id} style={schedStyles.itemCard}>
                <div style={schedStyles.itemText}>{item.text || '(sem texto)'}</div>
                <div style={schedStyles.itemMeta}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={cfgStyles.pill(statusTone)}>{statusLabel}</span>
                    <span style={schedStyles.itemDate}>
                      {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString('pt-BR') : '—'}
                    </span>
                  </div>
                  {isCancellable && (
                    <button
                      type="button"
                      style={{ ...schedStyles.cancelBtn, opacity: isCancelling ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      onClick={() => cancelScheduled(item.id)}
                      disabled={isCancelling}
                    >
                      {isCancelling && <MobileSpinner size={13} />}
                      {isCancelling ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ height: 24 }} />
    </MobileShell>
  )
}
