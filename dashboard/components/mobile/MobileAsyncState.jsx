'use client'

import { useEffect, useState } from 'react'
import { MobileStateCard } from '@/components/mobile/MobileShell'

export function useMockAsyncData(data, delayMs = 120) {
  const [state, setState] = useState({ loading: true, error: null, data: [] })

  useEffect(() => {
    const timer = setTimeout(() => {
      setState({ loading: false, error: null, data })
    }, delayMs)
    return () => clearTimeout(timer)
  }, [data, delayMs])

  return state
}

export function MobileSpinner({ size = 14, color = 'currentColor' }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function MobileLoadingCard({ label = 'Carregando dados...' }) {
  return (
    <div
      className="animate-pulse"
      style={{
        marginTop: 12,
        minHeight: 96,
        padding: 16,
        borderRadius: 18,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div style={{ height: 16, width: 144, borderRadius: 6, background: 'var(--bg-soft)' }} />
      <div style={{ marginTop: 8, height: 12, width: '100%', borderRadius: 6, background: 'var(--bg)' }} />
      <p style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-faint)' }}>{label}</p>
    </div>
  )
}

export function MobileErrorCard({ message = 'Não foi possível carregar os dados.', onRetry }) {
  return (
    <MobileStateCard
      title="Falha ao carregar"
      description={message}
      tone="error"
      actionLabel={onRetry ? 'Tentar de novo' : undefined}
      onAction={onRetry}
    />
  )
}
