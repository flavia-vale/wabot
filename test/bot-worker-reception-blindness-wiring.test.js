import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

// RCA 2026-09-14 (viviloppes@gmail.com). A conta ficou dois dias 100% cega —
// zero mensagens aceitas, espelhamento de ~1.100/dia para zero — e nenhuma rede
// de segurança acusou, porque TODAS mediam a partir da conexão atual e a sessão
// dela reconectava a cada ~50min. Os contadores abaixo são a correção: eles só
// funcionam se sobreviverem às reconexões (escopo de módulo) e se forem zerados
// exclusivamente quando uma mensagem é de fato ACEITA. Teste estrutural pelo
// mesmo motivo de bot-worker-retry-cache-wiring.test.js: bot-worker.js roda como
// processo próprio e não expõe essa lógica para import direto.

const CONTADORES = ['failuresSinceLastAccepted', 'stableDropsSinceLastAccepted']

test('os contadores de cegueira ficam em escopo de módulo, fora de startBotInner', () => {
  const startBotInnerIndex = src.indexOf('async function startBotInner()')
  assert.notEqual(startBotInnerIndex, -1, 'startBotInner não encontrada')
  for (const nome of CONTADORES) {
    const declIndex = src.indexOf(`let ${nome} = 0`)
    assert.notEqual(declIndex, -1, `declaração de ${nome} não encontrada`)
    assert.ok(
      declIndex < startBotInnerIndex,
      `${nome} precisa ficar em escopo de módulo: dentro de startBotInner ele zera a cada reconexão e a cegueira volta a ser invisível`
    )
  }
})

test('os contadores são zerados SÓ dentro de markMessageAccepted', () => {
  for (const nome of CONTADORES) {
    // `(?<!let )` exclui a própria declaração em escopo de módulo.
    const resets = [...src.matchAll(new RegExp(`(?<!let )\\b${nome}\\s*=\\s*0`, 'g'))]
    assert.equal(resets.length, 1, `${nome} deve ter exatamente um ponto de zeragem, achei ${resets.length}`)
    const antes = src.slice(0, resets[0].index)
    const abre = antes.lastIndexOf('function markMessageAccepted()')
    assert.notEqual(abre, -1, `zeragem de ${nome} não está em markMessageAccepted`)
    assert.ok(
      !antes.slice(abre).includes('\n}'),
      `zeragem de ${nome} precisa estar DENTRO de markMessageAccepted — zerar em qualquer outro lugar (reconexão, janela de tempo) reintroduz o bug`
    )
  }
})

test('o classificador recebe um relógio que não reseta na reconexão', () => {
  assert.match(
    src,
    /observedSinceMs:\s*lastAcceptedAtMs\s*\?\?\s*workerStartedAt/,
    'observedSinceMs precisa vir da última aceitação ou do boot do worker — nunca de connectionOpenedAt, que é o que escondia o caso'
  )
  assert.ok(
    !/observedSinceMs:\s*connectionOpenedAt/.test(src),
    'observedSinceMs jamais pode vir de connectionOpenedAt'
  )
})

test('o vigia de silêncio não volta a ignorar a falha total', () => {
  assert.ok(
    !src.includes('if (!silent.length || !hasActive) return'),
    'com `!hasActive` a falha TOTAL (todos os monitores calados) era o único estado que o vigia não enxergava — e é o pior deles'
  )
  assert.match(src, /const todosCalados = !hasActive/)
  assert.match(
    src,
    /ocupadaESemAceitar\s*=\s*failuresSinceLastAccepted > 0 \|\| stableDropsSinceLastAccepted > 0/,
    'com todos calados a evidência de problema precisa ser exigida — silêncio sozinho não pode virar alarme'
  )
})

// A linha de boot que diz quais filtros de recepção estão valendo cita três
// constantes de escopo de módulo. Se ela for parar ACIMA de qualquer uma delas,
// o módulo estoura ReferenceError (TDZ) no load — ou seja, TODO worker morre no
// boot. Isso quase foi enviado: a primeira versão do log ficava na linha ~315 e
// citava BLIND_ACROSS_RECONNECTS_MS, declarada só na ~1330.
test('o log de filtros de recepção vem DEPOIS de todas as constantes que cita', () => {
  const logIndex = src.indexOf("'Filtros de recepção deste robô'")
  assert.notEqual(logIndex, -1, 'linha de boot dos filtros de recepção não encontrada')
  const citadas = [
    'const IGNORE_UNMONITORED_GROUPS',
    'const CHAT_SCOPE_MODE =',
    'const BLIND_ACROSS_RECONNECTS_MS',
  ]
  for (const decl of citadas) {
    const declIndex = src.indexOf(decl)
    assert.notEqual(declIndex, -1, `declaração não encontrada: ${decl}`)
    assert.ok(
      declIndex < logIndex,
      `${decl} é declarada DEPOIS do log — isso é ReferenceError (TDZ) no load e derruba todo worker no boot`
    )
  }
})

test('a regra de ignorar chat não-monitorado deixa de ser invisível', () => {
  assert.match(
    src,
    /ignoreUnmonitoredGroups: IGNORE_UNMONITORED_GROUPS/,
    'sem isso não há como confirmar, pelo log, se a flag chegou aos robôs — e em modo remote ela só vale após reiniciar o supervisor'
  )
})
