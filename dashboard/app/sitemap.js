import { getIndexableSeoRoutes } from '../lib/seo-registry.mjs'
import { getSiteUrl } from '../lib/site-url'
import { EDITORIAL_DATES } from '../lib/editorial-content'
import { getAllLpSlugs } from '../lib/lp-config.mjs'

const baseUrl = getSiteUrl()

export default function sitemap() {
  return getIndexableSeoRoutes().map((route) => ({
    url: `${baseUrl}${route.path === '/' ? '' : route.path}`,
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
