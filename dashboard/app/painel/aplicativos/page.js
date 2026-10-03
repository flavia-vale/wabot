import { redirect } from 'next/navigation'
import AppsPanel from './AppsPanel'
import { SHOW_APPS_SCREEN } from '@/lib/featureVisibility'
export const metadata = { title: 'Aplicativos | Espelha Grupos', description: 'Onde suas ofertas são publicadas: WhatsApp, Telegram e Stories do Instagram.' }
// Escondida em produção por enquanto (lib/featureVisibility.js).
export default function AplicativosPage() {
  if (!SHOW_APPS_SCREEN) redirect('/painel')
  return <AppsPanel />
}
