import { FOUNDER_LINKEDIN_URL, FOUNDER_PERSON_ID_PATH, FOUNDER_SAME_AS } from './marketing-content.js'

export const EDITORIAL_AUTHOR = 'Equipe editorial do Espelha Grupos'
export const EDITORIAL_AUTHOR_DESCRIPTION = 'Equipe responsável por guias de operação responsável, afiliados, grupos de WhatsApp e rotinas de divulgação com revisão humana.'

// Autoria com pessoa física (E-E-A-T / citação por IA) — usar via `authorOverride`
// nas páginas de maior prioridade (guias de marketplace). Não trocar a autoria
// padrão do site inteiro sem decisão explícita — ver AGENTS.md > SEO orgânico.
export const EDITORIAL_PERSON_AUTHOR = 'Flávia Vale'
export const EDITORIAL_PERSON_AUTHOR_DESCRIPTION = 'Fundadora do Espelha Grupos, trabalha com tecnologia e opera grupos de ofertas desde 2023.'
// Foto real (não placeholder) + link para o LinkedIn PESSOAL dela (confirmado
// 20/09/2026). Autoria assinada por pessoa real e verificável, com foto e
// perfil externo linkável, é sinal de E-E-A-T (Google) e é o que separa uma
// "Equipe editorial" genérica de uma entidade que o ChatGPT/Perplexity/AI
// Overviews conseguem checar — mesma lógica do `sameAs`/`founder` já aplicado
// no layout raiz (ver comentário ali). O `@id` aponta para o MESMO nó Person
// de `/quem-somos#person`: é o que faz o Google/IA tratarem a autora do post e
// a fundadora do site como a MESMA entidade, em vez de duas pessoas soltas.
export const EDITORIAL_PERSON_AUTHOR_PHOTO_PATH = '/authors/flavia-vale.jpg'
export const EDITORIAL_PERSON_AUTHOR_LINKEDIN_URL = FOUNDER_LINKEDIN_URL
export const EDITORIAL_PERSON_AUTHOR_ID_PATH = FOUNDER_PERSON_ID_PATH
export const EDITORIAL_PERSON_AUTHOR_SAME_AS = FOUNDER_SAME_AS

export const EDITORIAL_DATES = {
  // Rotas comerciais/ferramentas que estavam sem updatedAt (validate:seo-consistency
  // acusava 9 erros). Sem essa data não há sinal de frescor para o Google nem para
  // os motores de IA, que pesam recência ao escolher o que citar.
  '/bot-canais-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/bot-afiliados-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-09-23' },
  '/bot-achadinhos-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-09-23' },
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
  '/precos': { publishedAt: '2026-08-05', updatedAt: '2026-09-23' },
  '/parceiro-influenciador': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/termos-parceria-influenciador': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/programa-de-afiliados': { publishedAt: '2026-07-31', updatedAt: '2026-07-31' },
  '/clonar-mensagens-de-grupo-de-afiliados': { publishedAt: '2026-08-26', updatedAt: '2026-08-26' },
  '/conteudos': { publishedAt: '2026-05-15', updatedAt: '2026-09-24' },
  '/benchmarks/operacao-grupos-ofertas-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-24' },
  '/blog/como-escalar-grupos-sem-operacao-manual': { publishedAt: '2026-05-11', updatedAt: '2026-09-24' },
  '/blog/checklist-padronizar-divulgacao-whatsapp': { publishedAt: '2026-05-11', updatedAt: '2026-09-24' },
  '/blog/conferir-converter-link-afiliado-whatsapp': { publishedAt: '2026-05-14', updatedAt: '2026-09-24' },
  '/blog/bot-para-afiliados-whatsapp-grupos-cupons': { publishedAt: '2026-05-14', updatedAt: '2026-09-24' },
  '/blog/grupo-ou-canal-whatsapp-achadinhos': { publishedAt: '2026-05-18', updatedAt: '2026-09-24' },
  '/blog/como-evitar-banimento-whatsapp-afiliados': { publishedAt: '2026-05-18', updatedAt: '2026-09-24' },
  '/blog/shadowban-whatsapp-canais': { publishedAt: '2026-05-18', updatedAt: '2026-09-24' },
  '/blog/migrar-grupo-achadinhos-para-canal': { publishedAt: '2026-05-18', updatedAt: '2026-09-24' },
  '/blog/chip-dedicado-bot-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-09-24' },
  '/blog/bot-whatsapp-antiban-existe': { publishedAt: '2026-05-18', updatedAt: '2026-09-24' },
  '/blog/comecar-afiliado-whatsapp-sem-grupo-grande': { publishedAt: '2026-06-08', updatedAt: '2026-06-08' },
  '/blog/como-ser-afiliado-shopee-whatsapp': { publishedAt: '2026-06-08', updatedAt: '2026-07-31' },
  '/blog/como-divulgar-ofertas-amazon-whatsapp': { publishedAt: '2026-06-08', updatedAt: '2026-07-31' },
  '/blog/como-divulgar-ofertas-mercado-livre-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-31' },
  '/blog/quanto-custa-bot-para-whatsapp-afiliados': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  '/blog/melhores-horarios-para-postar-ofertas-no-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  '/blog/como-converter-link-de-afiliado-automaticamente-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  '/blog/amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp': { publishedAt: '2026-07-22', updatedAt: '2026-07-31' },
  '/blog/como-montar-grupo-de-ofertas-no-whatsapp-do-zero': { publishedAt: '2026-07-22', updatedAt: '2026-07-22' },
  // Páginas de resposta (19/09/2026) — ver _preservationBlogPosts.js.
  '/blog/como-espelhar-mensagens-entre-grupos-whatsapp': { publishedAt: '2026-09-19', updatedAt: '2026-09-19' },
  '/blog/melhores-automacoes-para-afiliado-shopee-2026': { publishedAt: '2026-09-19', updatedAt: '2026-09-19' },
  '/blog/ferramenta-para-divulgar-ofertas-em-grupos-whatsapp': { publishedAt: '2026-09-19', updatedAt: '2026-09-19' },
  '/diagnostico-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/bot-comum-vs-espelha-grupos': { publishedAt: '2026-05-18', updatedAt: '2026-09-19' },
  '/faq-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-08-03' },
  '/como-funciona-espelha-grupos-canais': { publishedAt: '2026-05-18', updatedAt: '2026-09-19' },
  '/protecao-antiban-espelha-grupos': { publishedAt: '2026-05-18', updatedAt: '2026-09-19' },
  '/materiais/checklist-antiban-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/ferramentas/calculadora-risco-whatsapp': { publishedAt: '2026-05-18', updatedAt: '2026-07-30' },
  '/materiais/checklist-operacao-whatsapp': { publishedAt: '2026-05-11', updatedAt: '2026-09-24' },
  '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp': { publishedAt: '2026-05-14', updatedAt: '2026-09-24' },
  // Parágrafo de identidade de marca entrou em 2026-09-11 (e3f5273); a data
  // ficava em 05/2026 e a página é o ativo mais citado pelas IAs.
  '/metodologia-uso-responsavel-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-11' },
  // As 5 páginas de loja do Tier 1 (02/09) e /alternativas/promium (02/09)
  // nunca tiveram data — no promium o Article caía no fallback de 2026-05-15,
  // antes de a página existir (RCA 2026-09-18).
  '/shopee-afiliados-whatsapp': { publishedAt: '2026-09-02', updatedAt: '2026-09-23' },
  '/mercado-livre-afiliados-whatsapp': { publishedAt: '2026-09-02', updatedAt: '2026-09-11' },
  '/amazon-afiliados-whatsapp': { publishedAt: '2026-09-02', updatedAt: '2026-09-11' },
  '/shein-afiliados-whatsapp': { publishedAt: '2026-09-02', updatedAt: '2026-09-11' },
  '/magalu-afiliados-whatsapp': { publishedAt: '2026-09-02', updatedAt: '2026-09-11' },
  '/alternativas/promium': { publishedAt: '2026-09-02', updatedAt: '2026-09-11' },
  '/alternativas/achadinhos-bot': { publishedAt: '2026-08-03', updatedAt: '2026-09-23' },
  // US5 (specs/013-inbound-leads-strategy) — única página de comparação nova
  // desta rodada, publicada em 2026-08-19.
  '/alternativas/achadinho-pro': { publishedAt: '2026-08-19', updatedAt: '2026-09-23' },
  '/alternativas/gigi-bot': { publishedAt: '2026-08-26', updatedAt: '2026-08-26' },
  '/alternativas/proafiliados': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/alternativas/shozap': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/alternativas/fluxopromo': { publishedAt: '2026-08-04', updatedAt: '2026-08-04' },
  '/alternativas/bot-para-whatsapp-afiliados': { publishedAt: '2026-05-15', updatedAt: '2026-07-31' },
  '/espelha-grupos-vs-planilha-manual': { publishedAt: '2026-05-15', updatedAt: '2026-09-19' },
  '/espelha-grupos-vs-ferramentas-genericas-automacao': { publishedAt: '2026-05-15', updatedAt: '2026-09-19' },
  '/melhores-bots-para-afiliados-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-23' },
  '/glossario': { publishedAt: '2026-05-15', updatedAt: '2026-09-24' },
  '/estudos-de-caso': { publishedAt: '2026-05-15', updatedAt: '2026-09-24' },
  '/confiabilidade-sessao-whatsapp': { publishedAt: '2026-07-15', updatedAt: '2026-07-15' },
  '/espelha-grupos-e-confiavel': { publishedAt: '2026-09-11', updatedAt: '2026-09-23' },
  '/seguranca-credenciais-afiliado': { publishedAt: '2026-07-15', updatedAt: '2026-07-15' },
  '/quanto-ganha-afiliado-shopee': { publishedAt: '2026-09-11', updatedAt: '2026-09-11' },
  '/vendas-e-comissao-afiliado-whatsapp': { publishedAt: '2026-09-11', updatedAt: '2026-09-23' },
  '/copiaram-minha-oferta-no-whatsapp': { publishedAt: '2026-09-11', updatedAt: '2026-09-11' },
  // 23/09/2026 — visibilidade no ChatGPT para "bot para afiliados no WhatsApp":
  // política de reembolso pública, o modo de busca automática da Shopee e cinco
  // comparativos com preço coletado na página oficial de cada concorrente.
  '/politica-de-reembolso': { publishedAt: '2026-09-23', updatedAt: '2026-09-23' },
  '/bot-que-busca-ofertas-shopee-whatsapp': { publishedAt: '2026-09-23', updatedAt: '2026-09-23' },
  '/alternativas/easyfy': { publishedAt: '2026-09-23', updatedAt: '2026-09-23' },
  '/alternativas/lucreshop': { publishedAt: '2026-09-23', updatedAt: '2026-09-23' },
  '/alternativas/afiliai': { publishedAt: '2026-09-23', updatedAt: '2026-09-23' },
  '/alternativas/achify': { publishedAt: '2026-09-23', updatedAt: '2026-09-23' },
  '/alternativas/afiliados-turbo': { publishedAt: '2026-09-23', updatedAt: '2026-09-23' },
  // 33 rotas indexáveis sem data (23/09/2026). Nenhuma data inventada: cada
  // updatedAt é a última mudança de CONTEÚDO verificável (commit, rótulo
  // "Última atualização" da própria página ou comentário datado do registro).
  // Sem evidência, fica a data que o sitemap já publicava (2026-05-15).
  '/': { publishedAt: '2026-05-15', updatedAt: '2026-09-23' },
  '/llms.txt': { publishedAt: '2026-05-15', updatedAt: '2026-09-23' },
  '/pricing.md': { publishedAt: '2026-05-15', updatedAt: '2026-09-23' },
  '/termos': { publishedAt: '2026-05-15', updatedAt: '2026-09-23' },
  '/privacidade': { publishedAt: '2026-05-05', updatedAt: '2026-05-05' },
  '/quem-somos': { publishedAt: '2026-05-15', updatedAt: '2026-09-23' },
  '/suporte': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/espelhar-grupos-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-02' },
  '/bot-ofertas-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-08-19' },
  '/automacao-whatsapp-afiliados': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  // LPs de dor: o bloco de recursos (Features.jsx) passou a dizer 6 lojas em 18/09.
  '/bot-ofertas-afiliados-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/automatizar-divulgacao-em-grupos-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/escalar-grupos-ofertas-sem-equipe': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/padronizar-divulgacao-afiliado-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/aumentar-conversao-em-grupos-de-cupons': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/consistencia-postagens-em-grupos': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/reduzir-tempo-operacional-em-grupos-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/organizar-calendario-de-ofertas-no-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/melhorar-alcance-em-grupos-de-promocoes': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/rastrear-resultados-de-divulgacao-em-grupos': { publishedAt: '2026-05-15', updatedAt: '2026-09-18' },
  '/bot-ofertas-restaurantes-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  '/bot-ofertas-marketplace-whatsapp': { publishedAt: '2026-05-15', updatedAt: '2026-05-15' },
  // As 10 comparações de 17/09 (data que o registro já publicava).
  '/alternativas/divulgador-inteligente': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/divulgalinks': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/lumi-ofertas-inteligentes': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/busqy': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/afilira': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/ia-divulgadora': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/divulga-ninja': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/shark': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/afiliado-inteligente': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
  '/alternativas/afilimais': { publishedAt: '2026-09-17', updatedAt: '2026-09-17' },
}

export function formatDatePtBr(date) {
  const [year, month, day] = String(date).split('-')
  return `${day}/${month}/${year}`
}

export function getEditorialDates(slug) {
  return EDITORIAL_DATES[slug] ?? { publishedAt: '2026-05-15', updatedAt: '2026-05-15' }
}

export function buildArticleJsonLd({ title, description, slug, siteUrl, faq = [], type = 'Article', author, image }) {
  const dates = getEditorialDates(slug)
  const resolvedAuthor = author
    ? {
        '@type': author.type ?? 'Person',
        // Mesmo `@id` do Person em layout.js (`founder`): liga a autoria do
        // post à MESMA entidade fundadora, não a um nó solto por artigo.
        ...(author.idPath ? { '@id': `${siteUrl}${author.idPath}` } : {}),
        name: author.name,
        description: author.description,
        ...(author.idPath ? { url: `${siteUrl}${author.idPath}` } : {}),
        ...(author.photoPath ? { image: `${siteUrl}${author.photoPath}` } : {}),
        ...(author.sameAs ? { sameAs: author.sameAs } : {}),
      }
    : { '@type': 'Organization', name: EDITORIAL_AUTHOR, description: EDITORIAL_AUTHOR_DESCRIPTION }
  const article = {
    '@context': 'https://schema.org',
    '@type': type,
    headline: title,
    description,
    author: resolvedAuthor,
    publisher: { '@type': 'Organization', name: 'Espelha Grupos', logo: { '@type': 'ImageObject', url: `${siteUrl}/botinho-logo.svg` } },
    // Imagem de destaque do post (2026-09-21) — Google recomenda `image` em
    // Article/BlogPosting para elegibilidade a rich results; sem ela o card
    // de busca e a citação por IA saem sem nenhuma imagem do artigo em si
    // (só o og:image genérico da home, quando presente).
    ...(image?.path ? { image: `${siteUrl}${image.path}` } : {}),
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
