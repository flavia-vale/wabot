import { ComparisonPage, getComparisonMetadata } from '@/app/_comparisonContent'

const slug = '/espelha-grupos-vs-planilha-manual'
export const metadata = getComparisonMetadata(slug)
export default function Page() { return <ComparisonPage slug={slug} /> }
