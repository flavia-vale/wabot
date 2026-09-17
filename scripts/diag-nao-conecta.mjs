#!/usr/bin/env node
/**
 * Diagnóstico: "a cliente não consegue conectar o WhatsApp / erro ao gerar QR".
 *
 * Read-only: não grava nada, não liga/desliga robô, não apaga credencial.
 *
 * Junta as cinco fontes que respondem a pergunta, porque nenhuma sozinha
 * separa as causas (que pedem ações OPOSTAS):
 *
 *  1. `WaSession` — estado gravado (status, lifecycle, último código de queda,
 *     `blockNotice` da trava por número repetido).
 *  2. `WaConnectionEvent` — a linha do tempo das quedas, com o código bruto.
 *  3. `AdminAuditLog('session.telemetry')` — o funil de CLIQUES dela na tela
 *     (connect_click -> service_start_ok -> qr_requested -> qr_rendered). É o
 *     que separa "a tela nem conseguiu ligar o robô" de "ligou e o QR nunca
 *     chegou".
 *  4. `AnalyticsEvent('ops_*')` — teto de vagas, versão do WA recusada,
 *     desistência de reconexão, número repetido.
 *  5. `bot.log` — as linhas do worker dela na janela.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-nao-conecta.mjs <email> [--days=3]
 */

import 'dotenv/config'
import { createReadStream, existsSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'
import db from '../src/db.js'
import { getLogsBaseDir, getAuthInfoDir } from '../src/paths.js'

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const alvo = process.argv.slice(2).find((a) => !a.startsWith('--'))
const days = Math.max(1, Number(arg('days', 3)))
const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

if (!alvo) {
  console.error('Uso: node scripts/diag-nao-conecta.mjs <email> [--days=3]')
  process.exit(1)
}

function iso(d) {
  return d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '-'
}

async function main() {
  console.log(`\n=== Diagnóstico de conexão — ${alvo} (últimos ${days} dia(s), horários em UTC) ===`)

  // Erro engolido em script de diagnóstico vira conclusão errada (RCA 2026-09-07):
  // se a consulta falhar, queremos ver a falha, não "não achei".
  const user = await db.user.findFirst({
    where: { OR: [{ email: alvo }, { name: alvo }, { contactPhone: alvo }] },
    select: { id: true, email: true, name: true, plan: true, accessExpiresAt: true, createdAt: true, status: true },
  })
  if (!user) {
    console.log('[1] CONTA: nenhuma conta encontrada com esse identificador.')
    return
  }
  console.log(`\n[1] CONTA: ${user.email} | id=${user.id} | plano=${user.plan} | status=${user.status}`)
  console.log(`    criada=${iso(user.createdAt)} | acesso até=${iso(user.accessExpiresAt)}`)

  const sess = await db.waSession.findUnique({ where: { userId: user.id } })
  console.log('\n[2] SESSÃO GRAVADA:')
  if (!sess) console.log('    (nenhuma linha em WaSession — ela nunca chegou a pedir conexão)')
  else {
    console.log(`    status=${sess.status} | lifecycle=${sess.lifecycle} | phone=${sess.phone || '-'}`)
    console.log(`    últimoCódigoDeQueda=${sess.lastDisconnectCode || '-'} | heartbeat=${iso(sess.lastHeartbeatAt)} | atualizada=${iso(sess.updatedAt)}`)
    console.log(`    blockNotice=${sess.blockNotice || '-'}`)
  }
  const authDir = getAuthInfoDir(user.id)
  console.log(`    credencial em disco: ${existsSync(authDir) ? 'EXISTE' : 'não existe'} (${authDir})`)
  console.log(`    backup de pareamento: ${existsSync(`${authDir}.pairing-backup`) ? 'EXISTE (pareamento interrompido)' : 'não existe'}`)

  const eventos = await db.waConnectionEvent.findMany({
    where: { userId: user.id, occurredAt: { gte: desde } },
    orderBy: { occurredAt: 'desc' },
    take: 80,
  })
  console.log(`\n[3] EVENTOS DE CONEXÃO (${eventos.length} na janela):`)
  for (const e of eventos) console.log(`    ${iso(e.occurredAt)} | ${e.type} | code=${e.code || '-'} | lifecycle=${e.lifecycle || '-'} | ${String(e.metadata).slice(0, 200)}`)
  if (!eventos.length) console.log('    (nenhum — o robô dela não subiu nem caiu na janela)')

  const tel = await db.adminAuditLog.findMany({
    where: { actorUserId: user.id, action: 'session.telemetry', createdAt: { gte: desde } },
    orderBy: { createdAt: 'desc' },
    take: 120,
  })
  console.log(`\n[4] O QUE A TELA DELA FEZ (${tel.length} passos):`)
  for (const t of tel.reverse()) {
    let p = {}
    try { p = JSON.parse(t.after || '{}') } catch {}
    console.log(`    ${iso(t.createdAt)} | ${p.stage}/${p.event}${p.detail ? ` | ${String(p.detail).slice(0, 160)}` : ''}`)
  }
  if (!tel.length) console.log('    (nenhum — ou ela não abriu a tela na janela, ou a tela não chegou a chamar a API)')

  const sinais = await db.analyticsEvent.findMany({
    where: { userId: user.id, event: { startsWith: 'ops_' }, createdAt: { gte: desde } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  console.log(`\n[5] SINAIS OPERACIONAIS DELA (${sinais.length}):`)
  for (const s of sinais) console.log(`    ${iso(s.createdAt)} | ${s.event} | ${String(s.metadata || '').slice(0, 200)}`)
  if (!sinais.length) console.log('    (nenhum)')

  const capacidade = await db.analyticsEvent.groupBy({
    by: ['event'],
    where: { event: { in: ['ops_session_capacity_limit', 'ops_session_capacity_warning'] }, createdAt: { gte: desde } },
    _count: { event: true },
  }).catch((e) => { console.log('    (falha ao contar capacidade:', e.message, ')'); return [] })
  console.log('\n[6] TETO DE VAGAS NO SERVIDOR (todas as contas, na janela):')
  console.log(`    MAX_SESSIONS_PER_PROCESS no ambiente=${process.env.MAX_SESSIONS_PER_PROCESS || '(ausente -> padrão 20)'}`)
  for (const c of capacidade) console.log(`    ${c.event}: ${c._count.event}`)
  if (!capacidade.length) console.log('    (nenhuma recusa por teto registrada na janela)')

  const logFile = join(getLogsBaseDir(), 'bot.log')
  console.log(`\n[7] LINHAS DO bot.log DO WORKER DELA (${logFile}):`)
  if (!existsSync(logFile)) console.log('    (arquivo não encontrado)')
  else {
    const linhas = []
    const rl = createInterface({ input: createReadStream(logFile), crlfDelay: Infinity })
    for await (const linha of rl) {
      if (!linha.includes(user.id)) continue
      let t = null
      try { t = JSON.parse(linha).time } catch {}
      if (t && t < desde.getTime()) continue
      linhas.push(linha)
      if (linhas.length > 4000) linhas.shift()
    }
    for (const l of linhas.slice(-120)) console.log(`    ${l.slice(0, 400)}`)
    if (!linhas.length) console.log('    (nenhuma linha dela na janela — o worker não rodou)')
  }
}

main()
  .catch((e) => { console.error('\nFALHA NO DIAGNÓSTICO:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
