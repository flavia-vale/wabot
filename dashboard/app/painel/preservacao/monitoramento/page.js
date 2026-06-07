'use client'

/* Monitoramento da Preservação avançada — versão Menta do painel. Reusa os
 * mesmos cards de /dashboard/preservacao/monitoramento; o título vai para a
 * topbar via usePainelHeader. */

import { HealthOverview } from '@/components/preservacao/HealthOverview'
import { RiskScoreSummary } from '@/components/preservacao/RiskScoreSummary'
import { RecentFollowsList } from '@/components/preservacao/RecentFollowsList'
import { SnapshotsList } from '@/components/preservacao/SnapshotsList'
import { ProbeStatus } from '@/components/preservacao/ProbeStatus'
import { ClicksSummary } from '@/components/preservacao/ClicksSummary'
import { usePainelHeader } from '../../PainelShell'

export default function MonitoramentoPage() {
  usePainelHeader({ title: 'Monitoramento', subtitle: 'Como o bot está protegendo seus canais, quase em tempo real' })

  return (
    <div className="max-w-5xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HealthOverview />
        <RiskScoreSummary />
        <RecentFollowsList />
        <SnapshotsList />
        <ProbeStatus />
        <ClicksSummary />
      </div>
    </div>
  )
}
