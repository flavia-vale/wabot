import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (rel) => readFileSync(join(__dirname, '..', rel), 'utf8')
const adminRoute = read('src/api/routes/admin.js')
const adminPage = read('dashboard/app/admin/page.js')
const cardHelp = read('dashboard/lib/admin/cardHelp.js')
const botWorker = read('src/bot-worker.js')

// RCA 2026-09-14 (viviloppes@gmail.com). O card "Sem receber" JÁ existia na
// primeira página do admin e mostrou ZERO enquanto uma cliente passava dois dias
// sem espelhar nada. Ele estava certo: lia `ops_wa_reception_blind`, um sinal
// que o worker nunca chegava a emitir. Além disso o card tinha duas fragilidades
// próprias, cobertas aqui.

test('a janela do admin é maior que o throttle com que o worker emite o sinal', () => {
  const janela = adminRoute.match(/ADMIN_RECEPTION_BLIND_WINDOW_MS \|\| ([^)]+)\)/)
  const throttle = botWorker.match(/WA_RECEPTION_SIGNAL_THROTTLE_MS \|\| ([^)]+)\)/)
  assert.ok(janela, 'default da janela do admin não encontrado')
  assert.ok(throttle, 'default do throttle do worker não encontrado')
  const avalia = (expr) => Function(`"use strict";return (${expr.replace(/_/g, '')})`)()
  const janelaMs = avalia(janela[1])
  const throttleMs = avalia(throttle[1])
  assert.ok(
    janelaMs >= throttleMs * 2,
    `a janela (${janelaMs}ms) precisa ser bem maior que o throttle (${throttleMs}ms): iguais, o card pisca para zero no vão entre uma emissão e a seguinte`
  )
})

test('o card separa quem parou agora de quem está cega atravessando reconexões', () => {
  assert.match(adminRoute, /semReceberHaMuito:/, 'o backend precisa contar as cegas graves separadamente')
  assert.match(adminRoute, /acrossReconnects/, 'a separação sai do metadata do sinal')
  assert.match(adminRoute, /semReceberPiorSilencioMs/, 'o admin precisa dizer HÁ QUANTO TEMPO')
})

test('uma única conta cega há muito tempo já pinta o card de vermelho', () => {
  const trecho = adminPage.slice(adminPage.indexOf('label="Sem receber"'))
  const cardInteiro = trecho.slice(0, trecho.indexOf('/>') + 2)
  assert.match(
    cardInteiro,
    /semReceberHaMuito \?\? 0\) > 0\s*\?\s*'critical'/,
    'cegueira grave não pode depender de limiar de quantidade: uma cliente já é crítico'
  )
  assert.match(cardInteiro, /formatDurationMs\(/, 'o card precisa mostrar há quanto tempo, não só a contagem')
})

test('o backend NÃO usa distinct ao ler o sinal (perderia o metadata)', () => {
  const trecho = adminRoute.slice(adminRoute.indexOf("event: 'ops_wa_reception_blind'"))
  const consulta = trecho.slice(0, trecho.indexOf('}).catch'))
  assert.ok(
    !consulta.includes('distinct'),
    'com distinct a linha que sobrevive é indefinida e o metadata que separa o caso grave fica ao acaso'
  )
  assert.match(consulta, /metadata: true/)
})

test('a ajuda do card explica o caso grave num campo que a tela renderiza', () => {
  const renderizados = ['title', 'oQueE', 'impacto', 'comoResolver']
  const bloco = cardHelp.slice(cardHelp.indexOf('semReceber: {'))
  const corpo = bloco.slice(0, bloco.indexOf('\n  },'))
  const campos = [...corpo.matchAll(/^\s{4}(\w+):/gm)].map(m => m[1])
  for (const campo of campos) {
    assert.ok(
      renderizados.includes(campo),
      `HelpDot só renderiza ${renderizados.join('/')} — texto em "${campo}" nunca apareceria para ninguém`
    )
  }
  assert.match(corpo, /não se resolve sozinho/, 'a ajuda precisa dizer que o caso grave não se resolve sozinho')
})
