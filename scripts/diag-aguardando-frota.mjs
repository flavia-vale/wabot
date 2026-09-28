#!/usr/bin/env node
/**
 * Diagnóstico de frota: quais contas têm membros presos em "Aguardando mensagem"
 * e o que elas têm em comum (docs/rca/whatsapp-sessao.md, "Aguardando mensagem", parte 4).
 *
 * Read-only: lê `bot.log`, o banco e o `creds.json` de cada conta (só campos de
 * identificação: forma de pareamento, plataforma, índice da identidade do
 * aparelho, datas). Não imprime chave nem segredo.
 *
 * Responde: os grupos onde aparelhos desistem de pedir reenvio ("will not send
 * message again") pertencem a quais contas, e essas contas diferem das demais em
 * pareamento por código × QR, plataforma ou identidade do aparelho (keyIndex)?
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-aguardando-frota.mjs [--horas=6] [--top=15]
 */

import 'dotenv/config'
import { createReadStream, existsSync, readFileSync, statSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'
import { proto } from '@whiskeysockets/baileys'
import db from '../src/db.js'
import { getAuthInfoDir, getLogsBaseDir } from '../src/paths.js'

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const horas = Math.max(1, Number(arg('horas', 6)))
const top = Math.max(1, Number(arg('top', 15)))
const desdeMs = Date.now() - horas * 3600_000
const fmt = (value) => (value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-')

const logFile = join(getLogsBaseDir(), 'bot.log')
if (!existsSync(logFile)) {
  console.error(`bot.log não encontrado em ${logFile} — conferir BOT_LOG_DIR`)
  process.exit(1)
}

const porGrupo = new Map()
const stat = (jid) => {
  if (!porGrupo.has(jid)) porGrupo.set(jid, { desistiu: 0, pedidos: 0, membros: new Set(), envios: 0 })
  return porGrupo.get(jid)
}
const rl = createInterface({ input: createReadStream(logFile, { encoding: 'utf8' }), crlfDelay: Infinity })
for await (const raw of rl) {
  if (!raw.includes('retry-diag: pedido de reenvio') && !raw.includes('will not send message again') && !raw.includes('"Mensagem enviada"')) continue
  let line
  try { line = JSON.parse(raw) } catch { continue }
  if (typeof line.time === 'number' && line.time < desdeMs) continue
  const msg = String(line.msg || '')
  if (msg === 'Mensagem enviada' && line.destJid?.endsWith('@g.us')) stat(line.destJid).envios++
  else if (msg === 'retry-diag: pedido de reenvio' && line.remoteJid?.endsWith('@g.us')) {
    const g = stat(line.remoteJid)
    g.pedidos++
    if (line.participant) g.membros.add(line.participant)
  } else if (msg === 'will not send message again, as sent too many times') {
    const jid = line.key?.remoteJid
    if (jid?.endsWith('@g.us')) stat(jid).desistiu++
  }
}

const jids = [...porGrupo.keys()]
const grupos = jids.length ? await db.group.findMany({ where: { waJid: { in: jids }, role: 'post' }, include: { user: { select: { email: true, id: true } } } }) : []
const donoPorJid = new Map()
for (const g of grupos) donoPorJid.set(g.waJid, { userId: g.userId, email: g.user?.email, name: g.name })

function identidade(userId) {
  const file = join(getAuthInfoDir(userId), 'creds.json')
  if (!existsSync(file)) return null
  try {
    const creds = JSON.parse(readFileSync(file, 'utf8'))
    let keyIndex = '?'
    let advTs = null
    try {
      const details = creds?.account?.details
      const buf = details?.type === 'Buffer' ? Buffer.from(details.data, 'base64') : Buffer.from(details, 'base64')
      const identity = proto.ADVDeviceIdentity.decode(buf)
      keyIndex = identity.keyIndex
      advTs = Number(identity.timestamp) * 1000
    } catch {}
    return {
      pareamento: creds.pairingCode ? 'código' : 'QR',
      platform: creds.platform || '-',
      registered: creds.registered,
      keyIndex,
      advTs,
      temLid: Boolean(creds.me?.lid),
      device: String(creds.me?.id || '').split(':')[1]?.split('@')[0] || '0',
      credsMtime: statSync(file).mtimeMs,
    }
  } catch {
    return null
  }
}

const linhas = []
for (const [jid, g] of porGrupo) {
  if (!g.desistiu && !g.pedidos) continue
  const dono = donoPorJid.get(jid)
  linhas.push({ jid, ...g, membros: g.membros.size, dono, id: dono ? identidade(dono.userId) : null })
}
linhas.sort((a, b) => b.desistiu - a.desistiu || b.pedidos - a.pedidos)

console.log(`\n=== GRUPOS COM PEDIDO DE REENVIO nas últimas ${horas} h (top ${top}, por "desistiu") ===`)
for (const l of linhas.slice(0, top)) {
  const id = l.id
  console.log(`\n${l.jid}  ${l.dono?.name || '(grupo não é destino cadastrado)'}  ${l.dono?.email || ''}`)
  console.log(`   envios=${l.envios} pedidos=${l.pedidos} membros=${l.membros} desistiu=${l.desistiu}`)
  if (id) console.log(`   conta: pareamento=${id.pareamento} platform=${id.platform} device=:${id.device} keyIndex=${id.keyIndex} adv=${fmt(id.advTs)} lid=${id.temLid ? 'sim' : 'não'} creds=${fmt(id.credsMtime)}`)
}

const afetadas = new Map()
for (const l of linhas) {
  if (!l.dono || !l.id) continue
  if (l.desistiu === 0) continue
  afetadas.set(l.dono.userId, l.id)
}
console.log(`\n=== CONTAS COM APARELHO QUE DESISTIU (${afetadas.size}) × RESTO DA FROTA ===`)
const users = await db.waSession.findMany({ where: { status: 'connected' }, select: { userId: true } }).catch(() => [])
const frota = users.map((u) => u.userId).filter((u) => !afetadas.has(u)).map(identidade).filter(Boolean)
const conta = (lista, f) => lista.filter(f).length
const resumo = (lista, nome) => {
  console.log(`${nome}: ${lista.length} conta(s)  código=${conta(lista, (i) => i.pareamento === 'código')}  QR=${conta(lista, (i) => i.pareamento === 'QR')}  keyIndex>1=${conta(lista, (i) => Number(i.keyIndex) > 1)}  semLid=${conta(lista, (i) => !i.temLid)}`)
  const plat = new Map()
  for (const i of lista) plat.set(i.platform, (plat.get(i.platform) || 0) + 1)
  console.log(`   platform: ${[...plat].map(([k, v]) => `${k}×${v}`).join(' ')}`)
}
resumo([...afetadas.values()], 'afetadas')
resumo(frota, 'conectadas sem desistência')

await db.$disconnect().catch(() => {})
