'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { ProFeaturePaywall } from '@/components/ProFeaturePaywall'
import { hasProLikeAccess } from '@/lib/planEntitlements'
import { findDestinationsWithoutQueue } from '@/lib/painel/queueCoverage'
import { PainelContentActions, usePainelHeader } from '../PainelShell'

const EMPTY = { name: '', enabled: true, intervalEnabled: false, intervalMinutes: 30, hourlyCapEnabled: false, hourlyCap: 10, dailyCapEnabled: false, dailyCap: 50, operatingHoursEnabled: false, operatingHoursStart: '08:00', operatingHoursEnd: '22:00', targetJids: [] }
const LIMITS = [
  ['intervalEnabled', 'intervalMinutes', 'Intervalo mínimo entre ofertas', 'minutos'],
  ['hourlyCapEnabled', 'hourlyCap', 'Máximo de ofertas por hora', 'ofertas'],
  ['dailyCapEnabled', 'dailyCap', 'Máximo de ofertas por dia', 'ofertas'],
]
const ITEM_STATUS = {
  pending: { label: 'Aguardando', cls: 'is-flight' },
  queued: { label: 'Na fila de envio', cls: 'is-flight' },
  sent: { label: 'Enviada', cls: 'is-success' },
  cancelled: { label: 'Cancelada', cls: 'is-skip' },
  failed: { label: 'Falhou', cls: 'is-error' },
}

// Por que uma fila com itens pendentes não está enviando agora. Mantém os
// códigos alinhados com evaluateQueueGate/QUEUE_BLOCK_REASONS no backend.
// Sem isso, "pendente" sozinho não diz se é bot offline, horário, limite etc.
const BLOCK_REASON_COPY = {
  plan_inactive: 'Plano sem acesso às filas — os itens ficam guardados e voltam a sair quando o plano for reativado.',
  bot_offline: 'WhatsApp desconectado — reconecte o bot e os itens pendentes saem automaticamente.',
  outside_operating_hours: 'Fora do horário de funcionamento desta fila — os envios retomam dentro da janela configurada.',
  quiet_hours: 'Dentro da janela silenciosa global — os envios retomam quando a janela terminar.',
  interval_limit: 'Aguardando o intervalo mínimo entre ofertas — a próxima sai assim que o tempo passar.',
  hourly_limit: 'Limite de ofertas por hora atingido — os envios retomam na próxima hora.',
  daily_limit: 'Limite de ofertas por dia atingido — os envios retomam amanhã.',
}

function formatItemDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function FilasPage() {
  usePainelHeader({ title: 'Filas', subtitle: 'Organize ofertas e preserve o ritmo de envio automaticamente' })
  const [queues, setQueues] = useState([])
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [items, setItems] = useState({})
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [toggling, setToggling] = useState(null)
  const [bulkToggling, setBulkToggling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [planSubject, setPlanSubject] = useState({ plan: 'pro', accessExpiresAt: null })

  async function load() {
    setLoading(true)
    try {
      const [allQueues, me] = await Promise.all([api.offerQueues(), api.me().catch(() => null)])
      setQueues(allQueues)
      if (me) setPlanSubject({ plan: me.plan ?? 'trial', accessExpiresAt: me.accessExpiresAt ?? null })
    }
    catch (error) { setMessage(error.message) }
    finally { setLoading(false) }
  }
  function loadGroups() {
    api.groups().then((all) => setGroups(all.filter((group) => group.role === 'post'))).catch((error) => setMessage(error.message))
  }
  // Initial remote data synchronization.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); loadGroups() }, [])

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true); setMessage(''); setNotice('') }
  function openEdit(queue) { setEditing(queue.id); setForm({ ...EMPTY, ...queue, operatingHoursStart: queue.operatingHoursStart || EMPTY.operatingHoursStart, operatingHoursEnd: queue.operatingHoursEnd || EMPTY.operatingHoursEnd }); setShowForm(true); setMessage(''); setNotice('') }
  async function save(event) {
    event.preventDefault(); setMessage('')
    if (!form.targetJids.length) { setMessage('Selecione pelo menos um grupo de destino para a fila.'); return }
    try { if (editing) await api.offerQueueUpdate(editing, form); else await api.offerQueueCreate(form); setShowForm(false); await load() }
    catch (error) { setMessage(error.message) }
  }
  function toggleFormJid(jid) {
    setForm((current) => ({ ...current, targetJids: current.targetJids.includes(jid) ? current.targetJids.filter((j) => j !== jid) : [...current.targetJids, jid] }))
  }
  async function remove(queue) {
    if (!window.confirm(`Excluir a fila “${queue.name}” e todos os seus itens?`)) return
    try { await api.offerQueueDelete(queue.id); await load() } catch (error) { setMessage(error.message) }
  }
  async function toggleAllQueues(enabled) {
    const targets = queues.filter((queue) => queue.enabled !== enabled)
    if (!targets.length) return
    setBulkToggling(enabled ? 'on' : 'off')
    setMessage('')
    setNotice('')
    try {
      await Promise.all(targets.map((queue) => api.offerQueueUpdate(queue.id, { enabled })))
      setNotice(enabled ? 'Todas as filas foram ativadas.' : 'Todas as filas foram pausadas. Os itens pendentes continuam guardados.')
      await load()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBulkToggling(null)
    }
  }
  async function toggleQueue(queue) {
    const enabled = !queue.enabled
    setToggling(queue.id)
    setMessage('')
    setNotice('')
    try {
      const updated = await api.offerQueueUpdate(queue.id, { enabled })
      setQueues((current) => current.map((candidate) => candidate.id === queue.id ? { ...candidate, ...updated } : candidate))
      if (!enabled) setNotice(`Fila “${queue.name}” pausada. Nenhuma nova oferta será enviada até a reativação.`)
      else if (updated.activation?.sent) setNotice(`Fila “${queue.name}” ativada e a primeira oferta já foi enviada.`)
      else if (updated.activation?.skipped === 'empty') setNotice(`Fila “${queue.name}” ativada. Ela está vazia no momento.`)
      else if (updated.activation?.skipped === 'bot_offline') setNotice(`Fila “${queue.name}” ativada. A primeira oferta será enviada assim que o WhatsApp estiver conectado.`)
      else if (updated.activation?.skipped) setNotice(`Fila “${queue.name}” ativada. O envio seguirá assim que os limites configurados permitirem.`)
      else if (updated.activation?.failed) setNotice(`Fila “${queue.name}” ativada. A primeira oferta será tentada novamente automaticamente.`)
      else setNotice(`Fila “${queue.name}” ativada.`)
      await load()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setToggling(null)
    }
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
    if (queue.operatingHoursEnabled && queue.operatingHoursStart && queue.operatingHoursEnd) active.push(`funciona ${queue.operatingHoursStart}–${queue.operatingHoursEnd}`)
    return active.length ? active.join(' · ') : 'Sem limites adicionais'
  }
  const destinationsLabel = (queue) => {
    const jids = Array.isArray(queue.targetJids) ? queue.targetJids : []
    if (!jids.length) return 'Todos os grupos de postagem'
    const names = jids.map((jid) => groups.find((group) => group.waJid === jid)?.name || jid)
    return names.join(' · ')
  }
  // Grupos de destino que nenhuma fila alcança. Cálculo puro sobre o que a
  // página já carregou — sem chamada nova à API. Ver lib/painel/queueCoverage.
  const destinationsWithoutQueue = findDestinationsWithoutQueue(groups, queues)
  const activeQueueCount = queues.filter((queue) => queue.enabled).length
  const allQueuesEnabled = queues.length > 0 && activeQueueCount === queues.length
  const bulkQueueLabel = allQueuesEnabled ? 'Desativar todas' : 'Ativar todas'
  const itemDestinations = (jids) => {
    const list = Array.isArray(jids) ? jids : []
    if (!list.length) return 'Grupos da fila'
    const names = list.map((jid) => groups.find((group) => group.waJid === jid)?.name || jid)
    return names.length <= 2 ? names.join(' · ') : `${names.slice(0, 2).join(' · ')} +${names.length - 2}`
  }

  // Feature Pro: sem o plano, a página vira paywall mantendo só a
  // listagem/exclusão do que já existe.
  if (!loading && !hasProLikeAccess(planSubject)) {
    return <div className="pnl-grid" style={{ maxWidth: 980, margin: '0 auto' }}>
      <ProFeaturePaywall
        title="Filas de ofertas"
        bullets={[
          'Cadastre as ofertas de uma vez e o bot distribui ao longo do dia, sem rajadas.',
          'Limites por intervalo, por hora e por dia — você controla o ritmo de cada fila.',
          'Pause e retome quando quiser; os itens pendentes ficam guardados.',
        ]}
      />
      {message && <div className="pnl-note-box is-error" role="alert">{message}</div>}
      {queues.length > 0 && <section className="pnl-card">
        <div className="pnl-card-title">Suas filas (pausadas)</div>
        <p className="pnl-hint" style={{ marginTop: 6 }}>Elas ficam guardadas e voltam a drenar assim que o plano permitir.</p>
        {queues.map((queue) => <div key={queue.id} style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <strong>{queue.name}</strong>
            <p className="pnl-hint" style={{ marginTop: 2 }}>{queue.pendingCount} pendente(s)</p>
          </div>
          <button className="pnl-btn" onClick={() => remove(queue)}>Excluir</button>
        </div>)}
      </section>}
    </div>
  }

  return <div className="pnl-grid" style={{ maxWidth: 980, margin: '0 auto' }}>
    <PainelContentActions><button type="button" className="pnl-btn is-primary" onClick={openCreate}>+ Nova fila</button></PainelContentActions>
    {queues.length > 0 && <section className="pnl-master">
      <div className="pnl-master-ico" aria-hidden="true">⏱</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="pnl-master-title">{activeQueueCount > 0 ? 'Filas automáticas ligadas' : 'Filas pausadas'}</span>
          <span className="pnl-master-status"><span className={`pnl-dot ${activeQueueCount > 0 ? 'is-on' : 'is-idle'}`} aria-hidden="true" />{activeQueueCount} de {queues.length} ativas</span>
        </div>
        <div className="pnl-master-sub">Use o controle mestre para pausar ou retomar todas as filas de uma vez.</div>
      </div>
      <button type="button" className="pnl-btn is-primary" onClick={() => toggleAllQueues(!allQueuesEnabled)} disabled={bulkToggling !== null} style={{ flexShrink: 0 }}>
        {bulkToggling ? 'Atualizando…' : bulkQueueLabel}
      </button>
    </section>}
    {message && <div className="pnl-note-box is-error" role="alert">{message}</div>}
    {notice && <div className="pnl-note-box" role="status">{notice}</div>}
    {destinationsWithoutQueue.length > 0 && <div className="pnl-note-box is-warn" role="status">
      <strong>{destinationsWithoutQueue.length === 1 ? 'Um grupo não está em nenhuma fila.' : `${destinationsWithoutQueue.length} grupos não estão em nenhuma fila.`}</strong>{' '}
      {destinationsWithoutQueue.map((group) => group.name).join(' · ')} — as ofertas que você adiciona às filas não chegam {destinationsWithoutQueue.length === 1 ? 'nele' : 'neles'}. Para incluir, edite uma fila e marque o grupo na lista de destinos.
      <p className="pnl-hint" style={{ marginTop: 6 }}>Se isso for proposital, pode ignorar: {destinationsWithoutQueue.length === 1 ? 'ele continua recebendo' : 'eles continuam recebendo'} normalmente as ofertas dos grupos monitorados.</p>
    </div>}
    {showForm && <form className="pnl-card" onSubmit={save}>
      <div className="pnl-card-title">{editing ? 'Editar fila' : 'Nova fila'}</div>
      <div className="pnl-field" style={{ marginTop: 14 }}><label className="pnl-label" htmlFor="queue-name">Nome</label><input id="queue-name" className="pnl-input" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required maxLength={100} /></div>
      <label className="pnl-check" style={{ marginTop: 14 }}><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((current) => ({ ...current, enabled: e.target.checked }))} />Fila ativa</label>
      <div style={{ marginTop: 16 }}>
        <span className="pnl-label">Grupos de destino da fila</span>
        <p className="pnl-hint" style={{ marginTop: 4 }}>As ofertas inseridas nesta fila serão enviadas para estes grupos.</p>
        <div className="pnl-grid" style={{ marginTop: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {groups.map((group) => <label className="pnl-check" key={group.id}><input type="checkbox" checked={form.targetJids.includes(group.waJid)} onChange={() => toggleFormJid(group.waJid)} />{group.name}</label>)}
        </div>
        {!groups.length && <p className="pnl-note-box is-error" style={{ marginTop: 8 }}>Nenhum grupo de postagem configurado. <Link href="/painel/grupos">Adicionar grupos</Link></p>}
      </div>
      <div className="pnl-grid" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>{LIMITS.map(([toggle, value, label, unit]) => <div className="pnl-card" key={toggle} style={{ boxShadow: 'none' }}><label className="pnl-check"><input type="checkbox" checked={form[toggle]} onChange={(e) => setForm((current) => ({ ...current, [toggle]: e.target.checked }))} />{label}</label>{form[toggle] && <div className="pnl-field" style={{ marginTop: 12 }}><label className="pnl-label" htmlFor={value}>Valor ({unit})</label><input id={value} className="pnl-input" type="number" min="1" step="1" value={form[value]} onChange={(e) => setForm((current) => ({ ...current, [value]: Number(e.target.value) }))} required /></div>}</div>)}</div>
      <div className="pnl-card" style={{ marginTop: 16, boxShadow: 'none' }}>
        <label className="pnl-check"><input type="checkbox" checked={form.operatingHoursEnabled} onChange={(e) => setForm((current) => ({ ...current, operatingHoursEnabled: e.target.checked }))} />Selecionar horário de funcionamento SÓ dessa fila?</label>
        <p className="pnl-hint" style={{ marginTop: 6 }}>Se marcado, esta fila obedece somente ao horário definido aqui e ignora a janela silenciosa global das configurações. Se desmarcado, a fila segue a janela silenciosa global.</p>
        {form.operatingHoursEnabled && <div className="pnl-grid" style={{ marginTop: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="pnl-field"><label className="pnl-label" htmlFor="operatingHoursStart">Início</label><input id="operatingHoursStart" className="pnl-input" type="time" value={form.operatingHoursStart} onChange={(e) => setForm((current) => ({ ...current, operatingHoursStart: e.target.value }))} required /></div>
          <div className="pnl-field"><label className="pnl-label" htmlFor="operatingHoursEnd">Fim</label><input id="operatingHoursEnd" className="pnl-input" type="time" value={form.operatingHoursEnd} onChange={(e) => setForm((current) => ({ ...current, operatingHoursEnd: e.target.value }))} required /></div>
        </div>}
      </div>
      {/* O formato da oferta é escolhido no GRUPO DE DESTINO, nunca aqui: ele é
          sobre ONDE a oferta chega, não sobre qual esteira a produziu. Duas
          configurações para a mesma decisão só criariam contradição silenciosa. */}
      <p className="pnl-hint" style={{ marginTop: 16 }}>
        Como a oferta aparece (foto, foto com a sua marca ou card que abre a loja) é escolhido em{' '}
        <Link href="/painel/grupos">Grupos</Link>, dentro de cada grupo de destino — vale para tudo que chega nele.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button className="pnl-btn is-primary" type="submit">Salvar fila</button><button className="pnl-btn" type="button" onClick={() => setShowForm(false)}>Cancelar</button></div>
    </form>}
    {loading ? <div className="pnl-card">Carregando filas…</div> : !queues.length ? <div className="pnl-card"><div className="pnl-card-title">Nenhuma fila criada</div><p className="pnl-hint" style={{ marginTop: 6 }}>Crie uma fila para distribuir ofertas automaticamente ao longo do dia.</p><button className="pnl-btn is-primary" style={{ marginTop: 14 }} onClick={openCreate}>Criar primeira fila</button></div> : queues.map((queue) => <section className="pnl-card" key={queue.id} style={{ opacity: queue.enabled ? 1 : 0.76 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          <button
            type="button"
            role="switch"
            aria-checked={queue.enabled}
            aria-label={`${queue.enabled ? 'Desativar' : 'Ativar'} fila ${queue.name}`}
            className={`pnl-switch${queue.enabled ? ' is-on' : ''}`}
            onClick={() => toggleQueue(queue)}
            disabled={toggling === queue.id}
            title={queue.enabled ? 'Pausar fila' : 'Ativar fila e enviar a primeira oferta agora'}
            style={{ marginTop: 1, opacity: toggling === queue.id ? 0.55 : 1 }}
          ><span /></button>
          <div style={{ minWidth: 0 }}><div className="pnl-card-title">{queue.name}</div><p className="pnl-hint" style={{ marginTop: 4 }}>{queue.enabled ? summary(queue) : 'Envios pausados — os itens permanecem na fila'}</p></div>
        </div>
        <span className={`pnl-tag ${queue.enabled ? 'is-success' : 'is-skip'}`}>{toggling === queue.id ? 'Atualizando…' : queue.enabled ? 'Ativa' : 'Pausada'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><span className="pnl-tag">{queue.pendingCount} pendente(s)</span><span className="pnl-tag">{queue.sentTodayCount} enviada(s) hoje</span></div>
      {queue.enabled && queue.pendingCount > 0 && queue.blockReason && BLOCK_REASON_COPY[queue.blockReason] && <div className="pnl-note-box is-warn" role="status" style={{ marginTop: 12 }}>
        <strong>Itens pendentes não estão saindo.</strong> {BLOCK_REASON_COPY[queue.blockReason]}
      </div>}
      <p className="pnl-hint" style={{ marginTop: 10 }}>Destinos: {destinationsLabel(queue)}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Link
          className="pnl-btn is-primary"
          href={{ pathname: '/painel/criar-oferta', query: { fila: queue.id } }}
          aria-label={`Adicionar itens à fila ${queue.name}`}
        >
          Adicionar itens
        </Link>
        <button className="pnl-btn" onClick={() => openEdit(queue)}>Editar</button>
        <button className="pnl-btn" onClick={() => toggleItems(queue.id)}>{items[queue.id] ? 'Ocultar itens' : 'Ver itens'}</button>
        <button className="pnl-btn" onClick={() => remove(queue)}>Excluir</button>
      </div>
      {items[queue.id] && <div className="pnl-grid" style={{ marginTop: 14, gap: 10 }}>{!items[queue.id].length ? <p className="pnl-hint">Fila vazia — nenhum item cadastrado ainda.</p> : items[queue.id].map((item) => {
        const status = ITEM_STATUS[item.status] || { label: item.status, cls: '' }
        return <div key={item.id} className="pnl-card" style={{ boxShadow: 'none', padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start', opacity: item.status === 'cancelled' ? 0.6 : 1 }}>
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" width={52} height={52} style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flex: '0 0 auto', border: '1px solid var(--line)' }} />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <span className={`pnl-tag ${status.cls}`}>{status.label}</span>
              <span className="pnl-hint">#{item.position}</span>
              <span className="pnl-hint">{formatItemDate(item.createdAt)}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 80, overflow: 'hidden', margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{item.text}</p>
            <p className="pnl-hint" style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span aria-hidden="true">📨</span><span>{itemDestinations(item.targetJids)}</span></p>
            {item.lastError && <p className="pnl-hint" style={{ marginTop: 6, color: 'var(--danger, #b91c1c)' }}>Última tentativa falhou — será reenviada automaticamente.</p>}
          </div>
          {item.status === 'pending' && <button className="pnl-btn is-danger" onClick={() => cancelItem(queue.id, item.id)}>Remover</button>}
        </div>
      })}</div>}
    </section>)}
  </div>
}
