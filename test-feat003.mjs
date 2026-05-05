/**
 * Test suite for FEAT-003 — Logs de Envio
 * Tests: GET /api/logs, DELETE /api/logs/clear, pagination, filter by status, group name resolution
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const BASE = `http://localhost:${process.env.API_PORT || 3001}`

let passed = 0
let failed = 0
let authCookie = ''
let userId = ''

function ok(name) { console.log(`  ✓ ${name}`); passed++ }
function fail(name, reason) { console.error(`  ✗ ${name}: ${reason}`); failed++ }

function captureAuthCookie(res) {
  const setCookie = res.headers.get('set-cookie')
  const cookie = setCookie?.split(';')[0]
  if (!cookie?.startsWith('wb_auth=')) throw new Error('Cookie wb_auth ausente na resposta de autenticação')
  return cookie
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authCookie ? { Cookie: authCookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function setup() {
  // Register or login test user via API to get a real HttpOnly auth cookie
  const email = 'test-logs@wabot.com'
  const password = 'TestLogs123!'

  let res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 409 || res.status === 400) {
    // Already exists — login
    res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  }
  await res.json()
  authCookie = captureAuthCookie(res)

  const me = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: authCookie },
  }).then(r => r.json())
  userId = me.id

  // Create groups for name resolution test
  await db.group.deleteMany({ where: { userId } })
  await db.group.createMany({
    data: [
      { userId, waJid: '120363001@g.us', name: 'Grupo Monitor', role: 'monitor' },
      { userId, waJid: '120363002@g.us', name: 'Grupo Postagem', role: 'post' },
    ],
  })

  // Clear any existing logs for this user
  await db.messageLog.deleteMany({ where: { userId } })

  // Seed logs: 3 success + 2 error
  await db.messageLog.createMany({
    data: [
      { userId, platform: 'shopee',       sourceGroup: '120363001@g.us', destGroup: '120363002@g.us', originalUrl: 'https://shopee.com.br/p1', convertedUrl: 'https://s.shopee.com.br/aff1', messageText: 'Oferta Shopee 1', status: 'success' },
      { userId, platform: 'amazon',       sourceGroup: '120363001@g.us', destGroup: '120363002@g.us', originalUrl: 'https://amazon.com.br/p2', convertedUrl: 'https://amzn.to/aff2', messageText: 'Oferta Amazon', status: 'success' },
      { userId, platform: 'mercadolivre', sourceGroup: '120363001@g.us', destGroup: '120363002@g.us', originalUrl: 'https://ml.com.br/p3',   convertedUrl: 'https://meli.la/aff3', messageText: 'Oferta ML', status: 'success' },
      { userId, platform: 'shopee',       sourceGroup: '120363001@g.us', destGroup: '120363002@g.us', originalUrl: 'https://shopee.com.br/p4', convertedUrl: '',                    messageText: 'Erro shopee', status: 'error', errorMsg: 'timeout' },
      { userId, platform: 'amazon',       sourceGroup: '120363001@g.us', destGroup: 'unknown@g.us',   originalUrl: 'https://amazon.com.br/p5', convertedUrl: '',                    messageText: 'Erro amazon', status: 'error', errorMsg: 'socket closed' },
    ],
  })
}

async function cleanup() {
  await db.messageLog.deleteMany({ where: { userId } })
  await db.group.deleteMany({ where: { userId } })
  await db.user.delete({ where: { id: userId } }).catch(() => {})
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function testUnauthorized() {
  console.log('\nAuth protection:')
  const saved = authCookie
  authCookie = ''
  const { status } = await req('GET', '/api/logs')
  authCookie = saved
  status === 401 ? ok('GET /api/logs sem cookie → 401') : fail('GET /api/logs sem cookie', `esperado 401, recebido ${status}`)
}

async function testGetAllLogs() {
  console.log('\nGET /api/logs (tab Todos):')
  const { status, data } = await req('GET', '/api/logs?status=all&page=1&limit=20')
  status === 200 ? ok('status 200') : fail('status', `${status}`)
  data.total === 5 ? ok('total = 5') : fail('total', `esperado 5, recebido ${data.total}`)
  data.logs?.length === 5 ? ok('5 logs retornados') : fail('logs.length', `esperado 5, recebido ${data.logs?.length}`)
  data.page === 1 ? ok('page = 1') : fail('page', `${data.page}`)
  data.limit === 20 ? ok('limit = 20') : fail('limit', `${data.limit}`)
}

async function testFilterSuccess() {
  console.log('\nGET /api/logs?status=success:')
  const { status, data } = await req('GET', '/api/logs?status=success')
  status === 200 ? ok('status 200') : fail('status', `${status}`)
  data.total === 3 ? ok('total = 3') : fail('total', `esperado 3, recebido ${data.total}`)
  const allSuccess = data.logs?.every(l => l.status === 'success')
  allSuccess ? ok('todos com status=success') : fail('filtro', 'log com status diferente de success')
}

async function testFilterError() {
  console.log('\nGET /api/logs?status=error:')
  const { status, data } = await req('GET', '/api/logs?status=error')
  status === 200 ? ok('status 200') : fail('status', `${status}`)
  data.total === 2 ? ok('total = 2') : fail('total', `esperado 2, recebido ${data.total}`)
  const allError = data.logs?.every(l => l.status === 'error')
  allError ? ok('todos com status=error') : fail('filtro', 'log com status diferente de error')
  const hasErrorMsg = data.logs?.every(l => l.errorMsg)
  hasErrorMsg ? ok('errorMsg presente') : fail('errorMsg', 'algum log de erro sem errorMsg')
}

async function testPagination() {
  console.log('\nPaginação (limit=2):')
  const { data: p1 } = await req('GET', '/api/logs?page=1&limit=2')
  const { data: p2 } = await req('GET', '/api/logs?page=2&limit=2')
  const { data: p3 } = await req('GET', '/api/logs?page=3&limit=2')
  p1.logs?.length === 2 ? ok('página 1: 2 logs') : fail('página 1', `${p1.logs?.length}`)
  p2.logs?.length === 2 ? ok('página 2: 2 logs') : fail('página 2', `${p2.logs?.length}`)
  p3.logs?.length === 1 ? ok('página 3: 1 log (resto)') : fail('página 3', `${p3.logs?.length}`)
  p1.total === 5 ? ok('total consistente entre páginas') : fail('total p1', `${p1.total}`)
}

async function testGroupNameResolution() {
  console.log('\nResolução de nomes de grupo:')
  const { data } = await req('GET', '/api/logs?status=all&limit=10')
  const log = data.logs?.find(l => l.sourceGroup === '120363001@g.us')
  log?.sourceGroupName === 'Grupo Monitor' ? ok('sourceGroupName resolvido') : fail('sourceGroupName', `recebido: ${log?.sourceGroupName}`)
  log?.destGroupName === 'Grupo Postagem' ? ok('destGroupName resolvido') : fail('destGroupName', `recebido: ${log?.destGroupName}`)
  // JID desconhecido deve retornar o JID
  const unknown = data.logs?.find(l => l.destGroup === 'unknown@g.us')
  unknown?.destGroupName === 'unknown@g.us' ? ok('JID desconhecido retorna o próprio JID') : fail('JID desconhecido', `recebido: ${unknown?.destGroupName}`)
}

async function testOrderDesc() {
  console.log('\nOrdenação (mais recente primeiro):')
  const { data } = await req('GET', '/api/logs')
  const dates = data.logs?.map(l => new Date(l.sentAt).getTime())
  const sorted = [...dates].sort((a, b) => b - a)
  JSON.stringify(dates) === JSON.stringify(sorted) ? ok('logs em ordem desc por sentAt') : fail('ordenação', 'não está em ordem decrescente')
}

async function testClear() {
  console.log('\nDELETE /api/logs/clear:')
  const { status, data } = await req('DELETE', '/api/logs/clear')
  status === 200 ? ok('status 200') : fail('status', `${status}`)
  data.ok === true ? ok('{ ok: true }') : fail('body', JSON.stringify(data))

  const { data: after } = await req('GET', '/api/logs')
  after.total === 0 ? ok('logs zerados após clear') : fail('total após clear', `${after.total}`)
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== FEAT-003 — Logs de Envio — Testes de Integração ===')

  try {
    await setup()
    console.log(`\nSeed: 5 logs inseridos (3 success, 2 error) para userId=${userId}`)
  } catch (e) {
    console.error('Erro no setup:', e.message)
    process.exit(1)
  }

  await testUnauthorized()
  await testGetAllLogs()
  await testFilterSuccess()
  await testFilterError()
  await testPagination()
  await testGroupNameResolution()
  await testOrderDesc()
  await testClear()

  await cleanup()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Resultado: ${passed} passaram, ${failed} falharam`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
