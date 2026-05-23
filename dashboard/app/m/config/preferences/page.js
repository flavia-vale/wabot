import { MobileShell } from '@/components/mobile/MobileShell'
import { preferenceItems } from '@/components/mobile/mobileConfigData'

export default function PreferencesPage() {
  return (
    <MobileShell title="Conversor" active="inicio">
      <h2 className="text-lg font-semibold">Preferências</h2>

      <div className="mt-3 rounded-2xl border border-[#d7e7de] bg-white p-4">
        <p className="text-xs font-semibold text-[#5A6E68]">Aparência</p>
        <p className="mt-2 text-sm">Tema: Auto · Idioma: Português BR · Fuso: GMT-3</p>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#d7e7de] bg-white">
        {preferenceItems.map((item) => (
          <div key={item.label} className="border-b border-[#edf3ef] p-3 last:border-b-0">
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-xs text-[#5A6E68]">{item.sub}</p>
            <p className={`mt-1 text-xs font-semibold ${item.enabled ? 'text-[#3E9C7A]' : 'text-[#8FA09A]'}`}>{item.enabled ? 'Ativado' : 'Desativado'}</p>
          </div>
        ))}
      </div>
    </MobileShell>
  )
}
