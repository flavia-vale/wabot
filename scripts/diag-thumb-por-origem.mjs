#!/usr/bin/env node
/**
 * Diagnóstico: por que UM grupo monitorado chega com foto e OUTRO não.
 *
 * Quando a loja não devolve a foto oficial (caso crônico da Shopee, que tem uma
 * fonte só — a API de afiliado), tudo passa a depender da MINIATURA que veio no
 * card de link da mensagem de origem. E o tamanho dessa miniatura varia MUITO
 * de origem para origem: medições reais no mesmo minuto foram de 456 a 14.811
 * bytes. Miniatura minúscula ampliada vira borrão; abaixo do piso
 * (MONITORED_MIN_IMAGE_BYTES) ela não é publicada.
 *
 * Ou seja: "esse grupo manda foto e aquele não" costuma não ser diferença de
 * configuração nem de conta — é o tamanho da miniatura de cada origem.
 *
 * Este script NÃO grava nada. Ele lê o bot.log, junta as duas linhas que juntas
 * contam a história (`Mensagem aceita para processamento`, que tem o jid da
 * origem, e `Usando thumbnail do link preview` / `Imagem original baixada`, que
 * têm o tamanho) pelo msgId, e resume POR GRUPO DE ORIGEM.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-thumb-por-origem.mjs [--tail-mb=400] [--piso=800]
 */

import 'dotenv/config'
import fs from 'node:fs'
import db from '../src/db.js'

const arg = (name, def) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : def
}
const tailMb = arg('tail-mb', 400)
const piso = arg('piso', 800)
const logFile = process.env.BOT_LOG_DIR ? `${process.env.BOT_LOG_DIR}/bot.log` : '/home/deploy/BOTinho-shared/logs/bot.log'

if (!fs.existsSync(logFile)) {
  console.error(`Log não encontrado: ${logFile}`)
  process.exit(1)
}

const size = fs.statSync(logFile).size
const start = Math.max(0, size - tailMb * 1024 * 1024)
const fd = fs.openSync(logFile, 'r')
const buf = Buffer.alloc(size - start)
fs.readSync(fd, buf, 0, buf.length, start)
fs.closeSync(fd)

const jidPorMsg = new Map()   // msgId -> jid de origem
const platPorMsg = new Map()  // msgId -> plataforma
const fotos = []              // { msgId, bytes, fonte }

for (const linha of buf.toString('utf8').split('\n')) {
  if (!linha.startsWith('{')) continue
  let o
  try { o = JSON.parse(linha) } catch { continue }
  if (o.msg === 'Mensagem aceita para processamento' && o.msgId && o.jid) jidPorMsg.set(o.msgId, o.jid)
  else if (o.msg === 'getImage: iniciando resolução de imagem' && o.msgId) platPorMsg.set(o.msgId, o.platform || '?')
  else if (o.msg === 'Usando thumbnail do link preview' && o.msgId) fotos.push({ msgId: o.msgId, bytes: o.size || 0, fonte: 'miniatura_do_card' })
  else if (o.msg === 'Imagem original baixada' && o.msgId) fotos.push({ msgId: o.msgId, bytes: o.size || 0, fonte: 'foto_de_verdade' })
}

const grupos = await db.group.findMany({ select: { waJid: true, name: true, role: true } }).catch(() => [])
const nomePorJid = new Map(grupos.map(g => [g.waJid, g.name]))

const porOrigem = new Map()
for (const f of fotos) {
  const jid = jidPorMsg.get(f.msgId)
  if (!jid) continue
  const plataforma = platPorMsg.get(f.msgId) || '?'
  const chave = `${jid}|${plataforma}`
  if (!porOrigem.has(chave)) porOrigem.set(chave, { jid, plataforma, bytes: [], deVerdade: 0 })
  const bucket = porOrigem.get(chave)
  if (f.fonte === 'foto_de_verdade') bucket.deVerdade++
  else bucket.bytes.push(f.bytes)
}

if (!porOrigem.size) {
  console.log('Nenhuma mensagem com imagem no trecho de log lido. Aumente --tail-mb.')
  process.exit(0)
}

const mediana = arr => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

console.log(`\n=== Tamanho da imagem por GRUPO DE ORIGEM (piso considerado: ${piso} bytes) ===\n`)
const linhas = [...porOrigem.values()].sort((a, b) => (b.bytes.length + b.deVerdade) - (a.bytes.length + a.deVerdade))
for (const l of linhas) {
  const abaixo = l.bytes.filter(b => b < piso).length
  const nome = nomePorJid.get(l.jid) || '(origem não cadastrada)'
  console.log(`${nome}  [${l.jid}]  loja=${l.plataforma}`)
  console.log(`   fotos de verdade na mensagem: ${l.deVerdade}`)
  if (l.bytes.length) {
    console.log(`   só miniatura do card: ${l.bytes.length}  (menor ${Math.min(...l.bytes)}  mediana ${mediana(l.bytes)}  maior ${Math.max(...l.bytes)} bytes)`)
    console.log(`   abaixo do piso: ${abaixo}/${l.bytes.length}${abaixo ? '   <-- é aqui que a oferta perde a imagem' : ''}`)
  }
  console.log('')
}

console.log(`Leitura:
  "fotos de verdade" = a origem anexou a foto; o robô republica ela e nada disso
  importa. "só miniatura do card" = a origem mandou texto+link e o que existe é
  a miniatura do preview; aí a foto da oferta depende ou da loja devolver a foto
  oficial (a Shopee quase nunca devolve) ou dessa miniatura ser grande o
  bastante. Duas origens da MESMA loja podem ter miniaturas de tamanhos bem
  diferentes — é o que faz um grupo "mandar foto" e o outro não.
`)
process.exit(0)
