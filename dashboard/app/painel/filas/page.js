'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { PainelTopbarAction, usePainelHeader } from '../PainelShell'

const EMPTY = { name: '', enabled: true, intervalEnabled: false, intervalMinutes: 30, hourlyCapEnabled: false, hourlyCap: 10, dailyCapEnabled: false, dailyCap: 50 }
const LIMITS = [
  ['intervalEnabled', 'intervalMinutes', 'Intervalo mínimo entre ofertas', 'minutos'],
  ['hourlyCapEnabled', 'hourlyCap', 'Máximo de ofertas por hora', 'ofertas'],
  ['dailyCapEnabled', 'dailyCap', 'Máximo de ofertas por dia', 'ofertas'],
]

export default function FilasPage() {
  usePainelHeader({ title: 'Filas', subtitle: 'Organize ofertas e preserve o ritmo de envio automaticamente' })
  const [queues, setQueues] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [items, setItems] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try { setQueues(await api.offerQueues()) }
    catch (error) { setMessage(error.message) }
    finally { setLoading(false) }
  }
  // Initial remote data synchronization.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true); setMessage('') }
  function openEdit(queue) { setEditing(queue.id); setForm({ ...EMPTY, ...queue }); setShowForm(true); setMessage('') }
  async function save(event) {
    event.preventDefault(); setMessage('')
    try { if (editing) await api.offerQueueUpdate(editing, form); else await api.offerQueueCreate(form); setShowForm(false); await load() }
    catch (error) { setMessage(error.message) }
  }
  async function remove(queue) {
    if (!window.confirm(`Excluir a fila “${queue.name}” e todos os seus itens?`)) return
    try { await api.offerQueueDelete(queue.id); await load() } catch (error) { setMessage(error.message) }
  }
  async function toggleItems(queueId) {
    if (items[queueId]) { setItems((current) => ({ ...current, [queueId]: null })); return }
    try { const queueItems = await api.offerQueueItems(queueId); setItems((current) => ({ ...current, [queueId]: queueItems })) } catch (error) { setMessage(error.message) }
  }
  async function cancelItem(queueId, itemId) {
    try { await api.offerQueueItemDelete(queueId, itemId); setItems((current) => ({ ...current, [queueId]: current[queueId].map((item) => item.id === itemId ? { ...item, status: 'cancelled' } : item) })); await load() } catch (error) { setMessage(error.message) }
  }
  const summary = (queue) => {
    const active = []
    if (queue.intervalEnabled) active.push(`${queue.intervalMinutes} min entre ofertas`)
    if (queue.hourlyCapEnabled) active.push(`${queue.hourlyCap}/hora`)
    if (queue.dailyCapEnabled) active.push(`${queue.dailyCap}/dia`)
    return active.length ? active.join(' · ') : 'Sem limites adicionais'
  }

  return <div className="pnl-grid" style={{ maxWidth: 980, margin: '0 auto' }}>
    <PainelTopbarAction><button type="button" className="pnl-btn is-primary" onClick={openCreate}>+ Nova fila</button></PainelTopbarAction>
    {message && <div className="pnl-note-box is-error" role="alert">{message}</div>}
    {showForm && <form className="pnl-card" onSubmit={save}>
      <div className="pnl-card-title">{editing ? 'Editar fila' : 'Nova fila'}</div>
      <div className="pnl-field" style={{ marginTop: 14 }}><label className="pnl-label" htmlFor="queue-name">Nome</label><input id="queue-name" className="pnl-input" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required maxLength={100} /></div>
      <label className="pnl-check" style={{ marginTop: 14 }}><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((current) => ({ ...current, enabled: e.target.checked }))} />Fila ativa</label>
      <div className="pnl-grid" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>{LIMITS.map(([toggle, value, label, unit]) => <div className="pnl-card" key={toggle} style={{ boxShadow: 'none' }}><label className="pnl-check"><input type="checkbox" checked={form[toggle]} onChange={(e) => setForm((current) => ({ ...current, [toggle]: e.target.checked }))} />{label}</label>{form[toggle] && <div className="pnl-field" style={{ marginTop: 12 }}><label className="pnl-label" htmlFor={value}>Valor ({unit})</label><input id={value} className="pnl-input" type="number" min="1" step="1" value={form[value]} onChange={(e) => setForm((current) => ({ ...current, [value]: Number(e.target.value) }))} required /></div>}</div>)}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button className="pnl-btn is-primary" type="submit">Salvar fila</button><button className="pnl-btn" type="button" onClick={() => setShowForm(false)}>Cancelar</button></div>
    </form>}
    {loading ? <div className="pnl-card">Carregando filas…</div> : !queues.length ? <div className="pnl-card"><div className="pnl-card-title">Nenhuma fila criada</div><p className="pnl-hint" style={{ marginTop: 6 }}>Crie uma fila para distribuir ofertas automaticamente ao longo do dia.</p><button className="pnl-btn is-primary" style={{ marginTop: 14 }} onClick={openCreate}>Criar primeira fila</button></div> : queues.map((queue) => <section className="pnl-card" key={queue.id}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><div className="pnl-card-title">{queue.name}</div><p className="pnl-hint" style={{ marginTop: 4 }}>{summary(queue)}</p></div><span className={`pnl-tag ${queue.enabled ? 'is-success' : ''}`}>{queue.enabled ? 'Ativa' : 'Pausada'}</span></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><span className="pnl-tag">{queue.pendingCount} pendente(s)</span><span className="pnl-tag">{queue.sentTodayCount} enviada(s) hoje</span></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><button className="pnl-btn" onClick={() => openEdit(queue)}>Editar</button><button className="pnl-btn" onClick={() => toggleItems(queue.id)}>{items[queue.id] ? 'Ocultar itens' : 'Ver itens'}</button><button className="pnl-btn" onClick={() => remove(queue)}>Excluir</button></div>
      {items[queue.id] && <div className="pnl-grid" style={{ marginTop: 14 }}>{!items[queue.id].length ? <p className="pnl-hint">Fila vazia.</p> : items[queue.id].map((item) => <div key={item.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12 }}><div style={{ minWidth: 0 }}><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 72, overflow: 'hidden' }}>{item.text}</p><span className="pnl-hint">{item.status} · posição {item.position} · {new Date(item.createdAt).toLocaleString('pt-BR')}</span></div>{item.status === 'pending' && <button className="pnl-btn" onClick={() => cancelItem(queue.id, item.id)}>Remover</button>}</div>)}</div>}
    </section>)}
  </div>
}
