#!/usr/bin/env node
// Plano B / Fase 1b — seed do preset default de preservação por usuário a partir
// da config GLOBAL (BotConfig) e atribuição aos destinos-post (Group role=post).
//
// Idempotente:
//   - Usuário que já tem um PreservationPreset isDefault é pulado (não recria).
//   - Group role=post que já tem preservationPresetId é pulado (não sobrescreve
//     escolha do usuário).
//
// Comportamento preservado: o preset default nasce com os MESMOS limites da
// ex-global do usuário, convertendo a janela silenciosa (bloqueio) para horário
// de funcionamento (complemento). Assim, no dia 1, o gate por destino decide
// igual ao global anterior.
//
// Pré-requisitos (vide pegadinha #8 do AGENTS.md): parar a API antes em prod
// para evitar SQLITE_BUSY. Rodar backup_prod.sh antes em produção.
//
// Uso:
//   cd ~/wabot-staging && node scripts/seed-preservation-presets.mjs
//   cd ~/wabot && node scripts/seed-preservation-presets.mjs   # produção (backup antes)

import 'dotenv/config'
import db from '../src/db.js'
import { quietToOperatingHours } from '../src/core/preservationConfig.js'

export async function seedPreservationPresets({ db: client = db, now = () => new Date() } = {}) {
  const users = await client.user.findMany({ select: { id: true } })
  let presetsCreated = 0
  let groupsAssigned = 0
  let usersSkipped = 0

  for (const { id: userId } of users) {
    const existing = await client.preservationPreset.findFirst({ where: { userId, isDefault: true }, select: { id: true } })
    let presetId = existing?.id
    if (!presetId) {
      const cfg = await client.botConfig.findFirst({ where: { userId } })
      // Sem BotConfig → usa os defaults do schema do preset (não bloqueia o seed).
      const operatingHoursJson = cfg ? quietToOperatingHours(cfg.channelQuietHoursJson) : undefined
      const created = await client.preservationPreset.create({
        data: {
          userId,
          name: 'Padrão',
          isDefault: true,
          // Horário de funcionamento = complemento da janela silenciosa; só ATIVO
          // se a global tinha quiet ativo (preserva o comportamento por usuário).
          ...(operatingHoursJson ? { operatingHoursJson } : {}),
          operatingHoursEnabled: cfg?.quietHoursEnabled === true,
          throttleEnabled: cfg?.channelThrottleEnabled ?? true,
          minIntervalSec: cfg?.channelMinIntervalSec ?? 30,
          burstCap: cfg?.channelBurstCap ?? 6,
          burstWindowSec: cfg?.channelBurstWindowSec ?? 600,
          dailyCap: cfg?.channelDailyCap ?? null,
          updatedAt: now(),
        },
        select: { id: true },
      })
      presetId = created.id
      presetsCreated += 1
    } else {
      usersSkipped += 1
    }

    const assigned = await client.group.updateMany({
      where: { userId, role: 'post', preservationPresetId: null },
      data: { preservationPresetId: presetId },
    })
    groupsAssigned += assigned.count
  }

  return { presetsCreated, groupsAssigned, usersSkipped, users: users.length }
}

// Execução direta (não quando importado em teste).
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPreservationPresets()
    .then((r) => {
      console.log(`[seed-preservation-presets] usuários=${r.users} presets_criados=${r.presetsCreated} grupos_atribuídos=${r.groupsAssigned} já_existiam=${r.usersSkipped}`)
      return db.$disconnect()
    })
    .catch(async (err) => {
      console.error('[seed-preservation-presets] falhou:', err)
      await db.$disconnect().catch(() => {})
      process.exit(1)
    })
}
