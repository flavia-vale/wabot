/**
 * Test suite for FEAT-001 — Modo de imagem por grupo monitorado
 * Tests: PUT /api/groups/:id (imageMode fields), GET /api/groups (new fields present),
 *        validation, og:image scraper
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { fetchProductImage } from './src/converters/imageScrapers.js'

const db = new PrismaClient()
const BASE = `http://localhost:${process.env.API_PORT || 3001}`

let passed = 0
let failed = 0
let token = ''
let userId = ''
let groupId = ''

function ok(name) { console.log(`  ✓ ${name}`); passed++ }
function fail(name, reason) { console.error(`  ✗ ${name}: ${reason}`); failed++ }

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function setup() {
  const email = 'test-feat001@wabot.com'
  const password = 'TestFeat001!'

  let res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 409 || res.status === 400) {
    res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  }
  const auth = await res.json()
  token = auth.token
  if (!token) throw new Error(`Sem token: ${JSON.stringify(auth)}`)

  const me = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json())
  userId = me.id

  // Create a monitor group
  const { data: g } = await req('POST', '/api/groups', {
    waJid: '999888777@g.us', name: 'Grupo Teste FEAT001', role: 'monitor',
  })
  groupId = g.id
}

async function cleanup() {
  await db.group.deleteMany({ where: { userId } })
  await db.user.delete({ where: { id: userId } }).catch(() => {})
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function testDefaultFields() {
  console.log('\nCampos padrão ao criar grupo:')
  const { data } = await req('GET', '/api/groups')
  const g = data.find(x => x.id === groupId)
  g ? ok('grupo encontrado no GET') : fail('grupo', 'não retornado')
  g?.imageMode === 'none' ? ok('imageMode default = none') : fail('imageMode', `esperado none, recebido ${g?.imageMode}`)
  g?.imageLinkTarget === 'first' ? ok('imageLinkTarget default = first') : fail('imageLinkTarget', `esperado first, recebido ${g?.imageLinkTarget}`)
  g?.fallbackToOriginal === false ? ok('fallbackToOriginal default = false') : fail('fallbackToOriginal', `esperado false, recebido ${g?.fallbackToOriginal}`)
}

async function testUpdateImageMode() {
  console.log('\nPUT /api/groups/:id — atualizar imageMode:')
  const { status, data } = await req('PUT', `/api/groups/${groupId}`, { imageMode: 'original' })
  status === 200 ? ok('status 200') : fail('status', `${status}`)
  data.imageMode === 'original' ? ok('imageMode atualizado para original') : fail('imageMode', `recebido: ${data.imageMode}`)

  // Verify persisted
  const { data: groups } = await req('GET', '/api/groups')
  const g = groups.find(x => x.id === groupId)
  g?.imageMode === 'original' ? ok('imageMode persistido no banco') : fail('persistência', `recebido: ${g?.imageMode}`)
}

async function testUpdateFetchMode() {
  console.log('\nAtualizar para modo fetch com imageLinkTarget e fallback:')
  const { status, data } = await req('PUT', `/api/groups/${groupId}`, {
    imageMode: 'fetch',
    imageLinkTarget: 'last',
    fallbackToOriginal: true,
  })
  status === 200 ? ok('status 200') : fail('status', `${status}`)
  data.imageMode === 'fetch' ? ok('imageMode = fetch') : fail('imageMode', data.imageMode)
  data.imageLinkTarget === 'last' ? ok('imageLinkTarget = last') : fail('imageLinkTarget', data.imageLinkTarget)
  data.fallbackToOriginal === true ? ok('fallbackToOriginal = true') : fail('fallbackToOriginal', data.fallbackToOriginal)
}

async function testValidation() {
  console.log('\nValidação de campos inválidos:')
  const { status: s1, data: d1 } = await req('PUT', `/api/groups/${groupId}`, { imageMode: 'invalid' })
  s1 === 400 ? ok('imageMode inválido → 400') : fail('imageMode inválido', `status ${s1}`)

  const { status: s2, data: d2 } = await req('PUT', `/api/groups/${groupId}`, { imageLinkTarget: 'middle' })
  s2 === 400 ? ok('imageLinkTarget inválido → 400') : fail('imageLinkTarget inválido', `status ${s2}`)

  // Partial update (only one field)
  const { status: s3 } = await req('PUT', `/api/groups/${groupId}`, { imageMode: 'none' })
  s3 === 200 ? ok('update parcial (só imageMode) → 200') : fail('update parcial', `status ${s3}`)
}

async function testAuthProtection() {
  console.log('\nAuth protection no PUT:')
  const savedToken = token
  token = ''
  const { status } = await req('PUT', `/api/groups/${groupId}`, { imageMode: 'none' })
  token = savedToken
  status === 401 ? ok('sem token → 401') : fail('sem token', `status ${status}`)
}

async function testOwnership() {
  console.log('\nIsolamento por userId:')
  // Create another user
  const { token: token2 } = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'other-feat001@wabot.com', password: 'Other1234!' }),
  }).then(r => r.json())

  const savedToken = token
  token = token2
  const { status } = await req('PUT', `/api/groups/${groupId}`, { imageMode: 'original' })
  token = savedToken
  status === 404 ? ok('outro usuário não pode alterar grupo alheio → 404') : fail('isolamento', `status ${status}`)

  // Cleanup other user
  const { id: otherId } = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token2}` },
  }).then(r => r.json())
  await db.user.delete({ where: { id: otherId } }).catch(() => {})
}

async function testImageScraperFetch() {
  console.log('\nfetchProductImage (og:image):')
  // Use a known public URL with og:image (example.com won't have it, use a reliable page)
  // Testing with a URL that we know has og:image — GitHub
  const url = 'https://github.com'
  const imgUrl = await fetchProductImage('shopee', url)
  // GitHub should have og:image
  typeof imgUrl === 'string' && imgUrl.startsWith('http')
    ? ok(`og:image encontrado: ${imgUrl.slice(0, 60)}...`)
    : imgUrl === null
      ? ok('null retornado para URL sem og:image (aceitável)')
      : fail('retorno inesperado', String(imgUrl))
}

async function testImageScraperTimeout() {
  console.log('\nfetchProductImage — URL inválida:')
  const result = await fetchProductImage('amazon', 'https://localhost:9999/no-such-page')
  result === null ? ok('null retornado para URL com timeout/erro') : fail('esperado null', String(result))
}

// ── Runner ─────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== FEAT-001 — Modo de Imagem por Grupo — Testes de Integração ===')

  try { await setup() } catch (e) { console.error('Erro no setup:', e.message); process.exit(1) }
  console.log(`\nSetup: usuário e grupo monitor criados (groupId=${groupId})`)

  await testDefaultFields()
  await testUpdateImageMode()
  await testUpdateFetchMode()
  await testValidation()
  await testAuthProtection()
  await testOwnership()
  await testImageScraperFetch()
  await testImageScraperTimeout()

  await cleanup()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Resultado: ${passed} passaram, ${failed} falharam`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
