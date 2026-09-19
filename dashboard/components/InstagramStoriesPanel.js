'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

const STORY_STATUS = { queued: 'Na fila', processing: 'Publicando', container_processing: 'Preparando', published: 'Publicado', failed: 'Não saiu', retry_scheduled: 'Vamos tentar de novo', reconciliation_required: 'Conferindo se saiu', cancelled: 'Cancelado' }
const SOURCE = { manual: 'Manual', scheduled: 'Agendado', offer_queue: 'Fila de ofertas', offer_automation: 'Oferta automática', mirror: 'Espelhamento' }

const STATUS = {
  connected: ['Conectada', 'var(--success)'],
  needs_reconnect: ['Precisa reconectar', 'var(--warn)'],
  disconnected: ['Desconectada', 'var(--ink-soft)'],
}

function date(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('pt-BR')
}

export default function InstagramStoriesPanel() {
  const [connections, setConnections] = useState([])
  const [stories, setStories] = useState([])
  const [health, setHealth] = useState(null)
  const [busy, setBusy] = useState('')
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    try {
      const [nextConnections, nextStories, nextHealth] = await Promise.all([api.instagramConnections(), api.instagramStories(), api.instagramHealth()])
      setConnections(nextConnections)
      setStories(nextStories)
      setHealth(nextHealth)
    } catch (error) { setFeedback(error?.message || 'Não conseguimos carregar seus dados do Instagram agora.') }
  }, [])

  // Initial remote-data synchronization.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function connect() {
    setBusy('connect'); setFeedback('')
    try { const { url } = await api.instagramOAuthStart(); window.location.assign(url) }
    catch (error) { setFeedback(error.message); setBusy('') }
  }

  async function act(action, id) {
    setBusy(`${action}:${id}`); setFeedback('')
    try {
      if (action === 'refresh') await api.instagramRefresh(id)
      if (action === 'disconnect') await api.instagramDisconnect(id)
      if (action === 'retry') await api.instagramStoryRetry(id)
      if (action === 'cancel') await api.instagramStoryCancel(id)
      await load()
    } catch (error) { setFeedback(error.message) }
    finally { setBusy('') }
  }

  return (
    <section className="pnl-card" aria-labelledby="instagram-title">
      <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div id="instagram-title" className="pnl-card-title">Instagram Stories</div>
          <p className="pnl-card-note" style={{ marginTop: 6, maxWidth: 560 }}>Conecte uma conta profissional (Business ou Creator) para publicar suas ofertas em Story. O Story publicado por aqui é uma imagem: o Instagram não permite link clicável nele, então o card leva o nome da loja, o preço e a chamada para o link da sua bio.</p>
        </div>
        <button className="pnl-btn is-primary" onClick={connect} disabled={Boolean(busy)}>{busy === 'connect' ? 'Abrindo…' : 'Conectar Instagram'}</button>
      </div>

      {feedback && <div className="pnl-note-box is-error" role="alert" style={{ marginTop: 16 }}>{feedback}</div>}

      {health && <div className={`pnl-note-box ${health.requiresAttention ? 'is-error' : 'is-success'}`} role="status" style={{ marginTop: 16 }}>
        <strong>{health.requiresAttention ? `${health.requiresAttention} item(ns) precisam de atenção` : 'Operação do Instagram sem pendências críticas'}</strong>
        <p style={{ marginTop: 4 }}>Na fila: {health.publications.queued} · Publicando: {health.publications.processing} · Publicados: {health.publications.published} · Ofertas espelhadas que não viraram Story: {health.mirroring.failed}</p>
        {health.publications.reconciliation > 0 && <p style={{ marginTop: 4 }}>{health.publications.reconciliation} publicação(ões) podem ter saído sem o Instagram confirmar. Conferimos sozinhos a cada 15 minutos para não publicar duas vezes — você não precisa fazer nada.</p>}
      </div>}

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {connections.length === 0 && <div className="pnl-note-box">Nenhuma conta conectada. A conta do Instagram precisa ser profissional (Business ou Creator) e estar vinculada a uma página do Facebook.</div>}
        {connections.map(connection => {
          const [label, color] = STATUS[connection.status] || [connection.status, 'var(--ink-soft)']
          return <div key={connection.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div><strong>@{connection.username || connection.instagramAccountId}</strong><div className="pnl-card-note" style={{ marginTop: 4 }}><span style={{ color, fontWeight: 700 }}>{label}</span> · token até {date(connection.tokenExpiresAt)}</div></div>
            <div style={{ display: 'flex', gap: 8 }}><button className="pnl-btn" onClick={() => act('refresh', connection.id)} disabled={Boolean(busy)}>Renovar</button><button className="pnl-btn" onClick={() => act('disconnect', connection.id)} disabled={Boolean(busy)}>Desconectar</button></div>
          </div>
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="pnl-card-title" style={{ fontSize: 15 }}>Últimas publicações</div>
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left' }}><th>Destino</th><th>Origem</th><th>Situação</th><th>Quando</th><th aria-label="Ações" /></tr></thead>
            <tbody>{stories.slice(0, 20).map(story => <tr key={story.id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '10px 0' }}>{story.destination?.name || 'Instagram'}</td><td>{SOURCE[story.sourceType] || 'Oferta'}</td><td>{STORY_STATUS[story.status] || 'Em análise'}</td><td>{date(story.publishedAt || story.scheduledFor || story.createdAt)}</td><td style={{ display: 'flex', gap: 6 }}>{['failed', 'retry_scheduled', 'reconciliation_required'].includes(story.status) && <button className="pnl-btn" onClick={() => act('retry', story.id)} disabled={Boolean(busy)}>{story.status === 'reconciliation_required' ? 'Conferir agora' : 'Tentar novamente'}</button>}{story.status === 'queued' && story.scheduledFor && <button className="pnl-btn" onClick={() => act('cancel', story.id)} disabled={Boolean(busy)}>Cancelar</button>}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
