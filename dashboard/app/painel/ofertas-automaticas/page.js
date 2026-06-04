'use client'

/* Ofertas automáticas — reuso completo da tela existente
 * (app/dashboard/ofertas-automaticas/page.js) dentro do shell Menta. */

import OfertasAutomaticasInner from '@/app/dashboard/ofertas-automaticas/page'
import { usePainelHeader } from '../PainelShell'

export default function OfertasAutomaticasPage() {
  usePainelHeader({ title: 'Ofertas automáticas', subtitle: 'O bot garimpa promoções nas lojas e posta sozinho' })
  return (
    <div className="pnl-embed" style={{ maxWidth: 860, margin: '0 auto' }}>
      <OfertasAutomaticasInner />
    </div>
  )
}
