import { redirect } from 'next/navigation'

// Migrado para a parte "Ritmo por grupo" da tela única /painel/anti-banimento
// (specs/018-unificar-protecao-anti-ban). Preserva ?destino=<groupId> para
// links antigos que apontavam direto para um destino específico.
export default async function DestinosRedirect({ searchParams }) {
  const query = await searchParams
  const destino = typeof query?.destino === 'string' ? query.destino : null
  const suffix = destino ? `&destino=${encodeURIComponent(destino)}` : ''
  redirect(`/painel/anti-banimento?parte=ritmo${suffix}`)
}
