import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { FALLBACK_TERMS, getPublicTerms, resolveInternalApiBase } from '../dashboard/lib/legalTerms.js'

test('termos server-side consulta diretamente a API local de cada ambiente', () => {
  assert.equal(resolveInternalApiBase({ PORT: '3000', API_URL: 'https://espelhagrupos.com.br' }), 'http://127.0.0.1:3001')
  assert.equal(resolveInternalApiBase({ PORT: '3006', API_URL: 'http://178.105.54.0:3006' }), 'http://127.0.0.1:3004')
  assert.equal(resolveInternalApiBase({ PORT: '4000', API_PORT: '4010' }), 'http://127.0.0.1:4010')
  assert.equal(resolveInternalApiBase({ INTERNAL_API_URL: 'http://api-interna:8080/' }), 'http://api-interna:8080')
})

test('termos públicos retornam o documento editado recebido da API', async () => {
  const savedTerms = {
    title: 'Termos atualizados no admin',
    summary: 'Resumo atualizado',
    version: 'terms-20260612120000',
    content: {
      lastUpdatedLabel: '12 de junho de 2026',
      intro: 'Introdução atualizada',
      sections: [{ title: 'Nova seção', body: ['Novo conteúdo'], warning: false }],
      finalDeclaration: 'Declaração atualizada',
    },
  }
  let requestedUrl = ''
  let requestedOptions = null

  const terms = await getPublicTerms({
    env: { PORT: '3000', API_URL: 'https://espelhagrupos.com.br' },
    fetchImpl: async (url, options) => {
      requestedUrl = url
      requestedOptions = options
      return new Response(JSON.stringify({ terms: savedTerms }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
    logger: { error() {} },
  })

  assert.deepEqual(terms, savedTerms)
  assert.equal(requestedUrl, 'http://127.0.0.1:3001/api/public/legal/terms')
  assert.equal(requestedOptions.cache, 'no-store')
  assert.ok(requestedOptions.signal instanceof AbortSignal)
})

test('termos públicos usam fallback e registram falhas da API', async () => {
  const errors = []
  const terms = await getPublicTerms({
    env: { PORT: '3006' },
    fetchImpl: async () => new Response('indisponível', { status: 503 }),
    logger: { error: (...args) => errors.push(args) },
  })

  assert.equal(terms, FALLBACK_TERMS)
  assert.equal(errors.length, 1)
  assert.match(errors[0][0], /respondeu 503/)
})

test('página de termos renderiza todos os campos editáveis do admin', () => {
  const source = fs.readFileSync(new URL('../dashboard/app/termos/page.js', import.meta.url), 'utf8')

  assert.match(source, /description=\{terms\.summary/)
  assert.match(source, /content\.intro/)
  assert.match(source, /terms\.version/)
  assert.match(source, /content\.lastUpdatedLabel/)
  assert.match(source, /content\.finalDeclaration/)
  assert.match(source, /section\.warning/)
})
