// PR-5.E.2: lint de título de canal e copy template.
// Funções puras — warning, não erro. UI decide se mostra ou bloqueia
// (default: só mostrar, não bloquear).

export const LINT_CODES = Object.freeze({
  BRAND_IMPERSONATION: 'brand_impersonation',
  TITLE_TOO_GENERIC: 'title_too_generic',
  MISLEADING_CLAIM: 'misleading_claim',
})

const BRAND_RE = /amazon|shopee|mercado[\s.]?livre|magalu|aliexpress|shein/i
const ALLOWED_PREFIX_RE = /^\s*(ofertas?\s+de|achados?\s+de)\s+/i
const GENERIC_TITLE_RE = /^(promo|ofertas?|achados?)$/i

const MISLEADING_RES = [
  { re: /\b\d{2,3}\s*%\s*off\b/i, why: 'porcentagem de desconto absoluta ("X% OFF") soa enganoso para muitos classificadores' },
  { re: /[uú]ltima(s)?\s+pe[çc]a(s)?/iu, why: '"última peça" é frase de urgência clássica em spam' },
  { re: /\bclique\s+agora\b/i, why: '"clique agora" é call-to-action agressivo associado a spam' },
]

function warn(code, message) {
  return { code, message, severity: 'warning' }
}

export function lintChannelTitle(title) {
  const warnings = []
  if (typeof title !== 'string') return { warnings }
  const trimmed = title.trim()
  if (!trimmed) return { warnings }

  if (GENERIC_TITLE_RE.test(trimmed)) {
    warnings.push(warn(
      LINT_CODES.TITLE_TOO_GENERIC,
      'Título muito genérico — canais com nome único são menos suspeitos. Ex.: "Ofertas Tech BR".',
    ))
  }

  if (BRAND_RE.test(trimmed) && !ALLOWED_PREFIX_RE.test(trimmed)) {
    warnings.push(warn(
      LINT_CODES.BRAND_IMPERSONATION,
      'O título contém nome de marca sem prefixo de filiação ("Ofertas de…", "Achados de…"). Risco de denúncia por impersonação.',
    ))
  }

  return { warnings }
}

export function lintCopyTemplate(template) {
  const warnings = []
  if (typeof template !== 'string' || !template) return { warnings }

  for (const { re, why } of MISLEADING_RES) {
    if (re.test(template)) {
      warnings.push(warn(LINT_CODES.MISLEADING_CLAIM, `Claim potencialmente enganoso detectado: ${why}.`))
    }
  }

  return { warnings }
}
