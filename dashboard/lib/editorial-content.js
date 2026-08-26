export const EDITORIAL_AUTHOR = 'Equipe editorial do Espelha Grupos'
export const EDITORIAL_AUTHOR_DESCRIPTION = 'Equipe responsável por guias de operação responsável, afiliados, grupos de WhatsApp e rotinas de divulgação com revisão humana.'

// Autoria com pessoa física (E-E-A-T / citação por IA) — usar via `authorOverride`
// nas páginas de maior prioridade (guias de marketplace). Não trocar a autoria
// padrão do site inteiro sem decisão explícita — ver AGENTS.md > SEO orgânico.
export const EDITORIAL_PERSON_AUTHOR = 'Flávia Vale'
export const EDITORIAL_PERSON_AUTHOR_DESCRIPTION = 'Fundadora do Espelha Grupos, trabalha com tecnologia e opera grupos de ofertas desde 2023.'

export const EDITORIAL_DATES = {
  // Rotas comerciais/ferramentas que estavam sem updatedAt (validate:seo-consistency
  // acusava 9 erros). Sem essa data não há sinal de frescor para o Google nem para
  // os motores de IA, que pesam recência ao escolher o que citar.
  '/bot-canais-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/bot-afiliados-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/bot-achadinhos-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-08-03' },
  '/anti-ban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-08-03' },
  '/grupo-para-canal-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/bot-canal-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/comparativos': { publishedAt: '2026-05-15', updatedAt: '2026-07-30' },
  '/ferramentas': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/ferramentas/calculadora-tempo-grupos-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  // Lacuna herdada de 94c6a10f ("feature 010 seo-lead-capture, 24/27 tasks"): as duas
  // rotas entraram em CONTENT_SEO_ROUTES sem a data editorial correspondente, e o
  // validate:seo-consistency acusava isso desde então. publishedAt = data real de
  // criação dos arquivos (PR #1186).
  '/cadastro': { publishedAt: '2026-07-03', updatedAt: '2026-07-31' },
  '/parcerias': { publishedAt: '2026-07-03', updatedAt: '2026-07-31' },
  // Mesma lacuna da nota acima, encontrada em 2026-08-19 ao rodar
  // validate:seo-consistency para specs/013-inbound-leads-strategy (P2) — as
  // 3 rotas abaixo já tinham data em resolveLastModified() no seo-registry,
  // só faltava aqui. Reaproveita a MESMA data já em uso no registry para não
  // inventar dado novo.
  '/precos': { publishedAt: '2026-08-05', updatedAt: '2026-08-05' },
  '/parceiro-influenciador': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/termos-parceria-influenciador': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/programa-de-afiliados': { publishedAt: '2026-07-31', updatedAt: '2026-07-31' },
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
  '/blog/como-ser-afiliado-shopee-whatsapp': { publishedAt: '2026-06-08', updatedAt: '2026-07-31' },
  '/blog/como-divulgar-ofertas-amazon-whatsapp': { publishedAt: '2026-06-08', updatedAt: '2026-07-31' },
  '/blog/como-divulgar-ofertas-mercado-livre-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-31' },
  '/blog/quanto-custa-bot-para-whatsapp-afiliados': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-31' },
  '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  '/diagnostico-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/bot-comum-vs-botinho': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/faq-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-08-03' },
  '/como-funciona-botinho-canais': { publishedAt: '2026-05-18', updatedAt: '2026-05-18' },
  '/protecao-antiban-botinho': { publishedAt: '2026-05-18', updatedAt: '2026-08-03' },
  '/materiais/checklist-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/ferramentas/calculadora-risco-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/materiais/checklist-operacao-whatsapp': { publishedAt: '2026-05-11', updatedAt: '2026-05-15' },
  '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp': { publishedAt: '2026-05-14', updatedAt: '2026-05-15' },
  '/metodologia-uso-responsavel-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/alternativas/achadinhos-bot': { publishedAt: '2026-08-03', updatedAt: '2026-08-03' },
  // US5 (specs/013-inbound-leads-strategy) — única página de comparação nova
  // desta rodada, publicada em 2026-08-19.
  '/alternativas/achadinho-pro': { publishedAt: '2026-08-19', updatedAt: '2026-08-19' },
  '/alternativas/gigi-bot': { publishedAt: '2026-08-26', updatedAt: '2026-08-26' },
  '/alternativas/proafiliados': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/alternativas/shozap': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/alternativas/fluxopromo': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/alternativas/bot-para-whatsapp-afiliados': { publishedAt: '2026-05-15', updatedAt: '2026-07-31' },
  '/botinho-vs-planilha-manual': { publishedAt: '2026-05-15', updatedAt: '2026-07-30' },
  '/botinho-vs-ferramentas-genericas-automacao': { publishedAt: '2026-05-15', updatedAt: '2026-07-30' },
  '/melhores-bots-para-afiliados-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-07-30' },
  '/glossario': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/estudos-de-caso': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/confiabilidade-sessao-whatsapp': { publishedAt: '2026-07-15', updatedAt: '2026-07-15' },
  '/seguranca-credenciais-afiliado': { publishedAt: '2026-07-15', updatedAt: '2026-07-15' },
}

export function formatDatePtBr(date) {
  const [year, month, day] = String(date).split('-')
  return `${day}/${month}/${year}`
}

export function getEditorialDates(slug) {
  return EDITORIAL_DATES[slug] ?? { publishedAt: '2026-05-15', updatedAt: '2026-05-15' }
}

export function buildArticleJsonLd({ title, description, slug, siteUrl, faq = [], type = 'Article', author }) {
  const dates = getEditorialDates(slug)
  const resolvedAuthor = author
    ? { '@type': author.type ?? 'Person', name: author.name, description: author.description }
    : { '@type': 'Organization', name: EDITORIAL_AUTHOR, description: EDITORIAL_AUTHOR_DESCRIPTION }
  const article = {
    '@context': 'https://schema.org',
    '@type': type,
    headline: title,
    description,
    author: resolvedAuthor,
    publisher: { '@type': 'Organization', name: 'Espelha Grupos', logo: { '@type': 'ImageObject', url: `${siteUrl}/botinho-logo.svg` } },
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
