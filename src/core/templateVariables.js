const LEGACY_TEMPLATE_VARIABLES = [
  ['{{greeting}}', '{{gancho}}'],
  ['{{trailer}}', '{{convitegrupo}}'],
]

// specs/017-client-coupon-catalog (US4, FR-019/FR-020): {linhaDeCupom} sai do
// produto — substituída por {cupom}, resolvido só no envio. Sem migration de
// banco (data-model.md): a saída acontece na LEITURA, aqui, para as duas
// superfícies que consomem canonicalizeTemplateStore (tela de templates e
// worker). Remove a linha inteira quando o token ocupa a linha sozinho (não
// deixa lacuna); se estiver colado a outro texto na mesma linha, remove só o
// token. NÃO mexe em extractCouponLine (src/core/mirrorTemplate.js) — ela
// continua sendo o delimitador de extractTextPrice/{preçoDoTexto} (Trava #1).
const LINHA_DE_CUPOM_LINE_RE = /^[ \t]*\{linhaDeCupom\}[ \t]*(?:\r?\n|$)/gm
const LINHA_DE_CUPOM_INLINE_RE = /\{linhaDeCupom\}/g

export function canonicalizeTemplateBody(body) {
  if (typeof body !== 'string') return body
  const withLegacyAliases = LEGACY_TEMPLATE_VARIABLES.reduce(
    (result, [legacy, canonical]) => result.replaceAll(legacy, canonical),
    body,
  )
  return withLegacyAliases
    .replace(LINHA_DE_CUPOM_LINE_RE, '')
    .replace(LINHA_DE_CUPOM_INLINE_RE, '')
}

export function canonicalizeTemplateStore(store) {
  if (!store || typeof store !== 'object' || Array.isArray(store)) return store
  const overrides = store.overrides && typeof store.overrides === 'object' && !Array.isArray(store.overrides)
    ? Object.fromEntries(Object.entries(store.overrides).map(([key, body]) => [key, canonicalizeTemplateBody(body)]))
    : store.overrides
  const custom = Array.isArray(store.custom)
    ? store.custom.map(template => (
      template && typeof template === 'object'
        ? { ...template, body: canonicalizeTemplateBody(template.body) }
        : template
    ))
    : store.custom
  return { ...store, ...(overrides !== undefined && { overrides }), ...(custom !== undefined && { custom }) }
}

export function canonicalizeTemplateStoreJson(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.stringify(canonicalizeTemplateStore(JSON.parse(value)))
  } catch {
    return value
  }
}
