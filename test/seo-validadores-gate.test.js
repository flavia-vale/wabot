// Os validadores de SEO existiam desde 05/2026 e não rodavam em lugar nenhum:
// 33 rotas ficaram sem data e /cadastro sem noindex na metadata sem ninguém
// ver (23/09/2026). Aqui eles viram parte de `npm test` — e da CI, pelo
// deploy.yml. Rodam sem dependência do dashboard instalada.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import test from 'node:test'

const dashboard = new URL('../dashboard/', import.meta.url).pathname

function rodar(script) {
  const r = spawnSync(process.execPath, [`scripts/${script}`], { cwd: dashboard, encoding: 'utf8' })
  return { status: r.status, saida: `${r.stdout}\n${r.stderr}` }
}

for (const script of ['validate-seo-consistency.mjs', 'guard-seo-registry-coverage.mjs', 'lint-seo-metadata-duplicates.mjs']) {
  test(`${script} passa`, () => {
    const { status, saida } = rodar(script)
    assert.equal(status, 0, saida.split('\n').filter((l) => /ERRO/.test(l)).join('\n'))
  })
}

test('toda rota indexável tem data de atualização (fonte única: EDITORIAL_DATES)', async () => {
  const { getIndexableSeoRoutes } = await import('../dashboard/lib/seo-registry.mjs')
  const { EDITORIAL_DATES } = await import('../dashboard/lib/editorial-content.js')
  const semData = getIndexableSeoRoutes().filter((r) => !EDITORIAL_DATES[r.path]?.updatedAt).map((r) => r.path)
  assert.deepEqual(semData, [])
  // o sitemap publica a MESMA data do "Atualizado em" visível
  for (const route of getIndexableSeoRoutes()) assert.equal(route.lastModified, EDITORIAL_DATES[route.path].updatedAt, route.path)
})

test('nenhuma data editorial está no futuro nem troca a ordem publicação/atualização', async () => {
  const { EDITORIAL_DATES } = await import('../dashboard/lib/editorial-content.js')
  const hoje = new Date().toISOString().slice(0, 10)
  for (const [path, { publishedAt, updatedAt }] of Object.entries(EDITORIAL_DATES)) {
    assert.ok(updatedAt <= hoje, `${path}: updatedAt no futuro`)
    assert.ok(publishedAt <= updatedAt, `${path}: publicada depois de atualizada`)
  }
})

test('a CI roda os validadores: consistência bloqueia, frescor só avisa', () => {
  const yml = fs.readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
  assert.ok(yml.includes('Validadores de SEO (hard gate)'))
  const hard = yml.slice(yml.indexOf('Validadores de SEO (hard gate)'), yml.indexOf('Frescor editorial (aviso, não bloqueia)'))
  assert.match(hard, /validate:seo-consistency/)
  assert.doesNotMatch(hard, /continue-on-error/)
  const aviso = yml.slice(yml.indexOf('Frescor editorial (aviso, não bloqueia)'))
  assert.match(aviso.slice(0, 300), /continue-on-error: true/)
})
