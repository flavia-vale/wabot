import test from 'node:test'
import assert from 'node:assert/strict'
import { collectLinuxMetrics, cpuPercentFromDelta, normalizeStatfs, parseMeminfo, parseProcStat, parseVmstat, swapRatesFromDelta } from '../src/ops/capacity/linuxMetrics.js'

test('parses MemAvailable, cache and swap without inventing missing values', () => {
  assert.deepEqual(parseMeminfo('MemTotal: 8192 kB\nMemFree: 1024 kB\nMemAvailable: 4096 kB\nCached: 512 kB\nSReclaimable: 128 kB\nBuffers: 64 kB\nSwapTotal: 2048 kB\nSwapFree: 1536 kB\n'), { totalMb: 8, freeMb: 1, availableMb: 4, cacheMb: 0.6875, swapTotalMb: 2, swapUsedMb: 0.5 })
  assert.equal(parseMeminfo('MemTotal: 1024 kB\n').availableMb, null)
})
test('calculates CPU only from a valid monotonic delta', () => {
  const before = parseProcStat('cpu  100 0 50 850 0 0 0 0 0 0\n'); const after = parseProcStat('cpu  120 0 60 920 0 0 0 0 0 0\n')
  assert.equal(cpuPercentFromDelta(before, after), 30); assert.equal(cpuPercentFromDelta(after, before), null); assert.equal(cpuPercentFromDelta(null, after), null)
})
test('calculates swap rates and resets them on counter regression', () => {
  assert.deepEqual(parseVmstat('pswpin 10\npswpout 20\noom_kill 3\n'), { inPages: 10, outPages: 20, oomKillCount: 3 })
  assert.deepEqual(swapRatesFromDelta({ inPages: 10, outPages: 20 }, { inPages: 15, outPages: 22 }, 2), { inKbPerSec: 10, outKbPerSec: 4 })
  assert.deepEqual(swapRatesFromDelta({ inPages: 10, outPages: 20 }, { inPages: 1, outPages: 2 }, 2), { inKbPerSec: null, outKbPerSec: null })
})
test('normalizes disk blocks and inodes', () => assert.deepEqual(normalizeStatfs({ blocks: 100, bfree: 25, bavail: 20, bsize: 1048576, files: 1000, ffree: 900 }), { totalMb: 100, availableMb: 20, usedMb: 75, usedPercent: 75, inodeUsedPercent: 10 }))
test('collects load, uptime and null deltas after reboot', async () => {
  const files = { '/proc/meminfo': 'MemTotal: 8192 kB\n', '/proc/stat': 'cpu  10 0 0 90\n', '/proc/vmstat': 'pswpin 10\npswpout 20\n' }
  const result = await collectLinuxMetrics({ readFile: async (name) => files[name], statfs: async () => ({ blocks: 1, bfree: 1, bavail: 1, bsize: 1024, files: 1, ffree: 1 }), os: { loadavg: () => [1, 2, 3], uptime: () => 123 }, nowMs: 2000, bootId: 'new', previous: { bootId: 'old', observedAtMs: 1000, cpu: { total: 1, idle: 1 }, swap: { inPages: 1, outPages: 1 } } })
  assert.deepEqual(result.cpu, { percent: null, load: [1, 2, 3], uptimeSeconds: 123 }); assert.deepEqual(result.swapRates, { inKbPerSec: null, outKbPerSec: null })
})
