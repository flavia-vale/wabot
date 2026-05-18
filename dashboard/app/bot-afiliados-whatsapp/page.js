import { PreservationCommercialPage, getPreservationCommercialMetadata } from '../_preservationCommercialPages'

export const metadata = getPreservationCommercialMetadata('bot-afiliados-whatsapp')

export default function Page() {
  return <PreservationCommercialPage pageKey="bot-afiliados-whatsapp" />
}
