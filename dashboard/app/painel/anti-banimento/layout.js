'use client'

/* Gate de plano da tela "Anti-banimento" — tela única que substitui o antigo
 * grupo "Preservação avançada" (specs/018-unificar-protecao-anti-ban).
 *
 * Fonte ÚNICA do gate (FR-015/FR-015a): canUseAdvancedPreservation, importada
 * direto de src/billing/plans.js — a MESMA função que o backend usa. Nunca
 * reimplementar a checagem de plano aqui (era o bug do Premium ficando
 * bloqueado na tela antiga, que usava uma função própria em
 * dashboard/lib/plan.js, removida).
 *
 * Sem acesso, a tela fica VISÍVEL e BLOQUEADA (UpsellShell) — nunca oculta o
 * item de menu nem redireciona para fora. O detalhamento completo do estado
 * bloqueado (selo PRO, frase "o robô continua protegendo seu número...") é
 * da User Story 3; aqui entra a estrutura mínima para o gate já funcionar
 * corretamente nos 5 perfis de plano desde já. */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { canUseAdvancedPreservation } from '../../../../src/billing/plans.js'
import { LoadingState } from '@/components/States'
import { UpsellShell } from '@/components/preservacao/UpsellShell'

export default function AntiBanimentoLayout({ children }) {
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
  if (!planSubject || !canUseAdvancedPreservation(planSubject)) {
    return <UpsellShell ctaHref="/painel/plano" />
  }
  return <>{children}</>
}
