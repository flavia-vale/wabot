'use client'
import { useEffect, useId, useRef, useState } from 'react'

// Tooltip leve sem dependência externa. Hover em desktop, tap em mobile.
// Fechamento por ESC, clique fora ou blur. Renderiza um ícone "i" como trigger.
export function Tooltip({ content, label = 'Mais informações' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    function onClick(e) {
      if (triggerRef.current?.contains(e.target)) return
      if (tooltipRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('touchstart', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('touchstart', onClick)
    }
  }, [open])

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-bold text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      >
        i
      </button>
      {open && (
        /* Mesma correção do balão de ajuda do admin (2026-09-05): no celular a
           dica vira uma faixa fixa embaixo, porque um balão de largura fixa
           centralizado no "i" sai da tela quando o "i" está perto da borda — e
           dica que não dá para ler é pior que dica nenhuma. */
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          className="fixed inset-x-3 bottom-3 z-50 block rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg sm:absolute sm:inset-x-auto sm:bottom-full sm:left-1/2 sm:z-20 sm:mb-2 sm:w-64 sm:-translate-x-1/2"
        >
          {content}
          {/* A setinha só faz sentido quando o balão está grudado no "i". */}
          <span className="hidden sm:block sm:absolute sm:left-1/2 sm:top-full sm:-translate-x-1/2 sm:border-4 sm:border-transparent sm:border-t-gray-900" aria-hidden="true" />
        </span>
      )}
    </span>
  )
}
