import { PreservationDecisionPage, getPreservationDecisionMetadata } from '@/app/_preservationDecisionPages'

const slug = '/faq-antiban-whatsapp'
export const metadata = getPreservationDecisionMetadata(slug)
export default function Page() { return <PreservationDecisionPage slug={slug} /> }
