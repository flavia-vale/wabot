import test from 'node:test'
import assert from 'node:assert/strict'

import { MetaPocError, POC_MODE, createMetaPocClient, parseMetaPocConfig, runMetaStoryPoc } from '../src/instagram/meta/poc.js'

const BASE_ENV = {
  IG_GRAPH_API_VERSION: 'v25.0',
  IG_ACCOUNT_ID: '17841400000000000',
  IG_ACCESS_TOKEN: 'token-super-secreto',
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

test('configuração exige versão pinada, credencial e confirmação explícita do modo', () => {
  assert.equal(parseMetaPocConfig(BASE_ENV).mode, POC_MODE.INSPECT)
  assert.throws(() => parseMetaPocConfig({ ...BASE_ENV, IG_GRAPH_API_VERSION: 'latest' }), /vNN\.N/)
  assert.throws(() => parseMetaPocConfig({ ...BASE_ENV, IG_POC_MODE: 'publish' }), /IG_STORY_IMAGE_URL/)
  assert.throws(() => parseMetaPocConfig({ ...BASE_ENV, IG_POC_MODE: 'container', IG_STORY_IMAGE_URL: 'http:\/\/cdn.test/a.jpg' }), /HTTPS/)
})

test('modo inspect lê conta e orçamento sem criar container', async () => {
  const calls = []
  const fetchImpl = async url => {
    calls.push(String(url))
    return calls.length === 1
      ? json({ id: 'ig-1', username: 'loja', account_type: 'BUSINESS' })
      : json({ data: [{ quota_usage: 3, config: { quota_total: 100 } }] })
  }
  const report = await runMetaStoryPoc(parseMetaPocConfig(BASE_ENV), { fetchImpl })
  assert.equal(report.account.username, 'loja')
  assert.equal(report.publishingLimit.data[0].quota_usage, 3)
  assert.equal(report.container, null)
  assert.equal(calls.length, 2)
})

test('modo publish cria container, espera FINISHED e publica uma única vez', async () => {
  const config = parseMetaPocConfig({ ...BASE_ENV, IG_POC_MODE: 'publish', IG_STORY_IMAGE_URL: 'https://cdn.test/story.jpg', IG_POC_POLL_INTERVAL_MS: '1000' })
  const calls = []
  const replies = [
    { id: 'ig-1', username: 'loja', account_type: 'BUSINESS' },
    { data: [{ quota_usage: 3 }] },
    { id: 'container-1' },
    { id: 'container-1', status_code: 'IN_PROGRESS' },
    { id: 'container-1', status_code: 'FINISHED' },
    { id: 'media-1' },
  ]
  const report = await runMetaStoryPoc(config, {
    fetchImpl: async (url, options) => { calls.push({ url: String(url), options }); return json(replies.shift()) },
    sleep: async () => {},
  })
  assert.equal(report.container.status_code, 'FINISHED')
  assert.equal(report.media.id, 'media-1')
  assert.equal(calls.filter(call => call.url.endsWith('/media_publish')).length, 1)
  const createBody = calls.find(call => call.url.endsWith('/media')).options.body
  assert.equal(createBody.get('media_type'), 'STORIES')
  assert.equal(createBody.get('image_url'), 'https://cdn.test/story.jpg')
})

test('erro da Meta preserva códigos operacionais sem incluir token no objeto', async () => {
  const config = parseMetaPocConfig(BASE_ENV)
  const client = createMetaPocClient(config, { fetchImpl: async () => json({ error: { message: 'Token inválido', code: 190, error_subcode: 463 } }, 400) })
  await assert.rejects(client.inspectAccount(), error => {
    assert.ok(error instanceof MetaPocError)
    assert.equal(error.providerCode, 190)
    assert.equal(error.providerSubcode, 463)
    assert.doesNotMatch(JSON.stringify(error), /token-super-secreto/)
    return true
  })
})

test('container ERROR interrompe o fluxo e nunca chama media_publish', async () => {
  const config = parseMetaPocConfig({ ...BASE_ENV, IG_POC_MODE: 'publish', IG_STORY_IMAGE_URL: 'https://cdn.test/story.jpg' })
  let calls = 0
  const replies = [{ id: 'ig-1' }, { data: [] }, { id: 'c1' }, { id: 'c1', status_code: 'ERROR' }]
  await assert.rejects(runMetaStoryPoc(config, { fetchImpl: async () => { calls++; return json(replies.shift()) } }), error => error.code === 'CONTAINER_ERROR')
  assert.equal(calls, 4)
})
