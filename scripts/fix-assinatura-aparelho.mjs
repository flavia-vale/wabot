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
 * Uso (dentro do diretório do ambiente):
 *   node scripts/fix-assinatura-aparelho.mjs <email>            # simula uma conta
 *   node scripts/fix-assinatura-aparelho.mjs --todas             # simula a frota
 *   node scripts/fix-assinatura-aparelho.mjs <email> --aplicar   # grava (sessão desligada!)
 */

import 'dotenv/config'
import { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import libsignal from 'libsignal'
import db from '../src/db.js'
import { getAuthInfoBaseDir, getAuthInfoDir } from '../src/paths.js'

const aplicar = process.argv.includes('--aplicar')
const todas = process.argv.includes('--todas')
const email = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!email && !todas) {
  console.error('uso: node scripts/fix-assinatura-aparelho.mjs <email> [--aplicar]  |  --todas [--aplicar]')
  process.exit(1)
}

const toBuf = (v) => (typeof v === 'string' ? Buffer.from(v, 'base64') : v?.type === 'Buffer' ? Buffer.from(v.data, 'base64') : null)
const withType = (pub) => (pub.length === 33 ? pub : Buffer.concat([Buffer.from([5]), pub]))
const verificar = (pub, msg, sig) => { try { return libsignal.curve.verifySignature(withType(pub), msg, sig) === true } catch { return false } }

export function recalcularAssinaturaAparelho({ details, identityPub, identityPriv, accountSignatureKey }) {
  const msg = Buffer.concat([Buffer.from([6, 1]), details, identityPub, accountSignatureKey])
  const sig = Buffer.from(libsignal.curve.calculateSignature(identityPriv, msg))
  if (!verificar(identityPub, msg, sig)) throw new Error('assinatura recalculada não confere com a chave pública')
  return sig
}

function tratar(userId, label) {
  const file = join(getAuthInfoDir(userId), 'creds.json')
  if (!existsSync(file)) return console.log(`${label}: sem creds.json`)
  const creds = JSON.parse(readFileSync(file, 'utf8'))
  const account = creds.account
  const identityPub = toBuf(creds.signedIdentityKey?.public)
  const identityPriv = toBuf(creds.signedIdentityKey?.private)
  if (!account || !identityPub || !identityPriv) return console.log(`${label}: não pareada`)
  const details = toBuf(account.details)
  const accountSignatureKey = toBuf(account.accountSignatureKey)
  const atual = toBuf(account.deviceSignature)
  const msg61 = Buffer.concat([Buffer.from([6, 1]), details, identityPub, accountSignatureKey])
  const msg66 = Buffer.concat([Buffer.from([6, 6]), details, identityPub, accountSignatureKey])
  if (verificar(identityPub, msg61, atual)) return console.log(`${label}: OK — já assinada com [6,1]`)
  if (!verificar(identityPub, msg66, atual)) return console.log(`${label}: assinatura não confere com [6,1] nem [6,6] — NÃO mexer, investigar (par de chaves?)`)
  const nova = recalcularAssinaturaAparelho({ details, identityPub, identityPriv, accountSignatureKey })
  if (!aplicar) return console.log(`${label}: PRECISA — assinada com [6,6]; --aplicar regrava com [6,1] (simulação, nada gravado)`)
  const backup = `${file}.bak-${Date.now()}`
  copyFileSync(file, backup)
  account.deviceSignature = { type: 'Buffer', data: nova.toString('base64') }
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(creds, null, 2), { mode: 0o600 })
  renameSync(tmp, file)
  console.log(`${label}: GRAVADA com [6,1] (backup em ${backup}). Ligar a sessão de novo.`)
}

if (todas) {
  const base = getAuthInfoBaseDir()
  const ids = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
  const emailPorId = new Map(users.map((u) => [u.id, u.email]))
  for (const id of ids) tratar(id, emailPorId.get(id) || id)
} else {
  const user = await db.user.findFirst({ where: { email } })
  if (!user) { console.error(`conta não encontrada: ${email}`); process.exit(1) }
  tratar(user.id, email)
}
await db.$disconnect().catch(() => {})
