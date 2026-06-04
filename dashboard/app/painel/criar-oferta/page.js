'use client'

/* Criar oferta — reuso completo do OfferBuilder (componente compartilhado já
 * usado em /dashboard/gerar-oferta) dentro do shell Menta. Garante a mesma
 * lógica de scrape/conversão/preview, sem duplicar o motor de oferta. */

import { OfferBuilder } from '@/components/OfferBuilder'
import { usePainelHeader } from '../PainelShell'

export default function CriarOfertaPage() {
  usePainelHeader({ title: 'Criar oferta', subtitle: 'Cole um link de produto — o bot monta a oferta pronta' })
  return (
    <div className="pnl-grid" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="pnl-note-box is-info">
        Cole o link de um produto (Shopee, Amazon, Mercado Livre, Magalu…). Tentamos converter para o seu link de afiliado automaticamente; se não der, seguimos com o link original e avisamos.
      </div>
      <div className="pnl-card pnl-embed">
        <OfferBuilder mode="standalone" />
      </div>
    </div>
  )
}
