#!/usr/bin/env node
// Migração one-shot: cifra o campo `Credential.data` das linhas existentes (D-3).
//
// Idempotente: linhas já cifradas (prefixo v1:) são puladas. Re-rodar é seguro.
//
// Pré-requisitos:
//   - CREDENTIAL_ENCRYPTION_KEY configurada no .env do ambiente alvo.
//   - Parar a API antes de rodar para evitar SQLITE_BUSY em escrita concorrente
//     (vide pegadinha #8 do AGENTS.md). Em prod: `pm2 stop api` antes,
//     `pm2 start ecosystem.config.cjs --only api` depois.
//
// Uso:
//   cd ~/wabot-staging && node scripts/migrate-credentials-encrypt.mjs
//   cd ~/wabot && node scripts/migrate-credentials-encrypt.mjs   # produção (com backup antes)

import 'dotenv/config'
import db from '../src/db.js'
import { encryptCredential, validateEncryptionKey, __testing } from '../src/credentialCrypto.js'

async function main() {
  validateEncryptionKey() // aborta cedo se a chave estiver ausente/inválida

  const rows = await db.credential.findMany({ select: { id: true, platform: true, data: true } })
  let encrypted = 0
  let alreadyEncrypted = 0
  let skippedEmpty = 0

  for (const row of rows) {
    if (typeof row.data !== 'string' || row.data.length === 0) {
      skippedEmpty += 1
      continue
    }
    if (__testing.isEncrypted(row.data)) {
      alreadyEncrypted += 1
      continue
    }
    const ciphertext = encryptCredential(row.data)
    await db.credential.update({ where: { id: row.id }, data: { data: ciphertext } })
    encrypted += 1
  }

  console.log(`✓ Migração de credenciais concluída:`)
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
