import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ANALYTICS_EVENTS, PUBLIC_ANALYTICS_EVENTS } from '../src/analytics.js'
import { clearLeadCaptureAttempts, consumeLeadCaptureAttempt } from '../src/api/routes/public.js'

test('eventos de captura estão nas DUAS allowlists', () => {
  // Faltar em uma das duas faz o dado sumir sem erro — ver src/analytics.js.
  for (const event of ['tool_lead_captured', 'tool_lead_rejected']) {
    assert.equal(PUBLIC_ANALYTICS_EVENTS.has(event), true, `${event} fora de PUBLIC_ANALYTICS_EVENTS`)
    assert.equal(ANALYTICS_EVENTS.has(event), true, `${event} fora de ANALYTICS_EVENTS`)
  }
})

test('rate limit da captura é bem mais apertado que o de analytics', () => {
  clearLeadCaptureAttempts()
  const now = Date.now()

  for (let i = 0; i < 8; i += 1) {
    assert.equal(consumeLeadCaptureAttempt({ ip: '1.1.1.1', now }).blocked, false, `tentativa ${i + 1}`)
  }
  assert.equal(consumeLeadCaptureAttempt({ ip: '1.1.1.1', now }).blocked, true)

  // Outro IP não é afetado.
  assert.equal(consumeLeadCaptureAttempt({ ip: '2.2.2.2', now }).blocked, false)
})

test('rate limit libera depois da janela', () => {
  clearLeadCaptureAttempts()
  const now = Date.now()
  for (let i = 0; i < 9; i += 1) consumeLeadCaptureAttempt({ ip: '3.3.3.3', now })
  assert.equal(consumeLeadCaptureAttempt({ ip: '3.3.3.3', now }).blocked, true)

  const later = now + 10 * 60 * 1000 + 1
  assert.equal(consumeLeadCaptureAttempt({ ip: '3.3.3.3', now: later }).blocked, false)
})

/* Guarda de honestidade. O SMTP é opcional neste projeto (sem as envs `SMTP_*`
 * o envio vira no-op silencioso), então enquanto a rota só GUARDA o lead a copy
 * não pode prometer que manda e-mail. Se um dia o envio for ligado de verdade,
 * este teste deve ser atualizado JUNTO com a mudança de copy — nunca antes. */
test('a copy da captura não promete enviar e-mail', () => {
  const source = readFileSync(new URL('../dashboard/components/free-tools/ToolLeadCapture.jsx', import.meta.url), 'utf8')

  // Só o texto visível, para não cair nos comentários que explicam a regra.
  const visibleText = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  for (const promessa of [/enviamos/i, /enviaremos/i, /receber[áa] (o|um|no) e-?mail/i, /te mandamos/i]) {
    assert.ok(!promessa.test(visibleText), `copy promete e-mail (${promessa}) sem SMTP configurado`)
  }
})

test('a captura não esconde o resultado atrás do e-mail', () => {
  const risk = readFileSync(new URL('../dashboard/components/free-tools/WhatsAppRiskCalculator.jsx', import.meta.url), 'utf8')
  const capture = readFileSync(new URL('../dashboard/components/free-tools/ToolLeadCapture.jsx', import.meta.url), 'utf8')

  // O card de captura vem DEPOIS do resultado, e o componente nunca recebe o
  // resultado para renderizar — logo não tem como escondê-lo.
  assert.ok(risk.indexOf('Resultado estimado') < risk.indexOf('<ToolLeadCapture'))
  assert.ok(!capture.includes('result.'))
})
