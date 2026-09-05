'use client'

import { useEffect, useState } from 'react'

// O "?" ao lado do número, com a explicação em três perguntas.
//
// Pedido da dona do produto (2026-09-05): os cards do painel mostravam número
// sem contexto — "Filas/DLQ 3" não diz o que é, o que dói nem o que fazer.
// A explicação fica atrás do "?" para não virar parede de texto na tela.
//
// Vocabulário leigo obrigatório, como no resto do produto.

export function HelpDot({ title, oQueE, impacto, comoResolver, className = '' }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!title) return null

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`O que é ${title}`}
        aria-expanded={open}
        onClick={(event) => { event.stopPropagation(); event.preventDefault(); setOpen(value => !value) }}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[11px] font-black text-slate-600 ring-1 ring-slate-300 transition hover:bg-white hover:text-slate-900"
      >
        ?
      </button>
      {open && (
        <>
          {/* Clique fora fecha. Fica atrás do balão e não bloqueia o resto. */}
          <span className="fixed inset-0 z-30 cursor-default" onClick={(event) => { event.stopPropagation(); setOpen(false) }} />
          <span
            role="dialog"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
            className="absolute left-0 top-7 z-40 block w-72 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl"
          >
            <span className="mb-2 flex items-start justify-between gap-2">
              <span className="text-sm font-black text-gray-900">{title}</span>
              <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-gray-400 hover:text-gray-700">fechar</button>
            </span>
            {oQueE && (
              <span className="mt-2 block">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">O que é</span>
                <span className="block text-xs leading-relaxed text-gray-700">{oQueE}</span>
              </span>
            )}
            {impacto && (
              <span className="mt-2 block">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">O que acontece se ficar assim</span>
                <span className="block text-xs leading-relaxed text-gray-700">{impacto}</span>
              </span>
            )}
            {comoResolver && (
              <span className="mt-2 block">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">Como resolver</span>
                <span className="block text-xs leading-relaxed text-gray-700">{comoResolver}</span>
              </span>
            )}
          </span>
        </>
      )}
    </span>
  )
}

export default HelpDot
