import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSessionKey,
  parseSessionKey,
  accountIdFromSessionKey,
  isExtraSessionKey,
  roleForSlot,
  PRIMARY_SLOT,
  MAX_SLOT,
} from '../src/domain/session/sessionKey.js'
import { multiNumberEnabled } from '../src/domain/session/multiNumberFlag.js'

test('número 1 usa a própria conta como chave — nada muda para quem já existe', () => {
  assert.equal(buildSessionKey('cku123'), 'cku123')
  assert.equal(buildSessionKey('cku123', 1), 'cku123')
  assert.deepEqual(parseSessionKey('cku123'), { userId: 'cku123', slot: PRIMARY_SLOT })
})

test('número extra ganha ~n<slot> e volta para a conta', () => {
  const key = buildSessionKey('cku123', 2)
  assert.equal(key, 'cku123~n2')
  assert.deepEqual(parseSessionKey(key), { userId: 'cku123', slot: 2 })
  assert.equal(accountIdFromSessionKey(key), 'cku123')
  assert.equal(isExtraSessionKey(key), true)
  assert.equal(isExtraSessionKey('cku123'), false)
})

test('recusa slot e conta inválidos ao montar', () => {
  assert.throws(() => buildSessionKey('cku123', 0))
  assert.throws(() => buildSessionKey('cku123', MAX_SLOT + 1))
  assert.throws(() => buildSessionKey('cku123', 1.5))
  assert.throws(() => buildSessionKey(''))
  assert.throws(() => buildSessionKey('a~n2', 2))
  assert.throws(() => buildSessionKey('../etc', 1))
})

test('chave malformada vira null, nunca lança (vem de env/Redis/IPC)', () => {
  for (const bad of ['', null, undefined, 'x~n', 'x~n1', `x~n${MAX_SLOT + 1}`, 'x~n2~n2', '~n2', 'a b', '../x']) {
    assert.equal(parseSessionKey(bad), null, String(bad))
    assert.equal(accountIdFromSessionKey(bad), null)
  }
})

test('roleForSlot: só o número ativo envia; sem ativo válido, o 1 é o ativo', () => {
  assert.equal(roleForSlot({ slot: 1, activeWaSlot: 1 }), 'active')
  assert.equal(roleForSlot({ slot: 2, activeWaSlot: 1 }), 'standby')
  assert.equal(roleForSlot({ slot: 2, activeWaSlot: 2 }), 'active')
  assert.equal(roleForSlot({ slot: 1, activeWaSlot: 2 }), 'standby')
  assert.equal(roleForSlot({ slot: 1 }), 'active')
  assert.equal(roleForSlot({ slot: 1, activeWaSlot: 0 }), 'active')
})

test('flag nasce desligada; só "true" liga', () => {
  assert.equal(multiNumberEnabled({}), false)
  assert.equal(multiNumberEnabled({ MULTI_NUMBER_ENABLED: '1' }), false)
  assert.equal(multiNumberEnabled({ MULTI_NUMBER_ENABLED: ' TRUE ' }), true)
})

// Guarda estrutural: ninguém monta a chave de extra à mão.
test('ninguém monta "~n" fora de sessionKey.js', async () => {
  const { execFileSync } = await import('node:child_process')
  const out = execFileSync('grep', ['-rln', '--include=*.js', "~n\\${\\|'~n'\\|\"~n\"\\|`~n", 'src'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  assert.deepEqual(out.filter((f) => !f.endsWith('domain/session/sessionKey.js')), [])
})
