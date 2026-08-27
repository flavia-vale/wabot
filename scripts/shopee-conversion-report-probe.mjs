// Prova técnica SOMENTE LEITURA da API de Afiliados da Shopee.
//
// Não importa nem altera o runtime da API/bot, não grava no banco e não gera
// links. A única consulta ao banco é a leitura da credencial Shopee escolhida;
// externamente, envia apenas uma query GraphQL de relatório.
//
// Uso em staging:
//   node scripts/shopee-conversion-report-probe.mjs --list-users
//   node scripts/shopee-conversion-report-probe.mjs --days 1
// Se houver mais de uma credencial, aí sim informe --user-id com um ID listado.
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

const TYPE_REF = 'kind name ofType { kind name ofType { kind name ofType { kind name } } }'

export function buildTypeQuery(typeName) {
  return `query { __type(name: "${typeName}") { name fields { name args { name type { ${TYPE_REF} } } type { ${TYPE_REF} } } } }`
}

function namedType(type) {
  let current = type
  while (current?.ofType) current = current.ofType
  return current
}

function hasRequiredArguments(field) {
  return (field?.args ?? []).some(arg => arg?.type?.kind === 'NON_NULL')
}

export async function discoverSelection(rootTypeName, inspectType, maxDepth = 3) {
  const cache = new Map()
  async function fieldsFor(typeName, depth, ancestors) {
    if (depth > maxDepth || ancestors.has(typeName)) return []
    let type = cache.get(typeName)
    if (!type) {
      type = await inspectType(typeName)
      if (!type?.fields) throw new Error(`A introspecção não retornou os campos do tipo ${typeName}.`)
      cache.set(typeName, type)
    }
    const selections = []
    for (const field of type.fields) {
      if (hasRequiredArguments(field)) continue
      const leaf = namedType(field.type)
      if (['SCALAR', 'ENUM'].includes(leaf?.kind)) selections.push(field.name)
      else if (['OBJECT', 'INTERFACE'].includes(leaf?.kind)) {
        const children = await fieldsFor(leaf.name, depth + 1, new Set([...ancestors, typeName]))
        if (children.length) selections.push(`${field.name} { ${children.join(' ')} }`)
      }
    }
    return selections
  }
  return fieldsFor(rootTypeName, 0, new Set())
}

export function buildConversionReportQuery({ start, end, selection }) {
  if (!Array.isArray(selection) || selection.length === 0) throw new Error('Seleção dinâmica do relatório vazia.')
  return `query {
    conversionReport(purchaseTimeStart: ${start}, purchaseTimeEnd: ${end}) {
      nodes { ${selection.join(' ')} }
      pageInfo { scrollId hasNextPage }
    }
  }`
}

export function summarizeReport(nodes = []) {
  const byStatus = {}
  let tagged = 0
  const commissionTotals = {}
  function visit(value, path = '') {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`))
    if (!value || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key
      if (/status$/i.test(key) && child != null && typeof child !== 'object') {
        const status = `${childPath}=${String(child)}`
        byStatus[status] = (byStatus[status] || 0) + 1
      }
      if (/sub.?id|referrer/i.test(key) && String(child).toLowerCase() === EXPECTED_SUB_ID) tagged++
      if (/commission/i.test(key) && Number.isFinite(Number(child))) {
        commissionTotals[childPath] = (commissionTotals[childPath] || 0) + Number(child)
      }
      visit(child, childPath)
    }
  }
  for (const row of nodes) {
    visit(row)
  }
  return { rows: nodes.length, taggedEspelhaGrupos: tagged, byStatus, commissionTotals }
}

export function credentialNotFoundHint(total) {
  return total === 1
    ? 'Há apenas uma credencial Shopee neste ambiente; rode novamente sem --user-id para selecioná-la automaticamente.'
    : 'Rode --list-users e copie exatamente um dos IDs listados.'
}

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto.createHash('sha256').update(`${appId}${timestamp}${payload}${secretKey}`).digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
}

async function requestGraphql({ appId, secretKey }, query) {
  const body = { query }
  const payload = JSON.stringify(body)
  const { data } = await axios.post(ENDPOINT, body, {
    headers: { Authorization: buildAuth(appId, secretKey, payload), 'Content-Type': 'application/json' },
    timeout: 15000,
  })
  if (data?.errors?.length) {
    const errors = data.errors.map(({ code, message, path }) => ({ code, message, path }))
    throw new Error(`A Shopee recusou a consulta: ${JSON.stringify(errors)}`)
  }
  return data?.data
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
  if (!row) {
    const total = await prisma.credential.count({ where: { platform: 'shopee' } })
    const hint = credentialNotFoundHint(total)
    throw new Error(`Credencial Shopee não encontrada para o userId informado. ${hint}`)
  }
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
  const credentials = { appId, secretKey }
  const selection = await discoverSelection('ConversionReport', async typeName => {
    const data = await requestGraphql(credentials, buildTypeQuery(typeName))
    return data?.__type
  })
  const data = await requestGraphql(credentials, buildConversionReportQuery({ start, end, selection }))
  if (!data?.conversionReport) throw new Error('Resposta sem data.conversionReport.')
  return { ...data.conversionReport, discoveredSelection: selection }
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
    discoveredSelection: report.discoveredSelection,
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
