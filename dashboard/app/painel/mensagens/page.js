'use client'

/* Mensagens — reuso completo da tela de variações de texto/templates
 * (app/dashboard/variacoes-de-texto/page.js) dentro do shell Menta. Mantém o
 * template store, variáveis e prévia sem reescrever a lógica. */

import MensagensInner from '@/app/dashboard/variacoes-de-texto/page'
import { usePainelHeader } from '../PainelShell'

export default function MensagensPage() {
  usePainelHeader({ title: 'Mensagens', subtitle: 'Como o bot escreve quando posta no seu grupo' })
  return (
    <div className="pnl-embed" style={{ maxWidth: 860, margin: '0 auto' }}>
      <MensagensInner />
    </div>
  )
}
