import { EDITORIAL_DATES, formatDatePtBr } from '@/lib/editorial-content'
import { getSiteUrl } from '@/lib/site-url'

const styles = {
  wrap: {
    borderTop: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--ink-soft)',
    fontSize: 13,
    fontWeight: 600,
    padding: '14px 20px',
    textAlign: 'center',
  },
}

/** Selo e WebPage canônicos de todas as páginas editoriais públicas. */
export function EditorialFreshness({ pathname }) {
  const dates = EDITORIAL_DATES[pathname]

  if (!dates) return null

  const url = `${getSiteUrl()}${pathname === '/' ? '' : pathname}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    datePublished: dates.publishedAt,
    dateModified: dates.updatedAt,
    isPartOf: { '@id': `${getSiteUrl()}#website` },
  }

  return (
    <>
      <aside aria-label="Data da revisão editorial" style={styles.wrap}>
        Revisado em <time dateTime={dates.updatedAt}>{formatDatePtBr(dates.updatedAt)}</time>
      </aside>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  )
}
