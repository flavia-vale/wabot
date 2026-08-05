import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describeStaleWorkerCode, shouldWarnStaleWorkerCode, STALE_CODE_TOLERANCE_MS } from '../src/ops/staleWorkerCodeGuard.js'
import { computeCodeChangedAtMs } from '../src/ops/codeVersion.js'

const HORA = 3_600_000

test('avisa quando o código é mais novo que o boot do supervisor (o caso real)', () => {
  // Reprodução do incidente: supervisor de pé desde 01/08, fix gravado em
  // 05/08 — 4 dias de código no disco sem valer para os clientes.
  const supervisorBootedAtMs = Date.parse('2026-08-01T11:47:57Z')
  const codeChangedAtMs = Date.parse('2026-08-05T11:53:21Z')

  assert.equal(shouldWarnStaleWorkerCode({ supervisorMode: 'remote', supervisorBootedAtMs, codeChangedAtMs }), true)
})

test('NÃO avisa em modo inline — a API refaz o fork dos workers no deploy', () => {
  const supervisorBootedAtMs = Date.now() - 4 * 24 * HORA
  const codeChangedAtMs = Date.now()

  assert.equal(shouldWarnStaleWorkerCode({ supervisorMode: 'inline', supervisorBootedAtMs, codeChangedAtMs }), false)
  assert.equal(shouldWarnStaleWorkerCode({ supervisorMode: undefined, supervisorBootedAtMs, codeChangedAtMs }), false)
})

test('NÃO avisa quando o supervisor subiu DEPOIS do código (estado saudável)', () => {
  // É o estado após reiniciar o supervisor: workers com o código novo.
  const codeChangedAtMs = Date.parse('2026-08-05T11:53:21Z')
  const supervisorBootedAtMs = Date.parse('2026-08-05T14:57:35Z')

  assert.equal(shouldWarnStaleWorkerCode({ supervisorMode: 'remote', supervisorBootedAtMs, codeChangedAtMs }), false)
})

test('tolerância cobre deploy normal, onde pull e restart são quase simultâneos', () => {
  const supervisorBootedAtMs = Date.now()

  // Dentro da folga: não avisa.
  assert.equal(shouldWarnStaleWorkerCode({
    supervisorMode: 'remote',
    supervisorBootedAtMs,
    codeChangedAtMs: supervisorBootedAtMs + STALE_CODE_TOLERANCE_MS - 1,
  }), false)

  // Fora da folga: avisa.
  assert.equal(shouldWarnStaleWorkerCode({
    supervisorMode: 'remote',
    supervisorBootedAtMs,
    codeChangedAtMs: supervisorBootedAtMs + STALE_CODE_TOLERANCE_MS + 1,
  }), true)
})

test('fail-safe: sem dado confiável NÃO avisa (alarme falso treina a ignorar)', () => {
  const codeChangedAtMs = Date.now()
  for (const bootedAt of [null, undefined, 0, -1, NaN, 'ontem']) {
    assert.equal(
      shouldWarnStaleWorkerCode({ supervisorMode: 'remote', supervisorBootedAtMs: bootedAt, codeChangedAtMs }),
      false,
      `deveria ser silencioso para bootedAt=${String(bootedAt)}`,
    )
  }
  assert.equal(shouldWarnStaleWorkerCode({ supervisorMode: 'remote', supervisorBootedAtMs: Date.now(), codeChangedAtMs: null }), false)
  assert.equal(shouldWarnStaleWorkerCode(), false)
})

test('mensagem diz o tamanho do atraso e o que fazer, sem jargão de processo', () => {
  const supervisorBootedAtMs = Date.parse('2026-08-05T10:00:00Z')
  const codeChangedAtMs = Date.parse('2026-08-05T13:30:00Z')
  const msg = describeStaleWorkerCode({ supervisorBootedAtMs, codeChangedAtMs })

  assert.match(msg, /3h30/)
  assert.match(msg, /não estão valendo/i)
  assert.match(msg, /reconecta todas as sessões/i)
  assert.equal(describeStaleWorkerCode({}), '')
})

test('computeCodeChangedAtMs pega o arquivo mais recente e ignora node_modules/test', async () => {
  const raiz = await mkdtemp(path.join(tmpdir(), 'wabot-codever-'))
  const antigo = Date.parse('2026-08-01T00:00:00Z')
  const novo = Date.parse('2026-08-05T00:00:00Z')
  const futuroIgnorado = Date.parse('2026-08-09T00:00:00Z')

  await writeFile(path.join(raiz, 'a.js'), '//')
  await utimes(path.join(raiz, 'a.js'), new Date(antigo), new Date(antigo))

  await mkdir(path.join(raiz, 'core'))
  await writeFile(path.join(raiz, 'core', 'b.js'), '//')
  await utimes(path.join(raiz, 'core', 'b.js'), new Date(novo), new Date(novo))

  // Nem dependência instalada nem teste representam código em execução —
  // `npm ci` mexe em node_modules em todo deploy e criaria alarme falso.
  await mkdir(path.join(raiz, 'node_modules'))
  await writeFile(path.join(raiz, 'node_modules', 'c.js'), '//')
  await utimes(path.join(raiz, 'node_modules', 'c.js'), new Date(futuroIgnorado), new Date(futuroIgnorado))

  await mkdir(path.join(raiz, 'test'))
  await writeFile(path.join(raiz, 'test', 'd.js'), '//')
  await utimes(path.join(raiz, 'test', 'd.js'), new Date(futuroIgnorado), new Date(futuroIgnorado))

  // Arquivo que não é código também não conta.
  await writeFile(path.join(raiz, 'notas.md'), '#')
  await utimes(path.join(raiz, 'notas.md'), new Date(futuroIgnorado), new Date(futuroIgnorado))

  assert.equal(await computeCodeChangedAtMs(raiz), novo)
})

test('computeCodeChangedAtMs devolve 0 para diretório inexistente (fail-safe)', async () => {
  assert.equal(await computeCodeChangedAtMs('/caminho/que/nao/existe/xyz'), 0)
})
