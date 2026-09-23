'use client'

/* Gate Pro do módulo de Preservação avançada — versão Menta do painel.
 * Libera as telas para plano Pro/Trial,
 * caso contrário mostra o upsell. Reusa os componentes compartilhados; o CTA do
 * upsell aponta para /painel/plano. */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
// Fonte ÚNICA do gate de plano (FR-015/FR-015a, specs/018-unificar-protecao-anti-ban):
// a mesma função que o backend usa, importada direto de src/billing/plans.js —
// nunca uma checagem própria da tela (era o bug do Premium ficando bloqueado
// aqui, já que a função antiga só liberava pro/trial-ativo).
import { canUseAdvancedPreservation } from '../../../../src/billing/plans.js'
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
  if (!planSubject || !canUseAdvancedPreservation(planSubject)) return <UpsellShell ctaHref="/painel/plano" />
  return <>{children}</>
}
