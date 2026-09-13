import { createHash } from 'node:crypto'

export const STORY_WIDTH = 1080
export const STORY_HEIGHT = 1920
export const STORY_MIME_TYPE = 'image/jpeg'
export const STORY_TEMPLATE_SCHEMA_VERSION = 1

export const DEFAULT_STORY_TEMPLATE = Object.freeze({
  schemaVersion: STORY_TEMPLATE_SCHEMA_VERSION,
  key: 'wabot_classic',
  version: 1,
  background: '#F5F1E8',
  panel: '#FFFFFF',
  text: '#16231B',
  accent: '#F97316',
  muted: '#6B746E',
  product: { left: 90, top: 250, width: 900, height: 900 },
  title: { left: 90, top: 1200, width: 900, fontSize: 58, maxLines: 3 },
})

const COLOR_RE = /^#[0-9a-f]{6}$/i

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new TypeError(`${name} inválido`)
  return value
}

export function normalizeStoryTemplate(input = DEFAULT_STORY_TEMPLATE) {
  const value = structuredClone(input)
  if (value.schemaVersion !== STORY_TEMPLATE_SCHEMA_VERSION) throw new TypeError('schemaVersion de template incompatível')
  for (const name of ['background', 'panel', 'text', 'accent', 'muted']) {
    if (!COLOR_RE.test(value[name] || '')) throw new TypeError(`${name} deve ser uma cor hexadecimal`)
  }
  const product = value.product || {}
  const title = value.title || {}
  const normalized = {
    schemaVersion: STORY_TEMPLATE_SCHEMA_VERSION,
    key: String(value.key || '').trim(),
    version: integer(value.version, 'version', 1, 1_000_000),
    background: value.background,
    panel: value.panel,
    text: value.text,
    accent: value.accent,
    muted: value.muted,
    product: {
      left: integer(product.left, 'product.left', 0, STORY_WIDTH),
      top: integer(product.top, 'product.top', 0, STORY_HEIGHT),
      width: integer(product.width, 'product.width', 1, STORY_WIDTH),
      height: integer(product.height, 'product.height', 1, STORY_HEIGHT),
    },
    title: {
      left: integer(title.left, 'title.left', 0, STORY_WIDTH),
      top: integer(title.top, 'title.top', 0, STORY_HEIGHT),
      width: integer(title.width, 'title.width', 1, STORY_WIDTH),
      fontSize: integer(title.fontSize, 'title.fontSize', 20, 100),
      maxLines: integer(title.maxLines, 'title.maxLines', 1, 4),
    },
  }
  if (!normalized.key) throw new TypeError('key obrigatório')
  if (normalized.product.left + normalized.product.width > STORY_WIDTH || normalized.product.top + normalized.product.height > STORY_HEIGHT) throw new TypeError('área do produto sai do canvas')
  if (normalized.title.left + normalized.title.width > STORY_WIDTH || normalized.title.top > STORY_HEIGHT - 100) throw new TypeError('área do título sai do canvas')
  return Object.freeze(normalized)
}

export function storyTemplateHash(template) {
  return createHash('sha256').update(JSON.stringify(normalizeStoryTemplate(template))).digest('hex')
}
