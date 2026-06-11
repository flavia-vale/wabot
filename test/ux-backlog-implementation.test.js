import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { applyVariation } from '../src/core/copyVariation.js'
import { toMobileLogItem } from '../dashboard/lib/mobileLogs.js'
import { OFFER_TEMPLATE_VARIABLE_GROUPS } from '../dashboard/lib/mobileOfferComposer.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('painel converter stays 1:1 and does not expose the advanced offer builder', () => {
  const page = read('dashboard/app/painel/converte-links/page.js')
  assert.match(page, /Formato[\s\S]*1:1/)
  assert.doesNotMatch(page, /1:1 ou n:n/)
  assert.doesNotMatch(page, /OfferBuilder/)
  assert.doesNotMatch(page, /Montador de oferta/)
})

test('broadcast pages only expose message and direct destinations selection', () => {
  const painel = read('dashboard/app/painel/envio/page.js')
  const mobile = read('dashboard/app/m/op/broadcast/page.js')

  for (const page of [painel, mobile]) {
    assert.match(page, /Mensagem/)
    assert.match(page, /Destinos/)
    assert.match(page, /Seu grupo de destino não está aqui\? Clique aqui para adicionar/)
    assert.doesNotMatch(page, /Smart Segmentador/)
    assert.doesNotMatch(page, /Segmentar destinos/)
    assert.doesNotMatch(page, /Top N/)
    assert.doesNotMatch(page, /Mín\. participantes|Mínimo de participantes/)
  }
})

test('offer automation logs are labeled differently from manual sends', () => {
  const item = toMobileLogItem({
    id: 'log-1',
    status: 'success',
    sourceGroup: 'offerAutomation',
    sourceGroupName: 'Oferta automática',
    destGroup: '120@g.us',
    destGroupName: 'Grupo destino',
    messageText: 'Oferta automática enviada',
    platform: 'shopee',
    sentAt: '2026-06-07T12:00:00.000Z',
  }, new Date('2026-06-07T13:00:00.000Z'))

  assert.equal(item.source, 'offerAutomation')
  assert.equal(item.de, 'Oferta automática')
})

test('navigation uses Templates, ganchos e CTA label in web and mobile account', () => {
  assert.match(read('dashboard/app/painel/nav.js'), /Templates, ganchos e CTA/)
  assert.match(read('dashboard/app/m/account/page.js'), /Templates, ganchos e CTA/)
})

test('template variable UI only advertises canonical gancho, cta and convitegrupo names', () => {
  const page = read('dashboard/app/painel/mensagens/page.js')
  const automationTokens = OFFER_TEMPLATE_VARIABLE_GROUPS
    .find((group) => group.key === 'automation')
    .variables
    .map((variable) => variable.token)

  assert.deepEqual(automationTokens.filter((token) => /^\{\{/.test(token)), ['{{gancho}}', '{{cta}}', '{{convitegrupo}}', '{{grupoLink}}', '{{cupomLink}}'])
  assert.doesNotMatch(page, /\{\{greeting\}\}|\{\{trailer\}\}|Fechamentos/)

  const rendered = applyVariation('{{gancho}}|{{cta}}|{{convitegrupo}}|{{greeting}}|{{trailer}}', {
    pool: { greetings: ['GANCHO'], ctas: ['CTA'], trailers: ['CONVITE'] },
    groupId: 'grupo-1',
    date: '2026-06-07',
    autoInjectWhenMissing: false,
  })
  assert.equal(rendered, 'GANCHO|CTA|CONVITE|GANCHO|CONVITE')
})

test('template variable copy uses a real reusable clipboard helper with fallback', () => {
  const page = read('dashboard/app/painel/mensagens/page.js')
  assert.match(page, /copyTextToClipboard/)
  assert.match(read('dashboard/lib/clipboard.js'), /execCommand\('copy'\)/)
})

test('painel configuracoes exposes only the delivery cadence card', () => {
  const page = read('dashboard/app/painel/configuracoes/page.js')
  assert.match(page, /Cadência entre envios/)
  assert.doesNotMatch(page, /Marca nas mensagens|Filtros e boas-vindas/)
})
