#!/usr/bin/env node
/**
 * Diagnóstico: membros do grupo de destino veem as ofertas do robô como
 * "Aguardando mensagem. Essa ação pode levar alguns instantes".
 * (docs/rca/whatsapp-sessao.md, "Aguardando mensagem", partes 1 a 4.)
 *
 * Read-only: lê banco, `auth_info` e `bot.log`; não grava, não envia, não
 * apaga chave, não imprime segredo (só contagens e ids de estado).
 *
 * Separa, por grupo de destino da cliente, as três perguntas que decidem o
 * próximo passo:
 *   1. o robô ainda TEM a chave do grupo que distribuiu (`sender-key-…`) e para
 *      quantos aparelhos ele acha que já mandou (`sender-key-memory-…`)?
 *      → estados/keyId trocando entre uma rodada e outra = chave nova sem
 *        SKDM para ninguém (todo mundo preso de uma vez).
 *   2. desde o horário pedido, quantos envios saíram para o grupo e quantos
 *      pedidos de reenvio voltaram (membros distintos, repetidos, count,
 *      com/sem <keys>, não guardada, erro)?
 *      → pedidos ≈ 0 com envios > 0 e a cliente reclamando = os aparelhos
 *        NÃO estão pedindo reenvio (falha primária que o retry não vê);
 *        pedidos altos e repetidos por membro = reenvio não abre no aparelho.
 *   3. quantas mensagens enviadas estão guardadas para reenvio.
 *
 * Uso (dentro do diretório do ambiente; BOT_LOG_DIR/AUTH_INFO_DIR vêm do .env):
 *   cd ~/wabot && node scripts/diag-aguardando-mensagem.mjs <email> [jid|nome] [--horas=6] [--desde=2026-09-28T15:49:20Z]
 */

import 'dotenv/config'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'
import db from '../src/db.js'
import { getAuthInfoDir, getLogsBaseDir, getSentMessagesDir } from '../src/paths.js'

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const [email, alvoArg] = positional
if (!email) {
  console.error('uso: node scripts/diag-aguardando-mensagem.mjs <email> [jid|nome do grupo] [--horas=6] [--desde=ISO]')
  process.exit(1)
}
const horas = Math.max(1, Number(arg('horas', 6)))
const desdeArg = arg('desde', null)
const desdeMs = desdeArg ? Date.parse(desdeArg) : Date.now() - horas * 3600_000
if (!Number.isFinite(desdeMs)) {
  console.error(`--desde inválido: ${desdeArg}`)
  process.exit(1)
}

const fmt = (value) => (value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-')
const fixFileName = (file) => file.replace(/\//g, '__').replace(/:/g, '-')

const user = await db.user.findFirst({ where: { email } })
if (!user) {
  console.error(`conta não encontrada: ${email}`)
  process.exit(1)
}
console.log(`\n=== CONTA ===`)
console.log(`${user.email}  id=${user.id}  plano=${user.plan}`)
const sessao = await db.waSession.findFirst({ where: { userId: user.id } }).catch(() => null)
if (sessao) console.log(`WhatsApp: status=${sessao.status} lifecycle=${sessao.lifecycle} atualizado=${fmt(sessao.updatedAt)}`)

let destinos = await db.group.findMany({ where: { userId: user.id, role: 'post' }, orderBy: { name: 'asc' } })
if (alvoArg) {
  const alvo = alvoArg.toLowerCase()
  destinos = destinos.filter((g) => g.waJid === alvoArg || String(g.name || '').toLowerCase().includes(alvo))
}
if (!destinos.length) {
  console.error(alvoArg ? `nenhum destino da conta bate com "${alvoArg}"` : 'a conta não tem destino (role=post)')
  process.exit(1)
}

const authDir = getAuthInfoDir(user.id)
const sentDir = getSentMessagesDir(user.id)
const sentCount = existsSync(sentDir) ? readdirSync(sentDir).filter((f) => f.endsWith('.bin')).length : 0
console.log(`\n=== MENSAGENS GUARDADAS PARA REENVIO ===`)
console.log(`${sentDir}: ${sentCount} arquivo(s)  (0 = nada enviado neste worker nas últimas 24 h, ou BOT_LOG_DIR errado)`)

let meUsers = new Set()
try {
  const creds = JSON.parse(readFileSync(join(authDir, 'creds.json'), 'utf8'))
  meUsers = new Set([creds?.me?.id, creds?.me?.lid].filter(Boolean).map((j) => String(j).split(/[:@]/)[0]))
  console.log(`\nIdentidade do robô: ${[...meUsers].join(' / ')} (PN / LID, só a parte do usuário)`)
} catch {}
const isOwnDevice = (jid) => meUsers.has(String(jid || '').split(/[:@]/)[0])

console.log(`\n=== CHAVES DO GRUPO NO auth_info (${authDir}) ===`)
const jids = destinos.map((g) => g.waJid)
for (const grupo of destinos) {
  console.log(`\n-- ${grupo.name || '(sem nome)'}  ${grupo.waJid}`)
  const memoryFile = join(authDir, fixFileName(`sender-key-memory-${grupo.waJid}.json`))
  if (existsSync(memoryFile)) {
    try {
      const memory = JSON.parse(readFileSync(memoryFile, 'utf8')) || {}
      const entries = Object.entries(memory)
      const marcados = entries.filter(([, v]) => v === true)
      const lid = marcados.filter(([k]) => k.endsWith('@lid')).length
      const pn = marcados.filter(([k]) => k.endsWith('@s.whatsapp.net')).length
      console.log(`   sender-key-memory: ${marcados.length} aparelho(s) marcados como "já têm a chave" (lid=${lid} pn=${pn})  gravado ${fmt(statSync(memoryFile).mtimeMs)}`)
    } catch (err) {
      console.log(`   sender-key-memory: ilegível (${err.message})`)
    }
  } else {
    console.log('   sender-key-memory: ausente (próximo envio manda SKDM para todos os aparelhos)')
  }
  const prefix = fixFileName(`sender-key-${grupo.waJid}`)
  const keyFiles = existsSync(authDir) ? readdirSync(authDir).filter((f) => f.startsWith(prefix) && !f.startsWith(`${prefix}-memory`) && f.endsWith('.json')) : []
  if (!keyFiles.length) {
    console.log('   sender-key: AUSENTE — o próximo envio cria chave NOVA; quem está na memory acima NÃO recebe a SKDM dela (todo mundo preso)')
  }
  for (const file of keyFiles) {
    const who = file.slice(prefix.length + 2, -'.json'.length) + (isOwnDevice(file.slice(prefix.length + 2)) ? ' (do robô)' : ' (recebida de outro participante)')
    try {
      // O Baileys grava o registro como Buffer (BufferJSON) contendo o JSON dos estados.
      let states = JSON.parse(readFileSync(join(authDir, file), 'utf8'))
      if (states && states.type === 'Buffer') states = JSON.parse(Buffer.from(states.data, 'base64').toString('utf8'))
      const resumo = (Array.isArray(states) ? states : []).map((s) => `id=${s?.senderKeyId} it=${s?.senderChainKey?.iteration}`).join(' | ')
      console.log(`   sender-key ${who}: ${Array.isArray(states) ? states.length : '?'} estado(s) [${resumo}]  gravado ${fmt(statSync(join(authDir, file)).mtimeMs)}`)
    } catch (err) {
      console.log(`   sender-key ${who}: ilegível (${err.message})`)
    }
  }
}

const logFile = join(getLogsBaseDir(), 'bot.log')
console.log(`\n=== bot.log (${logFile}) desde ${fmt(desdeMs)} ===`)
if (!existsSync(logFile)) {
  console.log('bot.log não encontrado — conferir BOT_LOG_DIR no .env')
  process.exit(0)
}

const porGrupo = new Map(jids.map((jid) => [jid, {
  envios: 0,
  pedidos: 0,
  pedidosSemMensagem: 0,
  pedidosComKeys: 0,
  pedidosSendToAll: 0,
  countDist: new Map(),
  membros: new Set(),
  pedidosPorMembro: new Map(),
  msgIds: new Set(),
  pares: new Map(),
  montados: 0,
  encType: new Map(),
  naoGuardada: 0,
  erros: 0,
  desistiu: 0,
  primeiroPedido: null,
  ultimoPedido: null,
}]))
const jidSet = new Set(jids)
const inc = (map, k) => map.set(k, (map.get(k) || 0) + 1)

const rl = createInterface({ input: createReadStream(logFile, { encoding: 'utf8' }), crlfDelay: Infinity })
let linhas = 0
for await (const raw of rl) {
  linhas++
  let hit = false
  for (const jid of jids) {
    if (raw.includes(jid)) { hit = true; break }
  }
  if (!hit) continue
  let line
  try { line = JSON.parse(raw) } catch { continue }
  if (typeof line.time === 'number' && line.time < desdeMs) continue
  const msg = String(line.msg || '')
  const jid = [line.destJid, line.remoteJid, line.jid, line.key?.remoteJid].find((j) => jidSet.has(j))
  if (!jid) continue
  const g = porGrupo.get(jid)
  if (msg === 'Mensagem enviada') {
    g.envios++
  } else if (msg === 'retry-diag: pedido de reenvio') {
    g.pedidos++
    if (Array.isArray(line.found) && line.found.some((f) => f === false)) g.pedidosSemMensagem++
    if (line.hasKeys) g.pedidosComKeys++
    if (line.sendToAll) g.pedidosSendToAll++
    inc(g.countDist, String(line.retryCount ?? '?'))
    if (line.participant) { g.membros.add(line.participant); inc(g.pedidosPorMembro, line.participant) }
    if (line.msgId) g.msgIds.add(line.msgId)
    inc(g.pares, `${line.msgId}|${line.participant}`)
    g.primeiroPedido = g.primeiroPedido ?? line.time
    g.ultimoPedido = line.time
  } else if (msg === 'retry-diag: reenvio de grupo montado') {
    g.montados++
    inc(g.encType, String(line.encType || '?'))
  } else if (msg === 'retry-receipt: mensagem pedida não está guardada') {
    g.naoGuardada++
  } else if (msg === 'error in sending message again') {
    g.erros++
  } else if (msg === 'will not send message again, as sent too many times') {
    g.desistiu++
  }
}
console.log(`${linhas} linhas lidas`)

for (const grupo of destinos) {
  const g = porGrupo.get(grupo.waJid)
  const repetidos = [...g.pares.values()].filter((n) => n > 1).length
  const lid = [...g.membros].filter((m) => m.endsWith('@lid')).length
  console.log(`\n-- ${grupo.name || '(sem nome)'}  ${grupo.waJid}`)
  console.log(`   envios ("Mensagem enviada"): ${g.envios}`)
  console.log(`   pedidos de reenvio: ${g.pedidos}  em ${g.msgIds.size} mensagem(ns)  por ${g.membros.size} membro(s) distintos (lid=${lid})`)
  if (g.pedidos) {
    console.log(`     count: ${[...g.countDist].map(([k, v]) => `${k}×${v}`).join(' ')}  com <keys>: ${g.pedidosComKeys}  sendToAll: ${g.pedidosSendToAll}  sem mensagem guardada: ${g.pedidosSemMensagem}`)
    console.log(`     pares (msg+membro) que pediram de novo depois de atendidos: ${repetidos}`)
    console.log(`     reenvios montados: ${g.montados} (${[...g.encType].map(([k, v]) => `${k}×${v}`).join(' ') || '-'})  erros: ${g.erros}  desistiu (>5): ${g.desistiu}  não guardada: ${g.naoGuardada}`)
    console.log(`     primeiro/último pedido: ${fmt(g.primeiroPedido)} / ${fmt(g.ultimoPedido)}`)
    const top = [...g.pedidosPorMembro].sort((a, b) => b[1] - a[1]).slice(0, 10)
    console.log(`     quem pediu (até 10): ${top.map(([m, n]) => `${m}×${n}${isOwnDevice(m) ? ' [aparelho da PRÓPRIA conta]' : ''}`).join('  ')}`)
  }
  if (g.envios > 0 && g.pedidos === 0) {
    console.log('   → LEITURA: houve envio e NENHUM aparelho pediu reenvio. Se a cliente vê "Aguardando mensagem" nestas mensagens, os aparelhos não estão pedindo reenvio (o retry não alcança) — validar com celular de teste no grupo.')
  } else if (g.pedidos > 0 && repetidos === 0 && g.erros === 0) {
    console.log('   → LEITURA: todo pedido foi atendido na 1ª e ninguém pediu de novo. Se ainda assim não abre, o reenvio chega mas o aparelho não abre — validar com celular de teste.')
  } else if (repetidos > 0) {
    console.log('   → LEITURA: aparelhos pediram de novo DEPOIS de atendidos: o reenvio não abre no aparelho. Confira acima se o sender-key trocou de keyId entre rodadas.')
  }
}

await db.$disconnect().catch(() => {})
