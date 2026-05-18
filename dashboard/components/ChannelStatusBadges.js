'use client'

const STYLE = {
  base: 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  yellow: 'bg-amber-50 text-amber-800 border border-amber-200',
  gray: 'bg-slate-100 text-slate-700 border border-slate-200',
  blue: 'bg-sky-50 text-sky-700 border border-sky-200',
  rose: 'bg-rose-50 text-rose-700 border border-rose-200',
}

export function TypeBadge({ kind }) {
  if (kind === 'channel') return <span className={`${STYLE.base} ${STYLE.blue}`}>Canal</span>
  return <span className={`${STYLE.base} ${STYLE.gray}`}>Grupo</span>
}

export function FollowBadge({ status }) {
  if (status === 'followed') return <span className={`${STYLE.base} ${STYLE.green}`}>Seguindo</span>
  if (status === 'pending') return <span className={`${STYLE.base} ${STYLE.yellow}`}>Seguindo em breve…</span>
  if (status === 'error') return <span className={`${STYLE.base} ${STYLE.rose}`}>Erro ao seguir</span>
  return <span className={`${STYLE.base} ${STYLE.gray}`}>Não verificado</span>
}

export function AdminBadge({ status, onRefresh, refreshing }) {
  let cls = STYLE.gray
  let label = 'Não verificado'
  if (status === 'owner') { cls = STYLE.green; label = 'Admin OK' }
  else if (status === 'not-owner') { cls = STYLE.yellow; label = 'Sem permissão confirmada' }
  else if (status === 'error') { cls = STYLE.rose; label = 'Erro ao verificar' }
  return (
    <button
      type="button"
      className={`${STYLE.base} ${cls} hover:opacity-80 cursor-pointer`}
      onClick={onRefresh}
      disabled={refreshing}
      title="Clique para re-verificar"
    >
      {refreshing ? 'Verificando…' : label}
    </button>
  )
}
