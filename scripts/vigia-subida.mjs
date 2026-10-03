#!/usr/bin/env node
// Vigia de SUBIDA (merge develop → main) — SOMENTE LEITURA no banco e no pm2.
//
// 1) ANTES do merge, guarda o "marco" (quem estava conectado, quem estava
//    espelhando/enviando na última hora, processos, commit):
//      cd ~/wabot && node scripts/vigia-subida.mjs marco
//
// 2) DEPOIS do merge, acompanha e compara com o marco (repete a cada 2 min):
//      cd ~/wabot && node scripts/vigia-subida.mjs acompanhar            # 60 min
//      cd ~/wabot && node scripts/vigia-subida.mjs acompanhar --minutos=30
//      cd ~/wabot && node scripts/vigia-subida.mjs agora                 # uma leitura só
//
// Olha: processos pm2 (fora do ar / reiniciando sem parar), API (/ready e
// /ready/bots), painel, sessões do WhatsApp (quem estava conectado e caiu),
// espelhamento e envios (ritmo × marco, contas que pararam), erros e fila presa.
// Saída: 0 = sem 🔴 na última leitura; 1 = tem 🔴; 2 = sem marco / erro de uso.
//
// Feito para rodar ANTES de existir no disco de produção (o merge é que traz o
// arquivo): tudo do projeto é carregado a partir de ROOT (padrão: pasta atual).
//   git -C ~/wabot fetch origin develop && \
//   git -C ~/wabot show origin/develop:scripts/vigia-subida.mjs > /tmp/vigia-subida.mjs && \
//   cd ~/wabot && node /tmp/vigia-subida.mjs marco
//
// Grava só o marco em $HOME/wabot-pontos-de-retorno/subida-marco.json (+ cópia datada).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const MIN = 60_000

// ---------------------------------------------------------------- regras puras

// Espelhamento = saiu de um grupo/canal de origem (JID com @). O resto
// ('scheduled', ofertas automáticas, Criar oferta…) conta só em "envios".
export const isMirror = sourceGroup => typeof sourceGroup === 'string' && sourceGroup.includes('@')

const fmtPct = x => `${Math.round(x * 100)}%`
const lista = (xs, max = 12) => xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} … (+${xs.length - max})`

// Compara uma leitura com o marco. Tudo que entra aqui já é dado coletado.
//   marco/agora: { commit, pm2:[{name,status,restarts}], http:{ready,bots,painel},
//                  sessions:{connected:[userId], stale}, sends:{janelaMin, porUsuario:{id:{mirror,outros,erros}}, stuck} }
//   anterior: leitura anterior do mesmo acompanhamento (detecta pm2 em loop)
//   minutosDesde: minutos desde a subida (janela de `agora.sends`)
//   nomes: { userId: email } só para imprimir
export function compararSubida({ marco, agora, anterior = null, minutosDesde, carenciaMin = 15, nomes = {} }) {
  const out = []
  const add = (nivel, titulo, detalhe = '') => out.push({ nivel, titulo, detalhe })
  const nome = id => nomes[id] || id
  const emCarencia = minutosDesde < carenciaMin

  // Código
  if (agora.commit && marco.commit && agora.commit === marco.commit) add('🟡', 'Código', 'ainda é o mesmo commit do marco (deploy não chegou ou não terminou)')
  else add('🟢', 'Código', `${String(marco.commit).slice(0, 7)} → ${String(agora.commit).slice(0, 7)}`)

  // Processos
  const online = new Set((agora.pm2 || []).filter(p => p.status === 'online').map(p => p.name))
  const eraOnline = (marco.pm2 || []).filter(p => p.status === 'online').map(p => p.name)
  const fora = eraOnline.filter(n => !online.has(n))
  if (!agora.pm2?.length) add('🔴', 'Processos', 'não consegui ler o pm2 (rode no servidor, com o usuário do pm2)')
  else if (fora.length) add(emCarencia ? '🟡' : '🔴', 'Processos', `fora do ar: ${fora.join(', ')}`)
  else add('🟢', 'Processos', `${eraOnline.length} no ar`)
  if (anterior?.pm2) {
    const antes = new Map(anterior.pm2.map(p => [p.name, p.restarts]))
    const loop = (agora.pm2 || []).filter(p => antes.has(p.name) && p.restarts - antes.get(p.name) >= 2).map(p => p.name)
    if (loop.length) add('🔴', 'Processos', `reiniciando sem parar: ${loop.join(', ')}`)
  }

  // API e painel
  const h = agora.http || {}
  for (const [k, rotulo] of [['ready', 'API /ready'], ['bots', 'API /ready/bots'], ['painel', 'Painel']]) {
    const s = h[k]
    const ok = typeof s === 'number' && s >= 200 && s < 400
    if (!ok) add(emCarencia ? '🟡' : '🔴', rotulo, `respondeu ${s ?? 'nada'}`)
  }
  if (['ready', 'bots', 'painel'].every(k => typeof h[k] === 'number' && h[k] >= 200 && h[k] < 400)) add('🟢', 'API e painel', 'respondendo')

  // Sessões do WhatsApp
  const agoraCon = new Set(agora.sessions?.connected || [])
  const antesCon = marco.sessions?.connected || []
  const caiu = antesCon.filter(id => !agoraCon.has(id))
  const tolerancia = Math.max(2, Math.ceil(antesCon.length * 0.03))
  const resumoSess = `${agoraCon.size} conectadas agora × ${antesCon.length} no marco`
  if (caiu.length === 0) add('🟢', 'Sessões WhatsApp', resumoSess)
  else if (caiu.length <= tolerancia) add('🟡', 'Sessões WhatsApp', `${resumoSess}; fora: ${lista(caiu.map(nome))}`)
  else add(emCarencia ? '🟡' : '🔴', 'Sessões WhatsApp', `${resumoSess}; ${caiu.length} que estavam conectadas não voltaram${emCarencia ? ' (ainda reconectando)' : ''}: ${lista(caiu.map(nome))}`)
  const stale = agora.sessions?.stale ?? 0
  if (stale > 0) add(!emCarencia && stale > Math.max(3, agoraCon.size * 0.1) ? '🔴' : '🟡', 'Sessões WhatsApp', `${stale} "conectadas" sem sinal de vida há +5 min`)

  // Espelhamento e envios: ritmo × marco
  const soma = (s, campo) => Object.values(s?.porUsuario || {}).reduce((a, u) => a + (u[campo] || 0), 0)
  const ritmo = (s, campo) => soma(s, campo) / Math.max(1, s?.janelaMin || 1)
  const janela = Math.max(1, agora.sends?.janelaMin || minutosDesde)
  for (const [campo, rotulo] of [['mirror', 'Espelhamento'], ['outros', 'Outros envios (agendados/automáticos)']]) {
    const esperado = ritmo(marco.sends, campo) * janela
    const feito = soma(agora.sends, campo)
    const txt = `${feito} em ${Math.round(janela)} min (marco: ~${Math.round(esperado)} no mesmo tempo)`
    if (esperado < 5) add('🟢', rotulo, `${txt} — pouco movimento no marco, sem comparação`)
    else if (janela < 10) add('🟡', rotulo, `${txt} — cedo para comparar`)
    else if (feito < esperado * 0.3) add('🔴', rotulo, `${txt} — caiu para ${fmtPct(feito / esperado)}`)
    else if (feito < esperado * 0.6) add('🟡', rotulo, `${txt} — ${fmtPct(feito / esperado)} do normal`)
    else add('🟢', rotulo, txt)
  }

  // Contas que espelhavam e pararam (origem pode só estar quieta → 🟡, salvo se forem muitas)
  const ativos = Object.entries(marco.sends?.porUsuario || {}).filter(([, u]) => (u.mirror || 0) >= 3).map(([id]) => id)
  if (ativos.length && janela >= 20) {
    const pararam = ativos.filter(id => !(agora.sends?.porUsuario?.[id]?.mirror > 0))
    if (pararam.length === 0) add('🟢', 'Contas espelhando', `todas as ${ativos.length} que espelhavam seguem espelhando`)
    else add(pararam.length > ativos.length * 0.25 ? '🔴' : '🟡', 'Contas espelhando',
      `${pararam.length} de ${ativos.length} que espelhavam não espelharam nada desde a subida: ${lista(pararam.map(nome))}`)
  }

  // Erros
  const ok = soma(agora.sends, 'mirror') + soma(agora.sends, 'outros')
  const err = soma(agora.sends, 'erros')
  const okM = soma(marco.sends, 'mirror') + soma(marco.sends, 'outros')
  const errM = soma(marco.sends, 'erros')
  const taxa = ok + err ? err / (ok + err) : 0
  const taxaM = okM + errM ? errM / (okM + errM) : 0
  if (ok + err >= 20 && taxa > Math.max(0.1, taxaM * 2)) add('🔴', 'Erros de envio', `${fmtPct(taxa)} (marco: ${fmtPct(taxaM)}) — ${err} erros`)
  else add('🟢', 'Erros de envio', `${fmtPct(taxa)} (marco: ${fmtPct(taxaM)})`)

  // Fila presa
  const stuck = agora.sends?.stuck ?? 0
  const stuckM = marco.sends?.stuck ?? 0
  if (stuck > Math.max(5, stuckM * 2)) add('🔴', 'Fila presa', `${stuck} envios parados há +15 min (marco: ${stuckM})`)
  else if (stuck > stuckM) add('🟡', 'Fila presa', `${stuck} parados há +15 min (marco: ${stuckM})`)
  else add('🟢', 'Fila presa', `${stuck} (marco: ${stuckM})`)

  return out
}

export const pior = itens => itens.some(i => i.nivel === '🔴') ? '🔴' : itens.some(i => i.nivel === '🟡') ? '🟡' : '🟢'

// ------------------------------------------------------------------- coleta

const sh = promisify(execFile)
const safe = async fn => { try { return await fn() } catch { return null } }

async function readPm2() {
  const { stdout } = await sh('pm2', ['jlist'], { timeout: 15_000, maxBuffer: 20 * 1024 * 1024 })
  return JSON.parse(stdout).map(p => ({ name: p.name, status: p.pm2_env?.status, restarts: p.pm2_env?.restart_time ?? 0, desde: p.pm2_env?.pm_uptime ?? null }))
}

async function httpStatus(url) {
  try { return (await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8_000) })).status } catch { return null }
}

async function coletar({ root, db, desde }) {
  const now = Date.now()
  const apiPort = process.env.API_PORT || 3001
  const painelPort = process.env.DASHBOARD_PORT || 3000
  const live = { status: { in: ['connected', 'connecting'] } }
  const [commit, pm2, ready, bots, painel, connected, stale, rows, stuck] = await Promise.all([
    safe(async () => (await sh('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim()),
    safe(readPm2),
    httpStatus(`http://127.0.0.1:${apiPort}/ready`),
    httpStatus(`http://127.0.0.1:${apiPort}/ready/bots`),
    httpStatus(`http://127.0.0.1:${painelPort}/`),
    safe(async () => (await db.waSession.findMany({ where: { status: 'connected' }, select: { userId: true } })).map(r => r.userId)),
    safe(() => db.waSession.count({ where: { ...live, OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: new Date(now - 5 * MIN) } }] } })),
    safe(() => db.messageLog.groupBy({
      by: ['userId', 'sourceGroup', 'status'],
      where: { sentAt: { gte: new Date(desde) }, status: { in: ['success', 'error', 'failed'] }, NOT: { errorMsg: { startsWith: 'error:worker_restart' } } },
      _count: { _all: true },
    })),
    safe(() => db.messageLog.count({ where: { sentAt: { lt: new Date(now - 15 * MIN), gte: new Date(now - 6 * 60 * MIN) }, status: { in: ['queued', 'sending', 'pending'] } } })),
  ])
  const porUsuario = {}
  for (const r of rows || []) {
    const u = (porUsuario[r.userId] ||= { mirror: 0, outros: 0, erros: 0 })
    const n = r._count._all
    if (r.status === 'success') u[isMirror(r.sourceGroup) ? 'mirror' : 'outros'] += n
    else u.erros += n
  }
  return {
    at: new Date(now).toISOString(),
    commit,
    pm2: pm2 || [],
    http: { ready, bots, painel },
    sessions: connected ? { connected, stale: stale ?? 0 } : null,
    sends: rows ? { janelaMin: (now - desde) / MIN, porUsuario, stuck: stuck ?? 0 } : null,
  }
}

async function nomesDe(db, ids) {
  if (!ids.length) return {}
  const rows = await safe(() => db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })) || []
  return Object.fromEntries(rows.map(r => [r.id, r.email]))
}

function imprimir(itens, cabecalho) {
  console.log(`\n${pior(itens)} ${cabecalho}`)
  for (const i of itens) console.log(`  ${i.nivel} ${i.titulo}${i.detalhe ? ': ' + i.detalhe : ''}`)
}

// --------------------------------------------------------------------- main

async function main() {
  const [modo = 'agora', ...rest] = process.argv.slice(2)
  const args = new Map(rest.map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
  if (!['marco', 'acompanhar', 'agora'].includes(modo)) {
    console.error('uso: vigia-subida.mjs marco | acompanhar [--minutos=60] [--intervalo=120] | agora [--desde=ISO]')
    process.exit(2)
  }
  const root = path.resolve(String(args.get('root') || process.env.ROOT || process.cwd()))
  const require = createRequire(path.join(root, 'package.json'))
  require('dotenv').config({ path: path.join(root, '.env') })
  const { default: db } = await import(pathToFileURL(path.join(root, 'src/db.js')).href)

  const dir = String(args.get('dir') || path.join(os.homedir(), 'wabot-pontos-de-retorno'))
  const marcoFile = path.join(dir, 'subida-marco.json')

  if (modo === 'marco') {
    const m = await coletar({ root, db, desde: Date.now() - 60 * MIN })
    if (!m.sessions || !m.sends) { console.error('Não consegui ler o banco — marco NÃO gravado.'); process.exit(1) }
    fs.mkdirSync(dir, { recursive: true })
    const json = JSON.stringify(m, null, 2)
    fs.writeFileSync(marcoFile, json)
    fs.writeFileSync(path.join(dir, `subida-marco-${m.at.replace(/[:.]/g, '-')}.json`), json)
    const ativos = Object.values(m.sends.porUsuario).filter(u => u.mirror >= 3).length
    const espelhou = Object.values(m.sends.porUsuario).reduce((a, u) => a + u.mirror, 0)
    const outros = Object.values(m.sends.porUsuario).reduce((a, u) => a + u.outros, 0)
    console.log(`Marco gravado em ${marcoFile}`)
    console.log(`  commit ${m.commit?.slice(0, 7)} · pm2 online: ${m.pm2.filter(p => p.status === 'online').map(p => p.name).join(', ')}`)
    console.log(`  API /ready ${m.http.ready} · /ready/bots ${m.http.bots} · painel ${m.http.painel}`)
    console.log(`  sessões conectadas: ${m.sessions.connected.length} (sem sinal +5 min: ${m.sessions.stale})`)
    console.log(`  última hora: ${espelhou} espelhadas (${ativos} contas ativas), ${outros} outros envios, fila presa ${m.sends.stuck}`)
    await db.$disconnect?.()
    return
  }

  let marco
  try { marco = JSON.parse(fs.readFileSync(marcoFile, 'utf8')) } catch {
    console.error(`Sem marco em ${marcoFile}. Rode antes do merge: node scripts/vigia-subida.mjs marco`)
    process.exit(2)
  }
  const marcoAt = Date.parse(marco.at)
  // "Desde a subida" = quando a API foi reiniciada pelo deploy (se depois do marco).
  const calcDesde = pm2 => {
    if (args.get('desde')) return Date.parse(String(args.get('desde')))
    const api = (pm2 || []).find(p => p.name === 'api')?.desde
    return api && api > marcoAt ? api : marcoAt
  }

  const minutos = Number(args.get('minutos') || 60)
  const intervalo = Number(args.get('intervalo') || 120) * 1000
  const fim = modo === 'acompanhar' ? Date.now() + minutos * MIN : 0
  let anterior = null
  let ultimo = '🟢'
  do {
    const desde = calcDesde(await safe(readPm2))
    const agora = await coletar({ root, db, desde })
    if (!agora.sessions || !agora.sends) {
      console.log(`\n⚪ ${new Date().toLocaleTimeString('pt-BR')} — não consegui ler o banco nesta rodada`)
      ultimo = '🔴'
    } else {
      const minutosDesde = (Date.now() - desde) / MIN
      const suspeitos = [...(marco.sessions?.connected || []), ...Object.keys(marco.sends?.porUsuario || {})]
      const nomes = await nomesDe(db, [...new Set(suspeitos)])
      const itens = compararSubida({ marco, agora, anterior, minutosDesde, nomes })
      ultimo = pior(itens)
      imprimir(itens, `${new Date().toLocaleTimeString('pt-BR')} — ${Math.round(minutosDesde)} min desde a subida`)
      anterior = agora
    }
    if (Date.now() + intervalo > fim) break
    await new Promise(r => setTimeout(r, intervalo))
  } while (true)

  console.log(ultimo === '🔴'
    ? `\n🔴 TEM PROBLEMA. Veja os itens 🔴 acima. Rollback (dry-run primeiro): scripts/voltar_ao_ponto.sh ${marco.commit}`
    : `\n${ultimo} Sem item vermelho na última leitura.`)
  await db.$disconnect?.()
  process.exit(ultimo === '🔴' ? 1 : 0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(err => { console.error(err); process.exit(2) })
}
