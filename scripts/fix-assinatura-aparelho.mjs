#!/usr/bin/env node
/**
 * Conserto: refaz a assinatura do APARELHO (`account.deviceSignature`) no
 * `creds.json` de contas hosted pareadas pelo Baileys 6.7.23 com o prefixo
 * errado ([6,6]). O whatsmeow e o Baileys 7.x assinam com [6,1]; celulares de
 * fora rejeitavam a carteirinha do robô e TUDO ficava em "Aguardando mensagem"
 * (docs/rca/whatsapp-sessao.md, "Aguardando mensagem", parte 5).
 *
 * Sem `--aplicar` é só simulação (não grava nada). Com `--aplicar`:
 *   - só mexe em conta cuja assinatura atual NÃO confere com [6,1] e CONFERE com [6,6];
 *   - recalcula com a chave privada atual, confere com a pública antes de gravar;
 *   - guarda cópia `creds.json.bak-<timestamp>` ao lado;
 *   - grava só `account.deviceSignature`; nada mais muda.
 *
 * ATENÇÃO: aplicar com a sessão DESLIGADA (worker parado) — o worker guarda o
 * creds em memória e regravaria a assinatura antiga no próximo `creds.update`.
 * Depois de aplicar, ligar a sessão de novo pelo painel/admin.
 *
 * Com `--religar` o script faz o ciclo completo sozinho: para a sessão (mesmo
 * comando do painel), espera o worker morrer, grava e liga de novo — só nas
 * contas que precisam. Sem `--religar`, você para/liga por fora.
 *
 * Desde a parte 5 o próprio bot-worker refaz a assinatura a cada start
 * (src/core/deviceIdentitySignature.js); este script serve para consertar sem
 * esperar o próximo start e para conferir a frota.
 *
 * Uso (dentro do diretório do ambiente):
 *   node scripts/fix-assinatura-aparelho.mjs <email>                       # simula uma conta
 *   node scripts/fix-assinatura-aparelho.mjs --todas                        # simula a frota
 *   node scripts/fix-assinatura-aparelho.mjs <email> --aplicar              # grava (sessão desligada!)
 *   node scripts/fix-assinatura-aparelho.mjs --todas --aplicar --religar    # frota: para, grava, religa
 */

import 'dotenv/config'
import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import db from '../src/db.js'
import { getAuthInfoBaseDir, getAuthInfoDir } from '../src/paths.js'
import { ensureDeviceSignaturePrefix } from '../src/core/deviceIdentitySignature.js'

const aplicar = process.argv.includes('--aplicar')
const religar = process.argv.includes('--religar')
const todas = process.argv.includes('--todas')
const email = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!email && !todas) {
  console.error('uso: node scripts/fix-assinatura-aparelho.mjs <email> [--aplicar]  |  --todas [--aplicar]')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function lerCreds(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function gravarCreds(file, creds) {
  const backup = `${file}.bak-${Date.now()}`
  copyFileSync(file, backup)
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 })
  renameSync(tmp, file)
  return backup
}

async function pararSessao(userId) {
  const { stopBot, isRunning } = await import('../src/manager.js')
  const rodava = Boolean(await isRunning(userId).catch(() => false))
  if (!rodava) return false
  await db.waSession.updateMany({ where: { userId }, data: { status: 'disconnected', lifecycle: 'stopped_by_user' } })
  await stopBot(userId)
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    if (!(await isRunning(userId).catch(() => false))) return true
  }
  throw new Error('o worker não parou em 30 s — não gravar com ele vivo')
}

async function religarSessao(userId) {
  const { startBot } = await import('../src/manager.js')
  return startBot(userId)
}

async function tratar(userId, label) {
  const file = join(getAuthInfoDir(userId), 'creds.json')
  if (!existsSync(file)) return console.log(`${label}: sem creds.json`)
  const diag = ensureDeviceSignaturePrefix(lerCreds(file), { apply: false })
  if (diag.status === 'unpaired') return console.log(`${label}: não pareada`)
  if (diag.status === 'ok') return console.log(`${label}: OK — já assinada com [6,1]`)
  if (diag.status === 'unfixable') return console.log(`${label}: assinatura não confere e não dá para refazer — NÃO mexer, investigar (par de chaves?)`)
  if (!aplicar) return console.log(`${label}: PRECISA — assinada com ${diag.wasLegacyHosted ? '[6,6]' : 'prefixo desconhecido'}; --aplicar regrava com [6,1] (simulação, nada gravado)`)
  let rodava = false
  if (religar) {
    rodava = await pararSessao(userId)
    console.log(`${label}: sessão ${rodava ? 'parada' : 'já estava parada'}`)
  }
  // Relê depois de parar: o worker pode ter gravado o creds ao encerrar.
  const creds = lerCreds(file)
  const r = ensureDeviceSignaturePrefix(creds)
  if (r.status !== 'fixed') {
    console.log(`${label}: nada gravado (${r.status})`)
  } else {
    const backup = gravarCreds(file, creds)
    console.log(`${label}: GRAVADA com [6,1] (backup em ${backup})${religar ? '' : '. Ligar a sessão de novo.'}`)
  }
  if (religar && rodava) {
    const ok = await religarSessao(userId)
    console.log(`${label}: religar → ${ok === false ? 'RECUSADO pelo supervisor (ligar pelo painel)' : 'ok'}`)
  }
}

if (todas) {
  const base = getAuthInfoBaseDir()
  const ids = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
  const emailPorId = new Map(users.map((u) => [u.id, u.email]))
  for (const id of ids) await tratar(id, emailPorId.get(id) || id)
} else {
  const user = await db.user.findFirst({ where: { email } })
  if (!user) { console.error(`conta não encontrada: ${email}`); process.exit(1) }
  await tratar(user.id, email)
}
await db.$disconnect().catch(() => {})
