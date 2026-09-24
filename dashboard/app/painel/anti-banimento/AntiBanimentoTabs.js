'use client'

import Link from 'next/link'
import { usePainelHeader } from '../PainelShell'
import SituacaoPart from './SituacaoPart'
import RitmoPart from './RitmoPart'
import ContaPart from './ContaPart'

const PARTS = [
  { value: 'ritmo', label: 'Ritmo por grupo' },
  { value: 'conta', label: 'Ajustes da conta' },
  { value: 'situacao', label: 'Situação' },
]

function hrefFor(part, destino) {
  if (part === 'ritmo' && destino) return `/painel/anti-banimento?parte=ritmo&destino=${encodeURIComponent(destino)}`
  return `/painel/anti-banimento?parte=${part}`
}

export default function AntiBanimentoTabs({ parte, destino }) {
  usePainelHeader({
    title: <>Anti-banimento <span className="pnl-pro">PRO</span></>,
    subtitle: 'Tudo que protege o seu número de ser bloqueado, num lugar só',
  })

  return (
    <div className="pnl-grid" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <nav className="pnl-seg w-full overflow-x-auto sm:w-auto" aria-label="Partes do Anti-banimento" style={{ justifySelf: 'start' }}>
        {PARTS.map((p) => (
          <Link
            key={p.value}
            href={hrefFor(p.value, destino)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold no-underline transition ${parte === p.value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
            aria-current={parte === p.value ? 'page' : undefined}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {parte === 'situacao' && <SituacaoPart />}
      {parte === 'ritmo' && <RitmoPart initialDestino={destino} />}
      {parte === 'conta' && <ContaPart />}
    </div>
  )
}
