import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { extractClickId, isGoogleAdsEnabled, sanitizeGclid } from '../dashboard/lib/google-ads.js'

test('desligado por padrão: sem NEXT_PUBLIC_GADS_ID nada é carregado', () => {
  // Sem a env o site tem que ficar idêntico ao que era — nenhum script de
  // terceiro baixado, nenhuma conversão disparada.
  assert.equal(process.env.NEXT_PUBLIC_GADS_ID, undefined)
  assert.equal(isGoogleAdsEnabled(), false)
})

test('gclid preserva `_` — sanitizador de atribuição corromperia', () => {
  // Esta é a armadilha central: `sanitizeAttributionValue` troca `_` por `-`.
  // Um gclid com underscore passaria por ela virando outro valor, e a
  // importação de conversão offline falharia SEM ERRO VISÍVEL.
  const real = 'Cj0KCQjw_srBhCr'
  assert.equal(sanitizeGclid(real), real)
  assert.ok(sanitizeGclid(real).includes('_'))
})

test('rejeita gclid malformado em vez de gravar lixo', () => {
  for (const bad of ['', null, undefined, 'com espaço', 'a'.repeat(201), '<script>', 'x;y']) {
    assert.equal(sanitizeGclid(bad), '', String(bad))
  }
})

test('extrai gclid, gbraid e wbraid da query', () => {
  assert.deepEqual(extractClickId('?gclid=abc_123'), { key: 'gclid', value: 'abc_123' })
  // gbraid/wbraid são os equivalentes de iOS, onde o Google não entrega o
  // gclid clássico. Ignorá-los perderia a atribuição de todo o tráfego iOS.
  assert.deepEqual(extractClickId('?gbraid=xyz-9'), { key: 'gbraid', value: 'xyz-9' })
  assert.deepEqual(extractClickId('?wbraid=qqq'), { key: 'wbraid', value: 'qqq' })
  assert.equal(extractClickId('?utm_source=google'), null)
  assert.equal(extractClickId(''), null)
})

test('query malformada não quebra', () => {
  for (const bad of [null, undefined, 42, {}, '???']) {
    assert.equal(extractClickId(bad), null, String(bad))
  }
})

test('o servidor aceita gclid e usa sanitização própria, não a de atribuição', () => {
  const src = fs.readFileSync(new URL('../src/api/routes/auth.js', import.meta.url), 'utf8')
  assert.ok(src.includes('gclid: rawGclid'), 'a rota de registro precisa aceitar o campo')
  assert.ok(src.includes('gclid: gclid || null'), 'o gclid precisa entrar na metadata do signup')
  // Se alguém trocar por sanitizeAttributionValue(rawGclid), o `_` vira `-`.
  assert.ok(!/sanitizeAttributionValue\(\s*rawGclid/.test(src), 'não sanitizar gclid com o sanitizador de atribuição')
})

test('gclid sobrevive ao filtro de metadados sensíveis do servidor', () => {
  // sanitizeAnalyticsMetadata descarta chave que case com /(...|key|url|...)/i.
  // Se o campo fosse batizado `click_url` ou `gclid_key`, sumiria em silêncio.
  const analytics = fs.readFileSync(new URL('../src/analytics.js', import.meta.url), 'utf8')
  const match = analytics.match(/const SENSITIVE_KEY_PATTERN = (\/.+\/i)/)
  assert.ok(match, 'SENSITIVE_KEY_PATTERN não encontrado')
  const pattern = new RegExp(match[1].slice(1, -2), 'i')
  assert.equal(pattern.test('gclid'), false)
})

test('a tag só é montada quando configurada, e o gclid é capturado sempre', () => {
  const tag = fs.readFileSync(new URL('../dashboard/components/marketing/GoogleAdsTag.jsx', import.meta.url), 'utf8')
  // A captura do gclid roda no useEffect, ANTES do return null — perder isso
  // faria o site só registrar cliques de anúncio depois da env configurada.
  const effectIdx = tag.indexOf('captureFirstTouchClickId')
  const guardIdx = tag.indexOf('if (!isGoogleAdsEnabled()) return null')
  assert.ok(effectIdx > 0 && guardIdx > 0, 'estrutura do componente mudou')
  assert.ok(effectIdx < guardIdx, 'a captura do gclid não pode depender da env do Ads')
})

test('aceita o send_to completo OU só o rótulo, sem falhar em silêncio', async () => {
  const { resolveConversionSendTo } = await import('../dashboard/lib/google-ads.js')
  const ID = 'AW-1234567890'

  // Formato completo, copiado do snippet do painel: passa direto.
  assert.equal(resolveConversionSendTo('AW-1234567890/AbC-D_efG', ID), 'AW-1234567890/AbC-D_efG')

  // Só o rótulo (erro fácil de cometer ao copiar): montamos o valor completo.
  // Sem isso o Google descarta o disparo SEM ERRO e a campanha fica sem
  // conversao, o que só se descobre estranhando o relatório semanas depois.
  assert.equal(resolveConversionSendTo('AbC-D_efG', ID), 'AW-1234567890/AbC-D_efG')

  // Sem rótulo, ou sem ID e sem barra: nada a enviar.
  assert.equal(resolveConversionSendTo('', ID), '')
  assert.equal(resolveConversionSendTo('AbC-D_efG', ''), '')
})
