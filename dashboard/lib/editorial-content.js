export const EDITORIAL_AUTHOR = 'Equipe editorial do BOTinho'
export const EDITORIAL_AUTHOR_DESCRIPTION = 'Equipe responsável por guias de operação responsável, afiliados, grupos de WhatsApp e rotinas de divulgação com revisão humana.'

export const EDITORIAL_DATES = {
  '/conteudos': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/benchmarks/operacao-grupos-ofertas-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/blog/como-escalar-grupos-sem-operacao-manual': { publishedAt: '2026-05-11', updatedAt: '2026-05-15' },
  '/blog/checklist-padronizar-divulgacao-whatsapp': { publishedAt: '2026-05-11', updatedAt: '2026-05-15' },
  '/blog/conferir-converter-link-afiliado-whatsapp': { publishedAt: '2026-05-14', updatedAt: '2026-05-15' },
  '/blog/bot-para-afiliados-whatsapp-grupos-cupons': { publishedAt: '2026-05-14', updatedAt: '2026-05-15' },
  '/blog/grupo-ou-canal-whatsapp-achadinhos': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/blog/como-evitar-banimento-whatsapp-afiliados': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/blog/shadowban-whatsapp-canais': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/blog/migrar-grupo-achadinhos-para-canal': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/blog/chip-dedicado-bot-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/blog/bot-whatsapp-antiban-existe': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/blog/comecar-afiliado-whatsapp-sem-grupo-grande': { publishedAt: '2026-06-08', updatedAt: '2026-06-08' },
  '/blog/como-ser-afiliado-shopee-whatsapp': { publishedAt: '2026-06-08', updatedAt: '2026-06-08' },
  '/blog/como-divulgar-ofertas-amazon-whatsapp': { publishedAt: '2026-06-08', updatedAt: '2026-06-08' },
  '/diagnostico-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/bot-comum-vs-botinho': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/faq-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/como-funciona-botinho-canais': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/protecao-antiban-botinho': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/materiais/checklist-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/ferramentas/calculadora-risco-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/materiais/checklist-operacao-whatsapp': { publishedAt: '2026-05-11', updatedAt: '2026-05-15' },
  '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp': { publishedAt: '2026-05-14', updatedAt: '2026-05-15' },
  '/metodologia-uso-responsavel-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/alternativas/bot-para-whatsapp-afiliados': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/botinho-vs-planilha-manual': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/botinho-vs-ferramentas-genericas-automacao': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/melhores-bots-para-afiliados-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/glossario': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/estudos-de-caso': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
}

export function formatDatePtBr(date) {
  const [year, month, day] = String(date).split('-')
  return `${day}/${month}/${year}`
}

export function getEditorialDates(slug) {
  return EDITORIAL_DATES[slug] ?? { publishedAt: '2026-05-15', updatedAt: '2026-05-15' }
}

export function buildArticleJsonLd({ title, description, slug, siteUrl, faq = [], type = 'Article' }) {
  const dates = getEditorialDates(slug)
  const article = {
    '@context': 'https://schema.org',
    '@type': type,
    headline: title,
    description,
    author: { '@type': 'Organization', name: EDITORIAL_AUTHOR, description: EDITORIAL_AUTHOR_DESCRIPTION },
    publisher: { '@type': 'Organization', name: 'BOTinho', logo: { '@type': 'ImageObject', url: `${siteUrl}/botinho-logo.svg` } },
    datePublished: dates.publishedAt,
    dateModified: dates.updatedAt,
    mainEntityOfPage: `${siteUrl}${slug}`,
  }

  const schemas = [article]
  if (faq.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })
  }
  return schemas
}
