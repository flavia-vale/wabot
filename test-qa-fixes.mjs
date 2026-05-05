/**
 * Regression suite for QA bug fixes around config validation, group validation,
 * and HttpOnly cookie authentication.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const BASE = `http://localhost:${process.env.API_PORT || 3001}`

let passed = 0
let failed = 0
let authCookie = ''
let userId = ''
let groupId = ''

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
  const email = `qa-fixes-${Date.now()}@wabot.com`
  const password = 'QaFixes123!'
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  await res.json()
  authCookie = captureAuthCookie(res)

  const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: authCookie } })
  const me = await meRes.json()
  userId = me.id

  const group = await req('POST', '/api/groups', {
    waJid: '120363999@g.us', name: 'Grupo QA Fixes', role: 'monitor',
  })
  if (group.status !== 200) throw new Error(`Falha ao criar grupo: ${JSON.stringify(group.data)}`)
  groupId = group.data.id
}

async function cleanup() {
  if (!userId) return
  await db.messageLog.deleteMany({ where: { userId } })
  await db.scheduledMessage.deleteMany({ where: { userId } })
  await db.group.deleteMany({ where: { userId } })
  await db.botConfig.deleteMany({ where: { userId } })
  await db.credential.deleteMany({ where: { userId } })
  await db.payment.deleteMany({ where: { userId } })
  await db.waSession.deleteMany({ where: { userId } })
  await db.user.delete({ where: { id: userId } }).catch(() => {})
}

async function testCookieAuth() {
  console.log('\nAutenticação HttpOnly cookie:')
  const { status, data } = await req('GET', '/api/auth/me')
  status === 200 ? ok('cookie wb_auth autentica /api/auth/me') : fail('cookie auth', `status ${status}`)
  data.id === userId ? ok('usuário autenticado correto') : fail('usuário autenticado', JSON.stringify(data))
}

async function testConfigValidation() {
  console.log('\nValidação de /api/config:')
  const invalidString = await req('PUT', '/api/config', { delayMin: 'abc', delayMax: 10 })
  invalidString.status === 400 ? ok('delayMin string → 400') : fail('delayMin string', `status ${invalidString.status}`)

  const decimal = await req('PUT', '/api/config', { delayMin: 1.5, delayMax: 10 })
  decimal.status === 400 ? ok('delayMin decimal → 400') : fail('delayMin decimal', `status ${decimal.status}`)

  const outOfRange = await req('PUT', '/api/config', { delayMin: 0, delayMax: 301 })
  outOfRange.status === 400 ? ok('delayMax fora do range → 400') : fail('delayMax fora do range', `status ${outOfRange.status}`)

  const invertedPartial = await req('PUT', '/api/config', { delayMin: 20 })
  invertedPartial.status === 400 ? ok('update parcial delayMin > delayMax default → 400') : fail('update parcial invertido', `status ${invertedPartial.status}`)

  const valid = await req('PUT', '/api/config', { delayMin: 2, delayMax: 20, platforms: 'amazon', blockedKeywords: '', welcomeMsg: '' })
  valid.status === 200 && valid.data.delayMin === 2 && valid.data.delayMax === 20
    ? ok('config válida persiste delays')
    : fail('config válida', `${valid.status} ${JSON.stringify(valid.data)}`)

  const invertedExisting = await req('PUT', '/api/config', { delayMax: 1 })
  invertedExisting.status === 400 ? ok('update parcial delayMax < delayMin existente → 400') : fail('delayMax parcial invertido', `status ${invertedExisting.status}`)
}

async function testGroupFallbackValidation() {
  console.log('\nValidação de fallbackToOriginal:')
  const invalid = await req('PUT', `/api/groups/${groupId}`, { fallbackToOriginal: 'true' })
  invalid.status === 400 ? ok('fallbackToOriginal string → 400') : fail('fallbackToOriginal string', `status ${invalid.status}`)

  const valid = await req('PUT', `/api/groups/${groupId}`, { fallbackToOriginal: true })
  valid.status === 200 && valid.data.fallbackToOriginal === true
    ? ok('fallbackToOriginal boolean persiste')
    : fail('fallbackToOriginal boolean', `${valid.status} ${JSON.stringify(valid.data)}`)
}

async function run() {
  console.log('=== QA Fixes — Regressão dos bugs corrigidos ===')
  try {
    await setup()
    await testCookieAuth()
    await testConfigValidation()
    await testGroupFallbackValidation()
  } finally {
    await cleanup()
    await db.$disconnect()
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Resultado: ${passed} passaram, ${failed} falharam`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})
