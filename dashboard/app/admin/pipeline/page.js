'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const STATUS_META = {
  Backlog: { label: 'Backlog', accent: 'border-slate-300', chip: 'bg-slate-100 text-slate-700', rail: 'from-slate-100 to-white' },
  Ready: { label: 'Ready', accent: 'border-cyan-300', chip: 'bg-cyan-100 text-cyan-800', rail: 'from-cyan-50 to-white' },
  'In Progress': { label: 'In Progress', accent: 'border-blue-400', chip: 'bg-blue-100 text-blue-800', rail: 'from-blue-50 to-white' },
  Review: { label: 'Review', accent: 'border-violet-400', chip: 'bg-violet-100 text-violet-800', rail: 'from-violet-50 to-white' },
  QA: { label: 'QA', accent: 'border-amber-400', chip: 'bg-amber-100 text-amber-800', rail: 'from-amber-50 to-white' },
  Done: { label: 'Done', accent: 'border-emerald-400', chip: 'bg-emerald-100 text-emerald-800', rail: 'from-emerald-50 to-white' },
}

const TYPE_META = {
  Bug: { icon: '🐛', className: 'bg-red-50 text-red-700 ring-red-100' },
  Feature: { icon: '✨', className: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100' },
  Refactor: { icon: '⚡', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
  Security: { icon: '🛡️', className: 'bg-slate-900 text-white ring-slate-800' },
  Chore: { icon: '⚙️', className: 'bg-gray-100 text-gray-700 ring-gray-200' },
}

const PRIORITY_META = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-sky-100 text-sky-700',
  High: 'bg-amber-100 text-amber-800',
  Critical: 'bg-red-600 text-white',
}

function countDoneCriteria(issue) {
  return (issue.acceptanceCriteria || []).filter(item => item.done).length
}

function IssueCard({ issue, statuses, busy, onMove, onDragStart }) {
  const typeMeta = TYPE_META[issue.type] || TYPE_META.Chore
  const criteriaTotal = issue.acceptanceCriteria?.length || 0
  const criteriaDone = countDoneCriteria(issue)

  return (
    <article
      draggable={!busy}
      onDragStart={(event) => onDragStart(event, issue.id)}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{issue.id}</span>
          <h3 className="mt-1 text-sm font-black leading-snug text-slate-950">{issue.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ring-1 ${typeMeta.className}`}>{typeMeta.icon} {issue.type}</span>
      </div>

      {issue.description && <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-slate-600">{issue.description}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${PRIORITY_META[issue.priority] || PRIORITY_META.Medium}`}>{issue.priority}</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">{issue.epic}</span>
        {issue.createdAt && <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">{issue.createdAt}</span>}
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wide text-slate-500">
          <span>Critérios</span>
          <span>{criteriaDone}/{criteriaTotal}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${criteriaTotal ? (criteriaDone / criteriaTotal) * 100 : 0}%` }} />
        </div>
      </div>

      <label className="mt-4 block text-[11px] font-black uppercase tracking-wide text-slate-400" htmlFor={`status-${issue.id}`}>Mover card</label>
      <select
        id={`status-${issue.id}`}
        value={issue.status}
        disabled={busy}
        onChange={(event) => onMove(issue.id, event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-wait disabled:opacity-60"
      >
        {statuses.map(status => <option key={status} value={status}>{status}</option>)}
      </select>
    </article>
  )
}

function PipelineColumn({ column, statuses, busyId, dropTarget, onDropIssue, onMove, onDragStart, onDragOver }) {
  const meta = STATUS_META[column.status] || STATUS_META.Backlog
  const isDropTarget = dropTarget === column.status

  return (
    <section
      onDragOver={(event) => onDragOver(event, column.status)}
      onDrop={(event) => onDropIssue(event, column.status)}
      className={`min-h-[520px] rounded-[1.75rem] border-t-4 ${meta.accent} bg-gradient-to-b ${meta.rail} p-3 ring-1 ring-slate-200 transition ${isDropTarget ? 'scale-[1.01] ring-2 ring-slate-900' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-black text-slate-950">{meta.label}</h2>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sprint técnica</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${meta.chip}`}>{column.issues.length}</span>
      </div>

      <div className="space-y-3">
        {column.issues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-center text-xs font-bold text-slate-400">Solte uma issue aqui</div>
        ) : column.issues.map(issue => (
          <IssueCard key={issue.id} issue={issue} statuses={statuses} busy={busyId === issue.id} onMove={onMove} onDragStart={onDragStart} />
        ))}
      </div>
    </section>
  )
}

export default function AdminPipelinePage() {
  const [admin, setAdmin] = useState(null)
  const [pipeline, setPipeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [dragIssueId, setDragIssueId] = useState('')
  const [dropTarget, setDropTarget] = useState('')

  const totals = useMemo(() => {
    const issues = pipeline?.issues || []
    return {
      total: issues.length,
      critical: issues.filter(issue => issue.priority === 'Critical').length,
      active: issues.filter(issue => ['In Progress', 'Review', 'QA'].includes(issue.status)).length,
      done: issues.filter(issue => issue.status === 'Done').length,
    }
  }, [pipeline])

  async function loadData() {
    setError('')
    const [adminData, pipelineData] = await Promise.all([api.adminMe(), api.adminPipeline()])
    setAdmin(adminData)
    setPipeline(pipelineData)
  }

  useEffect(() => {
    let active = true
    Promise.all([api.adminMe(), api.adminPipeline()])
      .then(([adminData, pipelineData]) => {
        if (!active) return
        setAdmin(adminData)
        setPipeline(pipelineData)
      })
      .catch(err => {
        if (active) setError(err.message || 'Falha ao carregar o pipeline técnico.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function moveIssue(issueId, status) {
    const issue = pipeline?.issues?.find(item => item.id === issueId)
    if (!issue || issue.status === status || busyId) return

    const previousPipeline = pipeline
    const optimisticIssues = pipeline.issues.map(item => item.id === issueId ? { ...item, status } : item)
    const optimisticColumns = pipeline.statuses.map(columnStatus => ({
      status: columnStatus,
      issues: optimisticIssues.filter(item => item.status === columnStatus),
    }))

    setBusyId(issueId)
    setError('')
    setPipeline({ ...pipeline, issues: optimisticIssues, columns: optimisticColumns })

    try {
      const updated = await api.adminUpdatePipelineIssueStatus(issueId, status)
      setPipeline(updated)
    } catch (err) {
      setPipeline(previousPipeline)
      setError(err.message || 'Falha ao atualizar o status da issue.')
    } finally {
      setBusyId('')
      setDropTarget('')
      setDragIssueId('')
    }
  }

  function handleDragStart(event, issueId) {
    setDragIssueId(issueId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', issueId)
  }

  function handleDragOver(event, status) {
    event.preventDefault()
    setDropTarget(status)
  }

  function handleDrop(event, status) {
    event.preventDefault()
    const issueId = event.dataTransfer.getData('text/plain') || dragIssueId
    if (issueId) moveIssue(issueId, status)
  }

  if (loading) return <main className="min-h-screen bg-slate-950 p-6"><LoadingState message="Carregando pipeline técnico..." /></main>
  if (!admin) return <main className="min-h-screen bg-slate-950 p-6"><Alert type="error" title="Pipeline técnico" message={error || 'Sessão admin inválida.'} /></main>

  const columns = pipeline?.columns || []
  const statuses = pipeline?.statuses || []

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1e293b_0,#020617_34%,#0f172a_100%)] px-4 py-7 text-slate-950">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl shadow-black/20">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-700">Central Técnica de Desenvolvimento</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Kanban alimentado por um único arquivo Markdown.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">A rota lê <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold">.backlog/backlog.md</code>, quebra os blocos <code>START_ISSUE</code>/<code>END_ISSUE</code> e salva movimentos alterando apenas a linha <strong>Status</strong>.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => loadData().catch(err => setError(err.message))} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">Atualizar JSON</button>
                <Link href="/admin" className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Voltar ao admin</Link>
              </div>
            </div>
            <aside className="bg-slate-950 p-6 text-white sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Snapshot</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Issues</p><p className="text-3xl font-black">{totals.total}</p></div>
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Críticas</p><p className="text-3xl font-black">{totals.critical}</p></div>
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Em execução</p><p className="text-3xl font-black">{totals.active}</p></div>
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-300">Done</p><p className="text-3xl font-black">{totals.done}</p></div>
              </div>
              <p className="mt-4 text-xs text-slate-400">Última leitura: {pipeline?.updatedAt ? new Date(pipeline.updatedAt).toLocaleString('pt-BR') : '—'}</p>
            </aside>
          </div>
        </header>

        {error && <Alert type="warning" title="Pipeline técnico" message={error} />}
        {pipeline && !pipeline.fileExists && <Alert type="warning" title="Arquivo ausente" message="Crie .backlog/backlog.md na raiz do repo para alimentar o quadro." />}

        <section className="grid gap-4 xl:grid-cols-6">
          {columns.map(column => (
            <PipelineColumn
              key={column.status}
              column={column}
              statuses={statuses}
              busyId={busyId}
              dropTarget={dropTarget}
              onDropIssue={handleDrop}
              onDragOver={handleDragOver}
              onMove={moveIssue}
              onDragStart={handleDragStart}
            />
          ))}
        </section>
      </div>
    </main>
  )
}
