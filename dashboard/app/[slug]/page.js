import { notFound } from 'next/navigation'
import { LP_CONFIG, LpTemplate, getLpMetadata } from '../_lpShared'

export function generateStaticParams() {
  return Object.keys(LP_CONFIG).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  if (!LP_CONFIG[slug]) return {}
  return getLpMetadata(slug)
}

export default async function ProgrammaticLpPage({ params }) {
  const { slug } = await params
  if (!LP_CONFIG[slug]) notFound()

  return <LpTemplate slug={slug} />
}
