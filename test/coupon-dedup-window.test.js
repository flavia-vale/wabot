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

// A dedup local (in-memory), via MessageLog (DB) e a chamada ao Redis global
// PRECISAM usar effectiveDedupWindowMs — se alguma voltar a usar
// linkDedupWindowMs direto, cupom volta a ficar preso na janela diária mesmo
// com couponDedupWindowMs definido.
test('checagens de dedup local/DB/Redis no loop de destinos usam effectiveDedupWindowMs, não linkDedupWindowMs', () => {
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
    /const globalDedup = await globalDedupCheckAndSet\(key, effectiveDedupWindowMs\)/,
    'dedup global via Redis precisa usar effectiveDedupWindowMs',
  )
})

// Bug real (2ª rodada): mesmo com couponDedupWindowMs correto, cupom
// continuava bloqueado. Causa: duas camadas guardavam um TTL/expiresAt
// "congelado" na janela ANTIGA no momento em que a chave/linha foi gravada —
// SendDedupKey.expiresAt e o TTL nativo da chave no Redis — e só liberavam o
// slot quando esse TTL antigo expirasse sozinho (até 24h depois), mesmo
// depois do código já estar rodando com a janela curta nova. As duas
// camadas precisam parar de depender de um TTL fixo pra representar a janela
// lógica de dedup.
test('reserva SendDedupKey usa SEND_DEDUP_RESERVATION_TTL_MS fixo, não effectiveDedupWindowMs', () => {
  assert.match(
    botWorkerSource,
    /const SEND_DEDUP_RESERVATION_TTL_MS = Math\.max\(30_000, Number\(process\.env\.SEND_DEDUP_RESERVATION_TTL_MS\) \|\| 5 \* 60_000\)/,
    'SendDedupKey precisa de um TTL fixo e curto, independente da janela lógica do linkKind',
  )
  assert.match(
    botWorkerSource,
    /const reservationExpiresAt = new Date\(Date\.now\(\) \+ SEND_DEDUP_RESERVATION_TTL_MS\)/,
    'reserva atômica (SendDedupKey) precisa expirar em SEND_DEDUP_RESERVATION_TTL_MS, não effectiveDedupWindowMs/linkDedupWindowMs',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /const reservationExpiresAt = new Date\(Date\.now\(\) \+ effectiveDedupWindowMs\)/,
    'regressão: reserva não pode voltar a usar effectiveDedupWindowMs (prende cupom no TTL antigo até 24h)',
  )
})

test('dedup global via Redis compara timestamp guardado contra ttlMs do chamador, não o TTL nativo da chave', () => {
  assert.match(
    botWorkerSource,
    /const GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS = Math\.max\(60_000, Number\(process\.env\.GLOBAL_DEDUP_REDIS_SAFETY_CAP_MS\) \|\| 24 \* 60 \* 60_000\)/,
    'TTL nativo da chave Redis precisa ser um safety-cap fixo, não a janela lógica',
  )
  assert.match(
    botWorkerSource,
    /if \(existingTs && now - existingTs < ttlMs\) return \{ duplicate: true \}/,
    'decisão de duplicata precisa comparar o timestamp guardado contra ttlMs (janela do chamador) em tempo de leitura',
  )
  assert.doesNotMatch(
    botWorkerSource,
    /const ok = await r\.set\(`dedup:\$\{userId\}:\$\{key\}`, '1', 'PX', ttlMs, 'NX'\)/,
    'regressão: não pode voltar a gravar TTL=ttlMs direto na chave (prende dedup na janela de quando a chave foi criada)',
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

test('sendDedupKey.updateMany (vínculo com o MessageLog) continua logo após a reserva, sem depender do TTL', () => {
  assert.match(
    botWorkerSource,
    /db\.sendDedupKey\.updateMany\(\{\s*where: \{ id: \{ in: reservedDedupKeys \} \},\s*data: \{ messageLogId: log\.id \},/,
    'a reserva precisa continuar sendo vinculada ao MessageLog logo após criado — SEND_DEDUP_RESERVATION_TTL_MS só cobre esse intervalo curto',
  )
})
