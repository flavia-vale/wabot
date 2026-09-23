import { redirect } from 'next/navigation'

// Migrado para a parte "Ajustes da conta" da tela única
// /painel/anti-banimento (specs/018-unificar-protecao-anti-ban).
export default function ConfiguracoesRedirect() {
  redirect('/painel/anti-banimento?parte=conta')
}
