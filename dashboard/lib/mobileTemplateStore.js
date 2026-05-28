import { TEMPLATE_OPTIONS } from './mobileOfferComposer'

const STORAGE_KEY = 'wabot.mobile.templates.v1'

export const PRESET_TEMPLATE_BODIES = {
  achadinho: '✨ Achadinho do dia\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  relampago: '⚡ Oferta relâmpago\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  tech: '🔌 Achado tech\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  beleza: '💄 Oferta de beleza\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
}

function readStore() {
  if (typeof window === 'undefined') return { overrides: {}, custom: [] }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return { overrides: {}, custom: [], ...parsed }
  } catch {
    return { overrides: {}, custom: [] }
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch {}
}

export function loadAllTemplates() {
  const { overrides, custom } = readStore()
  const presets = TEMPLATE_OPTIONS.map((t) => ({
    ...t,
    body: overrides[t.key] ?? PRESET_TEMPLATE_BODIES[t.key] ?? t.preview,
    isCustom: false,
    isOverridden: !!overrides[t.key],
  }))
  return [
    ...presets,
    ...custom.map((t) => ({ ...t, isCustom: true, isOverridden: false })),
  ]
}

export function savePresetBody(key, body) {
  const store = readStore()
  writeStore({ ...store, overrides: { ...store.overrides, [key]: body } })
}

export function resetPresetBody(key) {
  const store = readStore()
  const overrides = { ...store.overrides }
  delete overrides[key]
  writeStore({ ...store, overrides })
}

export function createCustomTemplate({ name, body }) {
  const store = readStore()
  const key = `tpl_${Date.now()}`
  writeStore({ ...store, custom: [...store.custom, { key, name, body }] })
  return key
}

export function updateCustomTemplate(key, { name, body }) {
  const store = readStore()
  writeStore({ ...store, custom: store.custom.map((t) => t.key === key ? { ...t, name, body } : t) })
}

export function deleteCustomTemplate(key) {
  const store = readStore()
  writeStore({ ...store, custom: store.custom.filter((t) => t.key !== key) })
}
