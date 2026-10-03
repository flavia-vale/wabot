import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRenderedOfferTemplatePreview, summarizeAutomationTemplateUsage, MISSING_COUPON_LINK_NOTICE, MISSING_GROUP_LINK_NOTICE } from '../dashboard/lib/offerTemplatePreview.js'
import { PRESET_TEMPLATE_BODIES } from '../dashboard/lib/mobileTemplateStore.js'

const POOL = {
  greetings: ['🚨 GANCHO DE TESTE'],
  ctas: ['📲 CTA DE TESTE:'],
  trailers: ['⚠️ AVISO DE TESTE'],
}

test('prévia renderizada mostra corpo do modelo com gancho, CTA e aviso aplicados', () => {
  const preview = buildRenderedOfferTemplatePreview({
    template: { key: 'automatico_classico', body: PRESET_TEMPLATE_BODIES.automatico_classico },
    copyVariationPoolJson: JSON.stringify(POOL),
  })

  assert.match(preview, /🚨 GANCHO DE TESTE/)
  assert.match(preview, /📲 CTA DE TESTE:/)
  assert.match(preview, /⚠️ AVISO DE TESTE/)
  assert.match(preview, /Kit 3 Organizadores/)
  assert.match(preview, /https:\/\/s\.shopee\.com\.br\/oferta-afiliada/)
})

test('prévia respeita remoção de placeholders globais do template', () => {
  const preview = buildRenderedOfferTemplatePreview({
    template: { key: 'sem_globais', body: '🏷️ *{produto}*\n\n👉 {link}' },
    copyVariationPoolJson: JSON.stringify(POOL),
  })

  assert.doesNotMatch(preview, /GANCHO DE TESTE/)
  assert.doesNotMatch(preview, /CTA DE TESTE/)
  assert.doesNotMatch(preview, /AVISO DE TESTE/)
  assert.match(preview, /Kit 3 Organizadores/)
})

test('prévia sem link de cupom/grupo salvo avisa para preencher em vez de mostrar link de exemplo', () => {
  const template = { key: 'noiva', body: '👉🏻 {link}\n🎟️ Resgate os cupons aqui: {{cupomLink}}\n👥 Grupo: {{grupoLink}}' }
  const preview = buildRenderedOfferTemplatePreview({ template, couponLink: '', groupInviteLink: '  ' })

  assert.ok(preview.includes(MISSING_COUPON_LINK_NOTICE))
  assert.ok(preview.includes(MISSING_GROUP_LINK_NOTICE))
  assert.match(MISSING_COUPON_LINK_NOTICE, /final da página/)
  assert.doesNotMatch(preview, /espelhagrupos\.com\.br\/cupons/)
  assert.doesNotMatch(preview, /chat\.whatsapp\.com\/seu-grupo/)
})

test('prévia com link de cupom/grupo salvo mostra o link da cliente', () => {
  const template = { key: 'noiva', body: '🎟️ Resgate os cupons aqui: {{cupomLink}}\n👥 Grupo: {{grupoLink}}' }
  const preview = buildRenderedOfferTemplatePreview({
    template,
    couponLink: 'https://minhaloja.com/cupons',
    groupInviteLink: 'https://chat.whatsapp.com/abc',
  })

  assert.match(preview, /Resgate os cupons aqui: https:\/\/minhaloja\.com\/cupons/)
  assert.match(preview, /Grupo: https:\/\/chat\.whatsapp\.com\/abc/)
  assert.ok(!preview.includes(MISSING_COUPON_LINK_NOTICE))
})

test('sumariza uso de templates por automações ativas e pausadas', () => {
  const usage = summarizeAutomationTemplateUsage([
    { templateKey: 'automatico_classico', enabled: true, destGroupName: 'Grupo A' },
    { templateKey: 'automatico_classico', enabled: false, destGroupName: 'Grupo B' },
    { templateKey: 'tech', enabled: true, destGroupName: 'Grupo C' },
    { enabled: true, destGroupName: 'Grupo default' },
  ])

  assert.deepEqual(usage.get('automatico_classico'), {
    total: 3,
    enabled: 2,
    paused: 1,
    groups: ['Grupo A', 'Grupo B', 'Grupo default'],
  })
  assert.equal(usage.get('tech').enabled, 1)
})
