// Prova técnica SOMENTE LEITURA da API de Afiliados da Shopee.
//
// Não importa nem altera o runtime da API/bot, não grava no banco e não gera
// links. A única consulta ao banco é a leitura da credencial Shopee escolhida;
// externamente, envia apenas uma query GraphQL de relatório.
//
// Uso em staging:
//   node scripts/shopee-conversion-report-probe.mjs --list-users
//   node scripts/shopee-conversion-report-probe.mjs --user-id <ID> --days 1
//
// Por segurança, o resultado padrão é agregado e não imprime orderId,
// conversionId ou nomes de produtos. Use --show-sample apenas se for necessário
// confirmar os campos e não cole essa saída em tickets públicos.
import 'dotenv/config'
import axios from 'axios'
import crypto from 'node:crypto'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'
const EXPECTED_SUB_ID = 'espelhagrupos'
const MAX_DAYS = 7

let prisma
let decryptCredential

async function loadDatabaseDependencies() {
  if (prisma) return
  const [dbModule, cryptoModule] = await Promise.all([
    import('../src/db.js'),
    import('../src/credentialCrypto.js'),
  ])
  prisma = dbModule.default
  decryptCredential = cryptoModule.decryptCredential
}

export function parseArgs(argv) {
  const args = { days: 1, listUsers: false, showSample: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--list-users') args.listUsers = true
    else if (arg === '--show-sample') args.showSample = true
    else if (arg === '--user-id') args.userId = argv[++i]
    else if (arg === '--days') args.days = Number(argv[++i])
    else throw new Error(`Argumento desconhecido: ${arg}`)
  }
  if (!Number.isInteger(args.days) || args.days < 1 || args.days > MAX_DAYS) {
    throw new Error(`--days deve ser um inteiro entre 1 e ${MAX_DAYS}`)
  }
  return args
}

export function buildConversionReportQuery({ start, end }) {
  return `query {
    conversionReport(purchaseTimeStart: ${start}, purchaseTimeEnd: ${end}) {
      nodes {
        purchaseTime clickTime conversionId orderId checkoutId
        itemId itemName itemPrice commissionRate estimatedCommission
        buyerType referrer status subId1 subId2 subId3 subId4 subId5
      }
      pageInfo { scrollId hasNextPage }
    }
  }`
}

export function summarizeReport(nodes = []) {
  const byStatus = {}
  let tagged = 0
  let estimatedCommission = 0
  for (const row of nodes) {
    const status = String(row?.status || 'unknown')
    byStatus[status] = (byStatus[status] || 0) + 1
    if ([row?.subId1, row?.subId2, row?.subId3, row?.subId4, row?.subId5].includes(EXPECTED_SUB_ID)) tagged++
    estimatedCommission += Number(row?.estimatedCommission) || 0
  }
  return { rows: nodes.length, taggedEspelhaGrupos: tagged, byStatus, estimatedCommission }
}

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto.createHash('sha256').update(`${appId}${timestamp}${payload}${secretKey}`).digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
}

async function loadShopeeCredentials(userId) {
  await loadDatabaseDependencies()
  const rows = await prisma.credential.findMany({
    where: { platform: 'shopee', ...(userId ? { userId } : {}) },
    select: { userId: true, data: true },
  })
  if (!userId) {
    if (rows.length === 0) throw new Error('Nenhuma credencial Shopee encontrada neste ambiente.')
    if (rows.length > 1) throw new Error('Há mais de uma conta Shopee. Informe --user-id para evitar consultar a conta errada.')
  }
  const row = rows[0]
  if (!row) throw new Error(`Credencial Shopee não encontrada para userId=${userId}`)
  const credentials = JSON.parse(decryptCredential(row.data))
  if (!credentials.appId || !credentials.secretKey) throw new Error('Credencial Shopee sem appId/secretKey.')
  return { userId: row.userId, appId: credentials.appId, secretKey: credentials.secretKey }
}

async function listUsers() {
  await loadDatabaseDependencies()
  const rows = await prisma.credential.findMany({
    where: { platform: 'shopee' },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  })
  console.log(JSON.stringify({ shopeeCredentialUsers: rows.map(row => row.userId) }, null, 2))
}

async function requestReport({ appId, secretKey, days }) {
  const end = Math.floor(Date.now() / 1000)
  const start = end - days * 24 * 60 * 60
  const body = { query: buildConversionReportQuery({ start, end }) }
  const payload = JSON.stringify(body)
  const { data } = await axios.post(ENDPOINT, body, {
    headers: { Authorization: buildAuth(appId, secretKey, payload), 'Content-Type': 'application/json' },
    timeout: 15000,
  })
  if (data?.errors?.length) {
    const errors = data.errors.map(({ code, message, path }) => ({ code, message, path }))
    throw new Error(`A Shopee recusou a consulta: ${JSON.stringify(errors)}`)
  }
  if (!data?.data?.conversionReport) throw new Error('Resposta sem data.conversionReport.')
  return data.data.conversionReport
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.listUsers) return listUsers()

  const credentials = await loadShopeeCredentials(args.userId)
  const report = await requestReport({ ...credentials, days: args.days })
  const output = {
    readOnly: true,
    userId: credentials.userId,
    periodDays: args.days,
    summary: summarizeReport(report.nodes),
    pageInfo: report.pageInfo ?? null,
  }
  if (args.showSample) output.sample = report.nodes?.slice(0, 3) ?? []
  console.log(JSON.stringify(output, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch(err => {
      const remote = err?.response?.data
      console.error(remote ? JSON.stringify(remote, null, 2) : err.message)
      process.exitCode = 1
    })
    .finally(() => prisma?.$disconnect())
}
