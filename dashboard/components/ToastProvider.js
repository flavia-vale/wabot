'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)
let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((type, message, title) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, type, message, title }])
    setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  const value = useMemo(() => ({
    success: (message, title = 'Sucesso') => push('success', message, title),
    error: (message, title = 'Erro') => push('error', message, title),
    info: (message, title = 'Info') => push('info', message, title),
    warning: (message, title = 'Atenção') => push('warning', message, title),
  }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl border p-3 shadow-lg bg-white ${styles[t.type] || styles.info}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-xs">{t.message}</p>
              </div>
              <button onClick={() => dismiss(t.id)} className="text-xs opacity-70 hover:opacity-100">✕</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const styles = {
  success: 'border-emerald-200 text-emerald-800',
  error: 'border-red-200 text-red-800',
  warning: 'border-amber-200 text-amber-800',
  info: 'border-blue-200 text-blue-800',
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
