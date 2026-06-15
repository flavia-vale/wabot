import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRegisterHref, readAttributionFromSearchParams, sanitizeAttributionValue } from '../dashboard/lib/marketing-attribution.js'
import { shouldSuppressConversionPrompt } from '../dashboard/lib/analytics.js'

test('buildRegisterHref creates canonical register attribution params', () => {
  const href = buildRegisterHref({ source: 'seo', campaign: 'organic-marketing-sprint', content: 'bot-ofertas', term: 'hub-fase4' })
  const url = new URL(href, 'http://localhost:3006')

  assert.equal(url.pathname, '/login')
  assert.equal(url.searchParams.get('mode'), 'register')
  assert.equal(url.searchParams.get('source'), 'seo')
  assert.equal(url.searchParams.get('utm_source'), 'seo')
  assert.equal(url.searchParams.get('utm_medium'), 'organic')
  assert.equal(url.searchParams.get('utm_campaign'), 'organic-marketing-sprint')
  assert.equal(url.searchParams.get('utm_content'), 'bot-ofertas')
  assert.equal(url.searchParams.get('utm_term'), 'hub-fase4')
})

test('readAttributionFromSearchParams mirrors source and utm_source safely', () => {
  const params = new URLSearchParams('utm_source=lead magnet&utm_campaign=campanha teste&utm_content=cta#1')
  const attribution = readAttributionFromSearchParams(params)

  assert.equal(attribution.source, 'lead-magnet')
  assert.equal(attribution.utm_source, 'lead-magnet')
  assert.equal(attribution.utm_campaign, 'campanha-teste')
  assert.equal(attribution.utm_content, 'cta-1')
})

test('sanitizeAttributionValue keeps attribution short and URL-safe', () => {
  assert.equal(sanitizeAttributionValue(' campanha com espaços e símbolos !!! ', 20), 'campanha-com-espaços')
})

test('shouldSuppressConversionPrompt blocks critical flows only', () => {
  assert.equal(shouldSuppressConversionPrompt('/login'), true)
  assert.equal(shouldSuppressConversionPrompt('/painel/inicio'), true)
  assert.equal(shouldSuppressConversionPrompt('/dashboard/inicio'), false)
  assert.equal(shouldSuppressConversionPrompt('/m/op/offer'), false)
  assert.equal(shouldSuppressConversionPrompt('/admin/marketing-growth'), true)
  assert.equal(shouldSuppressConversionPrompt('/privacidade'), true)
  assert.equal(shouldSuppressConversionPrompt('/blog/conferir-converter-link-afiliado-whatsapp'), false)
})
