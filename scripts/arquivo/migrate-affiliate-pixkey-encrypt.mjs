#!/usr/bin/env node
// Migração one-shot: cifra o campo `AffiliateProfile.pixKey` das linhas
// existentes (R1 / D-3). A chave PIX pode ser CPF/telefone/e-mail — dado pessoal
// sensível que estava em texto puro no SQLite.
//
// Idempotente: linhas já cifradas (prefixo v1:) são puladas. Re-rodar é seguro.
//
// Pré-requisitos:
//   - CREDENTIAL_ENCRYPTION_KEY configurada no .env do ambiente alvo.
//   - Parar a API antes de rodar para evitar SQLITE_BUSY (pegadinha #8 do
//     AGENTS.md). Staging: `pm2 stop api-staging` antes, religar depois.
//     Prod: `scripts/backup_prod.sh` + `pm2 stop api` antes, religar depois.
//
// Uso:
//   cd ~/wabot-staging && node scripts/migrate-affiliate-pixkey-encrypt.mjs
//   cd ~/wabot && node scripts/migrate-affiliate-pixkey-encrypt.mjs   # prod (backup antes!)

import 'dotenv/config'
import db from '../src/db.js'
import { encryptCredential, validateEncryptionKey, __testing } from '../src/credentialCrypto.js'

async function main() {
  validateEncryptionKey() // aborta cedo se a chave estiver ausente/inválida

  const rows = await db.affiliateProfile.findMany({ select: { id: true, pixKey: true } })
  let encrypted = 0
  let alreadyEncrypted = 0
  let skippedEmpty = 0

  for (const row of rows) {
    if (typeof row.pixKey !== 'string' || row.pixKey.length === 0) {
      skippedEmpty += 1
      continue
    }
    if (__testing.isEncrypted(row.pixKey)) {
      alreadyEncrypted += 1
      continue
    }
    const ciphertext = encryptCredential(row.pixKey)
    await db.affiliateProfile.update({ where: { id: row.id }, data: { pixKey: ciphertext } })
    encrypted += 1
  }

  console.log(`✓ Migração de pixKey de afiliados concluída:`)
  console.log(`  ${encrypted} cifradas agora`)
  console.log(`  ${alreadyEncrypted} já estavam cifradas`)
  if (skippedEmpty) console.log(`  ${skippedEmpty} puladas (vazias)`)
  console.log(`  ${rows.length} linhas no total`)
}

main()
  .then(() => db.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('✗ Falha na migração:', err.message)
    await db.$disconnect().catch(() => {})
    process.exit(1)
  })
