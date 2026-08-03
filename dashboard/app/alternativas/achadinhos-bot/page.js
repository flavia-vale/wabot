import { ComparisonPage, getComparisonMetadata } from '@/app/_comparisonContent'

const slug = '/alternativas/achadinhos-bot'
export const metadata = getComparisonMetadata(slug)
export default function Page() { return <ComparisonPage slug={slug} /> }
