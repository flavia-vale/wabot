// Guarda de P3 (specs/013-inbound-leads-strategy): o aviso de envio bloqueado
// por falta de credencial precisa usar linguagem leiga, inverter o
// vocabulário certo por loja (Shopee é o OPOSTO de ML/Amazon/Magalu) e nunca
// aparecer para loja já cadastrada — mesmo com código vencido, quem avisa
// esse caso é src/credentialExpiry/. Contrato completo em
// contracts/credential-block-alert.md.
//
// Este teste deve FALHAR antes de T022 (src/credentialBlockAlert/message.js
// ainda não existe).

import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCredentialBlockAlerts } from '../src/credentialBlockAlert/message.js'

// (a) Jargão que nunca pode chegar à tela da cliente (FR-017).
const JARGAO_PROIBIDO = [/\bcookie\b/i, /\bSSID\b/i, /\btag\b/i, /partner_id/i, /\?tag=/, /amzn\.to/i]

function textoCompleto(store) {
  return [store.headline, store.body, store.nextStep].join(' \n ')
}

test('(a) nenhum texto do aviso contém jargão técnico', () => {
  const stores = buildCredentialBlockAlerts({
    blockedByPlatform: [
      { platform: 'shopee', blockedCount: 3, lastBlockedAt: new Date().toISOString() },
      { platform: 'mercadolivre', blockedCount: 2, lastBlockedAt: new Date().toISOString() },
      { platform: 'amazon', blockedCount: 1, lastBlockedAt: new Date().toISOString() },
    ],
    configuredPlatforms: [],
  })

  assert.equal(stores.length, 3)
  for (const store of stores) {
    const texto = textoCompleto(store)
    for (const padrao of JARGAO_PROIBIDO) {
      assert.doesNotMatch(texto, padrao, `${store.platform}: texto "${texto}" contém jargão proibido (${padrao})`)
    }
  }
})

test('(b) Shopee: o body diz que as ofertas PARAM de sair (FR-018)', () => {
  const [store] = buildCredentialBlockAlerts({
    blockedByPlatform: [{ platform: 'shopee', blockedCount: 5, lastBlockedAt: new Date().toISOString() }],
    configuredPlatforms: [],
  })
  assert.match(store.body, /param de sair|para de sair|não est(ã|a)o saindo/i)
})

test('(c) Mercado Livre e Amazon: o body diz "continuam saindo... link mais comprido", nunca "parou"/"pausado" (FR-019)', () => {
  for (const platform of ['mercadolivre', 'amazon']) {
    const [store] = buildCredentialBlockAlerts({
      blockedByPlatform: [{ platform, blockedCount: 4, lastBlockedAt: new Date().toISOString() }],
      configuredPlatforms: [],
    })
    assert.match(store.body, /continuam saindo/i, `${platform}: body não diz "continuam saindo"`)
    assert.match(store.body, /link mais comprido/i, `${platform}: body não menciona "link mais comprido"`)
    assert.doesNotMatch(store.body, /\b(parou|pausad[ao])\b/i, `${platform}: body diz "parou"/"pausado" — falso, o plano B continua enviando`)
  }
})

test('(d) guarda dedicada contra fusão de texto: Shopee e ML/Amazon vêm de constantes estruturalmente separadas', () => {
  const [shopee] = buildCredentialBlockAlerts({
    blockedByPlatform: [{ platform: 'shopee', blockedCount: 1, lastBlockedAt: new Date().toISOString() }],
    configuredPlatforms: [],
  })
  const [ml] = buildCredentialBlockAlerts({
    blockedByPlatform: [{ platform: 'mercadolivre', blockedCount: 1, lastBlockedAt: new Date().toISOString() }],
    configuredPlatforms: [],
  })

  // Reprova exatamente a regressão que uniria os dois textos num template só
  // com a consequência como variável: aí o corpo da Shopee teria que conter
  // a MESMA frase-base do ML, só trocando o final — o que a inversão de
  // vocabulário proíbe.
  assert.notEqual(shopee.body, ml.body)
  assert.doesNotMatch(shopee.body, /continuam saindo/i, 'Shopee não pode herdar a frase de ML/Amazon')
  assert.doesNotMatch(ml.body, /param de sair|não est(ã|a)o saindo/i, 'ML não pode herdar a frase da Shopee')
})

test('(e) loja com credencial já cadastrada não aparece em stores[] (FR-020/FR-021) — mesmo com código vencido', () => {
  const stores = buildCredentialBlockAlerts({
    blockedByPlatform: [
      { platform: 'shopee', blockedCount: 3, lastBlockedAt: new Date().toISOString() },
      { platform: 'mercadolivre', blockedCount: 2, lastBlockedAt: new Date().toISOString() },
    ],
    configuredPlatforms: ['shopee'], // já cadastrou (vencida ou não — quem avisa é credentialExpiry)
  })

  assert.equal(stores.some((s) => s.platform === 'shopee'), false, 'Shopee cadastrada não pode gerar aviso novo')
  assert.equal(stores.some((s) => s.platform === 'mercadolivre'), true, 'Mercado Livre sem cadastro deveria continuar avisando')
})

test('(f) stores: [] não gera nenhum aviso (cenário 6 da US3)', () => {
  const stores = buildCredentialBlockAlerts({ blockedByPlatform: [], configuredPlatforms: [] })
  assert.deepEqual(stores, [])
})

test('todo item traz o que aconteceu, o porquê e o próximo passo, com link para /painel/ids-afiliada (FR-016)', () => {
  const stores = buildCredentialBlockAlerts({
    blockedByPlatform: [{ platform: 'shopee', blockedCount: 7, lastBlockedAt: new Date().toISOString() }],
    configuredPlatforms: [],
  })
  const [store] = stores
  assert.ok(store.headline, 'falta headline (o que aconteceu)')
  assert.ok(store.body, 'falta body (o porquê)')
  assert.ok(store.nextStep, 'falta nextStep (o que fazer)')
  assert.equal(store.href, '/painel/ids-afiliada')
  assert.equal(store.storeLabel, 'Shopee')
  assert.equal(store.blockedCount, 7)
})

test('plataforma desconhecida não quebra o motor (fail-safe: não monta aviso genérico)', () => {
  const stores = buildCredentialBlockAlerts({
    blockedByPlatform: [{ platform: 'plataforma-inexistente', blockedCount: 1, lastBlockedAt: new Date().toISOString() }],
    configuredPlatforms: [],
  })
  assert.deepEqual(stores, [])
})
