'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { explainErrorMsg, STATUS_TABS, statusTag } from '@/lib/painel/logsCopy'

const LIMIT = 20
const PERIODS = [['today', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias']]

function num(v) { return Number.isFinite(Number(v)) ? Number(v) : 0 }

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function shortText(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return '—'
  return t.length > 90 ? `${t.slice(0, 89)}…` : t
}


function logOriginLabel(log) {
  if (log?.sourceGroup === 'offerAutomation') return 'Oferta automática'
  if (log?.sourceGroup === 'manual') return 'Manual'
  if (log?.sourceGroup === 'scheduled') return 'Agendamento'
  return log?.sourceGroupName || log?.sourceGroup || '—'
}

function StatusTag({ status }) {
  const t = statusTag(status)
  return <span className={`pnl-tag ${t.cls}`}>{t.label}</span>
}

function DedupChip({ hits }) {
  const n = num(hits)
  if (n <= 0) return null
  return <span className="pnl-dedup" title="Mesmo link bloqueado novamente por repetição (janela varia por tipo de link).">+{n} {n === 1 ? 'repetição' : 'repetições'}</span>
}

function ErrorDetails({ log, expanded, onToggle }) {
  if (!log.errorMsg) return null
  const benign = log.status === 'skipped' || log.status === 'info'
  return (
    <div>
      <button type="button" className={`pnl-detail-btn${benign ? '' : ' is-error'}`} onClick={onToggle} aria-expanded={expanded}>
        {expanded ? 'Ocultar motivo' : (benign ? 'Ver motivo' : 'Ver detalhes')}
      </button>
      {expanded && <p className={`pnl-detail-box${benign ? '' : ' is-error'}`}>{explainErrorMsg(log.errorMsg)}</p>}
    </div>
  )
}

export default function SendHistory() {
  const [period, setPeriod] = useState('today')
  const [summary, setSummary] = useState(null)

  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [data, setData] = useState(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClearQueue, setConfirmClearQueue] = useState(false)
  const [clearingQueue, setClearingQueue] = useState(false)
  const [queueNotice, setQueueNotice] = useState('')

  // Summary (cards) por período.
  useEffect(() => {
    let active = true
    api.logsSummary(period).then((s) => { if (active) setSummary(s) }).catch(() => { if (active) setSummary(null) })
    return () => { active = false }
  }, [period])

  // Debounce da busca.
  useEffect(() => {
    const h = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(h)
  }, [search])

  // Lista paginada. `loading` é derivado (loadedKey !== requestKey) para não
  // chamar setState síncrono dentro do efeito.
  const requestKey = `${tab}|${page}|${debounced}`
  const loading = loadedKey !== requestKey
  useEffect(() => {
    let active = true
    api.logs(tab, page, LIMIT, debounced)
      .then((d) => { if (active) { setData(d); setError('') } })
      .catch((e) => { if (active) setError(e?.message || 'Falha ao carregar envios.') })
      .finally(() => { if (active) setLoadedKey(`${tab}|${page}|${debounced}`) })
    return () => { active = false }
  }, [tab, page, debounced])

  const logs = data?.logs || []
  const total = num(data?.total)
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const statusCounts = data?.statusCounts || {}
  const statusCountsTotal = num(data?.statusCountsTotal)

  const counts = summary?.counts
  const failed = num(counts?.timeoutTotal) + num(counts?.errorOther)
  const deliveryRate = typeof summary?.deliveryRate === 'number' ? `${Math.round(summary.deliveryRate * 100)}%` : '—'
  const inFlight = num(counts?.inFlight)

  const cards = useMemo(() => ([
    { label: 'Enviados', value: num(counts?.success) },
    { label: 'Bloqueados por repetição', value: num(counts?.skippedDedup) },
    { label: 'Bloqueados pela regra', value: num(counts?.skippedConfig) },
    { label: 'Falhas', value: failed },
    { label: 'Taxa de entrega', value: deliveryRate },
  ]), [counts, failed, deliveryRate])

  function toggle(id) {
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function doClear() {
    setClearing(true)
    try {
      await api.logsClear()
      setPage(1)
      const [d, s] = await Promise.all([api.logs(tab, 1, LIMIT, debounced), api.logsSummary(period)])
      setData(d); setSummary(s)
    } catch (e) {
      setError(e?.message || 'Falha ao limpar os logs.')
    } finally {
      setClearing(false)
      setConfirmClear(false)
    }
  }

  async function doClearQueue() {
    setClearingQueue(true)
    setQueueNotice('')
    try {
      const res = await api.logsClearQueue()
      const cleared = num(res?.cleared)
      setPage(1)
      const [d, s] = await Promise.all([api.logs(tab, 1, LIMIT, debounced), api.logsSummary(period)])
      setData(d); setSummary(s)
      setQueueNotice(cleared > 0
        ? `Fila destravada — ${cleared} ${cleared === 1 ? 'oferta foi removida' : 'ofertas foram removidas'} da fila de envio.`
        : 'Nenhuma oferta estava presa na fila de envio no momento.')
    } catch (e) {
      setError(e?.message || 'Falha ao limpar a fila de envio.')
    } finally {
      setClearingQueue(false)
      setConfirmClearQueue(false)
    }
  }

  function chipCount(value) {
    if (value === 'all') return statusCountsTotal
    return num(statusCounts[value])
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* Cards de resumo */}
      <section className="pnl-card">
        <div className="pnl-toolbar" style={{ marginBottom: 16 }}>
          <div>
            <div className="pnl-card-title">Resumo</div>
            <div className="pnl-card-note">desempenho do período selecionado</div>
          </div>
          <span className="pnl-spacer" />
          <div className="pnl-seg" role="group" aria-label="Período do resumo">
            {PERIODS.map(([v, label]) => (
              <button key={v} className={period === v ? 'is-active' : ''} onClick={() => setPeriod(v)} aria-pressed={period === v}>{label}</button>
            ))}
          </div>
        </div>
        <div className="pnl-kpis" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {cards.map((c) => (
            <div key={c.label} className="pnl-kpi">
              <div className="pnl-kpi-label">{c.label}</div>
              <div className="pnl-kpi-num pnl-serif">{summary === null ? '—' : c.value}</div>
            </div>
          ))}
        </div>
        {inFlight > 0 && <p className="pnl-card-note" style={{ marginTop: 12 }}>{inFlight} {inFlight === 1 ? 'mensagem' : 'mensagens'} em vôo (na fila/enviando).</p>}
      </section>

      {/* Destaque: destravar a fila de envio */}
      <section className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--warn) 55%, transparent)', borderWidth: 2, borderStyle: 'solid' }}>
        <div className="pnl-toolbar" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pnl-card-title">
              <span aria-hidden="true" style={{ marginRight: 6 }}>⚠️</span>
              Fila de envio travada?
              {inFlight > 0 && <span className="pnl-tag is-flight" style={{ marginLeft: 8, verticalAlign: 'middle' }}>{inFlight} em vôo</span>}
            </div>
            <div className="pnl-note-box is-warn" role="note" style={{ marginTop: 10 }}>
              <strong>Limpar ofertas da fila</strong> remove todas as mensagens que estão presas na fila de envio
              (status <em>na fila</em> ou <em>enviando</em>), para <strong>destravar agarramentos</strong> e voltar a
              enviar normalmente. As ofertas removidas <strong>não serão enviadas</strong> e ficam marcadas como
              removidas no histórico — isto não apaga os envios já concluídos.
            </div>
          </div>
          <button
            type="button"
            className="pnl-btn is-danger"
            onClick={() => { setQueueNotice(''); setConfirmClearQueue(true) }}
            disabled={clearingQueue}
            style={{ flexShrink: 0, alignSelf: 'center' }}
          >
            {clearingQueue ? 'Limpando…' : 'Limpar ofertas da fila'}
          </button>
        </div>
        {queueNotice && <div className="pnl-note-box is-success" role="status" style={{ marginTop: 12 }}>{queueNotice}</div>}
      </section>

      {/* Filtros */}
      <div className="pnl-toolbar">
        <div className="pnl-chips" role="group" aria-label="Filtrar por status">
          {STATUS_TABS.map(([value, label]) => (
            <button key={value} className={`pnl-chip${tab === value ? ' is-active' : ''}`} onClick={() => { setTab(value); setPage(1) }} aria-pressed={tab === value}>
              {label}<span className="pnl-chip-count">{chipCount(value)}</span>
            </button>
          ))}
        </div>
      </div>

      <input
        className="pnl-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por produto, grupo, loja, URL, status ou erro…"
        aria-label="Buscar envios"
      />

      {error && (
        <div className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}>
          <p className="pnl-card-title" style={{ color: 'var(--danger)' }}>Falha ao carregar envios</p>
          <p className="pnl-card-note">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="pnl-grid">{[0, 1, 2, 3, 4].map((k) => <div key={k} className="pnl-skel" style={{ height: 52 }} />)}</div>
      ) : logs.length === 0 ? (
        <div className="pnl-card"><p className="pnl-empty">{debounced ? `Nenhum envio encontrado para “${debounced}”.` : 'Nenhum envio registrado ainda.'}</p></div>
      ) : (
        <>
          {/* Tabela desktop */}
          <div className="pnl-table-wrap">
            <table className="pnl-table">
              <thead>
                <tr>
                  <th>Horário</th><th>Status</th><th>Produto</th><th>Loja</th><th>Origem → Destino</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const dest = log.destGroup !== 'skipped' && log.destGroup !== 'conversion' && log.destGroup !== 'warning' ? log.destGroupName : null
                  return (
                    <tr key={log.id}>
                      <td className="pnl-faint" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatDateTime(log.sentAt)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div><StatusTag status={log.status} /><DedupChip hits={log.dedupHits} /></div>
                        <ErrorDetails log={log} expanded={expanded.has(log.id)} onToggle={() => toggle(log.id)} />
                      </td>
                      <td className="pnl-td-clip" title={log.messageText}>{shortText(log.messageText)}</td>
                      <td><span className="pnl-store">{log.platform || '—'}</span></td>
                      <td className="pnl-muted pnl-td-clip" title={`${logOriginLabel(log)} → ${dest || '—'}`}>
                        {logOriginLabel(log)}{dest ? ` → ${dest}` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="pnl-cards-mobile">
            {logs.map((log) => {
              const dest = log.destGroup !== 'skipped' && log.destGroup !== 'conversion' && log.destGroup !== 'warning' ? log.destGroupName : null
              return (
                <div key={`m-${log.id}`} className="pnl-card" style={{ padding: 14 }}>
                  <div className="pnl-toolbar" style={{ justifyContent: 'space-between' }}>
                    <span className="pnl-store">{log.platform || '—'}</span>
                    <span className="pnl-faint" style={{ fontSize: 11.5 }}>{formatDateTime(log.sentAt)}</span>
                  </div>
                  <p style={{ fontSize: 13, margin: '8px 0 4px' }}>{shortText(log.messageText)}</p>
                  <p className="pnl-muted" style={{ fontSize: 12 }}>{logOriginLabel(log)}{dest ? ` → ${dest}` : ''}</p>
                  <div style={{ marginTop: 8 }}><StatusTag status={log.status} /><DedupChip hits={log.dedupHits} /></div>
                  <ErrorDetails log={log} expanded={expanded.has(log.id)} onToggle={() => toggle(log.id)} />
                </div>
              )
            })}
          </div>

          <div className="pnl-pager">
            <span>{total} registro{total !== 1 ? 's' : ''}{debounced ? ` para “${debounced}”` : ''}</span>
            <div className="pnl-toolbar">
              <button type="button" className="pnl-danger-link" onClick={() => setConfirmClear(true)} style={{ marginRight: 12 }}>Limpar logs</button>
              {totalPages > 1 && (
                <div className="pnl-pager-btns">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Anterior</button>
                  <span>{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Próxima →</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {confirmClear && (
        <div className="pnl-modal-overlay" role="dialog" aria-modal="true" aria-label="Limpar logs">
          <div className="pnl-modal">
            <h3>Limpar todos os logs</h3>
            <p>Esta ação é permanente e apaga todo o histórico de envios da sua conta — inclusive registros fora do filtro atual. Não dá para recuperar pelo painel.</p>
            <div className="pnl-modal-actions">
              <button className="pnl-btn" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancelar</button>
              <button className="pnl-btn is-danger" onClick={doClear} disabled={clearing}>{clearing ? 'Limpando…' : 'Limpar tudo'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmClearQueue && (
        <div className="pnl-modal-overlay" role="dialog" aria-modal="true" aria-label="Limpar ofertas da fila">
          <div className="pnl-modal">
            <h3>Limpar ofertas da fila</h3>
            <p>
              Todas as ofertas que estão <strong>na fila de envio</strong> (na fila ou enviando){inFlight > 0 ? ` — ${inFlight} no momento` : ''} serão
              removidas para destravar a fila. Elas <strong>não serão enviadas</strong> e ficam marcadas como removidas no histórico.
              Envios já concluídos não são afetados.
            </p>
            <div className="pnl-modal-actions">
              <button className="pnl-btn" onClick={() => setConfirmClearQueue(false)} disabled={clearingQueue}>Cancelar</button>
              <button className="pnl-btn is-danger" onClick={doClearQueue} disabled={clearingQueue}>{clearingQueue ? 'Limpando…' : 'Limpar ofertas da fila'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
