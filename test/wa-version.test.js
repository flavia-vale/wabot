import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWaVersion,
  pickCurrentVersionFromRegistry,
  resolveWaWebVersion,
  WA_FAILURE_VERSION_REJECTED,
  WA_VERSION_REGISTRY_URL_DEFAULT,
} from '../src/core/waVersion.js'

test('parseWaVersion aceita as formas que a versão assume na natureza', () => {
  assert.deepEqual(parseWaVersion('2.3000.1044015310'), [2, 3000, 1044015310])
  // O registro real publica tudo com sufixo de canal — sem cortar o sufixo, a
  // versão vigente seria descartada e cairíamos na fonte velha (causa do 405).
  assert.deepEqual(parseWaVersion('2.3000.1044015310-alpha'), [2, 3000, 1044015310])
  assert.deepEqual(parseWaVersion('2, 3000, 1044015310'), [2, 3000, 1044015310])
  assert.deepEqual(parseWaVersion([2, 3000, 1044015310]), [2, 3000, 1044015310])
})

test('parseWaVersion rejeita valor em que não dá para confiar', () => {
  assert.equal(parseWaVersion(''), null)
  assert.equal(parseWaVersion('latest'), null)
  assert.equal(parseWaVersion('2.3000'), null)
  assert.equal(parseWaVersion([2, 3000]), null)
  assert.equal(parseWaVersion(null), null)
  assert.equal(parseWaVersion(undefined), null)
})

test('pickCurrentVersionFromRegistry usa a versão vigente do registro', () => {
  const now = Date.parse('2026-07-28T23:00:00Z')
  const payload = {
    currentVersion: '2.3000.1044015310-alpha',
    versions: [
      { version: '2.3000.1043880044-alpha', released: '2026-07-27T08:05:06Z', expire: '2026-09-27T08:05:06Z' },
      { version: '2.3000.1044015310-alpha', released: '2026-07-28T22:39:05Z', expire: '2026-09-28T22:39:05Z' },
    ],
  }
  assert.deepEqual(pickCurrentVersionFromRegistry(payload, { now }), [2, 3000, 1044015310])
})

test('pickCurrentVersionFromRegistry ignora currentVersion expirada e pega a mais nova viva', () => {
  // Usar build expirada é EXATAMENTE o que produz o failure 405 — se o registro
  // vier com currentVersion vencida, ela não pode ser escolhida.
  const now = Date.parse('2026-07-28T23:00:00Z')
  const payload = {
    currentVersion: '2.3000.1035194821',
    versions: [
      { version: '2.3000.1035194821', released: '2026-05-01T00:00:00Z', expire: '2026-07-01T00:00:00Z' },
      { version: '2.3000.1043880044-alpha', released: '2026-07-27T08:05:06Z', expire: '2026-09-27T08:05:06Z' },
      { version: '2.3000.1044015310-alpha', released: '2026-07-28T22:39:05Z', expire: '2026-09-28T22:39:05Z' },
    ],
  }
  assert.deepEqual(pickCurrentVersionFromRegistry(payload, { now }), [2, 3000, 1044015310])
})

test('pickCurrentVersionFromRegistry devolve null quando não há nada utilizável', () => {
  const now = Date.parse('2026-07-28T23:00:00Z')
  assert.equal(pickCurrentVersionFromRegistry(null, { now }), null)
  assert.equal(pickCurrentVersionFromRegistry({}, { now }), null)
  assert.equal(pickCurrentVersionFromRegistry({ versions: [] }, { now }), null)
  assert.equal(
    pickCurrentVersionFromRegistry(
      { versions: [{ version: '2.3000.1', released: '2026-01-01T00:00:00Z', expire: '2026-02-01T00:00:00Z' }] },
      { now }
    ),
    null
  )
})

test('WA_WEB_VERSION vence tudo — é o botão de emergência sem redeploy', async () => {
  let registryCalled = false
  const got = await resolveWaWebVersion({
    envValue: '2.3000.1044015310',
    fetchRegistry: async () => { registryCalled = true; return {} },
    fetchBaileysVersion: async () => ({ version: [2, 3000, 1035194821] }),
  })
  assert.deepEqual(got, { version: [2, 3000, 1044015310], source: 'env' })
  assert.equal(registryCalled, false, 'com pin manual não deve nem consultar o registro')
})

test('sem pin, usa o registro de versões reais em vez da versão do repo do Baileys', async () => {
  // Este é o coração do fix: o Baileys anunciava 1035194821, versão que não
  // existe na lista real do WA Web, e o WhatsApp respondia failure 405.
  const got = await resolveWaWebVersion({
    envValue: undefined,
    fetchRegistry: async () => ({
      currentVersion: '2.3000.1044015310-alpha',
      versions: [{ version: '2.3000.1044015310-alpha', released: '2026-07-28T22:39:05Z', expire: '2026-09-28T22:39:05Z' }],
    }),
    fetchBaileysVersion: async () => ({ version: [2, 3000, 1035194821] }),
    now: Date.parse('2026-07-28T23:00:00Z'),
  })
  assert.deepEqual(got, { version: [2, 3000, 1044015310], source: 'registry' })
})

test('registro fora do ar cai no Baileys — degrada, não derruba o boot', async () => {
  const got = await resolveWaWebVersion({
    fetchRegistry: async () => { throw new Error('ENETUNREACH') },
    fetchBaileysVersion: async () => ({ version: [2, 3000, 1035194821] }),
  })
  assert.deepEqual(got, { version: [2, 3000, 1035194821], source: 'baileys' })
})

test('registro e Baileys fora do ar caem na última versão boa do processo', async () => {
  const got = await resolveWaWebVersion({
    fetchRegistry: async () => { throw new Error('timeout') },
    fetchBaileysVersion: async () => { throw new Error('timeout') },
    cached: [2, 3000, 1044015310],
  })
  assert.deepEqual(got, { version: [2, 3000, 1044015310], source: 'cache' })
})

test('sem nenhuma fonte, lança em vez de anunciar versão inventada', async () => {
  await assert.rejects(
    () => resolveWaWebVersion({
      fetchRegistry: async () => { throw new Error('x') },
      fetchBaileysVersion: async () => { throw new Error('y') },
      cached: null,
    }),
    /Não foi possível resolver a versão do WhatsApp Web/
  )
})

test('WA_VERSION_REGISTRY_URL vazia desliga a fonte sem quebrar a resolução', async () => {
  let called = false
  const got = await resolveWaWebVersion({
    registryUrl: '',
    fetchRegistry: async () => { called = true; return {} },
    fetchBaileysVersion: async () => ({ version: [2, 3000, 1035194821] }),
  })
  assert.equal(called, false)
  assert.deepEqual(got, { version: [2, 3000, 1035194821], source: 'baileys' })
})

test('WA_WEB_VERSION inválida não trava o boot — segue para as outras fontes', async () => {
  const warns = []
  const got = await resolveWaWebVersion({
    envValue: 'ultima',
    fetchRegistry: async () => { throw new Error('x') },
    fetchBaileysVersion: async () => ({ version: [2, 3000, 1035194821] }),
    logger: { warn: (ctx, msg) => warns.push(msg) },
  })
  assert.equal(got.source, 'baileys')
  assert.equal(warns.length > 0, true, 'valor inválido precisa aparecer no log')
})

test('constantes canônicas', () => {
  assert.equal(WA_FAILURE_VERSION_REJECTED, 405)
  assert.match(WA_VERSION_REGISTRY_URL_DEFAULT, /^https:\/\//)
})
