import { TEMPLATE_OPTIONS } from './mobileOfferComposer.js'
import { api } from './api.js'

// Cache local (offline-first). A fonte de verdade agora é o backend
// (BotConfig.mobileTemplatesJson); o localStorage só acelera o primeiro
// render e segura edições quando a rede falha. Na primeira carga, se o
// servidor estiver vazio mas houver dados locais, migramos para o servidor.
const STORAGE_KEY = 'wabot.mobile.templates.v1'

export const PRESET_TEMPLATE_BODIES = {
  simples: '🛍️ {produto}\n\n~De {preço_de}~\n💥 *Por {preço}*\n\n🛒 Compre aqui 👉 {link}',
  achadinho: '✨ Achadinho do dia\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  relampago: '⚡ Oferta relâmpago\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  tech: '🔌 Achado tech\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  beleza: '💄 Oferta de beleza\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
}

const EMPTY_STORE = { overrides: {}, custom: [] }

function normalizeStore(raw) {
  const overrides = raw && typeof raw.overrides === 'object' && raw.overrides ? raw.overrides : {}
  const custom = Array.isArray(raw?.custom) ? raw.custom.filter((t) => t && t.key) : []
  return { overrides: { ...overrides }, custom: custom.map((t) => ({ key: t.key, name: t.name, body: t.body })) }
}

function isEmptyStore(store) {
  return Object.keys(store.overrides || {}).length === 0 && (store.custom || []).length === 0
}

function readLocalStore() {
  if (typeof window === 'undefined') return { ...EMPTY_STORE }
  try {
    return normalizeStore(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    return { ...EMPTY_STORE }
  }
}

function writeLocalStore(store) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStore(store))) } catch {}
}

function parseServerStore(config) {
  try {
    return normalizeStore(JSON.parse(config?.mobileTemplatesJson || '{}'))
  } catch {
    return { ...EMPTY_STORE }
  }
}

// Render imediato (sync) a partir de um store já em mãos. A página deve, em
// seguida, chamar loadTemplateStore() para reconciliar com o servidor.
export function composeTemplates(store = readLocalStore()) {
  const normalized = normalizeStore(store)
  const presets = TEMPLATE_OPTIONS.map((t) => ({
    ...t,
    body: normalized.overrides[t.key] ?? PRESET_TEMPLATE_BODIES[t.key] ?? t.preview,
    isCustom: false,
    isOverridden: !!normalized.overrides[t.key],
  }))
  return [
    ...presets,
    ...normalized.custom.map((t) => ({ ...t, isCustom: true, isOverridden: false })),
  ]
}

// Compat: carga síncrona só do cache local (fallback de render instantâneo).
export function loadAllTemplates() {
  return composeTemplates(readLocalStore())
}

// Store bruto do cache local (para inicializar estado antes do fetch).
export function readLocalTemplateStore() {
  return readLocalStore()
}

// Carrega do servidor, reconcilia com o cache e migra dados locais legados.
// Retorna o objeto store normalizado ({ overrides, custom }).
export async function loadTemplateStore() {
  const local = readLocalStore()
  try {
    const config = await api.getConfig()
    const server = parseServerStore(config)
    if (isEmptyStore(server) && !isEmptyStore(local)) {
      // Migração one-shot: usuário tinha modelos só no navegador.
      await persistTemplateStore(local)
      return local
    }
    writeLocalStore(server)
    return server
  } catch {
    return local
  }
}

// Persiste no servidor + atualiza o cache local. O cache é gravado primeiro
// para não perder a edição caso a chamada de rede falhe.
export async function persistTemplateStore(store) {
  const normalized = normalizeStore(store)
  writeLocalStore(normalized)
  await api.saveConfig({ mobileTemplatesJson: JSON.stringify(normalized) })
  return normalized
}

// Mutadores puros — recebem o store atual e devolvem o próximo.
export function withPresetBody(store, key, body) {
  const s = normalizeStore(store)
  return { ...s, overrides: { ...s.overrides, [key]: body } }
}

export function withoutPresetBody(store, key) {
  const s = normalizeStore(store)
  const overrides = { ...s.overrides }
  delete overrides[key]
  return { ...s, overrides }
}

export function withNewCustomTemplate(store, { name, body }) {
  const s = normalizeStore(store)
  const key = `tpl_${Date.now()}`
  return { store: { ...s, custom: [...s.custom, { key, name, body }] }, key }
}

export function withUpdatedCustomTemplate(store, key, { name, body }) {
  const s = normalizeStore(store)
  return { ...s, custom: s.custom.map((t) => (t.key === key ? { ...t, name, body } : t)) }
}

export function withoutCustomTemplate(store, key) {
  const s = normalizeStore(store)
  return { ...s, custom: s.custom.filter((t) => t.key !== key) }
}
