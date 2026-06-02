import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRenderedOfferTemplatePreview, summarizeAutomationTemplateUsage } from '../dashboard/lib/offerTemplatePreview.js'
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
