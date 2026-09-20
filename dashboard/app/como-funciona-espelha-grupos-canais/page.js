import { PreservationDecisionPage, getPreservationDecisionMetadata } from '@/app/_preservationDecisionPages'

const slug = '/como-funciona-espelha-grupos-canais'
export const metadata = getPreservationDecisionMetadata(slug)
export default function Page() { return <PreservationDecisionPage slug={slug} /> }
