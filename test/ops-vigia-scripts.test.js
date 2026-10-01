import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = f => fs.readFileSync(new URL(`../scripts/${f}`, import.meta.url), 'utf8')

test('vigia.mjs é somente leitura: sem escrita no banco nem no redis', () => {
  const s = read('vigia.mjs')
  assert.doesNotMatch(s, /\.(create|update|updateMany|delete|deleteMany|upsert)\(/)
  assert.doesNotMatch(s, /redis\.(set|del|lpush|rpush|publish|flushall)/i)
  assert.doesNotMatch(s, /\$executeRaw/)
})

test('voltar_ao_ponto.sh é dry-run por padrão e nunca roda pm2/restart', () => {
  const s = read('voltar_ao_ponto.sh')
  assert.match(s, /APLICAR:-0.*!= "1"/)
  // pm2 só aparece como TEXTO impresso (depois do heredoc), nunca executado.
  assert.doesNotMatch(s.split('cat <<MSG')[0].replace(/^\s*#.*$/gm, ''), /pm2/)
  assert.doesNotMatch(s, /reset --hard|push --force|rm -rf/)
})

test('ponto_retorno.sh não imprime o .env inteiro', () => {
  const s = read('ponto_retorno.sh')
  assert.doesNotMatch(s, /cat .*\.env/)
  assert.match(s, /SUPERVISOR_NODE_ROUTING/)
})

test('vigia_cron.sh usa trava e só notifica na transição para vermelho', () => {
  const s = read('vigia_cron.sh')
  assert.match(s, /flock -n/)
  assert.match(s, /\$PREV" != red/)
})
