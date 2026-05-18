import { PreservationCommercialPage, getPreservationCommercialMetadata } from '../_preservationCommercialPages'

export const metadata = getPreservationCommercialMetadata('bot-canal-whatsapp')

export default function Page() {
  return <PreservationCommercialPage pageKey="bot-canal-whatsapp" />
}
