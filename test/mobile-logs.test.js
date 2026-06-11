import { test } from 'node:test'
import assert from 'node:assert/strict'
import { friendlyMobileLogError, isSafeMobileLogUrl, mobileLogLinkActions, toMobileLogItem } from '../dashboard/lib/mobileLogs.js'

test('log mobile traduz erro por item de conversão sem ação falsa', () => {
  const item = toMobileLogItem({
    id: '1',
    status: 'error',
    sentAt: '2026-05-28T10:00:00.000Z',
    messageText: 'Oferta com erro',
    platform: 'amazon',
    sourceGroup: 'conversion',
    destGroup: null,
    originalUrl: 'https://amazon.test/p',
    errorMsg: 'error:conversion:Credenciais ausentes',
  }, new Date('2026-05-28T12:00:00.000Z'))

  assert.equal(item.status, 'falha')
  assert.equal(item.source, 'manual')
  assert.match(item.erro, /Credenciais ausentes/)
  assert.equal(item.canRetryInMobile, false)
})


test('helper de logs mobile aceita somente URLs http/https para abrir', () => {
  assert.equal(isSafeMobileLogUrl('https://example.com/oferta'), true)
  assert.equal(isSafeMobileLogUrl(' http://example.com/oferta '), true)
  assert.equal(isSafeMobileLogUrl('javascript:alert(1)'), false)
  assert.equal(isSafeMobileLogUrl('nota fiscal sem url'), false)
  assert.equal(isSafeMobileLogUrl(''), false)
})

test('friendlyMobileLogError traduz warning:ml_ssid_expired com texto PT-BR', () => {
  const result = friendlyMobileLogError('warning:ml_ssid_expired')
  assert.ok(result.includes('Mercado Livre'), 'deve mencionar Mercado Livre')
  assert.ok(result.includes('SSID') || result.includes('credencial'), 'deve mencionar credencial/SSID')
})

test('ações seguras incluem cópia sempre que há link e abertura só para URL válida', () => {
  const actions = mobileLogLinkActions({
    link: 'https://loja.test/produto',
    conv: 'texto convertido sem url',
  })

  assert.deepEqual(actions.map((action) => action.key), [
    'copy-original',
    'open-original',
    'copy-converted',
  ])
  assert.equal(actions.find((action) => action.key === 'open-original')?.href, 'https://loja.test/produto')
  assert.equal(actions.find((action) => action.key === 'copy-converted')?.value, 'texto convertido sem url')
})

test('log mobile de fila de ofertas mostra origem Fila com nome resolvido', () => {
  const item = toMobileLogItem({
    id: '9',
    status: 'success',
    sentAt: '2026-06-11T10:00:00.000Z',
    messageText: 'Oferta da fila',
    platform: 'amazon',
    sourceGroup: 'offerQueue:q1',
    sourceGroupName: 'Fila · Relâmpago',
    destGroup: '123@g.us',
    destGroupName: 'Grupo VIP',
    originalUrl: 'https://amazon.test/p',
    convertedUrl: 'https://amzn.to/x',
  }, new Date('2026-06-11T12:00:00.000Z'))

  assert.equal(item.source, 'offerQueue')
  assert.equal(item.de, 'Fila · Relâmpago')
  assert.equal(item.para, 'Grupo VIP')
})

test('log mobile de fila sem nome resolvido degrada para rótulo Fila', () => {
  const item = toMobileLogItem({
    id: '10',
    status: 'success',
    sentAt: '2026-06-11T10:00:00.000Z',
    messageText: 'Oferta da fila',
    platform: 'amazon',
    sourceGroup: 'offerQueue:q1',
    destGroup: '123@g.us',
    originalUrl: 'https://amazon.test/p',
  }, new Date('2026-06-11T12:00:00.000Z'))

  assert.equal(item.source, 'offerQueue')
  assert.equal(item.de, 'Fila')
})
