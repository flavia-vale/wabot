'use client'

/* Grupos — reuso completo (escolha da usuária). A tela atual em
 * app/dashboard/grupos/page.js concentra muita lógica (canais, saúde, follow,
 * admin, editor de destinos). Reusamos o componente dentro do shell Menta para
 * preservar 100% da funcionalidade; o reskin do corpo fica para depois. */

import GruposInner from '@/app/dashboard/grupos/page'
import { usePainelHeader } from '../PainelShell'

export default function GruposPage() {
  usePainelHeader({ title: 'Grupos', subtitle: 'Defina quais grupos o bot escuta e onde ele publica' })
  return (
    <div className="pnl-embed" style={{ maxWidth: 860, margin: '0 auto' }}>
      <GruposInner />
    </div>
  )
}
