import { PreservationCommercialPage, getPreservationCommercialMetadata } from '../_preservationCommercialPages'

export const metadata = getPreservationCommercialMetadata('bot-achadinhos-whatsapp')

export default function Page() {
  return <PreservationCommercialPage pageKey="bot-achadinhos-whatsapp" />
}
