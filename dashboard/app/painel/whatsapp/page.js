'use client'

/* Conexão WhatsApp no novo painel.
 *
 * Reuso completo (escolha da usuária): a tela de conexão atual em
 * app/dashboard/page.js é um componente client de ~800 linhas com toda a
 * lógica crítica de QR/pareamento/polling. Em vez de reescrever (risco alto
 * numa funcionalidade central), reusamos o componente existente dentro do
 * shell Menta. O corpo mantém o visual atual; o reskin completo fica para
 * uma etapa posterior. Funcionalidade preservada 100%. */

import DashboardConnection from '@/app/dashboard/page'
import { usePainelHeader } from '../PainelShell'

export default function WhatsAppPage() {
  usePainelHeader({ title: 'Conexão WhatsApp', subtitle: 'Status da sessão e conexão por QR Code ou código' })
  return (
    <div className="pnl-embed" style={{ maxWidth: 860, margin: '0 auto' }}>
      <DashboardConnection />
    </div>
  )
}
