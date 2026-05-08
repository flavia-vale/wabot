#!/usr/bin/env node
/**
 * Detecta "shadow modules": arquivos com o mesmo basename em extensões
 * diferentes no mesmo diretório (ex.: Footer.js + Footer.jsx).
 *
 * Webpack/Next resolvem por ordem de extensão, então uma versão antiga
 * pode sequestrar o import e causar build quebrado em prod mesmo com o
 * código novo presente. Foi exatamente o bug que derrubou o dashboard
 * em maio/2026 (Footer.js órfão sequestrou Footer.jsx).
 *
 * Uso: node scripts/check_no_shadow_modules.mjs [diretório]
 * Sai com código != 0 se encontrar conflitos.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, parse } from 'node:path'
import process from 'node:process'

const ROOT = process.argv[2] || 'dashboard'
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'out', 'coverage'])

const conflicts = []

function walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  const byBase = new Map()
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith('.')) walk(full)
      continue
    }
    const { name: base, ext } = parse(name)
    if (!EXTS.has(ext)) continue
    if (!byBase.has(base)) byBase.set(base, [])
    byBase.get(base).push(name)
  }
  for (const [base, files] of byBase) {
    if (files.length > 1) conflicts.push({ dir, base, files })
  }
}

walk(ROOT)

if (conflicts.length === 0) {
  console.log(`[shadow-modules] OK — nenhum conflito de basename em ${ROOT}/`)
  process.exit(0)
}

console.error(`[shadow-modules] ❌ Conflitos detectados em ${ROOT}/:`)
for (const c of conflicts) {
  console.error(`  ${c.dir}/`)
  for (const f of c.files) console.error(`    - ${f}`)
}
console.error('')
console.error('Webpack/Next resolveriam UM desses arquivos arbitrariamente, ignorando os outros.')
console.error('Delete as cópias obsoletas (geralmente .js antigos ao lado de .jsx novos) antes de buildar.')
process.exit(1)
