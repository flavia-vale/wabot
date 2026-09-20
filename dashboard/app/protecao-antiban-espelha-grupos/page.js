import { PreservationDecisionPage, getPreservationDecisionMetadata } from '@/app/_preservationDecisionPages'

const slug = '/protecao-antiban-espelha-grupos'
export const metadata = getPreservationDecisionMetadata(slug)
export default function Page() { return <PreservationDecisionPage slug={slug} /> }
