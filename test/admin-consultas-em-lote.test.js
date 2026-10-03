import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('buildFleetScenarios: sem distinct do Prisma (só comentário)', () => {
  const src = read('src/api/routes/admin.js')
  const i = src.indexOf('async function buildFleetScenarios')
  const code = src.slice(i, i + 2800).split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.ok(!/distinct\s*:/.test(code))
  assert.match(code, /waConnectionEvent\.groupBy/)
  assert.match(code, /analyticsEvent\.groupBy/)
})

test('GET /batches: um groupBy, sem await dentro de for', () => {
  const src = read('src/api/routes/adminEmails.js')
  const i = src.indexOf("app.get('/batches'")
  const body = src.slice(i, src.indexOf("app.post('/batches/:id/cancel'", i))
  assert.match(body, /emailSendLog\.groupBy/)
  assert.ok(!/emailSendLog\.count/.test(body))
  assert.ok(!/await /.test(body.slice(body.indexOf('for (const batch of batches)'))))
})

test('funil: take presente e aviso de truncamento na tela', () => {
  const src = read('src/domain/admin/service.js')
  const i = src.indexOf('async function getActivationFunnel')
  const body = src.slice(i, i + 1800)
  assert.match(body, /take: FUNNEL_COHORT_LIMIT \+ 1/)
  assert.match(body, /truncated/)
  assert.match(read('dashboard/app/admin/funil/page.js'), /data\.truncated/)
})
