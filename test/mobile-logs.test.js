import { test } from 'node:test'
import assert from 'node:assert/strict'
import { friendlyMobileLogError, isSafeMobileLogUrl, mobileLogLinkActions, toMobileLogItem } from '../dashboard/lib/mobileLogs.js'

test('log mobile traduz erro por item de conversão sem ação falsa', () => {
  const item = toMobileLogItem({
    id: '1',
    status: 'error',
    sentAt: '2026-05-28T10:00:00.000Z',
    messageText: 'Oferta com erro',
    platform: 'amazon',
    sourceGroup: 'conversion',
    destGroup: null,
    originalUrl: 'https://amazon.test/p',
    errorMsg: 'error:conversion:Credenciais ausentes',
  }, new Date('2026-05-28T12:00:00.000Z'))

  assert.equal(item.status, 'falha')
  assert.equal(item.source, 'manual')
  assert.match(item.erro, /Credenciais ausentes/)
  assert.equal(item.canRetryInMobile, false)
})


test('helper de logs mobile aceita somente URLs http/https para abrir', () => {
  assert.equal(isSafeMobileLogUrl('https://example.com/oferta'), true)
  assert.equal(isSafeMobileLogUrl(' http://example.com/oferta '), true)
  assert.equal(isSafeMobileLogUrl('javascript:alert(1)'), false)
  assert.equal(isSafeMobileLogUrl('nota fiscal sem url'), false)
  assert.equal(isSafeMobileLogUrl(''), false)
})

test('friendlyMobileLogError traduz warning:ml_ssid_expired com texto PT-BR', () => {
  const result = friendlyMobileLogError('warning:ml_ssid_expired')
  assert.ok(result.includes('Mercado Livre'), 'deve mencionar Mercado Livre')
  assert.ok(result.includes('SSID') || result.includes('credencial'), 'deve mencionar credencial/SSID')
})


test('friendlyMobileLogError traduz warnings específicos do Mercado Livre', () => {
  assert.match(friendlyMobileLogError('warning:ml_affiliate_forbidden'), /recusou/i)
  assert.match(friendlyMobileLogError('warning:ml_affiliate_rate_limited'), /limitou/i)
  assert.match(friendlyMobileLogError('warning:ml_affiliate_busy'), /Outra conversão/i)
})

// Feature 007-ml-vitrine-fallback-expired (T012): tradução de
// skip:ml_vitrine_missing precisa citar cadastro da vitrine e NUNCA
// mencionar SSID/renove/cookie (FR-005).
test('friendlyMobileLogError: skip:ml_vitrine_missing cita cadastrar a vitrine e não menciona SSID/renove/cookie', () => {
  const result = friendlyMobileLogError('skip:ml_vitrine_missing')
  assert.match(result, /vitrine/i)
  assert.match(result, /IDs de afiliada.*Mercado Livre/i)
  assert.doesNotMatch(result, /ssid/i)
  assert.doesNotMatch(result, /renove/i)
  assert.doesNotMatch(result, /cookie/i)
})

test('friendlyMobileLogError expõe o detalhe técnico do skip:incoming_error', () => {
  const result = friendlyMobileLogError('skip:incoming_error:Cannot read properties of undefined (reading foo)')
  assert.match(result, /processar essa mensagem/i)
  assert.match(result, /Detalhe técnico: Cannot read properties of undefined \(reading foo\)/)
})

test('friendlyMobileLogError sem detalhe mantém a frase genérica do incoming_error', () => {
  const result = friendlyMobileLogError('skip:incoming_error')
  assert.match(result, /processar essa mensagem/i)
  assert.ok(!result.includes('Detalhe técnico'), 'sem detalhe não deve anexar rótulo técnico')
})

// Diagnóstico (RCA de cupom preso em dedup — 3ª rodada de reports): o
// bot-worker grava HÁ QUANTO TEMPO o bloqueio anterior aconteceu direto no
// errorMsg (sufixo :age=Xs:window=Ys), pra distinguir "bloqueio de verdade
// dentro da janela configurada" de "bug". Sem isso, cada report de cupom
// bloqueado virava suposição nova em vez de diagnóstico conclusivo.
test('friendlyMobileLogError mostra tempo exato quando o errorMsg tem o sufixo de diagnóstico', () => {
  const result = friendlyMobileLogError('skip:dedup_recent_link:age=42s:window=300s')
  assert.match(result, /há 42s/)
  assert.match(result, /janela desse tipo de link: 5min/)
})

test('friendlyMobileLogError formata idade em minutos quando >= 60s', () => {
  const result = friendlyMobileLogError('skip:dedup_recent_link_global:age=125s:window=86400s')
  assert.match(result, /há 2min 5s/)
  assert.match(result, /janela desse tipo de link: 1440min/)
})

test('friendlyMobileLogError sem sufixo de diagnóstico mantém o texto genérico (rows antigas)', () => {
  const result = friendlyMobileLogError('skip:dedup_recent_link')
  assert.match(result, /bloqueado para não duplicar/)
  assert.ok(!result.includes('há '), 'sem o sufixo, não deve inventar um tempo')
})

test('ações seguras incluem cópia sempre que há link e abertura só para URL válida', () => {
  const actions = mobileLogLinkActions({
    link: 'https://loja.test/produto',
    conv: 'texto convertido sem url',
  })

  assert.deepEqual(actions.map((action) => action.key), [
    'copy-original',
    'open-original',
    'copy-converted',
  ])
  assert.equal(actions.find((action) => action.key === 'open-original')?.href, 'https://loja.test/produto')
  assert.equal(actions.find((action) => action.key === 'copy-converted')?.value, 'texto convertido sem url')
})
