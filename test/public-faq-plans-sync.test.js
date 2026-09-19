import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import db from '../src/db.js'
import { CORE_FAQ_ITEMS, DEFAULT_LANDING_PLANS } from '../dashboard/lib/marketing-content.js'

// RCA 2026-09-18: /api/public/faq e /api/public/plans (abertos no robots.txt
// para as IAs) devolviam o seed de 05-06/2026 — 4 lojas quando são 6. A regra
// documentada é "manter LpPlan/FaqItem em sincronia com DEFAULT_LANDING_PLANS /
// CORE_FAQ_ITEMS", e nada a verificava. Esta guarda: (1) a ÚLTIMA migration
// que toca esses textos precisa carregar exatamente o que está nas constantes
// — mudou a constante, nasce uma migration nova; (2) a migration roda de
// verdade e só troca a linha que ainda está com o texto antigo.

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '..', 'prisma', 'migrations')

function latestSyncMigration() {
  const dirs = fs.readdirSync(migrationsDir).filter((d) => /sync_public_faq_plans/.test(d)).sort()
  assert.ok(dirs.length, 'nenhuma migration *_sync_public_faq_plans_* encontrada')
  const dir = dirs[dirs.length - 1]
  return { dir, sql: fs.readFileSync(path.join(migrationsDir, dir, 'migration.sql'), 'utf8') }
}

function unquote(sql) {
  return sql.replace(/''/g, "'")
}

function statements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^(\s*--[^\n]*\n)+/, '').trim())
    .filter((s) => /^UPDATE/i.test(s))
}

test('a última migration de sincronia carrega EXATAMENTE os planos de DEFAULT_LANDING_PLANS', () => {
  const { sql } = latestSyncMigration()
  for (const plan of DEFAULT_LANDING_PLANS) {
    const block = sql.split(`WHERE "id" = '${plan.id}'`)[0].split('UPDATE "LpPlan"').pop()
    assert.ok(block, `sem UPDATE para o plano ${plan.id}`)
    const features = block.match(/"features" = '((?:[^']|'')*)'/)
    const description = block.match(/"description" = '((?:[^']|'')*)'/)
    assert.ok(features && description, `plano ${plan.id} sem features/description`)
    assert.equal(unquote(features[1]), JSON.stringify(plan.features), `features do plano ${plan.id} divergem — crie uma migration nova de sincronia`)
    assert.equal(unquote(description[1]), plan.desc, `description do plano ${plan.id} diverge`)
  }
})

test('a última migration de sincronia carrega as respostas de CORE_FAQ_ITEMS que ela toca', () => {
  const { sql } = latestSyncMigration()
  const touched = [...sql.matchAll(/UPDATE "FaqItem"\s+SET "answer" = '((?:[^']|'')*)'[^;]*WHERE "id" = '([^']+)'/g)]
  assert.ok(touched.length >= 2, 'a migration precisa tocar ao menos as perguntas de lojas e de bloqueio')
  for (const [, answer, id] of touched) {
    const item = CORE_FAQ_ITEMS.find((i) => i.id === id)
    assert.ok(item, `FaqItem ${id} não existe em CORE_FAQ_ITEMS`)
    assert.equal(unquote(answer), item.answer, `resposta de ${id} diverge de CORE_FAQ_ITEMS`)
  }
  const programs = CORE_FAQ_ITEMS.find((i) => i.id === 'faq_seed_programs')
  for (const loja of ['Shopee', 'Mercado Livre', 'Amazon', 'Magalu', 'SHEIN', 'AliExpress']) {
    assert.ok(programs.answer.includes(loja), `a resposta de lojas precisa citar ${loja}`)
  }
})

test('todo UPDATE é guardado pelo texto antigo — quem editou pelo admin não é sobrescrito', () => {
  const { sql } = latestSyncMigration()
  for (const st of statements(sql)) {
    assert.match(st, /WHERE "id" = '[^']+'\s+AND ("description"|"answer"|"features") = '/, `UPDATE sem guarda de texto antigo:\n${st.slice(0, 120)}`)
  }
  const semComentarios = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  assert.doesNotMatch(semComentarios, /ALTER TABLE|CREATE TABLE|DROP/i, 'DML pura: sem DDL (pegadinha #8)')
})

test('a migration roda no SQLite e só troca a linha que ainda tem o seed antigo', async () => {
  const { sql } = latestSyncMigration()
  const seedFeatures = '["Espelhamento de grupos (monitor → destinos)","Conversão de links: Mercado Livre, Amazon, Shopee e Magalu","Criar oferta a partir de link (título, preço e imagem)","Envio imediato e agendado","Templates de mensagem personalizáveis","Relatórios de envio com histórico completo"]'
  const seedDescription = 'Para operar ofertas manualmente em grupos: espelhamento, conversão de links, criação de ofertas e agendamento.'
  const seedProgramsAnswer = 'Hoje suportamos Shopee, Mercado Livre, Amazon e Magalu. Basta cadastrar suas credenciais no painel para as plataformas que você usa.'

  await db.lpPlan.upsert({
    where: { id: 'basic' },
    update: { description: seedDescription, features: seedFeatures, price: 'R$ 39', title: 'Basic', position: 2 },
    create: { id: 'basic', title: 'Basic', description: seedDescription, price: 'R$ 39', features: seedFeatures, position: 2 },
  })
  await db.faqItem.upsert({
    where: { id: 'faq_seed_programs' },
    update: { answer: seedProgramsAnswer, question: 'Funciona com quais programas de afiliados?', isActive: true, position: 4 },
    create: { id: 'faq_seed_programs', question: 'Funciona com quais programas de afiliados?', answer: seedProgramsAnswer, position: 4, isActive: true },
  })
  const editedByAdmin = 'Resposta editada pela administradora no painel.'
  await db.faqItem.upsert({
    where: { id: 'faq_seed_whatsapp_ban' },
    update: { answer: editedByAdmin, question: 'Vou ser banida do WhatsApp?', isActive: true, position: 1 },
    create: { id: 'faq_seed_whatsapp_ban', question: 'Vou ser banida do WhatsApp?', answer: editedByAdmin, position: 1, isActive: true },
  })

  for (const st of statements(sql)) {
    await db.$executeRawUnsafe(st)
  }

  const basic = await db.lpPlan.findUnique({ where: { id: 'basic' } })
  const basicDefault = DEFAULT_LANDING_PLANS.find((p) => p.id === 'basic')
  assert.deepEqual(JSON.parse(basic.features), basicDefault.features)
  assert.ok(basic.features.includes('SHEIN') && basic.features.includes('AliExpress'))

  const programs = await db.faqItem.findUnique({ where: { id: 'faq_seed_programs' } })
  assert.equal(programs.answer, CORE_FAQ_ITEMS.find((i) => i.id === 'faq_seed_programs').answer)

  const ban = await db.faqItem.findUnique({ where: { id: 'faq_seed_whatsapp_ban' } })
  assert.equal(ban.answer, editedByAdmin, 'linha editada no admin foi sobrescrita')

  // Idempotente: rodar de novo não muda nada.
  for (const st of statements(sql)) await db.$executeRawUnsafe(st)
  const again = await db.lpPlan.findUnique({ where: { id: 'basic' } })
  assert.equal(again.features, basic.features)

  await db.lpPlan.deleteMany({ where: { id: 'basic' } })
  await db.faqItem.deleteMany({ where: { id: { in: ['faq_seed_programs', 'faq_seed_whatsapp_ban'] } } })
})
