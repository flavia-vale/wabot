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
          <span className="fixed inset-0 z-40 cursor-default bg-slate-950/20" onClick={(event) => { event.stopPropagation(); setOpen(false) }} />
          {/* Posição FIXA na tela, nunca ancorada ao "?" (RCA 2026-09-05): o "?"
              fica no canto direito do card, e um balão de largura fixa nascendo
              ali some para fora da tela no celular — dava para ver o balão abrir
              e não dava para ler. Ancoragem por CSS não cabe nos dois extremos
              da grade sem medir a tela, então vira gaveta embaixo no celular e
              diálogo centralizado no computador. O título diz de qual card é. */}
          <span
            role="dialog"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
            className="fixed inset-x-3 bottom-3 z-50 block max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2"
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
