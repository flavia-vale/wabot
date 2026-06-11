'use client'

import Link from 'next/link'
import { usePainelHeader } from '../PainelShell'

const TABS = [
  { value: 'history', label: 'Histórico', href: '/painel/envios' },
  { value: 'scheduled', label: 'Próximos envios', href: '/painel/envios?view=scheduled' },
]

export default function EnviosTabs({ activeView, children }) {
  usePainelHeader({
    title: 'Envios',
    subtitle: 'Acompanhe o que já foi processado e os envios programados',
  })

  return (
    <div className="pnl-grid" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <nav className="pnl-seg" aria-label="Visões de envios" style={{ justifySelf: 'start' }}>
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-semibold no-underline transition ${activeView === tab.value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
            aria-current={activeView === tab.value ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
