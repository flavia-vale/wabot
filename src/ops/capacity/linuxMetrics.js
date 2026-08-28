import os from 'node:os'
import fs from 'node:fs/promises'

const KB_PER_MB = 1024

function finite(value) {
  return Number.isFinite(value) ? value : null
}

export function parseMeminfo(text) {
  const values = new Map()
  for (const line of String(text || '').split('\n')) {
    const match = line.match(/^([A-Za-z_()]+):\s+(\d+)\s+kB$/)
    if (match) values.set(match[1], Number(match[2]))
  }
  const mb = (key) => values.has(key) ? values.get(key) / KB_PER_MB : null
  const total = mb('MemTotal')
  const free = mb('MemFree')
  const available = mb('MemAvailable')
  const cacheParts = ['Cached', 'SReclaimable', 'Buffers'].map(mb)
  const cache = cacheParts.every((value) => value !== null)
    ? cacheParts.reduce((sum, value) => sum + value, 0)
    : null
  const swapTotal = mb('SwapTotal')
  const swapFree = mb('SwapFree')
  return {
    totalMb: total,
    freeMb: free,
    availableMb: available,
    cacheMb: cache,
    swapTotalMb: swapTotal,
    swapUsedMb: swapTotal !== null && swapFree !== null ? Math.max(0, swapTotal - swapFree) : null,
  }
}

export function parseProcStat(text) {
  const match = String(text || '').match(/^cpu\s+([\d\s]+)/m)
  if (!match) return null
  const ticks = match[1].trim().split(/\s+/).map(Number)
  if (ticks.length < 4 || ticks.some((value) => !Number.isFinite(value))) return null
  const total = ticks.reduce((sum, value) => sum + value, 0)
  const idle = (ticks[3] || 0) + (ticks[4] || 0)
  return { total, idle }
}

export function cpuPercentFromDelta(previous, current) {
  if (!previous || !current) return null
  const total = current.total - previous.total
  const idle = current.idle - previous.idle
  if (total <= 0 || idle < 0) return null
  return Math.max(0, Math.min(100, ((total - idle) / total) * 100))
}

export function parseVmstat(text) {
  const values = new Map()
  for (const line of String(text || '').split('\n')) {
    const match = line.match(/^(pswpin|pswpout)\s+(\d+)$/)
    if (match) values.set(match[1], Number(match[2]))
  }
  if (!values.has('pswpin') || !values.has('pswpout')) return null
  const oom = String(text || '').match(/^oom_kill\s+(\d+)$/m)
  return { inPages: values.get('pswpin'), outPages: values.get('pswpout'), oomKillCount: oom ? Number(oom[1]) : null }
}

export function swapRatesFromDelta(previous, current, elapsedSeconds, pageSizeKb = 4) {
  if (!previous || !current || !(elapsedSeconds > 0)) return { inKbPerSec: null, outKbPerSec: null }
  const input = current.inPages - previous.inPages
  const output = current.outPages - previous.outPages
  if (input < 0 || output < 0) return { inKbPerSec: null, outKbPerSec: null }
  return { inKbPerSec: input * pageSizeKb / elapsedSeconds, outKbPerSec: output * pageSizeKb / elapsedSeconds }
}

export function normalizeStatfs(stat) {
  if (!stat) return { totalMb: null, availableMb: null, usedMb: null, usedPercent: null, inodeUsedPercent: null }
  const total = finite(Number(stat.blocks) * Number(stat.bsize))
  const available = finite(Number(stat.bavail) * Number(stat.bsize))
  const free = finite(Number(stat.bfree) * Number(stat.bsize))
  const used = total !== null && free !== null ? Math.max(0, total - free) : null
  const inodeTotal = finite(Number(stat.files))
  const inodeFree = finite(Number(stat.ffree))
  return {
    totalMb: total === null ? null : total / 1048576,
    availableMb: available === null ? null : available / 1048576,
    usedMb: used === null ? null : used / 1048576,
    usedPercent: total > 0 && used !== null ? used / total * 100 : null,
    inodeUsedPercent: inodeTotal > 0 && inodeFree !== null ? (inodeTotal - inodeFree) / inodeTotal * 100 : null,
  }
}

export async function collectLinuxMetrics(options = {}) {
  const readFile = options.readFile || fs.readFile
  const statfs = options.statfs || fs.statfs
  const osApi = options.os || os
  const nowMs = options.nowMs ?? Date.now()
  const [memText, statText, vmText, disk, detectedBootId] = await Promise.all([
    readFile('/proc/meminfo', 'utf8'), readFile('/proc/stat', 'utf8'),
    readFile('/proc/vmstat', 'utf8'), statfs('/'),
    options.bootId != null ? Promise.resolve(options.bootId) : readFile('/proc/sys/kernel/random/boot_id', 'utf8').then((value) => String(value).trim()).catch(() => null),
  ])
  const bootId = options.bootId ?? detectedBootId
  const currentCpu = parseProcStat(statText)
  const currentSwap = parseVmstat(vmText)
  const elapsedSeconds = options.previous?.observedAtMs == null ? null : (nowMs - options.previous.observedAtMs) / 1000
  const sameBoot = !options.previous || options.previous.bootId == null || bootId == null || options.previous.bootId === bootId
  return {
    memory: parseMeminfo(memText),
    cpu: { percent: sameBoot ? cpuPercentFromDelta(options.previous?.cpu, currentCpu) : null, load: osApi.loadavg().map(finite), uptimeSeconds: finite(osApi.uptime()) },
    swapRates: sameBoot ? swapRatesFromDelta(options.previous?.swap, currentSwap, elapsedSeconds) : { inKbPerSec: null, outKbPerSec: null },
    oomKillCount: currentSwap?.oomKillCount ?? null,
    disk: normalizeStatfs(disk),
    sample: { cpu: currentCpu, swap: currentSwap, observedAtMs: nowMs, bootId: bootId ?? null },
  }
}
