#!/usr/bin/env node
/**
 * Diagnóstico: o preço que o robô publicou bate com o preço que está na Amazon?
 *
 * Read-only: lê `MessageLog` (não grava nada) e, para cada oferta de Amazon
 * publicada na janela, pega o preço que saiu no texto da mensagem e vai à
 * Amazon AGORA ler o preço do buy box, mostrando os dois lado a lado.
 *
 * Como ler o resultado:
 *   OK        -> o preço publicado é o mesmo que está na loja agora
 *   MUDOU     -> os dois são diferentes; pode ser preço que a loja mudou DEPOIS
 *                do envio (normal em oferta relâmpago) ou defeito nosso. Olhe a
 *                coluna "publicado em": diferença em oferta de minutos atrás é
 *                suspeita; de dias atrás quase sempre é a loja que mudou.
 *   SEM PRECO -> a loja não devolveu preço agora (CAPTCHA, produto indisponível)
 *   SEM TEXTO -> a mensagem publicada não trazia preço nenhum
 *
 * Não imprime segredo, cookie nem credencial.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-amazon-preco.mjs <email|telefone|nome> [--days=3] [--limit=15]
 */

import 'dotenv/config'
import db from '../src/db.js'
import { fetchProductInfo } from '../src/converters/productInfoScraper.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const who = process.argv.slice(2).find(a => !a.startsWith('--'))
const days = Number(arg('days', 3))
const limit = Number(arg('limit', 15))

if (!who) {
  console.error('Informe o e-mail, telefone ou parte do nome da cliente.')
  process.exit(1)
}

// Preço publicado: o PRIMEIRO "R$ x,yy" do texto costuma ser o preço "por".
// Quando o texto traz "de ... por ...", o segundo é o que vale — por isso
// pegamos todos e mostramos o conjunto quando há mais de um.
function precosDoTexto(text) {
  const matches = [...String(text || '').matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/g)]
  return matches.map(m => m[1])
}

function normaliza(price) {
  const num = Number(String(price || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(num) && num > 0 ? num.toFixed(2) : null
}

function quandoFoi(date) {
  const min = Math.round((Date.now() - new Date(date).getTime()) / 60000)
  if (min < 60) return `${min}min atras`
  if (min < 1440) return `${Math.round(min / 60)}h atras`
  return `${Math.round(min / 1440)}d atras`
}

const users = await db.user.findMany({
  where: {
    OR: [
      { email: { contains: who } },
      { name: { contains: who } },
      { contactPhone: { contains: who } },
    ],
  },
  select: { id: true, email: true, name: true },
  take: 5,
})

if (!users.length) {
  console.error(`Nenhuma conta encontrada para "${who}".`)
  await db.$disconnect()
  process.exit(1)
}
if (users.length > 1) {
  console.log('Mais de uma conta bate com esse identificador:')
  for (const u of users) console.log(` - ${u.name || '(sem nome)'} <${u.email}>`)
  console.log('Rode de novo com um identificador mais específico.\n')
}

const user = users[0]
const since = new Date(Date.now() - days * 86400_000)
console.log(`Conta: ${user.name || '(sem nome)'} <${user.email}>`)
console.log(`Janela: ultimos ${days} dia(s) | ate ${limit} ofertas de Amazon\n`)

const logs = await db.messageLog.findMany({
  where: { userId: user.id, platform: 'amazon', status: 'success', sentAt: { gte: since } },
  orderBy: { sentAt: 'desc' },
  take: limit,
  select: { originalUrl: true, convertedUrl: true, messageText: true, sentAt: true },
})

if (!logs.length) {
  console.log('Nenhuma oferta de Amazon publicada nessa janela.')
  await db.$disconnect()
  process.exit(0)
}

let ok = 0, mudou = 0, semPreco = 0, semTexto = 0

for (const log of logs) {
  const publicados = precosDoTexto(log.messageText)
  // Alvo do scrape: o link ORIGINAL (o convertido é encurtador de afiliado e
  // resolve para a mesma página, mas gasta hops a mais).
  const alvo = log.originalUrl || log.convertedUrl
  let live = null
  try {
    live = await fetchProductInfo(alvo, {})
  } catch (err) {
    live = null
  }
  const naLoja = live?.newPrice || ''

  let veredito
  if (!publicados.length) { veredito = 'SEM TEXTO'; semTexto++ }
  else if (!naLoja) { veredito = 'SEM PRECO'; semPreco++ }
  else if (publicados.some(p => normaliza(p) === normaliza(naLoja))) { veredito = 'OK'; ok++ }
  else { veredito = 'MUDOU'; mudou++ }

  console.log(`${veredito.padEnd(10)} | publicado ${quandoFoi(log.sentAt).padEnd(10)} | no texto: ${publicados.join(' / ') || '-'} | na loja agora: ${naLoja || '-'}`)
  console.log(`           ${alvo}`)
}

console.log(`\nResumo: OK=${ok} MUDOU=${mudou} SEM_PRECO=${semPreco} SEM_TEXTO=${semTexto}`)
console.log('MUDOU concentrado em envios de minutos atras = defeito nosso. Espalhado em envios antigos = a loja mudou o preco depois.')

await db.$disconnect()
