export function createSemaphore(limit = 1) {
  const max = Math.max(1, Number(limit) || 1)
  let active = 0
  const waiting = []
  const acquire = () => new Promise(resolve => {
    const grant = () => { active++; let released = false; resolve(() => { if (released) return; released = true; active--; waiting.shift()?.() }) }
    if (active < max) grant(); else waiting.push(grant)
  })
  return {
    async run(task) { const release = await acquire(); try { return await task() } finally { release() } },
    stats: () => ({ active, waiting: waiting.length, limit: max }),
  }
}
