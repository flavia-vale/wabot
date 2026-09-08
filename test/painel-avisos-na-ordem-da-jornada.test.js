// Achado em teste com conta nova (2026-09-08): ao entrar pela primeira vez, a
// cliente via avisos que não correspondiam ao momento dela na jornada.
//
// Puro + leitura de arquivo: sem banco, sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { shouldShowNoCredentialBanner } from '../src/domain/painel/journeyBanners.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('conta nova que ainda não conectou NÃO é cobrada por loja', () => {
  // O primeiro passo é conectar o WhatsApp. Cobrar a loja antes manda a pessoa
  // para o lugar errado — e o robô nem foi ligado, então o alarme não
  // corresponde a nada.
  assert.equal(
    shouldShowNoCredentialBanner({ hasAnyCredential: false, online: false, phone: null }),
    false,
  )
})

test('conectada e sem loja: aí sim o aviso é verdade', () => {
  assert.equal(
    shouldShowNoCredentialBanner({ hasAnyCredential: false, online: true, phone: '5511999999999' }),
    true,
  )
})

test('conectou, caiu e está sem loja: continua precisando do aviso', () => {
  // O número salvo sobrevive à desconexão. O robô dessa pessoa está de fato
  // sem publicar — ela precisa saber.
  assert.equal(
    shouldShowNoCredentialBanner({ hasAnyCredential: false, online: false, phone: '5511999999999' }),
    true,
  )
})

test('"não sei ainda" nunca vira acusação', () => {
  for (const hasAnyCredential of [null, undefined, true]) {
    assert.equal(
      shouldShowNoCredentialBanner({ hasAnyCredential, online: true, phone: '5511999999999' }),
      false,
      String(hasAnyCredential),
    )
  }
})

test('a regra é a MESMA da tela de conexão — não duas versões', () => {
  // Antes, o painel cobrava a loja antes de conectar e a tela de conexão só
  // depois: as duas superfícies discordavam sobre a mesma jornada.
  const shell = read('../dashboard/app/painel/PainelShell.js')
  assert.match(shell, /shouldShowNoCredentialBanner\(\{ hasAnyCredential, online, phone \}\)/)
  assert.ok(
    !shell.includes('show={hasAnyCredential === false}'),
    'o banner voltou a aparecer sem olhar a jornada',
  )
})

test('vídeo-aula não usa a cor de ERRO', () => {
  // `--danger` neste painel significa alerta. Uma conta nova abria os
  // "Primeiros passos" e via dois blocos vermelhos antes de qualquer coisa,
  // como se algo já tivesse dado errado.
  const page = read('../dashboard/app/painel/checklist/page.js')
  const bloco = page.slice(page.indexOf('function VideoBanner'), page.indexOf('export default'))
  assert.ok(!bloco.includes('var(--danger) 30%'), 'a borda voltou a ser de erro')
  assert.ok(!bloco.includes('var(--danger) 8%'), 'o fundo voltou a ser de erro')
  // O círculo do play continua vermelho: é o que faz o olho reconhecer "vídeo".
  assert.match(bloco, /background: 'var\(--danger\)'/)
})
