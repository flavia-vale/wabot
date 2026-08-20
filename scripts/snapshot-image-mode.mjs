#!/usr/bin/env node
/**
 * Guarda a "memória" de quem estava no modo de imagem PREVIEW antes da troca
 * global para "imagem que veio na mensagem" (2026-08-20).
 *
 * Contexto: o modo é global (`GROUP_IMAGE_MODE`, `src/core/imageModePolicy.js`)
 * e o valor persistido em `Group.imageMode` nunca é lido pelo pipeline. Ou
 * seja: TODO grupo monitorado ativo estava em preview. Este script grava, em
 * arquivo, a lista de clientes e grupos que estavam nessa condição no momento
 * da troca — é o que permite voltar sabendo exatamente quem era.
 *
 * Read-only no banco: não altera nada, só lê e grava um arquivo JSON.
 *
 * Uso:
 *   cd ~/wabot && node scripts/snapshot-image-mode.mjs
 *   cd ~/wabot && node scripts/snapshot-image-mode.mjs --out=/caminho/arquivo.json
 */

import 'dotenv/config'
import { writeFileSync } from 'fs'
import { join } from 'path'
import db from '../src/db.js'
import { getLogsBaseDir } from '../src/paths.js'
import { resolveGroupImageMode, DEFAULT_GROUP_IMAGE_MODE } from '../src/core/imageModePolicy.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const agora = new Date()
const out = arg('out', join(getLogsBaseDir(), `image-mode-snapshot-${agora.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`))

const grupos = await db.group.findMany({
  where: { role: 'monitor' },
  select: { id: true, userId: true, waJid: true, name: true, imageMode: true, active: true },
}).catch(async () => db.group.findMany({
  select: { id: true, userId: true, waJid: true, name: true, imageMode: true },
}))

const users = await db.user.findMany({
  where: { id: { in: [...new Set(grupos.map(g => g.userId))] } },
  select: { id: true, email: true, name: true },
})
const porUser = new Map(users.map(u => [u.id, u]))

const snapshot = {
  gravadoEm: agora.toISOString(),
  motivo: 'troca global de preview para "imagem que veio na mensagem" (bloqueio do ML na foto do preview)',
  modoEfetivoAntes: DEFAULT_GROUP_IMAGE_MODE,
  modoEfetivoAgora: resolveGroupImageMode(),
  observacao: 'O pipeline usa o modo GLOBAL; o campo imageMode de cada grupo nunca é lido e está aqui só como registro.',
  clientes: users.map(u => ({
    userId: u.id,
    email: u.email,
    nome: u.name,
    grupos: grupos.filter(g => g.userId === u.id).map(g => ({
      id: g.id, waJid: g.waJid, nome: g.name, imageModePersistido: g.imageMode ?? null, ativo: g.active ?? null,
    })),
  })),
}

writeFileSync(out, JSON.stringify(snapshot, null, 2))

console.log(`\nSnapshot gravado em: ${out}`)
console.log(`Clientes: ${snapshot.clientes.length} | Grupos monitorados: ${grupos.length}`)
console.log(`Modo efetivo agora: ${snapshot.modoEfetivoAgora}`)
console.log('\nPara voltar todo mundo ao preview: apague GROUP_IMAGE_MODE do .env,')
console.log('recrie a API (pm2 delete api && pm2 start ecosystem.config.cjs --only api)')
console.log('e reinicie o bot-supervisor para os bots pegarem.')
for (const c of snapshot.clientes) {
  console.log(`  ${String(c.email).padEnd(42)} ${c.grupos.length} grupo(s)`)
}

await db.$disconnect()
