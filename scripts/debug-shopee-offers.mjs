/**
 * Script de diagnóstico: chama a API Shopee com os mesmos parâmetros
 * que o trigger de automação usaria, e loga tudo sobre a resposta.
 *
 * Uso:
 *   DATABASE_URL=file:./prisma/prod.db node scripts/debug-shopee-offers.mjs <automationId>
 *
 * Exemplo:
 *   DATABASE_URL=file:./prisma/staging.db node scripts/debug-shopee-offers.mjs cmpvhiecr0001127p06xh9sg4
 */
import { PrismaClient } from '@prisma/client'
import axios from 'axios'
import crypto from 'crypto'

const automationId = process.argv[2]
if (!automationId) {
  console.error('Uso: node scripts/debug-shopee-offers.mjs <automationId>')
  process.exit(1)
}

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'
const PRICE_DIVISOR = 100_000

const db = new PrismaClient()

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto
    .createHash('sha256')
    .update(`${appId}${timestamp}${payload}${secretKey}`)
    .digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sig}`
}

function fmt(raw) {
  const n = Number(raw)
  return n ? `R$${(n / PRICE_DIVISOR).toFixed(2)}` : 'N/A'
}

async function run() {
  const automation = await db.offerAutomation.findUnique({ where: { id: automationId } })
  if (!automation) { console.error('Automação não encontrada:', automationId); process.exit(1) }

  console.log('\n=== AUTOMAÇÃO ===')
  console.log(`  keyword:       "${automation.keyword}"`)
  console.log(`  minDiscountPct: ${automation.minDiscountPct}%`)
  console.log(`  offersPerSend:  ${automation.offersPerSend}`)
  console.log(`  sortType:       ${automation.sortType}`)
  console.log(`  isAMSOffer:     ${automation.isAMSOffer}`)
  console.log(`  isKeySeller:    ${automation.isKeySeller}`)

  const credRow = await db.credential.findUnique({
    where: { userId_platform: { userId: automation.userId, platform: 'shopee' } },
  })
  if (!credRow) { console.error('SEM credencial Shopee para userId:', automation.userId); process.exit(1) }

  let creds
  try { creds = JSON.parse(credRow.data) } catch { creds = credRow.data }
  const appId = creds?.appId ?? creds?.app_id
  const secretKey = creds?.secretKey ?? creds?.secret_key
  if (!appId || !secretKey) { console.error('Credenciais Shopee inválidas:', Object.keys(creds ?? {})); process.exit(1) }
  console.log(`\n=== CREDENCIAIS ===`)
  console.log(`  appId:     ${String(appId).slice(0, 6)}... (${String(appId).length} chars)`)
  console.log(`  secretKey: ${String(secretKey).slice(0, 4)}... (${String(secretKey).length} chars)`)

  const safeKeyword = automation.keyword.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r]/g, ' ')
  const limit = Math.min(automation.offersPerSend * 4, 100)
  const amsParam = automation.isAMSOffer ? ', isAMSOffer: true' : ''
  const keySellerParam = automation.isKeySeller ? ', isKeySeller: true' : ''
  const query = `{
    productOfferV2(
      keyword: "${safeKeyword}",
      listType: 2,
      sortType: ${automation.sortType ?? 2},
      page: 1,
      limit: ${limit}${amsParam}${keySellerParam}
    ) {
      nodes {
        itemId shopId productName imageUrl offerLink
        price priceMin priceMax originPrice priceDiscountRate
        commissionRate sales ratingStar
      }
    }
  }`

  const body = { query }
  const payload = JSON.stringify(body)
  const authHeader = buildAuth(appId, secretKey, payload)

  console.log('\n=== REQUISIÇÃO ===')
  console.log(`  endpoint: ${ENDPOINT}`)
  console.log(`  limit: ${limit}`)
  console.log(`  Authorization (início): ${authHeader.slice(0, 60)}...`)

  let response
  try {
    response = await axios.post(ENDPOINT, body, {
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      timeout: 15000,
    })
  } catch (err) {
    console.error('\n=== ERRO HTTP ===')
    console.error('  status:', err.response?.status)
    console.error('  body:', JSON.stringify(err.response?.data))
    process.exit(1)
  }

  const { data } = response

  console.log('\n=== RESPOSTA BRUTA ===')
  console.log('  HTTP status:', response.status)
  if (data?.errors) console.log('  errors:', JSON.stringify(data.errors, null, 2))
  if (!data?.data) console.log('  data.data: NULL/UNDEFINED — a API retornou erro ou estrutura inesperada')

  const nodes = data?.data?.productOfferV2?.nodes ?? []
  console.log(`\n  nodes retornados: ${nodes.length}`)

  if (nodes.length) {
    console.log('\n=== TODOS OS CAMPOS DO PRIMEIRO PRODUTO (raw) ===')
    console.log(JSON.stringify(nodes[0], null, 2))
  }

  if (!nodes.length) {
    console.log('\n  DIAGNÓSTICO: A API retornou 0 produtos. Possíveis causas:')
    console.log('    1. Credenciais inválidas/expiradas (a API às vezes retorna vazio em vez de 401)')
    console.log('    2. Keyword sem produtos afiliados cadastrados')
    console.log('    3. listType: 2 sem resultados para essa keyword')
    console.log('\n  Tente outra keyword popular (ex: "celular", "fone") para confirmar se as creds funcionam.')
    process.exit(0)
  }

  console.log('\n=== PRODUTOS RETORNADOS (antes do filtro) ===')
  for (const o of nodes) {
    const rate = Number(o.priceDiscountRate) || 0
    const origin = Number(o.originPrice) || 0
    const current = Number(o.priceMin ?? o.price) || 0
    const hasRealDiscount = rate > 0 || (origin > 0 && current > 0 && current < origin)
    const passaFiltro = hasRealDiscount && rate >= automation.minDiscountPct

    console.log(`\n  [${passaFiltro ? '✓ PASSA' : '✗ FILTRADO'}] ${o.productName?.slice(0, 60)}`)
    console.log(`    itemId:           ${o.itemId}`)
    console.log(`    priceDiscountRate: ${o.priceDiscountRate} (como número: ${rate})`)
    console.log(`    originPrice:       ${o.originPrice} → ${fmt(o.originPrice)}`)
    console.log(`    priceMin:          ${o.priceMin} → ${fmt(o.priceMin)}`)
    console.log(`    price:             ${o.price} → ${fmt(o.price)}`)
    console.log(`    hasRealDiscount:   ${hasRealDiscount}`)
    console.log(`    minDiscountPct:    ${automation.minDiscountPct}%`)
    if (!passaFiltro) {
      if (!hasRealDiscount) console.log(`    motivo filtro: sem desconto real detectável`)
      else console.log(`    motivo filtro: rate(${rate}) < minDiscountPct(${automation.minDiscountPct})`)
    }
  }

  const passaram = nodes.filter(o => {
    const rate = Number(o.priceDiscountRate) || 0
    const origin = Number(o.originPrice) || 0
    const current = Number(o.priceMin ?? o.price) || 0
    const hasRealDiscount = rate > 0 || (origin > 0 && current > 0 && current < origin)
    return hasRealDiscount && rate >= automation.minDiscountPct
  })

  console.log(`\n=== RESUMO DO FILTRO ===`)
  console.log(`  Total da API: ${nodes.length} produtos`)
  console.log(`  Passaram filtro: ${passaram.length}`)
  console.log(`  Filtrados: ${nodes.length - passaram.length}`)
  if (!passaram.length && nodes.length > 0) {
    const rates = nodes.map(o => Number(o.priceDiscountRate) || 0)
    console.log(`  priceDiscountRate dos produtos: [${rates.join(', ')}]`)
    console.log(`  DIAGNÓSTICO: Todos filtrados. Verifique se priceDiscountRate está em % inteiro (ex: 25 = 25%)`)
    console.log(`  ou decimal (ex: 0.25 = 25%). Se decimal, o filtro nunca vai passar para minDiscountPct >= 10.`)
  }
}

run()
  .catch(err => { console.error('\nERRO INESPERADO:', err.message); process.exit(1) })
  .finally(() => db.$disconnect())
