'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'

// Aparência de cada origem do "futuro" de um envio. O chip de origem é o que
// permite reunir as três fontes numa lista só sem o usuário se perder.
const SOURCE = {
  inflight: { label: 'Na fila de envio', className: 'bg-blue-100 text-blue-700', dot: '#2563eb' },
  scheduled: { label: 'Agendada', className: 'bg-violet-100 text-violet-700', dot: '#7c3aed' },
  queue: { label: 'Fila', className: 'bg-emerald-100 text-emerald-700', dot: '#059669' },
}

const STATUS = {
  pending: { label: 'Aguardando', className: 'bg-amber-100 text-amber-700' },
  queued: { label: 'Na fila', className: 'bg-blue-100 text-blue-700' },
  sending: { label: 'Enviando agora', className: 'bg-blue-100 text-blue-700' },
}

const FILTERS = [
  { value: 'all', label: 'Tudo' },
  { value: 'inflight', label: 'Na fila de envio' },
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'queue', label: 'Filas' },
]

function formatWhen(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function relativeWhen(value) {
  if (!value) return null
  const target = new Date(value).getTime()
  if (Number.isNaN(target)) return null
  const diffMin = Math.round((target - Date.now()) / 60000)
  if (diffMin <= 0) return 'agora'
  if (diffMin < 60) return `em ${diffMin} min`
  const hours = Math.round(diffMin / 60)
  if (hours < 24) return `em ${hours} h`
  const days = Math.round(hours / 24)
  return `em ${days} d`
}

export default function UpcomingSends() {
  const [items, setItems] = useState(null)
  const [groupsByJid, setGroupsByJid] = useState({})
  const [requestState, setRequestState] = useState('loading')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [cancellingId, setCancellingId] = useState(null)
  const [confirmItem, setConfirmItem] = useState(null)

  const load = useCallback(async () => {
    setRequestState('loading')
    setError('')
    try {
      const [result, groups] = await Promise.all([
        api.upcomingList(),
        api.groups().catch(() => []),
      ])
      const list = Array.isArray(result) ? result : (result?.items ?? [])
      setItems(list)
      const map = {}
      for (const group of (Array.isArray(groups) ? groups : [])) {
        if (group?.waJid) map[group.waJid] = group.name || group.waJid
      }
      setGroupsByJid(map)
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

  async function cancel(item) {
    setCancellingId(item.id)
    setConfirmItem(null)
    setError('')
    try {
      if (item.cancel?.kind === 'scheduled') await api.scheduledCancel(item.cancel.id)
      else if (item.cancel?.kind === 'queueItem') await api.offerQueueItemDelete(item.cancel.queueId, item.cancel.id)
      await load()
    } catch (err) {
      setError(err?.message || 'Não foi possível cancelar este envio.')
    } finally {
      setCancellingId(null)
    }
  }

  const list = items ?? []
  const loading = requestState === 'loading'

  const counts = useMemo(() => {
    const base = { all: list.length, inflight: 0, scheduled: 0, queue: 0 }
    for (const item of list) if (item.source in base) base[item.source] += 1
    return base
  }, [list])

  const visible = useMemo(
    () => (filter === 'all' ? list : list.filter((item) => item.source === filter)),
    [list, filter],
  )

  function destinationsLabel(targetJids) {
    const jids = Array.isArray(targetJids) ? targetJids : []
    if (!jids.length) return 'Sem destino definido'
    const names = jids.map((jid) => groupsByJid[jid] || jid)
    if (names.length <= 2) return names.join(' · ')
    return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`
  }

  return (
    <section className="pnl-grid" aria-labelledby="upcoming-sends-title">
      <div className="pnl-toolbar">
        <div>
          <h2 id="upcoming-sends-title" className="pnl-card-title">Próximos envios</h2>
          <p className="pnl-card-note">
            Tudo que ainda vai sair, num lugar só: agendamentos, itens de fila e mensagens já no pipeline de envio.
          </p>
        </div>
        <span className="pnl-spacer" />
        <button type="button" className="pnl-btn" onClick={load} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {list.length > 0 && (
        <nav className="pnl-seg" aria-label="Filtrar por origem" style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
          {FILTERS.map((tab) => {
            const count = counts[tab.value] ?? 0
            const isActive = filter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                aria-pressed={isActive}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                {tab.label} <span style={{ opacity: 0.7 }}>({count})</span>
              </button>
            )
          })}
        </nav>
      )}

      {error && <Alert type="error" title="Erro ao carregar" message={error} />}

      {loading && !items && (
        <div className="pnl-grid" aria-label="Carregando próximos envios">
          {[0, 1, 2].map((key) => <div key={key} className="pnl-skel" style={{ height: 120 }} />)}
        </div>
      )}

      {!loading && list.length === 0 && !error && (
        <div className="pnl-card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="pnl-card-title" style={{ fontSize: 16 }}>Nenhum envio programado</p>
          <p className="pnl-card-note" style={{ margin: '6px auto 18px', maxWidth: 480 }}>
            Quando você agendar uma oferta, inserir um item numa fila ou houver uma mensagem aguardando envio, ela aparece aqui até entrar no histórico.
          </p>
          <Link href="/painel/criar-oferta" className="pnl-btn" style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
            Criar oferta
          </Link>
        </div>
      )}

      {!loading && list.length > 0 && visible.length === 0 && (
        <div className="pnl-card" style={{ textAlign: 'center', padding: 24 }}>
          <p className="pnl-card-note" style={{ margin: 0 }}>Nada nesta categoria por enquanto.</p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="pnl-grid" aria-label="Lista de próximos envios">
          {visible.map((item) => {
            const source = SOURCE[item.source] ?? { label: item.source, className: 'bg-gray-100 text-gray-600', dot: '#9ca3af' }
            const status = STATUS[item.status] ?? { label: item.status || '—', className: 'bg-gray-100 text-gray-600' }
            const when = formatWhen(item.scheduledAt)
            const eta = relativeWhen(item.scheduledAt)
            const isCancelling = cancellingId === item.id

            return (
              <li key={item.id} className="pnl-card" style={{ borderLeft: `3px solid ${source.dot}` }}>
                <div className="pnl-toolbar" style={{ alignItems: 'flex-start', gap: 14 }}>
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      width={56}
                      height={56}
                      style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flex: '0 0 auto', border: '1px solid var(--line)' }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: '1 1 380px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${source.className}`}>{item.sourceLabel || source.label}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                      {item.paused && <span className="rounded-full px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-700">Fila pausada</span>}
                      {when && (
                        <time className="pnl-faint" dateTime={item.scheduledAt} style={{ fontSize: 12 }}>
                          {when}{eta ? ` · ${eta}` : ''}
                        </time>
                      )}
                      {item.position != null && <span className="pnl-faint" style={{ fontSize: 12 }}>posição {item.position}</span>}
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.55, margin: 0, maxHeight: 96, overflow: 'hidden' }}>
                      {item.text || '(sem texto)'}
                    </p>
                    <p className="pnl-card-note" style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span aria-hidden="true">📨</span>
                      <span>{destinationsLabel(item.targetJids)}</span>
                      {item.imageUrl && <span>· com imagem</span>}
                    </p>
                    {item.lastError && (
                      <p className="pnl-card-note" style={{ marginTop: 6, color: 'var(--danger, #b91c1c)' }}>
                        Última tentativa falhou — será reenviada automaticamente.
                      </p>
                    )}
                  </div>
                  {item.cancellable ? (
                    <button
                      type="button"
                      className="pnl-btn is-danger"
                      onClick={() => setConfirmItem(item)}
                      disabled={isCancelling}
                    >
                      {isCancelling ? 'Cancelando…' : 'Cancelar'}
                    </button>
                  ) : (
                    <span className="pnl-faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }} title="Já saiu do estado cancelável">
                      em andamento
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmItem != null}
        title="Cancelar envio"
        message="Este envio será cancelado e não sairá. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar envio"
        danger
        onCancel={() => setConfirmItem(null)}
        onConfirm={() => cancel(confirmItem)}
      />
    </section>
  )
}
