import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, open, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'

// Mantém a chave abaixo do maxParamLength padrão (100) do router Fastify.
const KEY_RE = /^[a-f0-9]{24}-[a-f0-9-]{36}-([0-9]{10,13})\.jpg$/

function baseUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' && process.env.NODE_ENV !== 'test') throw new Error('STORY_ASSET_PUBLIC_BASE_URL deve usar HTTPS')
  return url.toString().replace(/\/$/, '')
}

function signature(secret, key, expires) {
  return createHmac('sha256', secret).update(`${key}:${expires}`).digest('hex')
}

function safeKey(key) {
  const normalized = String(key || '')
  if (!KEY_RE.test(normalized) || path.basename(normalized) !== normalized) throw new TypeError('storageKey inválida')
  return normalized
}

export function createLocalStoryAssetStorage({ directory, publicBaseUrl, signingSecret, now = () => Date.now() } = {}) {
  if (!directory) throw new Error('diretório do storage obrigatório')
  if (!signingSecret || String(signingSecret).length < 32) throw new Error('segredo de assinatura deve ter ao menos 32 caracteres')
  const root = path.resolve(directory)
  const publicBase = baseUrl(publicBaseUrl)

  return Object.freeze({
    async put(buffer, { expiresAt } = {}) {
      if (!Buffer.isBuffer(buffer) || !buffer.length) throw new TypeError('asset deve ser um Buffer não vazio')
      const expiry = new Date(expiresAt)
      if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now()) throw new TypeError('expiresAt deve estar no futuro')
      const hash = createHash('sha256').update(buffer).digest('hex')
      const expirySeconds = Math.floor(expiry.getTime() / 1000)
      const key = `${hash.slice(0, 24)}-${randomUUID()}-${expirySeconds}.jpg`
      await mkdir(root, { recursive: true, mode: 0o750 })
      const handle = await open(path.join(root, key), 'wx', 0o640)
      try { await handle.writeFile(buffer) } finally { await handle.close() }
      return Object.freeze({ storageKey: key, contentHash: hash, byteSize: buffer.length, expiresAt: expiry })
    },

    signedUrl(key, expiresAt) {
      const normalized = safeKey(key)
      const expires = Math.floor(new Date(expiresAt).getTime() / 1000)
      if (!Number.isSafeInteger(expires) || expires * 1000 <= now()) throw new TypeError('URL do asset já expirou')
      const sig = signature(signingSecret, normalized, expires)
      return `${publicBase}/${encodeURIComponent(normalized)}?expires=${expires}&signature=${sig}`
    },

    async openSigned(key, { expires, signature: suppliedSignature } = {}) {
      const normalized = safeKey(key)
      const expiry = Number(expires)
      if (!Number.isSafeInteger(expiry) || expiry * 1000 <= now()) throw Object.assign(new Error('asset expirado'), { code: 'ASSET_EXPIRED' })
      const expected = signature(signingSecret, normalized, expiry)
      const supplied = String(suppliedSignature || '')
      if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw Object.assign(new Error('assinatura inválida'), { code: 'INVALID_SIGNATURE' })
      const file = path.join(root, normalized)
      const info = await stat(file)
      return Object.freeze({ file, byteSize: info.size, expiresAt: new Date(expiry * 1000) })
    },

    async remove(key) {
      await rm(path.join(root, safeKey(key)), { force: true })
    },

    async cleanup({ olderThan = new Date(now()) } = {}) {
      await mkdir(root, { recursive: true, mode: 0o750 })
      const threshold = Math.floor(new Date(olderThan).getTime() / 1000)
      let removed = 0
      for (const entry of await readdir(root, { withFileTypes: true })) {
        if (!entry.isFile() || !KEY_RE.test(entry.name)) continue
        const expires = Number(entry.name.match(KEY_RE)?.[1])
        if (expires <= threshold) { await rm(path.join(root, entry.name), { force: true }); removed++ }
      }
      return { removed }
    },
  })
}

export function createStoryAssetStorageFromEnv(env = process.env) {
  const publicBaseUrl = String(env.STORY_ASSET_PUBLIC_BASE_URL || '').trim()
  const signingSecret = String(env.STORY_ASSET_SIGNING_SECRET || '').trim()
  if (!publicBaseUrl && !signingSecret) return null
  if (!publicBaseUrl || !signingSecret) throw new Error('STORY_ASSET_PUBLIC_BASE_URL e STORY_ASSET_SIGNING_SECRET devem ser configurados juntos')
  return createLocalStoryAssetStorage({
    directory: String(env.STORY_ASSET_DIR || '').trim() || './data/story-assets',
    publicBaseUrl,
    signingSecret,
  })
}
