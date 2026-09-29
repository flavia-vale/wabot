/**
 * Funil da campanha Canais + Preservação (`utm_campaign=canais-preservacao`) —
 * montagem PURA, sem banco.
 *
 * Responde as três perguntas do P1 do backlog pós-P3
 * (docs/marketing/canais-antiban/backlog-pos-p3-prioridades.md):
 *   - qual página trouxe lead?          → `byPage`
 *   - qual CTA gerou cadastro?          → `signupsByCta` + `ctaClicks`
 *   - qual faixa de risco converte melhor? → `bands`
 *
 * Usado pela rota `GET /api/admin/marketing/campanha-canais` (tela
 * /admin/marketing-growth) e pelo `scripts/diag-funil-antiban.mjs`. Um lugar só
 * para os dois não discordarem.
 *
 * ⚠️ Atribuição é aproximação: visita e clique são anônimos (não dá para ligar
 * uma visita a um cadastro específico). As etapas são CONTAGENS por página no
 * período, não a mesma pessoa andando pelo funil. O cadastro é ligado à página
 * pela página de entrada (primeiro toque) ou pela UTM da campanha no /login.
 */

import { landingPath } from '../signup/entryUtm.js'

export const CAMPAIGN = 'canais-preservacao'

// As 8 rotas da campanha. As três com o nome antigo no endereço redirecionam
// (LEGACY_ROUTE_REDIRECTS em dashboard/next.config.mjs); o evento chega com o
// endereço novo, mas um cadastro antigo pode ter o velho na página de entrada.
export const CAMPAIGN_PAGES = [
  { path: '/bot-canais-whatsapp', label: 'Landing Canais' },
  { path: '/diagnostico-antiban-whatsapp', label: 'Diagnóstico' },
  { path: '/materiais/checklist-antiban-whatsapp', label: 'Checklist' },
  { path: '/ferramentas/calculadora-risco-whatsapp', label: 'Calculadora de risco' },
  { path: '/bot-comum-vs-espelha-grupos', label: 'Bot comum vs Espelha Grupos', legacy: '/bot-comum-vs-botinho' },
  { path: '/faq-antiban-whatsapp', label: 'FAQ anti-ban' },
  { path: '/como-funciona-espelha-grupos-canais', label: 'Como funciona em canais', legacy: '/como-funciona-botinho-canais' },
  { path: '/protecao-antiban-espelha-grupos', label: 'Proteção em camadas', legacy: '/protecao-antiban-botinho' },
]

export const CAMPAIGN_EVENTS = [
  'organic_page_view',
  'organic_cta_click',
  'diagnostic_result_viewed',
  'diagnostic_form_submitted',
  'diagnostic_cta_clicked',
]

export const CALCULATOR_ORIGIN = 'calculadora_risco_whatsapp'
export const MAX_RANGE_DAYS = 90
export const DEFAULT_RANGE_DAYS = 30
// Teto das linhas agregadas que a consulta devolve. O GROUP BY roda no SQLite;
// isto só limita o que atravessa para o Node.
export const ROW_LIMIT = 2000

const STEP_KEYS = ['views', 'ctaClicks', 'diagnosticViewed', 'diagnosticSubmitted', 'calculatorClicks', 'signups']

export const STEP_LABELS = {
  views: 'Visitas',
  ctaClicks: 'Cliques em botão',
  diagnosticViewed: 'Viram o resultado do diagnóstico',
  diagnosticSubmitted: 'Enviaram o diagnóstico',
  calculatorClicks: 'Cliques da calculadora',
  signups: 'Cadastros',
}

/** Janela de datas limitada a 90 dias (padrão 30). */
export function boundedRange(query = {}, now = new Date()) {
  const to = query.to ? new Date(query.to) : now
  const safeTo = Number.isNaN(to.getTime()) || to > now ? now : to
  const fallbackFrom = new Date(safeTo.getTime() - DEFAULT_RANGE_DAYS * 864e5)
  const from = query.from ? new Date(query.from) : fallbackFrom
  const minFrom = new Date(safeTo.getTime() - MAX_RANGE_DAYS * 864e5)
  let safeFrom = Number.isNaN(from.getTime()) ? fallbackFrom : from
  if (safeFrom < minFrom) safeFrom = minFrom
  if (safeFrom > safeTo) safeFrom = fallbackFrom
  return { from: safeFrom, to: safeTo }
}

const byPath = new Map()
for (const page of CAMPAIGN_PAGES) {
  byPath.set(page.path, page.path)
  if (page.legacy) byPath.set(page.legacy, page.path)
}

/** Rota canônica da campanha para um caminho qualquer (ou null). */
export function campaignPage(path) {
  const clean = landingPath(path)
  return byPath.get(clean) || null
}

const str = (v, fallback = '') => {
  const s = String(v ?? '').trim()
  return s || fallback
}

function emptySteps() {
  return Object.fromEntries(STEP_KEYS.map((k) => [k, 0]))
}

function bump(map, key, seed, step, n) {
  if (!map.has(key)) map.set(key, { ...seed, ...emptySteps() })
  map.get(key)[step] += n
}

/**
 * Passo do funil para uma linha de evento público agregada.
 * @returns {string|null}
 */
export function stepForEvent(row) {
  switch (row.event) {
    case 'organic_page_view': return 'views'
    case 'organic_cta_click': return 'ctaClicks'
    case 'diagnostic_result_viewed': return 'diagnosticViewed'
    case 'diagnostic_form_submitted': return 'diagnosticSubmitted'
    case 'diagnostic_cta_clicked': return str(row.origin) === CALCULATOR_ORIGIN ? 'calculatorClicks' : null
    default: return null
  }
}

function pct(part, total) {
  return total ? Math.round((part / total) * 1000) / 10 : 0
}

function sortTop(map, limit, key = 'signups') {
  return [...map.values()]
    .sort((a, b) => (b[key] - a[key]) || (b.views - a.views) || (b.ctaClicks - a.ctaClicks))
    .slice(0, limit)
}

/**
 * @param {object} input
 * @param {Array<object>} input.eventRows linhas agregadas: {event, page, origin, cta, cta_destination, band, entry_utm_source, entry_utm_campaign, entry_utm_content, total}
 * @param {Array<object>} input.signupRows linhas agregadas de signup_created: {landing_page, source, utm_source, utm_campaign, utm_content, entry_utm_source, entry_utm_campaign, entry_utm_content, diagnostic_score_band, risk_score_band, segmento, total}
 */
export function buildCampaignFunnel({ eventRows = [], signupRows = [], from = null, to = null, rowLimit = ROW_LIMIT } = {}) {
  const pages = new Map(CAMPAIGN_PAGES.map((p) => [p.path, { page: p.path, label: p.label, ...emptySteps() }]))
  const utm = new Map()
  const ctas = new Map()
  const bands = new Map()
  const signupsByCta = new Map()
  const segmentos = new Map()
  const sources = new Map()
  const totals = emptySteps()

  for (const row of eventRows) {
    const step = stepForEvent(row)
    const page = campaignPage(row.page)
    const n = Number(row.total || 0)
    if (!step || !page || !n) continue

    totals[step] += n
    pages.get(page)[step] += n

    const source = str(row.entry_utm_source, '(sem utm)')
    const campaign = str(row.entry_utm_campaign, '(sem utm)')
    const content = str(row.entry_utm_content, '-')
    bump(utm, `${source}|${campaign}|${content}`, { utm_source: source, utm_campaign: campaign, utm_content: content }, step, n)

    if (row.event === 'organic_cta_click') {
      const cta = str(row.cta, '(sem nome)')
      const destination = str(row.cta_destination, '-')
      const key = `${page}|${cta}|${destination}`
      if (!ctas.has(key)) ctas.set(key, { page, cta, destination, clicks: 0 })
      ctas.get(key).clicks += n
    }

    const band = str(row.band)
    if (band && (step === 'diagnosticViewed' || step === 'diagnosticSubmitted' || step === 'calculatorClicks')) {
      const kind = step === 'calculatorClicks' ? 'calculadora' : 'diagnóstico'
      bump(bands, `${kind}|${band}`, { kind, band }, step, n)
    }
  }

  for (const row of signupRows) {
    const n = Number(row.total || 0)
    if (!n) continue
    const page = campaignPage(row.landing_page)
    const fromCampaign = str(row.utm_campaign) === CAMPAIGN || str(row.entry_utm_campaign) === CAMPAIGN
    const diagBand = str(row.diagnostic_score_band)
    const riskBand = str(row.risk_score_band)
    if (!page && !fromCampaign && !diagBand && !riskBand) continue

    totals.signups += n
    if (page) pages.get(page).signups += n

    const source = str(row.entry_utm_source, '(sem utm)')
    const campaign = str(row.entry_utm_campaign, '(sem utm)')
    const content = str(row.entry_utm_content, '-')
    bump(utm, `${source}|${campaign}|${content}`, { utm_source: source, utm_campaign: campaign, utm_content: content }, 'signups', n)

    // CTA que levou ao cadastro = utm_content do link de /login (hero,
    // resultado_alto, p2_signup_faq-antiban-whatsapp...).
    const cta = str(row.utm_content, '(sem utm_content)')
    signupsByCta.set(cta, (signupsByCta.get(cta) || 0) + n)

    if (diagBand) bump(bands, `diagnóstico|${diagBand}`, { kind: 'diagnóstico', band: diagBand }, 'signups', n)
    if (riskBand) bump(bands, `calculadora|${riskBand}`, { kind: 'calculadora', band: riskBand }, 'signups', n)

    const seg = str(row.segmento, '(não informado)')
    segmentos.set(seg, (segmentos.get(seg) || 0) + n)
    const src = str(row.source || row.utm_source, '(sem source)')
    sources.set(src, (sources.get(src) || 0) + n)
  }

  const byPage = [...pages.values()].map((row) => ({ ...row, ctaRate: pct(row.ctaClicks, row.views), signupRate: pct(row.signups, row.views) }))
  const bandRows = [...bands.values()]
    .map((row) => {
      const base = row.kind === 'calculadora' ? row.calculatorClicks : (row.diagnosticSubmitted || row.diagnosticViewed)
      return { ...row, signupRate: pct(row.signups, base) }
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || b.signups - a.signups)
  const toList = (map, limit = 20) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([key, signups]) => ({ key, signups }))

  return {
    campaign: CAMPAIGN,
    from,
    to,
    steps: STEP_KEYS.map((key) => ({ key, label: STEP_LABELS[key], count: totals[key] })),
    totals,
    byPage,
    byUtm: sortTop(utm, 30),
    ctaClicks: [...ctas.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 30),
    signupsByCta: toList(signupsByCta),
    bands: bandRows,
    segmentos: toList(segmentos),
    signupSources: toList(sources),
    // Se a consulta bateu no teto, o total pode estar subestimado.
    truncated: eventRows.length >= rowLimit || signupRows.length >= rowLimit,
  }
}
