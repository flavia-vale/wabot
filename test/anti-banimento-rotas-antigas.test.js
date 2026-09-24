import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Contrato: specs/018-unificar-protecao-anti-ban/contracts/ui-anti-banimento.md
// § Rotas do painel + § Menu. Os 4 endereços antigos viram redirect; o menu
// tem exatamente 1 item "Anti-banimento".

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const read = (p) => readFileSync(resolve(repoRoot, p), 'utf8')

test('/painel/preservacao redireciona para /painel/anti-banimento', () => {
  const source = read('dashboard/app/painel/preservacao/page.js')
  assert.match(source, /redirect\(\s*['"]\/painel\/anti-banimento['"]\s*\)/)
})

test('/painel/preservacao/monitoramento redireciona para ?parte=situacao', () => {
  const source = read('dashboard/app/painel/preservacao/monitoramento/page.js')
  assert.match(source, /redirect\(\s*['"]\/painel\/anti-banimento\?parte=situacao['"]\s*\)/)
})

test('/painel/preservacao/destinos redireciona para ?parte=ritmo (preservando ?destino=)', () => {
  const source = read('dashboard/app/painel/preservacao/destinos/page.js')
  assert.match(source, /parte=ritmo/)
  assert.match(source, /destino/)
})

test('/painel/preservacao/configuracoes redireciona para ?parte=conta', () => {
  const source = read('dashboard/app/painel/preservacao/configuracoes/page.js')
  assert.match(source, /redirect\(\s*['"]\/painel\/anti-banimento\?parte=conta['"]\s*\)/)
})

test('o menu tem exatamente 1 item "Anti-banimento" (não 3), no grupo Configuração, logo após Conexão WhatsApp, com pro:true', () => {
  const nav = read('dashboard/app/painel/nav.js')
  const occurrences = nav.match(/label:\s*['"]Anti-banimento['"]/g) || []
  assert.equal(occurrences.length, 1, 'deve existir exatamente 1 item "Anti-banimento" no menu')

  const configSectionStart = nav.indexOf("title: 'Configuração'")
  assert.notEqual(configSectionStart, -1)
  const configSectionEnd = nav.indexOf('\n  {', configSectionStart + 10)
  const configSection = nav.slice(configSectionStart, configSectionEnd === -1 ? undefined : configSectionEnd)

  const whatsappIdx = configSection.indexOf("label: 'Conexão WhatsApp'")
  const antibanIdx = configSection.indexOf("label: 'Anti-banimento'")
  assert.notEqual(whatsappIdx, -1, '"Conexão WhatsApp" precisa estar no grupo Configuração')
  assert.notEqual(antibanIdx, -1, '"Anti-banimento" precisa estar no grupo Configuração')
  assert.ok(whatsappIdx < antibanIdx, '"Anti-banimento" precisa vir logo depois de "Conexão WhatsApp"')

  const antibanItemStart = nav.indexOf('{', nav.indexOf("label: 'Anti-banimento'") - 30)
  const antibanItemEnd = nav.indexOf('},', antibanItemStart)
  const antibanItem = nav.slice(antibanItemStart, antibanItemEnd)
  assert.match(antibanItem, /href:\s*['"]\/painel\/anti-banimento['"]/)
  assert.match(antibanItem, /pro:\s*true/)
})

test('o grupo "Preservação avançada" não existe mais no array de navegação', () => {
  const nav = read('dashboard/app/painel/nav.js')
  assert.doesNotMatch(nav, /title:\s*['"]Preservação avançada['"]/)
})
