import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/*
 * Q6 da auditoria do painel (docs/admin/auditoria-painel-admin.md):
 * (1) a casca /admin/* não deve montar para quem não tem papel admin — uma
 * conta trial sem papel carregou páginas do admin e disparou 80 chamadas em
 * produção (todas 403, mas a página nem deveria ter montado);
 * (2) "Teste shard" é POC e só aparece no menu com a env ligada.
 */

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('o layout do admin envolve tudo na cerca', () => {
  const layout = read('dashboard/app/admin/layout.js')
  assert.match(layout, /import \{ AdminGate \} from '@\/components\/AdminGate'/)
  assert.match(layout, /<AdminGate>\{children\}<\/AdminGate>/)
})

test('a cerca pergunta ao backend quem é e manda não-admin de volta ao painel', () => {
  const gate = read('dashboard/components/AdminGate.js')
  assert.match(gate, /api\.adminMe\(\)/)
  assert.match(gate, /err\?\.status === 403[\s\S]*router\.replace\('\/painel'\)/)
  assert.match(gate, /if \(!liberado\) return <LoadingState \/>/, 'não renderiza filhos antes da resposta')
  assert.ok(!gate.includes('CS_ALLOWED_EMAILS') && !/@[a-z0-9.-]+\.[a-z]{2,}/i.test(gate.replace(/@\/components|@\/lib/g, '')), 'nenhum e-mail fixo decide acesso')
})

test('"Teste shard" só aparece no menu com tech:read E env ligada', () => {
  const page = read('dashboard/app/admin/page.js')
  const linha = page.split('\n').find(l => l.includes('href="/admin/teste-shard"'))
  assert.ok(linha, 'link do teste shard sumiu por completo')
  assert.match(linha, /permissions\?\.includes\('tech:read'\) && admin\?\.shardPocMode === 'enabled'/)
  assert.ok(!page.includes('href="/admin/pipeline"'), 'Pipeline (ferramenta de dev) não entra no menu do admin')
})

test('GET /api/admin/me informa o modo do shard', () => {
  const admin = read('src/api/routes/admin.js')
  const inicio = admin.indexOf("app.get('/me'")
  const corpo = admin.slice(inicio, admin.indexOf('\n  })\n', inicio))
  assert.match(corpo, /shardPocMode: String\(process\.env\.WA_SESSION_SHARD_POC \|\| 'observe'\)/)
})
