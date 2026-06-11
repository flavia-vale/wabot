const LEGACY_TEMPLATE_VARIABLES = [
  ['{{greeting}}', '{{gancho}}'],
  ['{{trailer}}', '{{convitegrupo}}'],
]

export function canonicalizeTemplateBody(body) {
  if (typeof body !== 'string') return body
  return LEGACY_TEMPLATE_VARIABLES.reduce(
    (result, [legacy, canonical]) => result.replaceAll(legacy, canonical),
    body,
  )
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
