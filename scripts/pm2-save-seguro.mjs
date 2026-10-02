#!/usr/bin/env node
// `pm2 save` protegido — use no lugar de `pm2 save` cru (deploys, runbooks).
//
//   node scripts/pm2-save-seguro.mjs            # confere e salva
//   node scripts/pm2-save-seguro.mjs --dry-run  # só diz se salvaria
//   PM2_SAVE_ALLOW_REMOVE=app-antigo node scripts/pm2-save-seguro.mjs
//
// Antes de salvar guarda uma cópia do dump (dump.pm2.bak-<data>, mantém 20).
// Recusa (código 3) se o save apagaria app de produção do dump ou se um app de
// produção não está online — regras em src/ops/pm2Guard.js (RCA 2026-10-01).

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { decidePm2Save, parseDumpNames, parsePm2List } from '../src/ops/pm2Guard.js'

const dryRun = process.argv.includes('--dry-run')
const pm2 = process.env.PM2_BIN || 'pm2'
const home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2')
const dumpPath = path.join(home, 'dump.pm2')
const KEEP = 20

let raw
try {
  raw = execFileSync(pm2, ['jlist'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 30_000 })
} catch (err) {
  console.error(`[pm2-save-seguro] ERRO: não consegui ler o pm2 (${err.message}). Nada foi salvo.`)
  process.exit(3)
}
const current = parsePm2List(raw)
let dumpRaw = null
try { dumpRaw = fs.readFileSync(dumpPath, 'utf8') } catch { dumpRaw = null }
const dumpNames = parseDumpNames(dumpRaw)

const decision = decidePm2Save({ current, dumpNames, allowRemove: process.env.PM2_SAVE_ALLOW_REMOVE })
if (!decision.ok) {
  console.error('[pm2-save-seguro] RECUSADO — o dump NÃO foi alterado:')
  for (const r of decision.reasons) console.error(`  - ${r}`)
  console.error('  Religue o que falta (scripts/religar-producao.sh) e rode de novo.')
  process.exit(3)
}
if (decision.removed.length) console.log(`[pm2-save-seguro] saindo do dump (permitido): ${decision.removed.join(', ')}`)
if (dryRun) { console.log(`[pm2-save-seguro] dry-run: salvaria ${current.length} apps.`); process.exit(0) }

if (dumpRaw !== null) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.copyFileSync(dumpPath, `${dumpPath}.bak-${stamp}`)
  const backups = fs.readdirSync(home).filter(f => f.startsWith('dump.pm2.bak-')).sort()
  for (const f of backups.slice(0, Math.max(0, backups.length - KEEP))) fs.rmSync(path.join(home, f), { force: true })
}
execFileSync(pm2, ['save'], { stdio: 'inherit', timeout: 30_000 })
console.log(`[pm2-save-seguro] salvo (${current.length} apps).`)
