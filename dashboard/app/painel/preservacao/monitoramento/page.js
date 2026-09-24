import { redirect } from 'next/navigation'

// Migrado para a parte "Situação" da tela única /painel/anti-banimento
// (specs/018-unificar-protecao-anti-ban). Ver dashboard/app/painel/anti-banimento/.
export default function MonitoramentoRedirect() {
  redirect('/painel/anti-banimento?parte=situacao')
}
