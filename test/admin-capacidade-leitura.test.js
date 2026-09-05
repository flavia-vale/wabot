import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { evaluateCapacity, evaluateResourceHealth } from '../src/ops/capacity/policy.js'

const MEDIDO = {
  memoryTotalMb: 7900, memoryAvailableMb: 2600, cpuPercent: 12,
  diskUsedPercent: 41, inodeUsedPercent: 8, swapInKbPerSec: 0, swapOutKbPerSec: 0,
  connectedSessions: 12, productionWorkers: 12,
}

test('a decisão sempre carrega a saúde dos recursos', () => {
  // RCA 2026-09-05: sem `resourceHealth` o bloco "Diagnóstico traduzido" dizia
  // "Sem medição" nos quatro cartões mesmo com o servidor medido e saudável.
  const decision = evaluateCapacity(MEDIDO)
  assert.ok(decision.resourceHealth, 'decisão sem resourceHealth deixa a tela cega')
  for (const chave of ['memory', 'cpu', 'disk', 'swap']) {
    assert.ok(decision.resourceHealth[chave], `faltou a saúde de ${chave}`)
    assert.notEqual(decision.resourceHealth[chave].state, 'unknown')
  }
})

test('sem memória total ainda entrega o que foi medido, em vez de zerar tudo', () => {
  const decision = evaluateCapacity({ ...MEDIDO, memoryTotalMb: null })
  assert.equal(decision.state, 'insufficient_data')
  assert.ok(decision.resourceHealth, 'CPU e disco continuam medidos e precisam aparecer')
  assert.equal(decision.resourceHealth.cpu.state, 'healthy')
  assert.equal(decision.resourceHealth.disk.state, 'healthy')
  // Memória de fato não dá para julgar — e "sem medição" nunca vira "saudável".
  assert.equal(decision.resourceHealth.memory.state, 'unknown')
})

test('a decisão persistida também recompõe a saúde a partir do snapshot', () => {
  const service = readFileSync(new URL('../src/ops/capacity/service.js', import.meta.url), 'utf8')
  assert.match(service, /resourceHealth: evaluateResourceHealth\(raw\)\.resources/)
})

test('a saúde separa saudável de crítico nos limites da política', () => {
  assert.equal(evaluateResourceHealth({ memoryTotalMb: 1000, memoryAvailableMb: 90 }).resources.memory.state, 'critical')
  assert.equal(evaluateResourceHealth({ memoryTotalMb: 1000, memoryAvailableMb: 150 }).resources.memory.state, 'attention')
  assert.equal(evaluateResourceHealth({ diskUsedPercent: 95 }).resources.disk.state, 'critical')
})

// ------------------------------------------------------- leitura da tela

const cards = readFileSync(new URL('../dashboard/app/admin/capacidade/components/CapacityResourceCards.js', import.meta.url), 'utf8')
const inventory = readFileSync(new URL('../dashboard/app/admin/capacidade/components/CapacityInventory.js', import.meta.url), 'utf8')
const chart = readFileSync(new URL('../dashboard/app/admin/capacidade/components/CapacityHistoryChart.js', import.meta.url), 'utf8')

test('os cards de recurso mudam de cor conforme o estado', () => {
  for (const estado of ['healthy', 'attention', 'critical', 'unknown']) {
    assert.match(cards, new RegExp(`${estado}: \\{`), `estado sem cor própria: ${estado}`)
  }
  assert.match(cards, /bg-emerald-50/)
  assert.match(cards, /bg-red-50/)
})

test('"contratado versus utilizado" compara de verdade, sem depender do provedor', () => {
  // Antes o bloco só listava o inventário da Hetzner; sem token ele vinha vazio
  // e o bloco vivia "sem medição".
  assert.match(inventory, /Contratado/)
  assert.match(inventory, /Utilizado/)
  assert.match(inventory, /Livre/)
  assert.match(inventory, /resources\.memory\?\.totalMb/)
  assert.match(inventory, /resources\.disk\?\.usedPercent/)
})

test('o gráfico diz se estamos bem ou mal e identifica os eixos', () => {
  assert.match(chart, /function readOccupancy/)
  assert.match(chart, /Estamos bem/)
  assert.match(chart, /Estamos NO LIMITE/)
  assert.match(chart, /tempo →/)
  assert.match(chart, /unidade=/)
})
