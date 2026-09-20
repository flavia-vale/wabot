import { PreservationDecisionPage, getPreservationDecisionMetadata } from '@/app/_preservationDecisionPages'

const slug = '/bot-comum-vs-espelha-grupos'
export const metadata = getPreservationDecisionMetadata(slug)
export default function Page() { return <PreservationDecisionPage slug={slug} /> }
