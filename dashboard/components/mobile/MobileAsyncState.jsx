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

export function MobileLoadingCard({ label = 'Carregando dados...' }) {
  return (
    <div className="mt-3 animate-pulse rounded-2xl border border-[#d7e7de] bg-white p-4" aria-busy="true" aria-live="polite">
      <div className="h-4 w-36 rounded bg-[#e7f0eb]" />
      <div className="mt-2 h-3 w-full rounded bg-[#eef5f1]" />
      <p className="mt-3 text-xs text-[#8FA09A]">{label}</p>
    </div>
  )
}

export function MobileErrorCard({ message = 'Não foi possível carregar os dados.' }) {
  return <MobileStateCard title="Falha ao carregar" description={message} tone="error" />
}
