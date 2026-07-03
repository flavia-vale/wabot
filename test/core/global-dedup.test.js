import test from 'node:test'
import assert from 'node:assert/strict'
import Redis from 'ioredis-mock'

import { checkAndSetGlobalDedup } from '../../src/core/globalDedup.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('primeira chamada não é duplicata (chave nova)', async () => {
  const r = new Redis()
  const result = await checkAndSetGlobalDedup(r, 'k1', 5_000)
  assert.equal(result.duplicate, false)
})

test('segunda chamada dentro da janela é duplicata', async () => {
  const r = new Redis()
  await checkAndSetGlobalDedup(r, 'k1', 5_000)
  const result = await checkAndSetGlobalDedup(r, 'k1', 5_000)
  assert.equal(result.duplicate, true)
})

// Diagnóstico (RCA de cupom preso em dedup): quando duplicata, o resultado
// precisa expor HÁ QUANTO TEMPO a chave original foi gravada — bot-worker.js
// usa isso pra registrar no painel "bloqueado há Xs", em vez de um texto
// genérico que não dá pra confirmar se o bloqueio está mesmo dentro da janela.
test('resultado duplicado expõe ageMs (tempo desde a gravação original)', async () => {
  const r = new Redis()
  await checkAndSetGlobalDedup(r, 'k1', 5_000)
  await sleep(30)
  const result = await checkAndSetGlobalDedup(r, 'k1', 5_000)
  assert.equal(result.duplicate, true)
  assert.ok(Number.isFinite(result.ageMs), 'ageMs precisa ser um número')
  assert.ok(result.ageMs >= 25, `ageMs deveria refletir os ~30ms que passaram (foi ${result.ageMs})`)
})

// Caso central deste fix: janela CURTA (simula couponDedupWindowMs) — depois
// que o tempo passa da janela, a MESMA chave deixa de ser duplicata, sem
// precisar esperar o TTL nativo (safetyCapMs, bem mais longo) expirar.
test('após a janela lógica passar, deixa de ser duplicata mesmo com safetyCapMs bem maior', async () => {
  const r = new Redis()
  const windowMs = 80
  const safetyCapMs = 10_000 // "24h" simulado — bem maior que windowMs
  const first = await checkAndSetGlobalDedup(r, 'coupon-key', windowMs, { safetyCapMs })
  assert.equal(first.duplicate, false)

  const tooSoon = await checkAndSetGlobalDedup(r, 'coupon-key', windowMs, { safetyCapMs })
  assert.equal(tooSoon.duplicate, true, 'antes da janela passar, ainda deve bloquear')

  await sleep(windowMs + 40)

  const afterWindow = await checkAndSetGlobalDedup(r, 'coupon-key', windowMs, { safetyCapMs })
  assert.equal(afterWindow.duplicate, false, 'depois da janela lógica passar, a MESMA chave (ainda viva no Redis sob safetyCapMs) não pode mais bloquear')
})

// Regressão do bug original: uma chave gravada sob uma janela LONGA (ex.:
// dedup de produto, 24h) não pode "vazar" e continuar bloqueando se uma
// chamada POSTERIOR pra essa MESMA chave vier com uma janela CURTA (ex.: se
// o linkKind de uma URL for reclassificado). O teste simula isso com
// safetyCapMs pequeno o bastante pra observar em tempo de teste.
test('chave escrita sob janela longa não bloqueia indefinidamente chamada seguinte com janela curta', async () => {
  const r = new Redis()
  const safetyCapMs = 10_000
  const longWindowMs = 300 // "janela longa" simulada
  const shortWindowMs = 40 // "janela curta" simulada

  await checkAndSetGlobalDedup(r, 'k2', longWindowMs, { safetyCapMs })
  // Chamada imediatamente depois, mas com janela CURTA: ainda dentro dela? Bloqueia.
  const soon = await checkAndSetGlobalDedup(r, 'k2', shortWindowMs, { safetyCapMs })
  assert.equal(soon.duplicate, true)

  await sleep(shortWindowMs + 20)

  // Passou da janela curta (mas NÃO da longa nem do safetyCap) — não deve bloquear.
  const afterShortWindow = await checkAndSetGlobalDedup(r, 'k2', shortWindowMs, { safetyCapMs })
  assert.equal(afterShortWindow.duplicate, false)
})

test('chave sobrevive no Redis por até safetyCapMs mesmo depois de deixar de ser duplicata (não é deletada, só reescrita)', async () => {
  const r = new Redis()
  const windowMs = 30
  const safetyCapMs = 5_000
  await checkAndSetGlobalDedup(r, 'k3', windowMs, { safetyCapMs })
  await sleep(windowMs + 20)
  const result = await checkAndSetGlobalDedup(r, 'k3', windowMs, { safetyCapMs })
  assert.equal(result.duplicate, false)
  const stillThere = await r.get('k3')
  assert.ok(stillThere, 'a chave deve continuar existindo (sobrescrita com timestamp novo), não ter sido deletada')
})

test('chaves diferentes não interferem entre si', async () => {
  const r = new Redis()
  await checkAndSetGlobalDedup(r, 'a', 5_000)
  const result = await checkAndSetGlobalDedup(r, 'b', 5_000)
  assert.equal(result.duplicate, false)
})
