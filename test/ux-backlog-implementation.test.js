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

test('broadcast page only exposes message and direct destinations selection', () => {
  const painel = read('dashboard/app/painel/envio/page.js')

  assert.match(painel, /Mensagem/)
  assert.match(painel, /Destinos/)
  assert.match(painel, /Seu grupo de destino não está aqui\? Clique aqui para adicionar/)
  assert.doesNotMatch(painel, /Smart Segmentador/)
  assert.doesNotMatch(painel, /Segmentar destinos/)
  assert.doesNotMatch(painel, /Top N/)
  assert.doesNotMatch(painel, /Mín\. participantes|Mínimo de participantes/)
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

test('message templates page prioritizes templates and progressively discloses supporting content', () => {
  const nav = read('dashboard/app/painel/nav.js')
  const page = read('dashboard/app/painel/mensagens/page.js')

  assert.match(nav, /label: 'Templates de mensagens'/)
  assert.match(page, /usePainelHeader\(\{ title: 'Templates de mensagens'/)
  assert.doesNotMatch(page, /PainelContentActions/)

  const templatesSection = page.indexOf('>Templates de mensagens</div>')
  const educationalSection = page.indexOf('<summary>Como funcionam os templates</summary>')
  const dynamicTextsSection = page.indexOf('Textos dinâmicos')
  const linksSection = page.indexOf('>Links<')
  const referenceSection = page.indexOf('<summary>Referência de variáveis</summary>')

  assert.ok(templatesSection !== -1)
  assert.ok(templatesSection < educationalSection)
  assert.ok(educationalSection < dynamicTextsSection)
  assert.ok(dynamicTextsSection < linksSection)
  assert.ok(linksSection < referenceSection)
  assert.match(page, /templateMode === 'list'[\s\S]*Criar template/)
  assert.match(page, />Concluir edição</)
  assert.match(page, /Salvar templates, textos e links/)
  assert.doesNotMatch(page, /<details[^>]*\sopen(?:=|\s|>)/)
  assert.doesNotMatch(page, /pra nunca repetir|>Fechamento</)
  assert.doesNotMatch(page, />[^<{]*(?:modelo|modelos)[^<{]*</i)
})

test('template variable UI only advertises canonical gancho, cta and convitegrupo names', () => {
  const page = read('dashboard/app/painel/mensagens/page.js')
  const automationTokens = OFFER_TEMPLATE_VARIABLE_GROUPS
    .find((group) => group.key === 'automation')
    .variables
    .map((variable) => variable.token)

  assert.deepEqual(automationTokens.filter((token) => /^\{\{/.test(token)), ['{{gancho}}', '{{cta}}', '{{convitegrupo}}', '{{grupoLink}}', '{{cupomLink}}'])
  const automationGroup = OFFER_TEMPLATE_VARIABLE_GROUPS.find((group) => group.key === 'automation')
  assert.equal(automationGroup.variables.find((variable) => variable.token === '{{cta}}').example, '⚠️ Preços e estoque podem mudar.')
  assert.equal(automationGroup.variables.find((variable) => variable.token === '{{convitegrupo}}').example, '📲 Entre no nosso grupo oficial:')
  const preservationEditor = read('dashboard/components/preservacao/CopyVariationPoolEditor.js')
  assert.match(preservationEditor, /key: 'ctas'[\s\S]*label: 'CTAs'[\s\S]*Preços e estoque podem mudar/)
  assert.match(preservationEditor, /key: 'trailers'[\s\S]*label: 'Convites do grupo[\s\S]*Entre no nosso grupo oficial/)
  assert.doesNotMatch(page, /\{\{greeting\}\}|\{\{trailer\}\}|Fechamentos/)

  const rendered = applyVariation('{{gancho}}|{{cta}}|{{convitegrupo}}', {
    pool: { greetings: ['GANCHO'], ctas: ['CTA'], trailers: ['CONVITE'] },
    groupId: 'grupo-1',
    date: '2026-06-07',
    autoInjectWhenMissing: false,
  })
  assert.equal(rendered, 'GANCHO|CTA|CONVITE')
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
