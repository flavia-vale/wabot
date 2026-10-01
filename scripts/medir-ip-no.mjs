#!/usr/bin/env node
// Mede se um servidor secundário deixa o WhatsApp mais instável que o principal
// (efeito do endereço de internet diferente). Read-only.
//
//   node scripts/medir-ip-no.mjs --candidato=n2 [--base=n1] [--horas=72]
//
// Lê os eventos de conexão (WaConnectionEvent: replaced, auth_reset, forbidden,
// flap/stable-close, retry_giveup) das contas de cada servidor na janela e
// compara a taxa por conta e por dia. Decisões em src/supervisor/ipMeasure.js
// (pura, testada). Limites que você precisa saber:
//   - os eventos são guardados por ~14 dias (retenção do telemetria);
//   - usa o servidor ATUAL de cada conta: se uma conta mudou de servidor DENTRO da
//     janela, os eventos antigos dela contam no servidor novo. Meça só depois de
//     mover e de esperar a janela inteira;
//   - com 1 conta-teste só detecta problema grosseiro (não é prova estatística).

import 'dotenv/config'
import db from '../src/db.js'
import { compareNodes, summarizeInstabilityByNode } from '../src/supervisor/ipMeasure.js'
import { isValidNodeId } from '../src/supervisor/protocol.js'

const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const candidate = arg('candidato')
const base = arg('base', 'n1')
const horas = Number(arg('horas', '72'))
if (!isValidNodeId(candidate) || !isValidNodeId(base) || !(horas > 0)) {
  console.error('Uso: node scripts/medir-ip-no.mjs --candidato=n2 [--base=n1] [--horas=72]')
  process.exit(2)
}

try {
  const desde = new Date(Date.now() - horas * 3_600_000)
  const sessoes = await db.waSession.findMany({ select: { userId: true, nodeId: true } })
  const nodeOfUser = Object.fromEntries(sessoes.map(s => [s.userId, s.nodeId]))
  const eventos = await db.waConnectionEvent.findMany({
    where: { occurredAt: { gte: desde } },
    select: { userId: true, type: true, code: true },
  })
  const summary = summarizeInstabilityByNode({ events: eventos, nodeOfUser, windowHours: horas })
  console.log(`Janela: últimas ${horas} h | eventos lidos: ${eventos.length}`)
  for (const [id, n] of Object.entries(summary)) {
    const taxa = n.badPerAccountDay === null ? 'n/d' : n.badPerAccountDay.toFixed(2)
    console.log(`\nservidor ${id}: ${n.accounts} conta(s) | instabilidade: ${n.bad} (${taxa} por conta/dia) | tentativas de reconexão: ${n.reconnects}`)
    if (Object.keys(n.byType).length) console.log(`  por tipo: ${JSON.stringify(n.byType)}`)
    if (Object.keys(n.byCode).length) console.log(`  códigos do WhatsApp: ${JSON.stringify(n.byCode)}`)
  }
  const veredito = compareNodes({ summary, base, candidate, windowHours: horas })
  const icon = { worse: '❌', no_difference: '✅', insufficient_data: '⚠️ ' }[veredito.code]
  console.log(`\n${icon} ${veredito.message}`)
  process.exitCode = veredito.code === 'worse' ? 1 : 0
} finally {
  await db.$disconnect()
}
