import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUserOrigin } from '../src/domain/admin/service.js'

test('origem por afiliado traz nome/email/código do afiliado', () => {
  const origin = buildUserOrigin({
    id: 'u1',
    affiliateProfileId: 'aff1',
    affiliateRef: { code: 'MARIA10', user: { name: 'Maria', email: 'maria@x.com' } },
  })
  assert.equal(origin.type, 'affiliate')
  assert.equal(origin.label, 'Afiliado')
  assert.equal(origin.affiliateName, 'Maria')
  assert.equal(origin.affiliateEmail, 'maria@x.com')
  assert.equal(origin.affiliateCode, 'MARIA10')
})

test('origem por indicação de cliente traz nome/email do indicador', () => {
  const referrerMap = new Map([['u9', { id: 'u9', name: 'João', email: 'joao@x.com' }]])
  const origin = buildUserOrigin({ id: 'u2', affiliateProfileId: null, referredBy: 'u9' }, { referrerMap })
  assert.equal(origin.type, 'referral')
  assert.equal(origin.label, 'Indicação de cliente')
  assert.equal(origin.referrerName, 'João')
  assert.equal(origin.referrerEmail, 'joao@x.com')
})

test('origem orgânica usa source/utm do evento de cadastro', () => {
  const signupMetaMap = new Map([['u3', { utm_source: 'instagram', utm_medium: 'bio', utm_campaign: 'lanc' }]])
  const origin = buildUserOrigin({ id: 'u3', affiliateProfileId: null, referredBy: null }, { signupMetaMap })
  assert.equal(origin.type, 'organic')
  assert.equal(origin.label, 'Instagram')
  assert.equal(origin.source, 'instagram')
  assert.equal(origin.detail, 'bio · lanc')
})

test('origem sem nenhum sinal vira "Não rastreada"', () => {
  const origin = buildUserOrigin({ id: 'u4', affiliateProfileId: null, referredBy: null })
  assert.equal(origin.type, 'organic')
  assert.equal(origin.label, 'Não rastreada')
  assert.equal(origin.source, null)
})

test('referredBy sem match no mapa cai para orgânico (não quebra)', () => {
  const origin = buildUserOrigin({ id: 'u5', affiliateProfileId: null, referredBy: 'inexistente' }, { referrerMap: new Map() })
  assert.equal(origin.type, 'organic')
})

test('source direto é rotulado como Direto', () => {
  const signupMetaMap = new Map([['u6', { source: 'direct' }]])
  const origin = buildUserOrigin({ id: 'u6', affiliateProfileId: null }, { signupMetaMap })
  assert.equal(origin.label, 'Direto')
})
