import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildInbox, pesoFinanceiro, acoesPara, LIMIAR_AGORA, GRAVIDADE } from '../src/domain/admin/inboxPriority.js'
import { PAYING_STATUS } from '../src/domain/admin/payingStatus.js'

/*
 * G1 da auditoria do painel: caixa de entrada "Hoje" — uma linha por cliente,
 * prioridade = peso financeiro × gravidade, ação ao lado.
 */

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('pagante com robô fora do ar vem antes de lead que não conectou', () => {
  const r = buildInbox({ clientes: [
    { id: 'lead', email: 'lead@x', payingStatus: PAYING_STATUS.NEVER, segmento: 'sem-envio-ate-7d' },
    { id: 'pag', email: 'pag@x', payingStatus: PAYING_STATUS.PAYING, segmento: null, operacional: 'robo-caido-agora', canAdminRetry: true, detalheMs: 3 * 3600_000 },
    { id: 'ex', email: 'ex@x', payingStatus: PAYING_STATUS.FORMER, segmento: 'venceu-ate-3d' },
  ] })
  assert.deepEqual([...r.agora, ...r.semana].map(l => l.userId), ['pag', 'ex', 'lead'])
  assert.equal(r.agora[0].userId, 'pag')
  assert.equal(r.agora[0].prioridade, 9)
  assert.equal(r.agora[0].acoes[0], 'reconectar', 'ação primária do robô caído é reconectar quando a API pode')
  assert.equal(r.semana.find(l => l.userId === 'lead').prioridade, 1)
})

test('cada cliente aparece UMA vez: o motivo operacional vence o comercial', () => {
  const r = buildInbox({ clientes: [
    { id: 'u1', email: 'u1@x', payingStatus: PAYING_STATUS.PAYING, segmento: 'parou-de-enviar', operacional: 'cega-agora' },
  ] })
  assert.equal(r.total, 1)
  assert.equal(r.agora[0].motivo, 'cega-agora')
  assert.equal(r.agora[0].titulo, 'Conectada, mas sem receber')
})

test('quem não tem motivo não entra; motivo desconhecido também não', () => {
  const r = buildInbox({ clientes: [
    { id: 'ok', email: 'ok@x', payingStatus: PAYING_STATUS.PAYING, segmento: null },
    { id: 'x', email: 'x@x', payingStatus: PAYING_STATUS.PAYING, segmento: 'motivo-que-nao-existe' },
  ] })
  assert.equal(r.total, 0)
})

test('peso financeiro: pagante 3, ex-pagante 2, trial que já publicou 1,5, lead 1', () => {
  assert.equal(pesoFinanceiro({ payingStatus: PAYING_STATUS.PAYING }), 3)
  assert.equal(pesoFinanceiro({ payingStatus: PAYING_STATUS.FORMER }), 2)
  assert.equal(pesoFinanceiro({ payingStatus: PAYING_STATUS.NEVER, everSent: true }), 1.5)
  assert.equal(pesoFinanceiro({ payingStatus: PAYING_STATUS.NEVER }), 1)
})

test('"Agora" é só o que cruza o limiar: cobrança recusada de pagante sim, lead sem loja não', () => {
  const r = buildInbox({ clientes: [
    { id: 'a', email: 'a@x', payingStatus: PAYING_STATUS.PAYING, segmento: 'cobranca-recusada', telefone: '5511999999999' },
    { id: 'b', email: 'b@x', payingStatus: PAYING_STATUS.NEVER, segmento: 'sem-loja' },
  ] })
  assert.ok(r.agora[0].prioridade >= LIMIAR_AGORA)
  assert.deepEqual(r.agora.map(l => l.userId), ['a'])
  assert.deepEqual(r.agora[0].acoes, ['whatsapp', 'ficha'])
  assert.deepEqual(r.semana.map(l => l.userId), ['b'])
  assert.deepEqual(acoesPara('robo-caido', { canAdminRetry: false, telefone: '' }), ['ficha'])
})

test('todo segmento comercial do contato semanal tem gravidade (senão some da caixa em silêncio)', async () => {
  const { OUTREACH_SEGMENTS } = await import('../src/domain/admin/outreachSegments.js')
  for (const seg of OUTREACH_SEGMENTS) assert.ok(GRAVIDADE[seg.id], `segmento ${seg.id} sem gravidade`)
})

test('rota /inbox: support:read, auditada, só leitura em lote, telefone mascarado por papel', () => {
  const fonte = read('src/api/routes/admin.js')
  const inicio = fonte.indexOf("app.get('/inbox'")
  assert.ok(inicio >= 0)
  const corpo = fonte.slice(inicio, fonte.indexOf('\n  })\n', inicio))
  assert.match(corpo, /requireAdmin\(req, reply, 'support:read'\)/)
  assert.match(corpo, /action: 'admin\.inbox\.read'/)
  assert.match(corpo, /classifyOutreachSegment\(/)
  assert.match(corpo, /findPayingDown\(/)
  assert.match(corpo, /findPayingBlind\(/)
  assert.match(corpo, /canSeePhone\(req\.admin\.role\)/)
  assert.ok(!/\.(create|update|delete|upsert)\(/.test(corpo), 'a caixa só lê')
  assert.ok(!/for \([^)]*\) \{[^}]*await db\./s.test(corpo), 'nenhuma consulta por cliente dentro de laço')
  assert.match(corpo, /take: INBOX_USER_LIMIT/)
})

test('tela /admin/hoje: tokens do design system, confirma antes de reconectar, link no menu', () => {
  const page = read('dashboard/app/admin/hoje/page.js')
  assert.doesNotMatch(page, /#[0-9a-fA-F]{3,8}\b/, 'cor em hex solto — usar var(--token)')
  assert.match(page, /var\(--accent-strong\)/)
  assert.match(page, /if \(!window\.confirm\([\s\S]*adminOnlineReconnect/)
  assert.match(page, /\/admin\/clientes\/\$\{item\.userId\}/)
  for (const jargao of ['DLQ', 'payload', 'endpoint', 'jid']) assert.ok(!page.includes(jargao), `jargão "${jargao}" na tela`)
  assert.match(read('dashboard/app/admin/page.js'), /href="\/admin\/hoje"/)
  assert.match(read('dashboard/lib/api.js'), /adminInbox: \(\) => apiFetch\('\/api\/admin\/inbox'\)/)
})
