import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SEND_PAUSE_MAX_AGE_MS } from '../src/domain/painel/sendPauseStatus.js'
import { explainErrorMsg } from '../dashboard/lib/painel/logsCopy.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// Incidente 2026-09-24: linhas "na fila" de 9 a 73 dias (envio morto num
// reinício antigo) fariam a faixa acusar espera que não existe.
test('a faixa só conta fila das últimas 6h (ignora linha-fantasma)', () => {
  assert.equal(SEND_PAUSE_MAX_AGE_MS, 6 * 60 * 60 * 1000)
  const route = read('src/api/routes/logs.js')
  assert.match(route, /sentAt: \{ gte: new Date\(Date\.now\(\) - SEND_PAUSE_MAX_AGE_MS\) \}/)
})

test('faixa é uma linha só, chamativa, com link Ajustar', () => {
  const shell = read('dashboard/app/painel/PainelShell.js')
  const banner = shell.slice(shell.indexOf('function SendPauseBanner'), shell.indexOf('/* Canal parado porque'))
  assert.match(banner, /className="pnl-hold-banner"/)
  assert.doesNotMatch(banner, /notice\.body/)
  assert.match(read('dashboard/app/painel/painel.css'), /\.pnl-hold-banner \{[^}]*var\(--warn\)/)
})

test('"esperou tempo demais" aponta para o Anti-banimento, não para a tela antiga', () => {
  for (const msg of ['skip:queue_expired:age=320min:max=300min', 'skip:queue_expired']) {
    const text = explainErrorMsg(msg)
    assert.match(text, /Anti-banimento/)
    assert.doesNotMatch(text, /Preservação por grupo e canal/)
  }
  assert.doesNotMatch(read('dashboard/components/WhatsAppConnectedOverview.js'), /Preservação por grupo e canal|href="\/painel\/preservacao\/destinos"/)
})
