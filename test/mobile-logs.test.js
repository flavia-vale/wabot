import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toMobileLogItem } from '../dashboard/lib/mobileLogs.js'

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
