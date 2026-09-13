import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('schema persiste todas as entidades e invariantes das fases 2–4', async () => {
  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
  for (const model of ['Destination', 'InstagramConnection', 'StoryTemplate', 'StoryTemplateVersion', 'RenderedAsset', 'StoryPublication', 'StoryPublicationAttempt']) {
    assert.match(schema, new RegExp(`model ${model} \\{`))
  }
  assert.match(schema, /@@unique\(\[scopeKey, key\]\)/)
  assert.match(schema, /idempotencyKey\s+String\s+@unique/)
  assert.match(schema, /encryptedToken\s+String/)
  assert.doesNotMatch(schema, /accessToken\s+String/)
  assert.match(schema, /whatsappEnabled\s+Boolean\s+@default\(true\)/)
})
