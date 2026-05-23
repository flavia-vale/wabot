import { MobileShell } from '@/components/mobile/MobileShell'

export default function OfferPage() {
  return (
    <MobileShell title="Conversor" active="criar">
      <h2 className="text-lg font-semibold">Gerador de oferta</h2>
      <div className="mt-3 rounded-2xl border border-[#d7e7de] bg-white p-4">
        <p className="text-sm font-semibold">Sandália Bege Verão 2026 — R$ 39,90</p>
        <p className="mt-1 text-xs text-[#5A6E68]">Modelo: Achadinho ✨</p>
        <textarea className="mt-3 h-36 w-full rounded-xl border border-[#d7e7de] bg-[#EEF6F2] p-3 text-sm" defaultValue={'✨ Achadinho do dia\n\nSandália Bege Verão 2026 por *R$ 39,90*\n👉 s.shopee.com.br/3As9XkLp2'} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="rounded-full border border-[#d7e7de] px-3 py-2 text-sm font-semibold">Agendar</button>
          <button className="rounded-full bg-[#1F2D2A] px-3 py-2 text-sm font-semibold text-white">Enviar agora</button>
        </div>
      </div>
    </MobileShell>
  )
}
