import { redirect } from 'next/navigation'

export default function AgendadosPage() {
  redirect('/painel/envios?view=scheduled')
}
