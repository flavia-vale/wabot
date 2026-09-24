// specs/018-unificar-protecao-anti-ban, Fase 7 (Script de diagnóstico).
//
// Duas frentes: (1) as regras puras de classificação/percentil
// (src/domain/antiban/diagnostics.js), testadas sem banco; (2) guardas
// estruturais do script — importa as regras do produto em vez de
// reimplementá-las, nunca engole erro de consulta como "zero"/"nenhuma conta
// encontrada" (lição do diag-assinatura-recusada.mjs), lista contas por
// e-mail (nunca telefone), e nunca compara `sentAt` como string contra
// datetime() (armadilha do AGENTS.md).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  percentiles,
  classifyFixedFieldValue,
  classifyQueueAgeRisk,
  projectedLastDestinationDelayMs,
  theoreticalDestinationsPerHour,
} from '../src/domain/antiban/diagnostics.js'

test('percentiles: p50/p90/max de um array', () => {
  const r = percentiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(r.n, 10)
  assert.equal(r.max, 10)
  assert.ok(r.p50 >= 4 && r.p50 <= 6)
  assert.ok(r.p90 >= 8)
})

test('percentiles: array vazio devolve tudo null, nunca lança', () => {
  const r = percentiles([])
  assert.deepEqual(r, { p50: null, p90: null, max: null, n: 0 })
})

test('percentiles: ignora valores não-finitos (NaN/undefined) em vez de quebrar', () => {
  const r = percentiles([1, NaN, 2, undefined, 3])
  assert.equal(r.n, 3)
})

test('classifyFixedFieldValue: herdando quando null/undefined', () => {
  assert.equal(classifyFixedFieldValue(null, 6, 'menor-vence'), 'herdando')
  assert.equal(classifyFixedFieldValue(undefined, 6, 'menor-vence'), 'herdando')
})

test('classifyFixedFieldValue: burstCap (menor-vence) — 3 é mais conservador, 20 é menos', () => {
  assert.equal(classifyFixedFieldValue(3, 6, 'menor-vence'), 'mais_conservador')
  assert.equal(classifyFixedFieldValue(20, 6, 'menor-vence'), 'menos_conservador')
  assert.equal(classifyFixedFieldValue(6, 6, 'menor-vence'), 'igual')
})

test('classifyFixedFieldValue: burstWindowSec (maior-vence) — 1200 é mais conservador, 300 é menos', () => {
  assert.equal(classifyFixedFieldValue(1200, 600, 'maior-vence'), 'mais_conservador')
  assert.equal(classifyFixedFieldValue(300, 600, 'maior-vence'), 'menos_conservador')
  assert.equal(classifyFixedFieldValue(600, 600, 'maior-vence'), 'igual')
})

test('projectedLastDestinationDelayMs: (N-1) × intervalo; N<=1 é 0', () => {
  assert.equal(projectedLastDestinationDelayMs(1, 20000), 0)
  assert.equal(projectedLastDestinationDelayMs(0, 20000), 0)
  assert.equal(projectedLastDestinationDelayMs(4, 20000), 60000)
})

test('theoreticalDestinationsPerHour: 3600/intervalo', () => {
  assert.equal(theoreticalDestinationsPerHour(20), 180)
  assert.equal(theoreticalDestinationsPerHour(0), null)
  assert.equal(theoreticalDestinationsPerHour(null), null)
})

test('classifyQueueAgeRisk: sem teto (0/null) nunca acusa risco', () => {
  assert.equal(classifyQueueAgeRisk(999999999, 0).nivel, 'sem_teto')
  assert.equal(classifyQueueAgeRisk(999999999, null).nivel, 'sem_teto')
})

test('classifyQueueAgeRisk: ok < 50%, atenção 50-99%, descartaria >= 100%', () => {
  const tetoMin = 300 // 5h = 18.000.000ms
  assert.equal(classifyQueueAgeRisk(1_000_000, tetoMin).nivel, 'ok')
  assert.equal(classifyQueueAgeRisk(10_000_000, tetoMin).nivel, 'atencao')
  assert.equal(classifyQueueAgeRisk(20_000_000, tetoMin).nivel, 'descartaria')
})

test('classifyQueueAgeRisk: sem dado de atraso não afirma nada (fail-safe)', () => {
  assert.equal(classifyQueueAgeRisk(null, 300).nivel, 'sem_dado')
  assert.equal(classifyQueueAgeRisk(undefined, 300).nivel, 'sem_dado')
})

// ---------- guardas estruturais do script ----------

const scriptSourceComComentarios = readFileSync(new URL('../scripts/diag-antiban-valores.mjs', import.meta.url), 'utf8')
// Sem o comentário de topo: ele CITA "telefone" e ".catch(() => [])" como
// exemplos do que NÃO fazer (é a própria explicação da guarda), o que faria
// os testes abaixo darem falso positivo se lessem o comentário como código.
const scriptSource = scriptSourceComComentarios.replace(/\/\*[\s\S]*?\*\//g, ' ')

test('o script IMPORTA as regras do produto em vez de reimplementá-las', () => {
  assert.match(scriptSource, /from ['"].*core\/antiBanFloor\.js['"]/)
  assert.match(scriptSource, /from ['"].*core\/preservationConfig\.js['"]/)
  assert.match(scriptSource, /from ['"].*core\/destinationSpacing\.js['"]/)
  assert.match(scriptSource, /from ['"].*core\/queueExpiry\.js['"]/)
  assert.match(scriptSource, /from ['"].*domain\/antiban\/diagnostics\.js['"]/)
})

test('o script NUNCA compara sentAt cru como string (armadilha do AGENTS.md)', () => {
  assert.doesNotMatch(scriptSource, /sentAt\s*>\s*['"`]/)
  assert.doesNotMatch(scriptSource, /sentAt\s*>=?\s*datetime\(['"`]now/)
})

test('o script lista contas por E-MAIL, nunca telefone', () => {
  assert.doesNotMatch(scriptSource, /contactPhone|telefone/i)
})

test('o script tem a Parte A e a Parte B, e a B não é pulada silenciosamente sem --detalhes', () => {
  assert.match(scriptSource, /PARTE A/i)
  assert.match(scriptSource, /PARTE B/i)
  // A Parte B não pode estar dentro de um `if (detalhes)` — ela roda sempre.
  const parteBIndex = scriptSource.search(/PARTE B/i)
  const antesDaParteB = scriptSource.slice(0, parteBIndex)
  const ultimoIfDetalhes = antesDaParteB.lastIndexOf('if (detalhes')
  const ultimaChaveFechamento = antesDaParteB.lastIndexOf('}\n')
  assert.ok(
    ultimoIfDetalhes === -1 || ultimoIfDetalhes < ultimaChaveFechamento,
    'Parte B não pode ficar dentro do bloco condicional de --detalhes',
  )
})

test('o script imprime erro de consulta em vez de tratar falha como "zero"/lista vazia', () => {
  // Nenhum `.catch(() => [])` silencioso — lição do diag-assinatura-recusada.mjs
  assert.doesNotMatch(scriptSource, /\.catch\(\s*\(\)\s*=>\s*\[\]\s*\)/)
})
