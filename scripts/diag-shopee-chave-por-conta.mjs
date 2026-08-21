#!/usr/bin/env node
/**
 * Diagnóstico: QUANTAS contas estão com a chave da Shopee recusada — e quanto
 * isso está custando em oferta sem foto.
 *
 * Por que existe: já havia diagnóstico por conta para o Mercado Livre
 * (`diag-ml-credencial-por-conta.mjs`), mas nenhum para a Shopee. E a Shopee é
 * o caso MAIS grave dos dois: sem chave aceita, a conversão falha inteira, a
 * oferta vira `skip:no_valid_conversions` e NADA é publicado — enquanto no ML o
 * plano B continua enviando com link mais comprido. Numa amostra de 8h de
 * produção, 210 ofertas de Shopee saíram sem foto (ML: 139), e quantas contas
 * estavam nessa situação nunca foi medido.
 *
 * Read-only: não grava nada e NUNCA imprime App ID ou chave secreta.
 *
 * A sondagem ao vivo (`checkShopeeSession`) é só de LEITURA (productOfferV2 com
 * limit 1) — não gera link nem grava nada do lado da Shopee. Use --no-live para
 * pular e ficar só no que o banco já sabe.
 *
 * Lembre da classificação canônica: SÓ o código 10020 ("Invalid Signature")
 * vira "chave recusada". Qualquer outro código, HTTP != 200, timeout ou rede
 * fora fica INDETERMINADO — a API de afiliado responde 200 mesmo em erro, então
 * status não classifica nada sozinho.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-shopee-chave-por-conta.mjs [--days=7] [--no-live]
 */

import 'dotenv/config'
import db from '../src/db.js'
import { parseCredentialData } from '../src/credentialHealth.js'
import { checkShopeeSession } from '../src/converters/shopee.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const days = Number(arg('days', 7))
const live = !process.argv.includes('--no-live')
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

// 1) O que o banco já sabe: como terminaram os envios de Shopee, por conta.
const rows = await db.messageLog.findMany({
  where: { sentAt: { gte: since }, platform: { contains: 'shopee' } },
  select: { userId: true, sentAt: true, status: true, errorMsg: true, convertedUrl: true },
  take: 200000,
}).catch(() => [])

const porConta = new Map()
for (const r of rows) {
  const acc = porConta.get(r.userId) || { total: 0, sucesso: 0, semConversao: 0, curto: 0 }
  acc.total += 1
  if (r.status === 'success') acc.sucesso += 1
  // `skip:no_valid_conversions` é a assinatura da chave recusada: nenhum link
  // convertido -> a oferta INTEIRA é descartada (não é "sai sem foto", é "não sai").
  if (/no_valid_conversions/.test(String(r.errorMsg || ''))) acc.semConversao += 1
  if (/s\.shopee|shope\.ee/i.test(String(r.convertedUrl || ''))) acc.curto += 1
  porConta.set(r.userId, acc)
}

// 2) Quem TEM credencial de Shopee cadastrada (inclui quem não enviou nada na
//    janela — que é justamente o sintoma de chave morta: as automações param).
const credenciais = await db.credential.findMany({
  where: { platform: 'shopee' },
  select: { userId: true, data: true },
}).catch(() => [])

const idsRelevantes = new Set([...porConta.keys(), ...credenciais.map(c => c.userId)])
const users = await db.user.findMany({
  where: { id: { in: [...idsRelevantes] } },
  select: { id: true, email: true, name: true },
}).catch(() => [])
const nome = new Map(users.map(u => [u.id, `${u.name} <${u.email}>`]))

console.log(`\n=== Shopee por conta — últimos ${days} dia(s) ===`)
console.log('sem_conversao = a oferta INTEIRA foi descartada (assinatura de chave recusada)')
console.log('curto = link s.shopee gerado (chave funcionando)\n')

const resultados = []
for (const cred of credenciais) {
  const acc = porConta.get(cred.userId) || { total: 0, sucesso: 0, semConversao: 0, curto: 0 }
  const dados = parseCredentialData(cred.data) || {}
  const temCampos = Boolean(String(dados.appId || '').trim() && String(dados.secretKey || '').trim())

  let sonda = temCampos ? { alive: null, reason: 'nao_sondado' } : { alive: null, reason: 'falta_preencher' }
  if (live && temCampos) {
    sonda = await checkShopeeSession(dados).catch(err => ({ alive: null, reason: `erro:${err?.message || 'falha'}` }))
    // Espaça as sondagens: rajada contra a API da loja não ajuda ninguém.
    await new Promise(r => setTimeout(r, 1500))
  }
  resultados.push({ userId: cred.userId, acc, temCampos, sonda })
}

// Ordena pelo que mais dói: chave recusada primeiro, depois volume descartado.
const peso = s => (s.sonda.alive === false ? 2 : s.sonda.alive === null ? 1 : 0)
resultados.sort((a, b) => (peso(b) - peso(a)) || (b.acc.semConversao - a.acc.semConversao))

let recusadas = 0
let ofertasPerdidas = 0
for (const { userId, acc, temCampos, sonda } of resultados) {
  let veredito
  if (!temCampos) veredito = 'falta preencher'
  else if (sonda.alive === false) { veredito = '⚠ CHAVE RECUSADA'; recusadas += 1; ofertasPerdidas += acc.semConversao }
  else if (sonda.alive === true) veredito = 'chave OK'
  else veredito = `indeterminado (${sonda.reason || 'sem resposta conclusiva'})`

  console.log(`${veredito.padEnd(34)} ${(nome.get(userId) || userId).padEnd(44)} envios ${String(acc.total).padStart(5)} | sem_conversao ${String(acc.semConversao).padStart(5)} | curto ${String(acc.curto).padStart(5)}`)
}

console.log(`\nContas com chave da Shopee recusada: ${recusadas} de ${resultados.length} cadastradas`)
console.log(`Ofertas descartadas por falta de conversão nessas contas (${days}d): ${ofertasPerdidas}`)
if (!live) console.log('\n(--no-live: nenhuma sondagem foi feita; o veredito veio só do banco.)')
console.log('\nLembrete de linguagem: na Shopee é "chave" (App ID + chave secreta), e o aviso')
console.log('para a cliente é o OPOSTO do ML — aqui as ofertas da Shopee PARAM de sair.')

await db.$disconnect()
