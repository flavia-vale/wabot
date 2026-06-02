import { api } from './api.js'

// Fonte de verdade: backend (BotConfig.mobileCouponLinksJson).
// localStorage vira cache offline + origem de migração one-shot da chave
// legada que só guardava os links (sem o CTA).
const STORAGE_KEY = 'wabot.mobile.offer.couponPrefs.v1'
const LEGACY_LINKS_KEY = 'wabot.mobile.offer.couponLinks.v1'

export const DEFAULT_COUPON_LINKS = { shopee: '', mercadolivre: '', amazon: '', magazineluiza: '' }
export const DEFAULT_COUPON_CTA = '🎟 Mais cupons da {loja}:'

function normalizePrefs(raw) {
  const links = raw && typeof raw.links === 'object' && raw.links ? raw.links : {}
  const cta = typeof raw?.cta === 'string' && raw.cta.trim() ? raw.cta : DEFAULT_COUPON_CTA
  return { links: { ...DEFAULT_COUPON_LINKS, ...links }, cta }
}

function isEmptyPrefs(prefs) {
  const noLinks = Object.values(prefs.links || {}).every((v) => !String(v || '').trim())
  return noLinks && (!prefs.cta || prefs.cta === DEFAULT_COUPON_CTA)
}

function readLegacyLinks() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LEGACY_LINKS_KEY)
    if (!raw) return null
    return normalizePrefs({ links: JSON.parse(raw) })
  } catch {
    return null
  }
}

function readLocalPrefs() {
  if (typeof window === 'undefined') return normalizePrefs({})
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizePrefs(JSON.parse(raw))
  } catch {}
  return readLegacyLinks() || normalizePrefs({})
}

function writeLocalPrefs(prefs) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePrefs(prefs))) } catch {}
}

function parseServerPrefs(config) {
  try {
    return normalizePrefs(JSON.parse(config?.mobileCouponLinksJson || '{}'))
  } catch {
    return normalizePrefs({})
  }
}

// Carrega do servidor, reconcilia com o cache e migra dados locais legados.
export async function loadCouponPrefs() {
  const local = readLocalPrefs()
  try {
    const config = await api.getConfig()
    const server = parseServerPrefs(config)
    if (isEmptyPrefs(server) && !isEmptyPrefs(local)) {
      await persistCouponPrefs(local)
      return local
    }
    writeLocalPrefs(server)
    return server
  } catch {
    return local
  }
}

// Persiste no servidor + atualiza o cache local (cache primeiro, para não
// perder a edição se a rede falhar).
export async function persistCouponPrefs(prefs) {
  const normalized = normalizePrefs(prefs)
  writeLocalPrefs(normalized)
  await api.saveConfig({ mobileCouponLinksJson: JSON.stringify(normalized) })
  return normalized
}
