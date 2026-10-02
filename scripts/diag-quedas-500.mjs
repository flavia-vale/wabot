#!/usr/bin/env node
/**
 * Aceite dos patches do Baileys contra quedas 500 por mensagem travada
 * (canal — RCA 2026-09-24; DM — PR #2112; ack de último recurso/status —
 * docs/rca/whatsapp-sessao.md "Ack de último recurso").
 *
 * Responde duas perguntas, read-only:
 *   1. Por dia (UTC): quedas 500, quantas com `stuckMsg`, conexões abertas e a
 *      razão `500 com stuckMsg ÷ opens`. Aceite = razão perto de zero por 7 dias.
 *   2. Na cauda do bot.log: o ack que o servidor recusou era de qual tipo de
 *      chat (canal, dm, grupo, status)? Se a razão não cai, o balde que sobrou
 *      é o próximo conserto.
 *
 * Uso (no VPS, dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-quedas-500.mjs
 *   cd ~/wabot && node scripts/diag-quedas-500.mjs --dias=14 --log-mb=120
 */
import 'dotenv/config'
import { openSync, readSync, fstatSync, closeSync } from 'node:fs'
import { join } from 'node:path'
import { dailyStuck500Ratio, tallyStuckAcksFromLog } from '../src/core/stuckAckClassifier.js'
import { getLogsBaseDir } from '../src/paths.js'

const args = process.argv.slice(2)
const opt = (nome, padrao) => {
  const hit = args.find((a) => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
const dias = Math.max(1, Number(opt('dias', 7)) || 7)
const logMb = Math.max(5, Number(opt('log-mb', 80)) || 80)
const logPath = opt('log', join(getLogsBaseDir(), 'bot.log'))

function lerCaudaDoLog(caminho, maxBytes) {
  let fd
  try {
    fd = openSync(caminho, 'r')
  } catch {
    return null
  }
  try {
    const tamanho = fstatSync(fd).size
    const ler = Math.min(tamanho, maxBytes)
    const buf = Buffer.allocUnsafe(ler)
    readSync(fd, buf, 0, ler, tamanho - ler)
    return buf.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

const db = (await import('../src/db.js')).default
const desde = new Date(Date.now() - dias * 86400_000)
const rows = await db.waConnectionEvent.findMany({
  where: {
    occurredAt: { gte: desde },
    OR: [
      { type: { in: ['connected', 'reconnect_success'] } },
      { type: 'disconnect', code: '500' },
    ],
  },
  select: { type: true, code: true, metadata: true, occurredAt: true },
})

console.log(`\n===== quedas 500 por dia (últimos ${dias}d, UTC) =====`)
console.log('dia         quedas500  stuckMsg  opens  razao(stuck/open)')
for (const d of dailyStuck500Ratio(rows)) {
  console.log(`${d.dia}  ${String(d.quedas500).padStart(9)}  ${String(d.stuckMsg).padStart(8)}  ${String(d.opens).padStart(5)}  ${d.razao ?? '—'}`)
}

console.log(`\n===== acks recusados no bot.log (últimos ${logMb} MB de ${logPath}) =====`)
const texto = lerCaudaDoLog(logPath, logMb * 1024 * 1024)
if (texto == null) {
  console.log('bot.log não encontrado — passe --log=<caminho>')
} else {
  const t = tallyStuckAcksFromLog(texto)
  console.log(`total=${t.total} ids_distintos=${t.idsDistintos}`)
  console.log('por tipo de chat:', JSON.stringify(t.porTipo))
  console.log('por class do ack:', JSON.stringify(t.porClasse))
  console.log('(desconhecido = o id não aparece em nenhuma outra linha da cauda; aumente --log-mb)')
}

await db.$disconnect?.()
