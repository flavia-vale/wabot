import { OrganicNicheLanding, getOrganicNicheMetadata } from '../_organicNicheLanding'

export const metadata = getOrganicNicheMetadata('bot-ofertas-restaurantes-whatsapp')

export default function Page() {
  return <OrganicNicheLanding pageKey="bot-ofertas-restaurantes-whatsapp" />
}
