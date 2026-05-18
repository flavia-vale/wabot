import { PreservationCommercialPage, getPreservationCommercialMetadata } from '../_preservationCommercialPages'

export const metadata = getPreservationCommercialMetadata('anti-ban-whatsapp')

export default function Page() {
  return <PreservationCommercialPage pageKey="anti-ban-whatsapp" />
}
