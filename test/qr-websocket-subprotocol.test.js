// RCA 2026-09-02 — a troca de marca quebrou o QR em tempo real.
//
// O subprotocolo do WebSocket é um TOKEN do HTTP (RFC 6455 §4.1, que remete ao
// `token` da RFC 7230 §3.2.6): letras, dígitos e um punhado de símbolos, NUNCA
// espaço. A varredura de texto que renomeou a marca no dashboard trocou
// 'BOTinho-auth' por 'Espelha Grupos-auth' — valor inválido pelo RFC e, pior,
// divergente do que a API confere. Nenhum teste olhava as duas pontas juntas,
// então o handshake do QR passou a ser recusado sem nada ficar vermelho.
//
// Este teste existe para que o nome só possa mudar nos dois lados ao mesmo
// tempo, e sempre para um valor que o protocolo aceite.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const raiz = new URL('..', import.meta.url)
const ler = (caminho) => fs.readFileSync(new URL(caminho, raiz), 'utf8')

// RFC 7230 §3.2.6 — tchar
const TOKEN_HTTP = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function subprotocoloDoCliente() {
  const fonte = ler('dashboard/lib/api.js')
  return fonte.match(/export const QR_WS_SUBPROTOCOL = '([^']+)'/)?.[1] ?? null
}

function subprotocolosDaApi() {
  const fonte = ler('src/api/routes/session.js')
  const bruto = fonte.match(/const QR_WS_SUBPROTOCOLS = new Set\(\[([^\]]+)\]\)/)?.[1]
  if (!bruto) return null
  return [...bruto.matchAll(/'([^']+)'/g)].map((m) => m[1])
}

test('o subprotocolo que o dashboard envia é um token HTTP válido (sem espaço)', () => {
  const enviado = subprotocoloDoCliente()
  assert.ok(enviado, 'não achei QR_WS_SUBPROTOCOL em dashboard/lib/api.js')
  assert.match(
    enviado,
    TOKEN_HTTP,
    `"${enviado}" não é um token HTTP válido — subprotocolo de WebSocket não aceita espaço nem acento, e o navegador recusa o handshake antes de sair da máquina`
  )
})

test('o subprotocolo que o dashboard envia é aceito pela API', () => {
  const enviado = subprotocoloDoCliente()
  const aceitos = subprotocolosDaApi()
  assert.ok(aceitos?.length, 'não achei QR_WS_SUBPROTOCOLS em src/api/routes/session.js')
  assert.ok(
    aceitos.includes(enviado),
    `o dashboard envia "${enviado}" e a API só aceita ${aceitos.map((v) => `"${v}"`).join(', ')} — o QR em tempo real fica recusado no handshake. As duas pontas mudam juntas.`
  )
})

test('todo subprotocolo aceito pela API também é token HTTP válido', () => {
  for (const aceito of subprotocolosDaApi() ?? []) {
    assert.match(aceito, TOKEN_HTTP, `"${aceito}" não é token HTTP válido — nenhum navegador conseguiria enviá-lo`)
  }
})

test('o dashboard não monta o subprotocolo com literal solto — passa pela constante', () => {
  const fonte = ler('dashboard/lib/api.js')
  for (const m of fonte.matchAll(/new WebSocket\(.*$/gm)) {
    assert.match(
      m[0],
      /QR_WS_SUBPROTOCOL/,
      `WebSocket aberto sem a constante: ${m[0]} — literal solto é o que permitiu a renomeação silenciosa`
    )
  }
})
