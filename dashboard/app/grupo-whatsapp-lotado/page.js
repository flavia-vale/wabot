import { PreservationCommercialPage, getPreservationCommercialMetadata } from '../_preservationCommercialPages'

export const metadata = getPreservationCommercialMetadata('grupo-whatsapp-lotado')

export default function Page() {
  return <PreservationCommercialPage pageKey="grupo-whatsapp-lotado" />
}
