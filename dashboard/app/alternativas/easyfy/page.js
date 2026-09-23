import { ComparisonPage, getComparisonMetadata } from '@/app/_comparisonContent'

const slug = '/alternativas/easyfy'
export const metadata = getComparisonMetadata(slug)
export default function Page() { return <ComparisonPage slug={slug} /> }
