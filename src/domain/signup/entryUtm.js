/**
 * UTM da ENTRADA (primeiro toque) e campos da campanha Canais + Preservação —
 * regra PURA, sem banco.
 *
 * Por que existe (2026-09-29, P1 da campanha canais-antiban):
 * - O link do post (`/bot-canais-whatsapp?utm_source=instagram&utm_content=post3`)
 *   só é lido na primeira página. Os CTAs internos levam para o /login com a UTM
 *   DA PÁGINA (`utm_source=seo`), e o `landing_page` que guarda a original é
 *   saneado (`?`, `=` e `&` viram `-`) e depois cortado em 80 caracteres pelo
 *   `sanitizeAnalyticsMetadata` — o `utm_content` do post se perdia. Aqui a UTM
 *   de entrada é extraída ANTES do corte e gravada em campos próprios
 *   (`entry_utm_*`), curtos.
 * - `diagnostic_score_band`, `risk_score_band` e `segmento` chegavam ao /login
 *   pela URL do diagnóstico/calculadora/checklist e eram descartados — nunca
 *   alcançavam o `signup_created`. Sem eles não dá para responder "qual faixa
 *   de risco converte melhor?".
 *
 * A MESMA regra de leitura existe no navegador (`readEntryUtm` em
 * dashboard/lib/marketing-attribution.js): src/ não importa dashboard/lib
 * (dependency-cruiser). `test/campanha-canais-funil.test.js` compara as duas.
 */

export const ENTRY_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']

// Parâmetros que podem vir depois de um utm_* na página de entrada. Servem de
// "fim do valor" no formato saneado, em que não sobra `&` para separar.
const STOP_KEYS = '(?:utm_[a-z]+|fbclid|gclid|gbraid|wbraid|ref|source|aff|mode|email)'

function cleanValue(value, max = 64) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max)
}

/**
 * Lê a UTM da página de entrada. Aceita a URL crua (`/x?utm_source=a`) e o
 * formato saneado do cookie de primeiro toque (`/x-utm_source-a`).
 * @returns {{entry_utm_source?: string, entry_utm_medium?: string, entry_utm_campaign?: string, entry_utm_content?: string}}
 */
export function parseEntryUtm(landing) {
  const raw = String(landing ?? '').slice(0, 500)
  const out = {}
  if (!raw) return out

  const q = raw.indexOf('?')
  if (q !== -1) {
    const params = new URLSearchParams(raw.slice(q + 1))
    for (const key of ENTRY_UTM_KEYS) {
      const value = cleanValue(params.get(key))
      if (value) out[`entry_${key}`] = value
    }
    return out
  }

  for (const key of ENTRY_UTM_KEYS) {
    const match = raw.match(new RegExp(`-${key}-(.+?)(?=-${STOP_KEYS}-|$)`))
    const value = match ? cleanValue(match[1]) : ''
    if (value) out[`entry_${key}`] = value
  }
  return out
}

/** Caminho da página de entrada sem a querystring (crua ou saneada). */
export function landingPath(landing) {
  const raw = String(landing ?? '').split('?')[0]
  const cut = raw.search(new RegExp(`-${STOP_KEYS}-`))
  const path = (cut === -1 ? raw : raw.slice(0, cut)).replace(/\/+$/, '')
  return path || (raw.startsWith('/') ? '/' : '')
}

// Faixas conhecidas hoje (PreservationDiagnostic.jsx / risk-calculator). Valor
// fora do formato é descartado em vez de gravado: é texto que veio da URL.
const BAND_RE = /^[a-z][a-z0-9_-]{0,31}$/
const SEGMENTO_RE = /^[a-z][a-z0-9-]{0,47}$/

/**
 * Campos da campanha que o /login repassa ao cadastro. Só entram valores
 * curtos e no formato esperado — nada de texto livre da URL no banco.
 */
export function campaignSignupFields(body = {}) {
  const out = {}
  const diag = cleanValue(body.diagnostic_score_band, 32)
  const risk = cleanValue(body.risk_score_band, 32)
  const seg = cleanValue(body.segmento, 48)
  if (BAND_RE.test(diag)) out.diagnostic_score_band = diag
  if (BAND_RE.test(risk)) out.risk_score_band = risk
  if (SEGMENTO_RE.test(seg)) out.segmento = seg
  return out
}
