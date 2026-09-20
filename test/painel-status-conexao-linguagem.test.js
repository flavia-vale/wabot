// Trava a REDAÇÃO e as regras da tela de status do WhatsApp.
//
// RCA 2026-08: o painel mostrava verde com o espelhamento parado, e piscava
// "Conectando…"/"Gerando QR Code…" a cada reconexão automática (~20 quedas/hora
// na frota). Cliente vendo isso vai re-parear — que é justamente a ação que
// PIORA o estado. O texto e o que aparece fazem parte do produto, então têm
// teste.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageSource = readFileSync(new URL('../dashboard/app/painel/whatsapp/page.js', import.meta.url), 'utf8')

const JARGAO_PROIBIDO = [
  /\bjid\b/i,
  /\blid\b(?!\w)/i,
  /decrypt|descriptograf/i,
  /retry receipt|stream:error|badSession|sender.?key/i,
  /\bsocket\b/i,
  /\bheartbeat\b/i,
  /upsert/i,
]

test('nenhum jargão técnico chega à tela da cliente', () => {
  // Só o que a cliente LÊ: conteúdo de texto do JSX, não nome de variável.
  const textos = [...pageSource.matchAll(/>([^<>{}]{6,})</g)].map(match => match[1])
  for (const regex of JARGAO_PROIBIDO) {
    const vazou = textos.find(texto => regex.test(texto))
    assert.equal(vazou, undefined, `jargão "${regex}" apareceu na tela: ${vazou}`)
  }
})

test('a tela avisa quando está conectado e sem receber mensagens', () => {
  assert.match(pageSource, /sem receber mensagens/i)
  assert.match(pageSource, /not_receiving/)
})

test('reconexão automática não mostra a tela de gerar QR', () => {
  // É essa tela que induz o re-pareamento desnecessário durante uma
  // reconexão que o robô resolve sozinho.
  assert.match(pageSource, /isRunning && !isConnected && !isSelfHealing && !qr && !pairingCode/)
})

test('a tela nunca manda re-parear por causa de instabilidade', () => {
  const textos = [...pageSource.matchAll(/>([^<>{}]{6,})</g)].map(match => match[1]).join(' | ')
  assert.doesNotMatch(textos, /reconecte|escaneie novamente por inst|leia o QR de novo/i)
})

test('estado da cliente vem do servidor, não é recalculado na tela', () => {
  // A decisão (carência, ação necessária, limites) mora em
  // src/core/clientVisibleSessionState.js, que tem teste próprio.
  assert.match(pageSource, /status\?\.clientState\?\.state/)
})

test('visão conectada recebe o plano do usuário que está no escopo da página', () => {
  assert.match(pageSource, /user:\s*painelUser\s*}\s*=\s*usePainel\(\)/)
  assert.match(pageSource, /plan=\{painelUser\?\.plan\}/)
  assert.doesNotMatch(pageSource, /plan=\{user\?\.plan\}/)
})
