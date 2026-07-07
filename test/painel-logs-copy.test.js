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
  // Copy reframada (2026-07): o warning é informativo (comissão credita via
  // ?tag=; amzn.to é best-effort e a sessão expira em minutos), não alarme.
  assert.match(explainErrorMsg('warning:amazon_cookies_expired'), /creditando sua comissão/)
  assert.match(explainErrorMsg('warning:amazon_cookies_expired'), /amzn\.to/)
  assert.equal(explainErrorMsg(null), null)
})
