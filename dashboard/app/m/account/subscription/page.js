import { MobileShell } from '@/components/mobile/MobileShell'

export default function SubscriptionPage() {
  return (
    <MobileShell title="Conversor" active="inicio">
      <h2 className="text-lg font-semibold">Assinatura</h2>

      <div className="mt-3 rounded-2xl bg-[#1F2D2A] p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">Plano atual</p>
        <p className="mt-1 text-4xl italic">Pro</p>
        <p className="mt-1 text-sm text-white/80">R$ 39/mês · renova em 14 jun</p>
        <button className="mt-3 rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#1F2D2A]">Mudar plano</button>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#d7e7de] bg-white">
        <div className="border-b border-[#edf3ef] p-3"><p className="text-sm font-semibold">Grupos ativos</p><p className="text-xs text-[#5A6E68]">8 · ilimitado</p></div>
        <div className="border-b border-[#edf3ef] p-3"><p className="text-sm font-semibold">Posts no mês</p><p className="text-xs text-[#5A6E68]">2.847 de 5.000</p></div>
        <div className="p-3"><p className="text-sm font-semibold">Lojas conectadas</p><p className="text-xs text-[#5A6E68]">4 de 5</p></div>
      </div>
    </MobileShell>
  )
}
