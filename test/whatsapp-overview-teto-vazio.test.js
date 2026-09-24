import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Incidente 2026-09-24: a tela "WhatsApp conectado" abria com teto de 250/dia
// já preenchido, e quem clicava em "Salvar" gravava um limite que nunca
// escolheu. Teto vazio = sem limite (decideDestination só barra com dailyCap != null).
const src = readFileSync(new URL('../dashboard/components/WhatsAppConnectedOverview.js', import.meta.url), 'utf8')

test('tela do WhatsApp não vem com teto diário preenchido', () => {
  assert.doesNotMatch(src, /dailyCap:\s*250/)
  assert.doesNotMatch(src, /\|\|\s*250/)
  assert.match(src, /dailyCap:\s*null/)
})

test('campo de teto vazio grava null (sem limite), nunca 0 ou NaN', () => {
  assert.match(src, /placeholder="Sem limite"/)
  assert.match(src, /e\.target\.value === '' \|\| !Number\.isInteger\(n\) \|\| n < 1 \? null : n/)
})
