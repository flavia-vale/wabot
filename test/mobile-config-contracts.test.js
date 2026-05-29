import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MOBILE_CONFIG_CONTRACT_KEYS,
  buildMobilePreferencesPayload,
  getMobileTemplatePresetNotice,
} from '../dashboard/lib/mobileConfigContracts.js'

test('preferências mobile enviam apenas campos com contrato real no BotConfig', () => {
  const payload = buildMobilePreferencesPayload({
    notifyNewSale: true,
    notifyDailySummary: true,
    welcomeMsg: 'Bem-vinda ao grupo!',
    brandingGroupLink: 'https://chat.whatsapp.com/abc',
    brandingCtaText: 'Entre no grupo:',
  })

  assert.deepEqual(Object.keys(payload).sort(), [...MOBILE_CONFIG_CONTRACT_KEYS].sort())
  assert.equal(payload.welcomeMsg, 'Bem-vinda ao grupo!')
  assert.equal(payload.brandingGroupLink, 'https://chat.whatsapp.com/abc')
  assert.equal(payload.brandingCtaText, 'Entre no grupo:')
  assert.equal('notifyNewSale' in payload, false)
})

test('templates mobile são anunciados como presets locais quando não há contrato backend', () => {
  assert.match(getMobileTemplatePresetNotice(), /preset/i)
  assert.match(getMobileTemplatePresetNotice(), /não são salvos/i)
})
