import test from 'node:test'
import assert from 'node:assert/strict'
import { explainErrorMsg } from '../dashboard/lib/painel/logsCopy.js'

// Diagnóstico (RCA de cupom preso em dedup — 3ª rodada de reports): mesma
// lógica de test/mobile-logs.test.js, para o painel desktop/tablet
// (dashboard/lib/painel/logsCopy.js duplica a tradução de errorMsg do
// mobileLogs.js — ver AGENTS.md/precedente já existente no arquivo).
test('explainErrorMsg mostra tempo exato quando o errorMsg tem o sufixo de diagnóstico', () => {
  const result = explainErrorMsg('skip:dedup_recent_link:age=42s:window=300s')
  assert.match(result, /há 42s/)
  assert.match(result, /janela desse tipo de link: 5min/)
})

test('explainErrorMsg formata idade em minutos quando >= 60s', () => {
  const result = explainErrorMsg('skip:dedup_recent_link_global:age=125s:window=86400s')
  assert.match(result, /há 2min 5s/)
  assert.match(result, /janela desse tipo de link: 1440min/)
})

test('explainErrorMsg sem sufixo de diagnóstico mantém o texto genérico (rows antigas)', () => {
  const result = explainErrorMsg('skip:dedup_recent_link')
  assert.match(result, /bloqueado para não duplicar/)
  assert.ok(!result.includes('há '), 'sem o sufixo, não deve inventar um tempo')
})

test('explainErrorMsg outros prefixos continuam funcionando (sem regressão)', () => {
  assert.match(explainErrorMsg('skip:title_mismatch'), /não combina com o produto/)
  assert.match(explainErrorMsg('warning:amazon_cookies_expired'), /cookies da Amazon/)
  assert.equal(explainErrorMsg(null), null)
})

// Feature 007-ml-vitrine-fallback-expired (T012): tradução de
// skip:ml_vitrine_missing precisa citar "cadastrar a vitrine" e NUNCA
// mencionar SSID/renove/cookie (FR-005) — renovar o SSID nunca resolve
// vitrine de terceiro, mencionar isso é enganoso.
test('explainErrorMsg: skip:ml_vitrine_missing cita cadastrar a vitrine e não menciona SSID/renove/cookie', () => {
  const result = explainErrorMsg('skip:ml_vitrine_missing')
  assert.match(result, /cadastr(ar|ou) o link da SUA vitrine|cadastrar a vitrine/i)
  assert.match(result, /IDs de afiliada/i)
  assert.doesNotMatch(result, /ssid/i)
  assert.doesNotMatch(result, /renove/i)
  assert.doesNotMatch(result, /cookie/i)
})

// RCA 2026-09-19: a cliente lia "ainda não fazemos conversão automática de
// afiliado para essa loja" numa oferta da AMAZON, que convertemos desde sempre.
// O que tinha acontecido é que a promoção saiu do ar no site de quem publicou,
// antes de o robô abrir o link. As duas causas pedem ações opostas: uma é
// esperar por um suporte que já existe, a outra é "acabou, não há o que fazer".
test('oferta encerrada na origem tem motivo próprio, e não fala em loja sem suporte', () => {
  const encerrada = explainErrorMsg('skip:policy:all:any:text:offer_ended_at_source')
  assert.match(encerrada, /encerrada/i)
  assert.doesNotMatch(encerrada, /não fazemos convers/i)
  assert.doesNotMatch(encerrada, /fora das regras/i)

  // A frase antiga continua valendo para o caso que ela de fato descreve.
  const semSuporte = explainErrorMsg('skip:policy:all:any:text:unsupported_store')
  assert.match(semSuporte, /não fazemos convers/i)

  // E o genérico não pode ser engolido por nenhum dos dois.
  assert.match(explainErrorMsg('skip:policy:all:any:text'), /fora das regras/i)
})
