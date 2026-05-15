import { notFound } from 'next/navigation'
import { LP_CONFIG, LpTemplate, getLpMetadata } from '../_lpShared'
import { getProgrammaticSeoSlugs } from '@/lib/seo-registry.mjs'

export function generateStaticParams() {
  return getProgrammaticSeoSlugs().map((slug) => ({ slug }))
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
