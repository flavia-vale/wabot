'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

// PR-5 follow-up: painel anti-ban consolidado por canal-destino.
// Exibe health, risk score, lista de snapshots e ação de "recriar canal".
// Componente client puro — recebe initialHealth e busca o resto on-mount.

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR') } catch { return iso }
}

function ScoreBar({ score }) {
  if (score == null) return <span className="text-xs text-slate-500">Sem dados (clique em "Recalcular")</span>
  const cls = score >= 70 ? 'bg-rose-500' : score >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${cls}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-medium">{score}/100</span>
    </div>
  )
}

export function ChannelHealthPanel({ group, initialHealth, onHealthChange }) {
  const [health, setHealth] = useState(initialHealth ?? null)
  const [snapshots, setSnapshots] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [score, setScore] = useState(initialHealth?.reportRiskScore ?? null)
  const [showRecreate, setShowRecreate] = useState(false)
  const [newJid, setNewJid] = useState('')
  const [recreating, setRecreating] = useState(false)

  useEffect(() => {
    let active = true
    api.channelSnapshots(group.id)
      .then((list) => { if (active) setSnapshots(list ?? []) })
      .catch(() => {})
    return () => { active = false }
  }, [group.id])

  async function refreshHealth() {
    try {
      const h = await api.channelHealth(group.id)
      setHealth(h)
      setScore(h?.reportRiskScore ?? null)
      onHealthChange?.(h)
    } catch (err) { setError(err.message) }
  }

  async function recomputeScore() {
    setBusy(true); setError('')
    try {
      const r = await api.channelRiskScore(group.id, 7)
      setScore(r.score)
      await refreshHealth()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function snapshotNow() {
    setBusy(true); setError('')
    try {
      const row = await api.channelSnapshotNow(group.id)
      setSnapshots(prev => [row, ...prev])
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function doRecreate() {
    const target = newJid.trim()
    if (!target.endsWith('@newsletter')) {
      setError('JID novo precisa terminar em @newsletter')
      return
    }
    setRecreating(true); setError('')
    try {
      await api.channelRecreate(group.id, target)
      setShowRecreate(false)
      setNewJid('')
      // health/snapshots ficam stale; o panel pai vai recarregar groups.
      window.location.reload()
    } catch (err) { setError(err.message) } finally { setRecreating(false) }
  }

  return (
    <div className="mt-3 border border-slate-200 rounded-lg bg-slate-50 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500 uppercase mb-1">Saúde</div>
          <div className="text-sm">
            Status: <span className="font-medium">{health?.status ?? '—'}</span>
            {health?.consecutiveFailures > 0 && <span className="ml-2 text-rose-700">({health.consecutiveFailures} falhas seguidas)</span>}
          </div>
          {health?.lastError && <div className="text-xs text-slate-600 mt-1">Último erro: {health.lastError}</div>}
          {health?.pausedUntil && <div className="text-xs text-rose-700 mt-1">Pausado até {formatDate(health.pausedUntil)}</div>}
          <div className="text-xs text-slate-500 mt-1">Último post: {formatDate(health?.lastPostedAt)}</div>
          <button onClick={refreshHealth} className="mt-2 text-xs text-sky-600 hover:underline">Atualizar saúde</button>
        </div>

        <div>
          <div className="text-xs text-slate-500 uppercase mb-1">Risco de denúncia (7d)</div>
          <ScoreBar score={score} />
          <button
            onClick={recomputeScore}
            disabled={busy}
            className="mt-2 text-xs px-2 py-1 bg-sky-600 text-white rounded disabled:opacity-50">
            {busy ? 'Calculando…' : 'Recalcular'}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-slate-500 uppercase">Snapshots ({snapshots.length})</div>
          <button onClick={snapshotNow} disabled={busy}
            className="text-xs px-2 py-1 bg-emerald-600 text-white rounded disabled:opacity-50">
            {busy ? 'Capturando…' : 'Snapshot agora'}
          </button>
        </div>
        {snapshots.length === 0 && <div className="text-xs text-slate-500">Nenhum snapshot ainda. O cron diário (3h BRT) faz o backup automático.</div>}
        {snapshots.length > 0 && (
          <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
            {snapshots.slice(0, 10).map(s => (
              <li key={s.id} className="flex justify-between gap-2 border-b border-slate-100 py-1">
                <span className="font-mono truncate">{s.name || '(sem nome)'}</span>
                <span className="text-slate-500 whitespace-nowrap">{formatDate(s.snapshotedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        {!showRecreate ? (
          <button onClick={() => setShowRecreate(true)} className="text-xs text-rose-600 hover:underline">
            🪂 Recriar canal (se o atual caiu)
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-slate-700">
              Crie um canal novo no app do WhatsApp. Cole o JID do novo aqui — o bot troca o destino e re-roteia tudo que apontava para o canal antigo.
            </div>
            <input
              type="text"
              value={newJid}
              onChange={(e) => setNewJid(e.target.value)}
              placeholder="xxxxxxxxxxxx@newsletter"
              className="w-full border rounded px-2 py-1 text-sm font-mono"
            />
            <div className="flex gap-2">
              <button onClick={doRecreate} disabled={recreating}
                className="text-xs px-3 py-1 bg-rose-600 text-white rounded disabled:opacity-50">
                {recreating ? 'Trocando…' : 'Confirmar troca'}
              </button>
              <button onClick={() => { setShowRecreate(false); setNewJid(''); setError('') }}
                className="text-xs px-3 py-1 bg-slate-200 rounded">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{error}</div>}
    </div>
  )
}
