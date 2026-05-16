const baseUrl = (process.env.LP_BASE_URL || process.argv[2] || 'http://localhost:3006').replace(/\/$/, '')

const budgets = {
  '/': { htmlKb: 220, ldScripts: 6 },
  '/espelhar-grupos-whatsapp': { htmlKb: 240, ldScripts: 4 },
  '/espelhar-grupos-whatsapp-sao-paulo': { htmlKb: 260, ldScripts: 7 },
  '/blog/como-escalar-grupos-sem-operacao-manual': { htmlKb: 240, ldScripts: 5 },
}

async function checkRoute(path, budget) {
  const res = await fetch(`${baseUrl}${path}`)
  if (!res.ok) return { path, ok: false, reason: `HTTP ${res.status}` }
  const html = await res.text()
  const htmlKb = Buffer.byteLength(html, 'utf8') / 1024
  const ldScripts = [...html.matchAll(/application\/ld\+json/g)].length
  const ok = htmlKb <= budget.htmlKb && ldScripts <= budget.ldScripts
  return {
    path,
    ok,
    reason: `html=${htmlKb.toFixed(1)}KB/${budget.htmlKb}KB ld=${ldScripts}/${budget.ldScripts}`,
  }
}

const results = await Promise.all(Object.entries(budgets).map(([path, budget]) => checkRoute(path, budget)))
results.forEach((r) => console.log(`${r.ok ? 'OK' : 'FALHA'} ${r.path} -> ${r.reason}`))
if (results.some((r) => !r.ok)) process.exitCode = 1
