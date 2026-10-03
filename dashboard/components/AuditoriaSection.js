'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

const TAKE = 50

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function quem(u) {
  return u ? (u.name || u.email || u.id) : 'sistema'
}

function resumo(r) {
  const partes = []
  if (r.reason) partes.push(r.reason)
  if (r.after && typeof r.after === 'object') {
    const txt = JSON.stringify(r.after)
    partes.push(txt.length > 140 ? `${txt.slice(0, 140)}…` : txt)
  }
  if (r.status && r.status !== 'success') partes.unshift(`(${r.status})`)
  return partes.join(' · ') || '—'
}

function PessoaLink({ u }) {
  if (!u) return <span style={{ color: 'var(--ink-soft)' }}>—</span>
  return <Link href={`/admin/clientes/${u.id}`} style={{ color: 'var(--accent-strong)' }}>{quem(u)}</Link>
}

// M8 da auditoria: quem fez o quê (AdminAuditLog). Só dono e admin; a leitura
// em si não é auditada. Payload já vem redigido do servidor.
export default function AuditoriaSection({ admin }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [page, setPage] = useState(1)
  const [filtros, setFiltros] = useState({ days: '30', action: '', actor: '', target: '' })
  const [aplicado, setAplicado] = useState({ days: '30', action: '', actor: '', target: '' })
  const permitido = admin?.role === 'owner' || admin?.role === 'admin'

  useEffect(() => {
    if (!permitido) return undefined
    let active = true
    Promise.resolve()
      .then(() => api.adminAudit({ ...aplicado, page, take: TAKE }))
      .then((r) => { if (active) { setDados(r); setErro('') } })
      .catch((e) => { if (active) setErro(e?.message || 'Não consegui carregar a auditoria.') })
    return () => { active = false }
  }, [permitido, aplicado, page])

  if (!permitido) return null

  function buscar(e) {
    e.preventDefault()
    setPage(1)
    setAplicado({ ...filtros })
  }

  const rows = dados?.rows ?? []
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / TAKE)) : 1
  const campo = { background: 'var(--bg-soft)', color: 'var(--ink)', border: '1px solid var(--line)' }

  return (
    <section id="auditoria" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
      <h2 style={{ color: 'var(--ink)' }} className="text-lg font-black">Auditoria · quem fez o quê</h2>
      <p style={{ color: 'var(--ink-soft)' }} className="text-xs">Ações do painel admin, da mais recente para a mais antiga. Dados sensíveis aparecem mascarados.</p>
      <form onSubmit={buscar} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs" style={{ color: 'var(--ink-soft)' }}>Período
          <select value={filtros.days} onChange={e => setFiltros(f => ({ ...f, days: e.target.value }))} style={campo} className="mt-1 block rounded-xl px-2 py-2 text-sm">
            <option value="1">Último dia</option>
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="180">180 dias</option>
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--ink-soft)' }}>Ação
          <input value={filtros.action} onChange={e => setFiltros(f => ({ ...f, action: e.target.value }))} placeholder="ex.: user.block" style={campo} className="mt-1 block rounded-xl px-3 py-2 text-sm" />
        </label>
        <label className="text-xs" style={{ color: 'var(--ink-soft)' }}>Quem fez
          <input value={filtros.actor} onChange={e => setFiltros(f => ({ ...f, actor: e.target.value }))} placeholder="e-mail ou id" style={campo} className="mt-1 block rounded-xl px-3 py-2 text-sm" />
        </label>
        <label className="text-xs" style={{ color: 'var(--ink-soft)' }}>Cliente afetado
          <input value={filtros.target} onChange={e => setFiltros(f => ({ ...f, target: e.target.value }))} placeholder="e-mail ou id" style={campo} className="mt-1 block rounded-xl px-3 py-2 text-sm" />
        </label>
        <button type="submit" style={{ background: 'var(--accent-strong)', color: 'var(--surface)' }} className="rounded-xl px-4 py-2 text-sm font-bold">Filtrar</button>
      </form>
      {erro && <p style={{ color: 'var(--danger)' }} className="mt-3 text-sm">{erro}</p>}
      {dados && !rows.length && <p style={{ color: 'var(--ink-soft)' }} className="mt-3 text-sm">Nada encontrado neste período.</p>}
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ color: 'var(--ink)' }}>
            <thead style={{ color: 'var(--ink-soft)' }}>
              <tr><th className="py-1 pr-3">Quando</th><th className="pr-3">Quem</th><th className="pr-3">Ação</th><th className="pr-3">Alvo</th><th>Resumo</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="pr-3"><PessoaLink u={r.actor} /></td>
                  <td className="pr-3">{r.label}</td>
                  <td className="pr-3"><PessoaLink u={r.target} /></td>
                  <td className="text-xs" style={{ color: 'var(--ink-soft)', wordBreak: 'break-word' }}>{resumo(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dados && (
        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'var(--ink-soft)' }}>
          <span>{dados.total} registro(s) · página {page} de {totalPaginas}</span>
          <span className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: 'var(--bg-soft)', color: 'var(--ink)' }} className="rounded-xl px-3 py-1 font-bold disabled:opacity-40">Anterior</button>
            <button type="button" disabled={page >= totalPaginas} onClick={() => setPage(p => p + 1)} style={{ background: 'var(--bg-soft)', color: 'var(--ink)' }} className="rounded-xl px-3 py-1 font-bold disabled:opacity-40">Próxima</button>
          </span>
        </div>
      )}
    </section>
  )
}
