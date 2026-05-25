import Link from 'next/link'
import { MobileShell } from '@/components/mobile/MobileShell'
import { credentialItems } from '@/components/mobile/mobileConfigData'
import { mobileRoutes } from '@/components/mobile/routes'

export default function CredentialsPage() {
  return (
    <MobileShell title="Conversor" active="inicio">
      <h2 className="text-lg font-semibold">Credenciais</h2>
      <p className="mt-1 text-xs text-[#5A6E68]">Conecte seus IDs de afiliada para reescrita automática dos links.</p>
      <div className="mt-3 overflow-hidden rounded-2xl border border-[#d7e7de] bg-white">
        {credentialItems.map((item) => (
          <div key={item.store} className="border-b border-[#edf3ef] p-3 last:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{item.store}</p>
              <Link href={item.enabled ? mobileRoutes.configPreferences : mobileRoutes.helpTutorial} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.enabled ? 'border border-[#d7e7de] text-[#5A6E68]' : 'bg-[#1F2D2A] text-white'}`}>{item.enabled ? 'Editar' : 'Conectar'}</Link>
            </div>
            <p className="mt-1 text-xs text-[#5A6E68]">{item.enabled ? item.id : 'Não conectado'}</p>
          </div>
        ))}
      </div>
    </MobileShell>
  )
}
