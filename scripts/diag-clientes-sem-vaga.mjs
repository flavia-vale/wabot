#!/usr/bin/env node
/**
 * Diagnóstico: QUEM tentou conectar o WhatsApp e não conseguiu porque o
 * servidor estava no teto de robôs (`MAX_SESSIONS_PER_PROCESS`).
 *
 * Read-only: não grava nada, não liga robô nenhum, não manda e-mail.
 *
 * Junta TRÊS fontes, porque nenhuma sozinha cobre o período inteiro:
 *
 *  1. `AnalyticsEvent('ops_session_capacity_limit')` — a fonte boa, mas só
 *     existe depois do deploy que criou o sinal (2026-09-01). Antes disso a
 *     recusa não deixava rastro no banco.
 *  2. Log do supervisor — cada recusa loga `{ userId }` junto da linha
 *     "Circuit breaker: limite de sessões por processo atingido". Cobre o
 *     período anterior ao sinal, desde que o arquivo de log tenha sobrevivido.
 *  3. `WaConnectionEvent('manual_pairing_requested')` com
 *     `workerWasRunning:false` — tentativa de parear por número em que o robô
 *     não subiu. Nem toda linha dessas é falta de vaga (o robô pode ter caído
 *     por outro motivo), por isso vem marcada como INDÍCIO, não como certeza.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-clientes-sem-vaga.mjs [--days=30] [--csv]
 *   cd ~/wabot && node scripts/diag-clientes-sem-vaga.mjs --days=60 --csv > contatos.csv
 */

import 'dotenv/config'
import { createReadStream, existsSync, readdirSync, statSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'
import { homedir } from 'os'
import db from '../src/db.js'
import { getLogsBaseDir } from '../src/paths.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const days = Math.max(1, Number(arg('days', 30)))
const asCsv = process.argv.includes('--csv')
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

// userId -> { fontes:Set, tentativas:number, primeira:Date, ultima:Date }
const hits = new Map()

function registrar(userId, quando, fonte) {
  if (!userId) return
  const at = quando instanceof Date && !Number.isNaN(quando.getTime()) ? quando : null
  if (at && at < since) return
  const atual = hits.get(userId) ?? { fontes: new Set(), tentativas: 0, primeira: null, ultima: null }
  atual.fontes.add(fonte)
  atual.tentativas += 1
  if (at) {
    if (!atual.primeira || at < atual.primeira) atual.primeira = at
    if (!atual.ultima || at > atual.ultima) atual.ultima = at
  }
  hits.set(userId, atual)
}

// ---- Fonte 1: sinal durável no banco -----------------------------------
async function lerSinalDoBanco() {
  const eventos = await db.analyticsEvent.findMany({
    where: { event: 'ops_session_capacity_limit', createdAt: { gte: since } },
    select: { userId: true, metadata: true, createdAt: true },
  }).catch(() => [])
  for (const ev of eventos) {
    let userId = ev.userId
    if (!userId) {
      try { userId = JSON.parse(ev.metadata ?? '{}')?.userId ?? null } catch { userId = null }
    }
    registrar(userId, ev.createdAt, 'sinal')
  }
  return eventos.length
}

// ---- Fonte 2: log do supervisor ----------------------------------------
function arquivosDeLog() {
  const alvos = []
  const logDir = getLogsBaseDir()
  const pm2Dir = join(homedir(), '.pm2', 'logs')
  for (const dir of [logDir, pm2Dir]) {
    if (!existsSync(dir)) continue
    for (const nome of readdirSync(dir)) {
      if (!/^(bot\.log|bot-supervisor-(out|error))/.test(nome)) continue
      const caminho = join(dir, nome)
      try { if (statSync(caminho).isFile()) alvos.push(caminho) } catch {}
    }
  }
  return alvos
}

const RE_CIRCUIT = /Circuit breaker: limite de sess/i
// O userId aparece como campo do pino (JSON) ou impresso pelo pino-pretty.
const RE_USER_ID = /"userId"\s*:\s*"([^"]+)"|userId:\s*"?([a-z0-9]{20,})"?/i

async function lerLogs() {
  let linhas = 0
  for (const caminho of arquivosDeLog()) {
    await new Promise((resolve) => {
      const rl = createInterface({ input: createReadStream(caminho, { encoding: 'utf8' }), crlfDelay: Infinity })
      rl.on('line', (linha) => {
        if (!RE_CIRCUIT.test(linha)) return
        const m = RE_USER_ID.exec(linha)
        const userId = m?.[1] || m?.[2] || null
        if (!userId) return
        linhas++
        let quando = null
        const t = /"time"\s*:\s*(\d+)/.exec(linha)
        if (t) quando = new Date(Number(t[1]))
        registrar(userId, quando, 'log')
      })
      rl.on('close', resolve)
      rl.on('error', resolve)
    })
  }
  return linhas
}

// ---- Fonte 3: pareamento que não subiu (indício) ------------------------
async function lerPareamentos() {
  const eventos = await db.waConnectionEvent.findMany({
    where: { type: 'manual_pairing_requested', occurredAt: { gte: since } },
    select: { userId: true, metadata: true, occurredAt: true },
  }).catch(() => [])
  let considerados = 0
  for (const ev of eventos) {
    let meta = {}
    try { meta = JSON.parse(ev.metadata ?? '{}') } catch {}
    if (meta.workerWasRunning !== false) continue
    considerados++
    registrar(ev.userId, ev.occurredAt, meta.refused ? 'sinal' : 'indicio')
  }
  return considerados
}

const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')

async function main() {
  const nSinal = await lerSinalDoBanco()
  const nLog = await lerLogs()
  const nPair = await lerPareamentos()

  if (hits.size === 0) {
    console.log(`Nenhuma cliente barrada por falta de vaga nos últimos ${days} dias.`)
    console.log(`(sinal no banco: ${nSinal} | linhas de log: ${nLog} | pareamentos sem robô: ${nPair})`)
    return
  }

  const users = await db.user.findMany({
    where: { id: { in: [...hits.keys()] } },
    select: {
      id: true, name: true, email: true, contactPhone: true,
      plan: true, status: true, accessExpiresAt: true,
      waSession: { select: { phone: true, status: true, updatedAt: true } },
    },
  })
  const byId = new Map(users.map(u => [u.id, u]))

  const linhas = [...hits.entries()]
    .map(([userId, info]) => {
      const u = byId.get(userId)
      // WaSession.phone é o número do WhatsApp que a cliente conectou; serve de
      // contato quando ela não preencheu o telefone do cadastro.
      const telefone = u?.contactPhone || u?.waSession?.phone || ''
      return {
        nome: u?.name ?? '(conta apagada)',
        telefone,
        email: u?.email ?? '',
        plano: u?.plan ?? '',
        conta: u?.status ?? '',
        tentativas: info.tentativas,
        certeza: info.fontes.has('sinal') || info.fontes.has('log') ? 'confirmado' : 'indício',
        primeira: info.primeira,
        ultima: info.ultima,
        conectado_agora: u?.waSession?.status === 'connected' ? 'sim' : 'não',
      }
    })
    .sort((a, b) => b.tentativas - a.tentativas)

  if (asCsv) {
    console.log('nome,telefone,email,plano,conta,tentativas,certeza,primeira_tentativa,ultima_tentativa,conectado_agora')
    for (const l of linhas) {
      const campos = [l.nome, l.telefone, l.email, l.plano, l.conta, l.tentativas, l.certeza, fmt(l.primeira), fmt(l.ultima), l.conectado_agora]
      console.log(campos.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    }
    return
  }

  console.log(`\nClientes barradas por falta de vaga nos últimos ${days} dias: ${linhas.length}`)
  console.log(`Fontes — sinal no banco: ${nSinal} | linhas de log: ${nLog} | pareamentos sem robô: ${nPair}\n`)
  for (const l of linhas) {
    console.log(`${l.certeza === 'confirmado' ? '●' : '○'} ${l.nome}`)
    console.log(`   telefone: ${l.telefone || '(não cadastrado)'}   e-mail: ${l.email}`)
    console.log(`   plano: ${l.plano} | conta: ${l.conta} | tentativas: ${l.tentativas} | conectada agora: ${l.conectado_agora}`)
    console.log(`   primeira: ${fmt(l.primeira)}   última: ${fmt(l.ultima)}\n`)
  }
  console.log('● confirmado = o servidor registrou a recusa por falta de vaga')
  console.log('○ indício    = tentou parear e o robô não subiu; pode ter sido outra causa')
  console.log('\nPara planilha: node scripts/diag-clientes-sem-vaga.mjs --csv > contatos.csv')
}

main()
  .catch(err => { console.error('Falhou:', err?.message ?? err); process.exitCode = 1 })
  .finally(() => db.$disconnect().catch(() => {}))
