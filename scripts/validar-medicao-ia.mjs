#!/usr/bin/env node
// Confere o CSV de medição de citação por IA antes de ele virar placar.
// Read-only. Uso: node scripts/validar-medicao-ia.mjs [caminho.csv]
// Sai com código 1 se houver ERRO (linha que mudaria a conta); avisos não barram.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateAiVisibilityCsv } from '../src/ops/aiVisibilityCsv.js'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arquivo = process.argv[2] || path.join(raiz, 'docs/marketing/ai_visibility_tracking.csv')
const { errors, warnings, rowCount } = validateAiVisibilityCsv(fs.readFileSync(arquivo, 'utf8'))

for (const aviso of warnings) console.log(`AVISO  ${aviso}`)
for (const erro of errors) console.error(`ERRO   ${erro}`)
console.log(`${rowCount} linhas · ${errors.length} erro(s) · ${warnings.length} aviso(s)`)
if (errors.length) process.exitCode = 1
