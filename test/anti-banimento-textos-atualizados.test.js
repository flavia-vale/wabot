import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Contrato: FR-006 (specs/018-unificar-protecao-anti-ban) — todo texto que
// hoje aponta para as telas antigas de "Preservação avançada" passa a citar
// "Anti-banimento". Superfícies do escopo de T033: upsell (UpsellShell.js),
// tutorial, e-mails que citam a funcionalidade, página pública de preços.
// (As mensagens de erro de plano já são cobertas por
// test/gate-mensagem-anti-banimento.test.js, T021/T022.)

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const read = (p) => readFileSync(resolve(repoRoot, p), 'utf8')

// Remove comentários JSX/JS antes de varrer: um comentário explicando qual
// jargão NÃO usar (prática já estabelecida no repo, ex.: Pricing.jsx linha
// ~99) não é texto visível para a cliente e não deve reprovar o teste.
function stripComments(source) {
  return source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '')
}

const FORBIDDEN = [
  'Módulo de Preservação Avançada',
  'Preservação avançada',
  'Preservação Pro',
  'Preservação por grupo e canal',
]

const SURFACES = [
  'dashboard/components/preservacao/UpsellShell.js',
  'dashboard/components/landing/Pricing.jsx',
]

for (const surface of SURFACES) {
  test(`${surface}: não contém jargão antigo de "Preservação"`, () => {
    const source = stripComments(read(surface))
    for (const term of FORBIDDEN) {
      assert.doesNotMatch(source, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `"${term}" ainda aparece em ${surface}`)
    }
  })
}

test('UpsellShell.js cita "Anti-banimento"', () => {
  const source = read('dashboard/components/preservacao/UpsellShell.js')
  assert.match(source, /Anti-banimento/)
})

test('Pricing.jsx (landing) cita "Anti-banimento" no lugar do antigo badge "Preservação"', () => {
  const source = read('dashboard/components/landing/Pricing.jsx')
  assert.match(source, /Anti-banimento/)
})

test('tutorial do painel não menciona "Preservação" (nada a atualizar — confirmado por grep, não por suposição)', () => {
  const source = read('dashboard/app/painel/tutorial/page.js')
  assert.doesNotMatch(source, /[Pp]reserva/)
})

test('src/email/registry.js não menciona "Preservação" (nada a atualizar — confirmado por grep, não por suposição)', () => {
  const source = read('src/email/registry.js')
  assert.doesNotMatch(source, /[Pp]reserva/)
})
