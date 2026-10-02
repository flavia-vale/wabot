/**
 * Preenche copyVariationPoolJson para todos os BotConfig com valor vazio ou '{}'.
 *
 * Uso:
 *   DATABASE_URL=file:./prisma/prod.db node scripts/seed-copy-variations.mjs
 *   DATABASE_URL=file:./staging.db     node scripts/seed-copy-variations.mjs   # staging (schema em prisma/)
 *
 * Idempotente: só atualiza registros que estão com pool vazio.
 */
import { PrismaClient } from '@prisma/client'
import { DEFAULT_COPY_VARIATION_POOL_JSON } from '../src/api/routes/config.js'

const db = new PrismaClient()

async function run() {
  const rows = await db.botConfig.findMany({
    select: { userId: true, copyVariationPoolJson: true },
  })

  const toUpdate = rows.filter(r => !r.copyVariationPoolJson || r.copyVariationPoolJson === '{}')

  if (!toUpdate.length) {
    console.log('Nenhum registro precisa ser atualizado.')
    return
  }

  console.log(`Atualizando ${toUpdate.length} de ${rows.length} registros...`)

  for (const row of toUpdate) {
    await db.botConfig.update({
      where: { userId: row.userId },
      data: { copyVariationPoolJson: DEFAULT_COPY_VARIATION_POOL_JSON },
    })
    console.log(`  ✓ userId=${row.userId}`)
  }

  console.log('Concluído.')
}

run()
  .catch(err => { console.error('ERRO:', err.message); process.exit(1) })
  .finally(() => db.$disconnect())
