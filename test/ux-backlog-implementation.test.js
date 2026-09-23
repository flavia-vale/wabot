import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { applyVariation } from '../src/core/copyVariation.js'
import { toMobileLogItem } from '../dashboard/lib/mobileLogs.js'
import { OFFER_TEMPLATE_VARIABLE_GROUPS } from '../dashboard/lib/mobileOfferComposer.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('painel converter stays 1:1 and does not expose the advanced offer builder', () => {
  const page = read('dashboard/app/painel/converte-links/page.js')
  // O rótulo "Formato 1:1" saiu no redesenho de 2026-09-19; a REGRA continua e
  // hoje é aplicada pela trava de um link por teste (`linksDemais`), que
  // desabilita o botão e explica o porquê.
  assert.match(page, /Cole um link por vez/)
  assert.match(page, /linksDemais/)
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

test('message templates page prioritizes models and progressively discloses supporting content', () => {
  const nav = read('dashboard/app/painel/nav.js')
  const page = read('dashboard/app/painel/mensagens/page.js')

  // Protótipo Basic/PRO (2026-09-23): o item do menu chama "Mensagens".
  assert.match(nav, /label: 'Mensagens',\n\s+href: '\/painel\/mensagens'/)
  assert.match(page, /usePainelHeader\(\{ title: 'Templates de mensagens'/)
  assert.doesNotMatch(page, /PainelContentActions/)

  const templatesSection = page.indexOf('id="modelos-title">Modelos de mensagem</h2>')
  const automaticFieldsSection = page.indexOf('id="campos-title">Campos automáticos</h2>')
  const dynamicTextsSection = page.indexOf('id="variacoes-title">Frases que variam sozinhas</h2>')
  const linksSection = page.indexOf('<strong>Links opcionais</strong>')

  assert.ok(templatesSection !== -1)
  assert.ok(templatesSection < automaticFieldsSection)
  assert.ok(automaticFieldsSection < dynamicTextsSection)
  assert.ok(dynamicTextsSection < linksSection)
  assert.match(page, /templateMode === 'list'[\s\S]*Novo modelo/)
  // Um clique só: o botão do editor aplica E grava (nunca voltar ao par
  // "Concluir edição" + "Salvar", que fazia o primeiro clique parecer o salvamento).
  assert.doesNotMatch(page, /Concluir edição/)
  assert.match(page, /onClick=\{saveTemplate\}/)
  assert.match(page, /Salvar modelo/)
  assert.match(page, /async function saveTemplate\(\)[\s\S]*applyAndPersist/)
  assert.match(page, /async function applyAndPersist\(nextStore\)[\s\S]*handleSave\(nextStore\)/)
  assert.match(page, /Salvar alterações/)
  assert.doesNotMatch(page, /<details[^>]*\sopen(?:=|\s|>)/)
  assert.doesNotMatch(page, /pra nunca repetir|>Fechamento</)
  assert.match(page, /aria-expanded=\{open\}/)
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
  // As variações vivem só na página de Templates ("Textos dinâmicos").
  assert.match(page, /key: 'ctas'[\s\S]*nome: 'CTAs'[\s\S]*Preços e estoque podem mudar/)
  assert.match(page, /key: 'trailers'[\s\S]*nome: 'Convite do grupo'[\s\S]*Entre no nosso grupo oficial/)
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

test('painel configuracoes only exposes account email and password settings', () => {
  // O bloco de e-mail/senha virou componente, usado também em Minha conta.
  const page = read('dashboard/components/AccountAccessForms.js')
  assert.match(read('dashboard/app/painel/configuracoes/page.js'), /<AccountAccessForms \/>/)
  assert.match(page, /E-mail de acesso/)
  assert.match(page, /Alterar senha/)
  assert.match(page, /api\.updateAccountEmail/)
  assert.match(page, /api\.updateAccountPassword/)
  assert.doesNotMatch(page, /Preferências gerais|Cadência entre envios|Espelhamento com template|Marca nas mensagens|Filtros e boas-vindas|Plataformas ativas|Palavras bloqueadas|Mensagem de boas-vindas/)
})

test('painel grupos mantém seletor de link primário independente de template', () => {
  const source = readFileSync('dashboard/app/painel/espelhamento/page.js', 'utf8')

  assert.match(source, /label="Link principal quando há vários"/)
  assert.match(source, /onUpdate\(g\.id, \{ primaryLinkTarget: e\.target\.value \}\)/)
  assert.doesNotMatch(source, /\{templateApplied && \(\s*<CfgRow\s+label="Link principal quando há vários"/s)
  assert.doesNotMatch(source, /\{templateApplied && \(\s*<CfgRow\s+label="Link a converter quando há vários"/s)
})
