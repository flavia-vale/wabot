import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

/* Guarda de regressão do incidente 2026-07-31.
 *
 * Dois commits com 1 minuto de diferença (c0201487 e 5bee4a71) implementaram o
 * IndexNow em paralelo e deixaram DOIS arquivos de chave em dashboard/public/.
 * O script passou a apontar para a chave do segundo commit, que o IndexNow
 * rejeitava com 403 UserForbiddedToAccessSite — deixando o step de deploy de
 * produção vermelho em toda promoção para main, sem ninguém perceber por dias.
 *
 * Estes testes não falam com a rede: validam só as invariantes locais que, se
 * respeitadas, impedem exatamente aquele estado.
 */

const here = path.dirname(url.fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const publicDir = path.join(repoRoot, 'dashboard', 'public')
const scriptPath = path.join(repoRoot, 'scripts', 'notify-indexnow.mjs')

const KEY_FILE_RE = /^[0-9a-f]{8,128}\.txt$/

function listKeyFiles() {
  return fs.readdirSync(publicDir).filter((name) => KEY_FILE_RE.test(name))
}

function readScriptKey() {
  const source = fs.readFileSync(scriptPath, 'utf8')
  const match = source.match(/^const INDEXNOW_KEY = '([^']+)'/m)
  assert.ok(match, 'INDEXNOW_KEY não encontrado em scripts/notify-indexnow.mjs')
  return match[1]
}

test('existe exatamente um arquivo de chave do IndexNow em dashboard/public', () => {
  const keyFiles = listKeyFiles()
  assert.equal(
    keyFiles.length,
    1,
    `esperado 1 arquivo de chave, encontrado ${keyFiles.length}: ${keyFiles.join(', ')}. ` +
      'Ao rotacionar a chave, remova o .txt antigo no mesmo PR — dois arquivos foi a causa do incidente de 2026-07-31.'
  )
})

test('INDEXNOW_KEY do script bate com o nome do arquivo publicado', () => {
  const [keyFile] = listKeyFiles()
  assert.equal(
    `${readScriptKey()}.txt`,
    keyFile,
    'a chave no script precisa ser o mesmo valor do nome do arquivo .txt publicado'
  )
})

test('o arquivo de chave contém apenas a chave, sem quebra de linha no fim', () => {
  const [keyFile] = listKeyFiles()
  const raw = fs.readFileSync(path.join(publicDir, keyFile), 'utf8')
  const expected = keyFile.replace(/\.txt$/, '')
  assert.equal(
    raw,
    expected,
    `o arquivo deve conter exatamente "${expected}" e nada mais (sem \\n final). ` +
      'A chave que o IndexNow rejeitava tinha 33 bytes por causa da quebra de linha; a que funciona tem 32.'
  )
})
