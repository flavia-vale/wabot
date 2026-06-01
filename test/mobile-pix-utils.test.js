import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PIX_KEY,
  SUPPORT_WA_NUMBER,
  SUPPORT_PHONE_LABEL,
  buildPixWaLink,
} from '../dashboard/lib/mobilePixUtils.js'

test('PIX_KEY tem o valor correto', () => {
  assert.equal(PIX_KEY, 'd80c705f-3893-4802-939b-cce5c9338c66')
})

test('SUPPORT_WA_NUMBER tem o número correto', () => {
  assert.equal(SUPPORT_WA_NUMBER, '5532999844020')
})

test('SUPPORT_PHONE_LABEL tem o label correto', () => {
  assert.equal(SUPPORT_PHONE_LABEL, '(32) 99984-4020')
})

test('buildPixWaLink contém o número correto na URL', () => {
  const link = buildPixWaLink('Plano Pro', 'R$ 49,90', 'user@email.com')
  assert.ok(link.includes('wa.me/5532999844020'))
})

test('buildPixWaLink gera payload encodado com planName, price e email', () => {
  const link = buildPixWaLink('Plano Pro', 'R$ 49,90', 'user@email.com')
  const decoded = decodeURIComponent(link.split('?text=')[1])
  assert.ok(decoded.includes('Plano Pro'))
  assert.ok(decoded.includes('R$ 49,90'))
  assert.ok(decoded.includes('user@email.com'))
})

test('buildPixWaLink não quebra com campos vazios', () => {
  assert.doesNotThrow(() => buildPixWaLink('', '', ''))
})

test('buildPixWaLink usa — para campos vazios', () => {
  const link = buildPixWaLink('', '', '')
  const decoded = decodeURIComponent(link.split('?text=')[1])
  assert.ok(decoded.includes('—'))
})

test('buildPixWaLink começa com https://wa.me/', () => {
  const link = buildPixWaLink('Plano Pro', 'R$ 49,90', 'test@test.com')
  assert.ok(link.startsWith('https://wa.me/'))
})
