'use client'

/* Parte "Situação" do Anti-banimento — como o bot está protegendo os canais,
 * quase em tempo real. Reaproveita os cards canônicos de monitoramento
 * (mesmos componentes da antiga tela "Monitoramento"). */

import { HealthOverview } from '@/components/preservacao/HealthOverview'
import { RiskScoreSummary } from '@/components/preservacao/RiskScoreSummary'

export default function SituacaoPart() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <HealthOverview />
      <RiskScoreSummary />
    </div>
  )
}
