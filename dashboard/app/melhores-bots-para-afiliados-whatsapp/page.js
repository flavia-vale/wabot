import { ComparisonPage, getComparisonMetadata } from '@/app/_comparisonContent'

const slug = '/melhores-bots-para-afiliados-whatsapp'
export const metadata = getComparisonMetadata(slug)
export default function Page() { return <ComparisonPage slug={slug} /> }
