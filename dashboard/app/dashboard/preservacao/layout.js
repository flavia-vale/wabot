'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { canAccessAdvancedPreservation } from '@/lib/plan'
import { LoadingState } from '@/components/States'
import { UpsellShell } from '@/components/preservacao/UpsellShell'

export default function PreservacaoLayout({ children }) {
  const [planSubject, setPlanSubject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.me()
      .then(me => {
        if (!active) return
        setPlanSubject({ plan: me?.plan ?? 'trial', accessExpiresAt: me?.accessExpiresAt ?? null })
      })
      .catch(err => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  if (loading) return <LoadingState message="Carregando..." />
  if (error) return <p className="text-sm text-red-600" role="alert">{error}</p>
  if (!canAccessAdvancedPreservation(planSubject)) return <UpsellShell />
  return <>{children}</>
}
