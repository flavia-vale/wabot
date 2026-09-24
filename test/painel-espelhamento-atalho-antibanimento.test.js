import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Contrato: specs/018-unificar-protecao-anti-ban/contracts/ui-anti-banimento.md
// § Espelhamento — a aba de proteção do painel de destino mantém "Saúde deste
// destino" e troca os links antigos por um atalho para o Anti-banimento.

const __dirname = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(__dirname, '..', 'dashboard/app/painel/espelhamento/page.js'), 'utf8')

test('o atalho da aba "Anti-ban" aponta para /painel/anti-banimento?parte=ritmo&destino=<id> com o texto certo', () => {
  assert.match(source, /\/painel\/anti-banimento\?parte=ritmo&destino=\$\{g\.id\}/)
  assert.match(source, /Ajustar no Anti-banimento PRO →/)
})

test('não existe mais link para /painel/preservacao/destinos', () => {
  assert.doesNotMatch(source, /\/painel\/preservacao\/destinos/)
})

test('o texto "Preservação por grupo e canal" não aparece mais na aba de destino', () => {
  assert.doesNotMatch(source, /Preservação por grupo e canal/)
})

test('"Saúde deste destino" continua presente (não duplicar controle de edição na aba de Espelhamento)', () => {
  assert.match(source, /Saúde deste destino/)
})
