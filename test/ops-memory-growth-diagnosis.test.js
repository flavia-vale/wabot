import test from 'node:test'
import assert from 'node:assert/strict'

import { splitRobotMemory, slopePerHour, classifyGrowth, describeGrowthVerdict, GROWTH_VERDICTS } from '../src/ops/memory/growthDiagnosis.js'

const H = 3_600_000
const MIB = 1024 * 1024
const serie = (pontos) => pontos.map(([h, extra]) => ({ atMs: h * H, ...extra }))

test('splitRobotMemory junta smaps + status + runtime em MiB e calcula o que fica fora do V8', () => {
  const smaps = {
    totalPss: 120 * MIB,
    byKind: [{ kind: 'heap_principal', pss: 30 * MIB }, { kind: 'anonimo', pss: 60 * MIB }],
    arenas: { count: 1, pss: 10 * MIB },
  }
  const status = { rssAnon: 110 * MIB, threads: 29 }
  const runtime = { heapUsedBytes: 20 * MIB, heapTotalBytes: 35 * MIB, externalBytes: 5 * MIB, arrayBuffersBytes: 3 * MIB }
  const foto = splitRobotMemory({ smaps, status, runtime })
  assert.equal(foto.pssMiB, 120)
  assert.equal(foto.glibcMiB, 40, '[heap] + arenas')
  assert.equal(foto.anonMiB, 60)
  assert.equal(foto.arenas, 1)
  assert.equal(foto.threads, 29)
  assert.equal(foto.v8HeapUsedMiB, 20)
  assert.equal(foto.foraDoV8MiB, 70, 'rssAnon − heapTotal − external')
})

test('sem runtime (sem IPC) os campos do V8 ficam null, nunca 0 — 0 seria mentira', () => {
  const foto = splitRobotMemory({ smaps: { totalPss: 10 * MIB, byKind: [], arenas: { count: 0, pss: 0 } }, status: { rssAnon: 8 * MIB, threads: 5 } })
  assert.equal(foto.v8HeapUsedMiB, null)
  assert.equal(foto.arrayBuffersMiB, null)
  assert.equal(foto.foraDoV8MiB, null)
})

test('slopePerHour: reta perfeita dá a inclinação exata e ignora pontos sem valor', () => {
  const s = serie([[0, { pssMiB: 100 }], [1, { pssMiB: 103 }], [2, { pssMiB: 106 }], [3, {}]])
  assert.equal(slopePerHour(s, 'pssMiB'), 3)
  assert.equal(slopePerHour(s, 'inexistente'), null)
})

test('poucas medidas ou janela curta → sem_dado (nunca conclui por duas amostras)', () => {
  assert.equal(classifyGrowth(serie([[0, { pssMiB: 100 }], [5, { pssMiB: 200 }]])).verdict, GROWTH_VERDICTS.SEM_DADO)
  assert.equal(classifyGrowth(serie([[0, { pssMiB: 100 }], [0.5, { pssMiB: 120 }], [1, { pssMiB: 140 }]])).verdict, GROWTH_VERDICTS.SEM_DADO)
  assert.equal(classifyGrowth([]).verdict, GROWTH_VERDICTS.SEM_DADO)
})

test('total quase parado → estável, mesmo com ruído de tráfego', () => {
  const s = serie([[0, { pssMiB: 100 }], [1, { pssMiB: 101.5 }], [2, { pssMiB: 100.2 }], [3, { pssMiB: 101 }]])
  assert.equal(classifyGrowth(s).verdict, GROWTH_VERDICTS.ESTAVEL)
})

test('cresce no glibc com o V8 parado → retenção do alocador (o caso medido em 19/09)', () => {
  // 92,8 → 122,6 MiB/robô em ~9 h: arena +9, heap +10, anon +10, heapUsed do V8 parado.
  const s = serie([
    [0, { pssMiB: 92.8, glibcMiB: 41.4, v8HeapUsedMiB: 18, arrayBuffersMiB: 2 }],
    [3, { pssMiB: 103, glibcMiB: 48, v8HeapUsedMiB: 18.5, arrayBuffersMiB: 2.4 }],
    [6, { pssMiB: 113, glibcMiB: 55, v8HeapUsedMiB: 18.2, arrayBuffersMiB: 1.9 }],
    [9, { pssMiB: 122.6, glibcMiB: 61.2, v8HeapUsedMiB: 18.4, arrayBuffersMiB: 2.1 }],
  ])
  const r = classifyGrowth(s)
  assert.equal(r.verdict, GROWTH_VERDICTS.RETENCAO_ALOCADOR)
  assert.ok(r.slopes.glibc > 2 && r.slopes.v8HeapUsed < 0.5, JSON.stringify(r.slopes))
})

test('heapUsed do V8 sobe junto com o total → vazamento em JS, e ganha de qualquer outro balde', () => {
  const s = serie([
    [0, { pssMiB: 100, glibcMiB: 40, v8HeapUsedMiB: 20 }],
    [3, { pssMiB: 112, glibcMiB: 43, v8HeapUsedMiB: 28 }],
    [6, { pssMiB: 124, glibcMiB: 46, v8HeapUsedMiB: 36 }],
    [9, { pssMiB: 136, glibcMiB: 49, v8HeapUsedMiB: 44 }],
  ])
  assert.equal(classifyGrowth(s).verdict, GROWTH_VERDICTS.VAZAMENTO_JS)
})

test('arrayBuffers sobem com o total → buffers presos na fila', () => {
  const s = serie([
    [0, { pssMiB: 100, glibcMiB: 40, v8HeapUsedMiB: 20, arrayBuffersMiB: 5 }],
    [3, { pssMiB: 130, glibcMiB: 42, v8HeapUsedMiB: 20.5, arrayBuffersMiB: 30 }],
    [6, { pssMiB: 160, glibcMiB: 44, v8HeapUsedMiB: 20.2, arrayBuffersMiB: 55 }],
    [9, { pssMiB: 190, glibcMiB: 46, v8HeapUsedMiB: 20.8, arrayBuffersMiB: 80 }],
  ])
  assert.equal(classifyGrowth(s).verdict, GROWTH_VERDICTS.BUFFERS_EM_FILA)
})

test('sem IPC (só /proc) ainda separa alocador de "não sei": glibc explica → retenção; senão → misto', () => {
  const soGlibc = serie([[0, { pssMiB: 100, glibcMiB: 40 }], [3, { pssMiB: 110, glibcMiB: 48 }], [6, { pssMiB: 120, glibcMiB: 56 }]])
  assert.equal(classifyGrowth(soGlibc).verdict, GROWTH_VERDICTS.RETENCAO_ALOCADOR)
  const foraDoGlibc = serie([[0, { pssMiB: 100, glibcMiB: 40 }], [3, { pssMiB: 110, glibcMiB: 41 }], [6, { pssMiB: 120, glibcMiB: 42 }]])
  assert.equal(classifyGrowth(foraDoGlibc).verdict, GROWTH_VERDICTS.MISTO)
})

test('toda frase de veredito é leiga e diz a ação — sem jargão que a dona do produto não lê', () => {
  for (const v of Object.values(GROWTH_VERDICTS)) {
    const frase = describeGrowthVerdict(v)
    assert.ok(frase.length > 40, v)
    assert.doesNotMatch(frase, /smaps|PSS|RSS|brk|mallopt/, `jargão em ${v}: ${frase}`)
  }
})
