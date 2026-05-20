'use client'
import { HealthOverview } from '@/components/preservacao/HealthOverview'
import { RiskScoreSummary } from '@/components/preservacao/RiskScoreSummary'
import { RecentFollowsList } from '@/components/preservacao/RecentFollowsList'
import { SnapshotsList } from '@/components/preservacao/SnapshotsList'
import { ProbeStatus } from '@/components/preservacao/ProbeStatus'
import { ClicksSummary } from '@/components/preservacao/ClicksSummary'

export default function MonitoramentoPage() {
  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">📊 Monitoramento</h2>
        <p className="text-sm text-gray-500">
          Veja em tempo quase real como o bot está protegendo seus canais. Atualize cada card pelo botão no canto superior.
        </p>
      </header>

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
