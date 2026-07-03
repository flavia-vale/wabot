import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

// Bug real: mensagens de cupom (Amazon/ML/Shopee) usam a MESMA janela diária
// de dedup (24h, linkDedupWindowMs) das ofertas de produto. Como o link de
// cupom costuma ser uma página FIXA (ex.: landing de campanha) repostada
// várias vezes ao dia com códigos diferentes, a janela diária bloqueava quase
// todo reenvio legítimo — pedido explícito da cliente: cupom precisa de uma
// janela bem mais curta (5min default), produto continua com a janela diária.
const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('couponDedupWindowMs existe com default de 5min e override via COUPON_DEDUP_WINDOW_MS', () => {
  assert.match(
    botWorkerSource,
    /const couponDedupWindowMs = Math\.max\(1_000, Number\(process\.env\.COUPON_DEDUP_WINDOW_MS\) \|\| 5 \* 60_000\)/,
    'janela curta de cupom precisa existir com default 5min e override por env',
  )
})

test('effectiveDedupWindowMs é escolhido por primary.linkKind === coupon antes do loop de destinos', () => {
  assert.match(
    botWorkerSource,
    /const isCouponLink = primary\.linkKind === 'coupon'/,
  )
  assert.match(
    botWorkerSource,
    /const effectiveDedupWindowMs = isCouponLink \? couponDedupWindowMs : linkDedupWindowMs/,
  )
})

// As 4 checagens de dedup (local, DB, reserva atômica, Redis global) e a
// expiração da reserva PRECISAM usar effectiveDedupWindowMs — se alguma
// voltar a usar linkDedupWindowMs direto, cupom volta a ficar preso na
// janela diária mesmo com couponDedupWindowMs definido.
test('todas as checagens de dedup no loop de destinos usam effectiveDedupWindowMs, não linkDedupWindowMs', () => {
  assert.match(
    botWorkerSource,
    /Date\.now\(\) - dedup\.links\[key\] < effectiveDedupWindowMs/,
    'dedup local (in-memory) precisa usar effectiveDedupWindowMs',
  )
  assert.match(
    botWorkerSource,
    /sentAt: \{ gte: new Date\(Date\.now\(\) - effectiveDedupWindowMs\) \}/,
    'dedup via MessageLog (DB) precisa usar effectiveDedupWindowMs',
  )
  assert.match(
    botWorkerSource,
    /const reservationExpiresAt = new Date\(Date\.now\(\) \+ effectiveDedupWindowMs\)/,
    'reserva atômica (SendDedupKey) precisa expirar em effectiveDedupWindowMs, não linkDedupWindowMs',
  )
  assert.match(
    botWorkerSource,
    /const globalDedup = await globalDedupCheckAndSet\(key, effectiveDedupWindowMs\)/,
    'dedup global via Redis precisa usar effectiveDedupWindowMs',
  )
})

test('registerDedupBlock aceita dedupWindowMs explícito e as 4 chamadas do loop passam effectiveDedupWindowMs', () => {
  assert.match(
    botWorkerSource,
    /async function registerDedupBlock\(\{ reason, platform, destJid, originalUrl: incomingUrl, convertedUrl: outgoingUrl, messageText, dedupWindowMs = linkDedupWindowMs \}\)/,
    'registerDedupBlock precisa aceitar dedupWindowMs (default linkDedupWindowMs para chamadores fora do loop)',
  )
  const callsWithEffectiveWindow = (botWorkerSource.match(/dedupWindowMs: effectiveDedupWindowMs,/g) || []).length
  assert.equal(callsWithEffectiveWindow, 4, 'as 4 chamadas de registerDedupBlock dentro do loop de destinos precisam passar effectiveDedupWindowMs')
})
