import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { isStuckSending, buildFilasRows, resolveQueueBackend, dlqDisponivel, validateReprocessReason, FILAS_MAX_LINHAS } from '../src/domain/admin/stuckSendQueue.js'
import { STUCK_SENDING_MS } from '../src/ops/adminOpsAlertPolicy.js'

// M5 da auditoria: Operação → Filas (envios presos em 'sending'); DLQ só com BullMQ.

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const NOW = 1_800_000_000_000

test('preso = status sending há mais que STUCK_SENDING_MS', () => {
  assert.equal(isStuckSending({ status: 'sending', sentAt: new Date(NOW - STUCK_SENDING_MS - 1) }, NOW), true)
  assert.equal(isStuckSending({ status: 'sending', sentAt: new Date(NOW - 60_000) }, NOW), false)
  assert.equal(isStuckSending({ status: 'success', sentAt: new Date(NOW - 9e6) }, NOW), false)
  assert.equal(isStuckSending({ status: 'sending', sentAt: null }, NOW), false)
})

test('backend: só QUEUE_BACKEND=bullmq liga a DLQ; vazio/memory = memória', () => {
  assert.equal(resolveQueueBackend({}), 'memoria')
  assert.equal(resolveQueueBackend({ QUEUE_BACKEND: 'memory' }), 'memoria')
  assert.equal(resolveQueueBackend({ QUEUE_BACKEND: ' BullMQ ' }), 'bullmq')
  assert.equal(dlqDisponivel({}), false)
  assert.equal(dlqDisponivel({ QUEUE_BACKEND: 'bullmq' }), true)
})

test('linhas: mais antigo primeiro, com cliente e último sucesso', () => {
  const rows = buildFilasRows({
    nowMs: NOW,
    presos: [
      { userId: 'a', _count: { _all: 2 }, _min: { sentAt: new Date(NOW - 3_600_000) } },
      { userId: 'b', _count: { _all: 1 }, _min: { sentAt: new Date(NOW - 7_200_000) } },
    ],
    usuarios: [{ id: 'a', email: 'a@x', name: 'A' }],
    ultimosSucessos: [{ userId: 'a', _max: { sentAt: new Date(NOW - 5000) } }],
  })
  assert.deepEqual(rows.map(r => r.userId), ['b', 'a'])
  assert.equal(rows[1].presos, 2)
  assert.equal(rows[1].email, 'a@x')
  assert.equal(rows[0].ultimoSucessoEm, null)
  assert.equal(rows[1].maisAntigoMs, 3_600_000)
  assert.equal(FILAS_MAX_LINHAS, 500)
})

test('reprocessar exige motivo', () => {
  assert.equal(validateReprocessReason({}).ok, false)
  assert.equal(validateReprocessReason({ reason: 'abc' }).ok, false)
  assert.equal(validateReprocessReason({ reason: 'cliente pediu' }).ok, true)
})

test('rotas: só em lote (groupBy/in, take 500), permissões e auditoria', () => {
  const src = read('src/api/routes/admin.js')
  const i = src.indexOf("app.get('/filas'")
  const j = src.indexOf("// ---- DLQ do pipeline de envio (BullMQ) ----")
  assert.ok(i > 0 && j > i)
  const bloco = src.slice(i, j)
  assert.match(bloco, /requireAdmin\(req, reply, 'tech:read'\)/)
  assert.match(bloco, /app\.post\('\/filas\/:userId\/reprocessar'[\s\S]*requireAdmin\(req, reply, 'tech:write'\)/)
  assert.match(bloco, /groupBy/)
  assert.match(bloco, /take: FILAS_MAX_LINHAS/)
  assert.ok(!/findMany\(\{ where: \{ status: 'sending'/.test(bloco), 'nada de varrer linhas uma a uma')
  assert.match(bloco, /writeAdminAuditLog\(req, \{ action: 'admin\.filas\.list'/)
  assert.match(bloco, /writeAdminAuditLog\(req, \{ action: 'admin\.filas\.reprocessar'/)
  assert.match(bloco, /recoverStuckSendLogs\(\{ db, userId/)
})

test('rotas /send-dlq/* respondem 409 quando a fila é em memória', () => {
  const src = read('src/api/routes/admin.js')
  const k = src.indexOf('async function resolveDlqUserId')
  assert.match(src.slice(k, k + 400), /if \(!dlqDisponivel\(\)\)[\s\S]*code\(409\)/)
})

test('telas: seção Filas na Operação com confirm, DLQ do Início só com bullmq, chip linka', () => {
  const op = read('dashboard/app/admin/operacao/page.js')
  const comp = read('dashboard/components/FilasSection.js')
  assert.match(op, /<FilasSection admin=\{admin\}/)
  assert.match(comp, /window\.confirm\(`Destravar/)
  assert.match(comp, /api\.adminFilasReprocessar/)
  const inicio = read('dashboard/app/admin/page.js')
  assert.match(inicio, /sendDlq\?\.backend === 'bullmq'/)
  const hoje = read('dashboard/app/admin/hoje/page.js')
  assert.match(hoje, /href="\/admin\/operacao#filas"/)
})
