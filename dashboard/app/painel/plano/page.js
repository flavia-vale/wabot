'use client'

/* Plano e cobrança — reuso completo da tela de assinaturas existente
 * (app/dashboard/assinaturas/page.js) dentro do shell Menta. */

import AssinaturasInner from '@/app/dashboard/assinaturas/page'
import { usePainelHeader } from '../PainelShell'

export default function PlanoPage() {
  usePainelHeader({ title: 'Plano e cobrança', subtitle: 'Sua assinatura, uso e forma de pagamento' })
  return (
    <div className="pnl-embed" style={{ maxWidth: 860, margin: '0 auto' }}>
      <AssinaturasInner />
    </div>
  )
}
