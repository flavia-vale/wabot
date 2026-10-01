#!/usr/bin/env node
// Grava nodeId='n1' nas sessões que ainda estão com nodeId nulo.
//
// POR QUE: a regra do roteamento por nó é "nulo = n1, sempre". O backfill não
// muda comportamento — só torna explícito o que já valia — e é pré-requisito
// de listar um segundo nó (n2) em SUPERVISOR_NODE_IDS: depois dele, nenhuma
// conta antiga fica ambígua. Ver docs/ops/multi-supervisor-ativacao.md.
//
// Read-only por padrão. Grava só com --aplicar. Idempotente.
//
//   node scripts/backfill-node-id.mjs
//   node scripts/backfill-node-id.mjs --aplicar

import 'dotenv/config'
import db from '../src/db.js'
import { DEFAULT_NODE_ID } from '../src/supervisor/protocol.js'

const aplicar = process.argv.includes('--aplicar')

try {
  const total = await db.waSession.count()
  const nulos = await db.waSession.count({ where: { nodeId: null } })
  console.log(`sessões: ${total} | com nodeId nulo: ${nulos}`)
  if (!aplicar) {
    console.log(`(simulação) com --aplicar, ${nulos} sessões receberiam nodeId='${DEFAULT_NODE_ID}'`)
  } else {
    const { count } = await db.waSession.updateMany({ where: { nodeId: null }, data: { nodeId: DEFAULT_NODE_ID } })
    const restantes = await db.waSession.count({ where: { nodeId: null } })
    console.log(`gravadas: ${count} | nulas restantes: ${restantes}`)
  }
} finally {
  await db.$disconnect()
}
