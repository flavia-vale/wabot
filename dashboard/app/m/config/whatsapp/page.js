import Link from 'next/link'
import { MobileShell } from '@/components/mobile/MobileShell'
import { whatsappStatus } from '@/components/mobile/mobileConfigData'
import { mobileRoutes } from '@/components/mobile/routes'

export default function WhatsAppConfigPage() {
  const progress = Math.round((whatsappStatus.postsToday / whatsappStatus.postLimit) * 100)

  return (
    <MobileShell title="Conversor" active="inicio">
      <h2 className="text-lg font-semibold">Conexão WhatsApp</h2>
      <div className="mt-3 rounded-2xl border border-[#bde3d2] bg-[#f3fbf7] p-4">
        <p className="text-sm font-semibold text-[#3E9C7A]">WhatsApp conectado</p>
        <p className="mt-1 text-xs text-[#5A6E68]">{whatsappStatus.phone} · {whatsappStatus.activeDays} dias ativos</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href={mobileRoutes.logs} className="rounded-full border border-[#d7e7de] px-3 py-2 text-center text-sm font-semibold">Sincronizar</Link>
          <Link href={mobileRoutes.helpTutorial} className="rounded-full border border-[#eecac1] px-3 py-2 text-center text-sm font-semibold text-[#D97757]">Desconectar</Link>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-[#d7e7de] bg-white p-4">
        <p className="text-xs font-semibold text-[#5A6E68]">Posts hoje</p>
        <p className="mt-1 text-sm font-semibold">{whatsappStatus.postsToday} de {whatsappStatus.postLimit} ({progress}%)</p>
        <div className="mt-2 h-2 rounded-full bg-[#e7f0eb]"><div className="h-2 rounded-full bg-[#3E9C7A]" style={{ width: `${progress}%` }} /></div>
        <p className="mt-3 text-xs text-[#5A6E68]">Tempo mínimo entre posts: 45s · Soneca: {whatsappStatus.sleepMode ? '23h–7h' : 'desativada'}</p>
      </div>
    </MobileShell>
  )
}
