#!/usr/bin/env node
/**
 * Diagnóstico: a "carteirinha" do aparelho do robô (ADV device identity) bate
 * com a chave de identidade que ele usa para cifrar?
 * (docs/rca/whatsapp-sessao.md, "Aguardando mensagem", parte 4.)
 *
 * Read-only. Lê só o `creds.json` de cada conta; não imprime chave privada nem
 * segredo, só OK/FALHA por assinatura e os índices/datas.
 *
 * Por que isso decide: o celular de outra pessoa só aceita mensagem de um
 * aparelho vinculado se o `device-identity` que vai junto (1) foi assinado pela
 * conta dona do robô e (2) certifica exatamente a chave de identidade com que a
 * mensagem foi cifrada. Se a chave de identidade do `creds.json` não é a que a
 * carteirinha certifica, TODO aparelho de fora descarta TUDO que vem do robô
 * (pede reenvio até desistir), enquanto o celular da própria conta continua
 * abrindo. É o quadro do grupo "OFERTAS DO DIA" (2026-09-28).
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-identidade-aparelho.mjs            # frota inteira, resumo + só as FALHAS
 *   cd ~/wabot && node scripts/diag-identidade-aparelho.mjs <email>    # uma conta, detalhado
 */

import 'dotenv/config'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { proto } from '@whiskeysockets/baileys'
import { Curve } from '@whiskeysockets/baileys/lib/Utils/crypto.js'
import db from '../src/db.js'
import { getAuthInfoBaseDir, getAuthInfoDir } from '../src/paths.js'

const email = process.argv.slice(2).find((a) => !a.startsWith('--'))
const fmt = (value) => (value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-')
const toBuf = (v) => {
  if (!v) return null
  if (typeof v === 'string') return Buffer.from(v, 'base64')
  if (v.type === 'Buffer') return Buffer.from(v.data, 'base64')
  if (Array.isArray(v)) return Buffer.from(v)
  return null
}

function checar(userId) {
  const file = join(getAuthInfoDir(userId), 'creds.json')
  if (!existsSync(file)) return { userId, status: 'sem creds.json' }
  let creds
  try { creds = JSON.parse(readFileSync(file, 'utf8')) } catch (err) { return { userId, status: `creds ilegível: ${err.message}` } }
  const account = creds.account
  const identityPub = toBuf(creds.signedIdentityKey?.public)
  if (!account || !identityPub) return { userId, status: 'sem account/identidade (não pareado)', registered: creds.registered }
  const details = toBuf(account.details)
  const accountSignatureKey = toBuf(account.accountSignatureKey)
  const accountSignature = toBuf(account.accountSignature)
  const deviceSignature = toBuf(account.deviceSignature)
  const out = { userId, registered: creds.registered, pareamento: creds.pairingCode ? 'código' : 'QR', platform: creds.platform || '-', me: creds.me?.id, credsMtime: statSync(file).mtimeMs }
  try {
    const dev = proto.ADVDeviceIdentity.decode(details)
    out.keyIndex = dev.keyIndex
    out.advTs = Number(dev.timestamp) * 1000
  } catch { out.keyIndex = '?' }
  out.assinaturaConta = accountSignatureKey && accountSignature
    ? Curve.verify(accountSignatureKey, Buffer.concat([Buffer.from([6, 0]), details, identityPub]), accountSignature)
    : null
  out.assinaturaAparelho = accountSignatureKey && deviceSignature
    ? Curve.verify(identityPub, Buffer.concat([Buffer.from([6, 1]), details, identityPub, accountSignatureKey]), deviceSignature)
    : null
  const signalIdentity = (creds.signalIdentities || [])[0]
  const signalKey = toBuf(signalIdentity?.identifierKey)
  out.identidadeContaBate = signalKey && accountSignatureKey
    ? Buffer.compare(signalKey.length === 33 ? signalKey.subarray(1) : signalKey, accountSignatureKey) === 0
    : null
  out.status = out.assinaturaConta === false || out.assinaturaAparelho === false ? 'FALHA' : (out.assinaturaConta && out.assinaturaAparelho ? 'OK' : 'incompleto')
  return out
}

function imprimir(r, extra = '') {
  console.log(`${r.status.padEnd(9)} ${extra}${r.pareamento || ''} ${r.platform || ''} me=${r.me || '-'} keyIndex=${r.keyIndex ?? '-'} adv=${fmt(r.advTs)} assinaturaConta=${r.assinaturaConta} assinaturaAparelho=${r.assinaturaAparelho} identidadeContaBate=${r.identidadeContaBate} creds=${fmt(r.credsMtime)}`)
}

if (email) {
  const user = await db.user.findFirst({ where: { email } })
  if (!user) { console.error(`conta não encontrada: ${email}`); process.exit(1) }
  const r = checar(user.id)
  console.log(`\n=== ${email} (${user.id}) ===`)
  imprimir(r)
  console.log(`\nLeitura: assinaturaAparelho=false = a chave de identidade do creds.json NÃO é a que a carteirinha certifica (todo aparelho de fora descarta o robô; re-parear resolve). assinaturaConta=false = carteirinha não é da conta. Os dois true = a identidade está íntegra; a causa é outra.`)
} else {
  const base = getAuthInfoBaseDir()
  const ids = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
  const emailPorId = new Map(users.map((u) => [u.id, u.email]))
  const resultados = ids.map(checar)
  const tot = (s) => resultados.filter((r) => r.status === s).length
  console.log(`\n=== FROTA (${resultados.length} pastas em ${base}) ===`)
  console.log(`OK=${tot('OK')}  FALHA=${tot('FALHA')}  incompleto=${tot('incompleto')}  não pareado/sem creds=${resultados.length - tot('OK') - tot('FALHA') - tot('incompleto')}`)
  const ruins = resultados.filter((r) => r.status === 'FALHA' || r.status === 'incompleto' || r.identidadeContaBate === false)
  console.log(`\n=== CONTAS COM PROBLEMA NA IDENTIDADE (${ruins.length}) ===`)
  for (const r of ruins) imprimir(r, `${emailPorId.get(r.userId) || r.userId}  `)
  if (!ruins.length) console.log('nenhuma — a identidade do aparelho está íntegra em toda a frota; a causa do "Aguardando mensagem" é outra.')
}

await db.$disconnect().catch(() => {})
