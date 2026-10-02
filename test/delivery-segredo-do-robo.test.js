import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTelegramApi, readTelegramSecret } from '../src/delivery/telegram/api.js'

// Feature 017, T042 (FR-016/FR-017): o segredo do robô do Telegram é de
// infraestrutura. Só UM módulo lê a env; nenhuma rota, resposta, erro ou log
// carrega o valor; nenhuma tela pede dado de acesso à cliente.

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SECRET = '123456:SEGREDO-DE-TESTE-abcdef'

function listJs(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      out.push(...listJs(full))
    } else if (/\.(js|mjs)$/.test(entry)) out.push(full)
  }
  return out
}

test('só o cliente do Telegram lê TELEGRAM_BOT_TOKEN do ambiente', () => {
  const readers = [...listJs(path.join(repoRoot, 'src')), ...listJs(path.join(repoRoot, 'dashboard', 'app')), ...listJs(path.join(repoRoot, 'dashboard', 'lib'))]
    .filter((file) => /TELEGRAM_BOT_TOKEN/.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(repoRoot, file))
  assert.deepEqual(readers, [path.join('src', 'delivery', 'telegram', 'api.js')])
})

test('a tela não pede nem mostra dado de acesso do robô', () => {
  const dir = path.join(repoRoot, 'dashboard', 'app', 'painel', 'aplicativos')
  for (const file of listJs(dir)) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /<input|<textarea/i, `${file}: a cliente não digita nada para ligar o Telegram`)
    assert.doesNotMatch(src, /\b(token|chat_id|webhook|Bot API)\b/i, file)
  }
})

test('erro de rede ou recusa do Telegram nunca carrega o segredo', async () => {
  const failing = createTelegramApi({ secret: SECRET, fetchImpl: async (url) => { throw new Error(`connect ECONNREFUSED ${url}`) } })
  await assert.rejects(failing.getMe(), (err) => !String(err.message).includes(SECRET) && !JSON.stringify(err).includes(SECRET))

  const refusing = createTelegramApi({ secret: SECRET, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized' }) }) })
  await assert.rejects(refusing.getMe(), (err) => err.errorCode === 401 && !String(err.message).includes(SECRET))
})

test('sem segredo, nada liga', () => {
  assert.equal(readTelegramSecret({}), null)
  assert.equal(readTelegramSecret({ TELEGRAM_BOT_TOKEN: '  ' }), null)
  assert.throws(() => createTelegramApi({ secret: null }))
})
