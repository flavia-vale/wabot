import test from 'node:test'
import assert from 'node:assert/strict'
import { collectCapacitySnapshot } from '../src/ops/capacity/collector.js'
const linux = { memory: { totalMb: 8192, availableMb: 4000 }, cpu: { percent: 2, load: [0.1, 0.2, 0.3], uptimeSeconds: 10 }, swapRates: {}, disk: { totalMb: 40000, usedPercent: 72 } }
test('collector isola fonte falha e devolve parcial sanitizado', async () => { const result = await collectCapacitySnapshot({ collectLinux: async () => linux, collectProcesses: async () => { throw new Error('no') } }); assert.equal(result.completeness, 'partial'); assert.equal(result.memoryTotalMb, 8192); assert.equal(result.sources.find((source) => source.name === 'processes').status, 'unavailable') })
test('collector agrega workers apenas por ambiente classificado', async () => { const result = await collectCapacitySnapshot({ collectLinux: async () => linux, collectProcesses: async () => ({ workers: [{ environment: 'production', rssMb: 300 }, { environment: 'staging', rssMb: 100 }], components: [], sources: {} }) }); assert.equal(result.productionWorkers, 1); assert.equal(result.stagingWorkers, 1); assert.equal(result.workerRssTotalMb, 300) })
test('collector trava concorrência in-process', async () => { let release; const pending = new Promise((resolve) => { release = resolve }); const first = collectCapacitySnapshot({ collectLinux: () => pending.then(() => linux), collectProcesses: async () => ({ workers: [], components: [], sources: {} }) }); const second = await collectCapacitySnapshot({}); assert.deepEqual(second, { skipped: true, reason: 'COLLECTION_IN_PROGRESS' }); release(); await first })
test('collector mantem processos quando Linux expira e coleta contagens do banco', async () => {
  const result = await collectCapacitySnapshot({ timeoutMs: 10, collectLinux: () => new Promise(() => {}), collectProcesses: async () => ({ workers: [{ environment: 'production', rssMb: 350 }], components: [{ key: 'api', environment: 'production', rssMb: 150, status: 'online' }], sources: {} }), collectDatabase: async () => ({ connectedSessions: 1, activeCustomers: 3 }) })
  assert.equal(result.completeness, 'partial')
  assert.equal(result.productionWorkers, 1)
  assert.equal(result.connectedSessions, 1)
  assert.equal(result.activeCustomers, 3)
  assert.equal(result.processRssTotalMb, null)
  assert.equal(result.fixedBaseMb, null)
  assert.equal(result.sources.find((source) => source.name === 'linux').errorCode, 'SOURCE_TIMEOUT')
})

test('collector preserva amostra Linux entre ticks para CPU e swap por delta', async () => {
  const linuxState = {}; const seen = []
  const collectLinux = async (options) => { seen.push(options); return { ...linux, cpu: { ...linux.cpu, percent: options.previous ? 25 : null }, swapRates: { inKbPerSec: options.previous ? 4 : null, outKbPerSec: options.previous ? 8 : null }, sample: { cpu: { total: seen.length * 100, idle: seen.length * 50 }, swap: { inPages: seen.length, outPages: seen.length * 2 }, observedAtMs: options.nowMs, bootId: 'boot-a' } } }
  const processes = async () => ({ workers: [], components: [], sources: {} })
  const first = await collectCapacitySnapshot({ now: () => 1000, linuxState, collectLinux, collectProcesses: processes })
  const second = await collectCapacitySnapshot({ now: () => 2000, linuxState, collectLinux, collectProcesses: processes })
  assert.equal(first.cpuPercent, null); assert.equal(second.cpuPercent, 25)
  assert.equal(second.swapOutKbPerSec, 8)
  assert.equal(seen[1].previous.bootId, 'boot-a')
  assert.equal(seen[1].nowMs, 2000)
})

test('collector classifica falha total sem promover parcial vazio', async () => {
  const result = await collectCapacitySnapshot({ collectLinux: async () => { throw new Error('linux') }, collectProcesses: async () => { throw new Error('pm2') } })
  assert.equal(result.completeness, 'failed')
})
