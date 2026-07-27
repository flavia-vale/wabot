// Diagnóstico read-only do caminho de conversão Amazon para UMA usuária.
//
// Contexto: "não tenho cliques na Amazon desde <data>". As causas possíveis são
// mutuamente excludentes e só os dados de produção separam entre elas:
//   1. a oferta Amazon parou de SAIR (conversão devolvendo null -> mensagem
//      descartada com error:conversion:* / skip:no_valid_conversions);
//   2. a oferta sai, mas o link vai SEM a tag de afiliado (não credita clique);
//   3. a oferta sai com a tag e o problema é do lado da Amazon (relatório/conta).
//
// O script não escreve nada: só lê Credential/MessageLog e faz chamadas de
// leitura à Amazon (resolver short link + probe de sessão SiteStripe). O
// cookie/segredo NUNCA é impresso — só o nome dos cookies e o tamanho.
//
// Uso (na VPS, dentro do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-amazon-clicks.mjs flavia.vale@usp.br
//   cd ~/wabot && node scripts/diag-amazon-clicks.mjs flavia.vale@usp.br https://amzn.to/XXXX
import 'dotenv/config'

const email = process.argv[2]
if (!email) {
  console.error('uso: node scripts/diag-amazon-clicks.mjs <email> [linkAmazonDeTeste]')
  process.exit(1)
}
const linkOverride = process.argv[3] || null

const { default: db } = await import('../src/db.js')
const { decryptCredential } = await import('../src/credentialCrypto.js')
const amazon = await import('../src/converters/amazon.js')

const line = (t) => console.log(`\n===== ${t} =====`)

const user = await db.user.findUnique({ where: { email } })
if (!user) {
  console.error(`usuária não encontrada: ${email}`)
  process.exit(1)
}
line('USUÁRIA')
console.log({ id: user.id, email: user.email, accessExpiresAt: user.accessExpiresAt, plan: user.plan })

line('CREDENCIAL AMAZON')
const cred = await db.credential.findUnique({
  where: { userId_platform: { userId: user.id, platform: 'amazon' } },
})
let creds = null
if (!cred) {
  console.log('NENHUMA credencial amazon cadastrada')
} else {
  try {
    creds = JSON.parse(decryptCredential(cred.data))
  } catch (err) {
    console.log('falha ao decifrar/parsear credencial:', err.message)
  }
  if (creds) {
    const cookieHeader = String(creds.cookie ?? '')
    const cookieNames = cookieHeader
      .split(';')
      .map(part => part.split('=')[0].trim())
      .filter(Boolean)
    console.log({
      campos: Object.keys(creds),
      tag: creds.tag ?? null,
      cookieChars: cookieHeader.length,
      cookiesNomeados: cookieNames,
      legadoUbid: Boolean(creds['ubid-acbbr']),
      legadoAt: Boolean(creds['at-acbbr']),
      legadoX: Boolean(creds['x-acbbr']),
    })
  }
}

line('ENVIOS AMAZON POR DIA (últimos 30 dias)')
const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const logs = await db.messageLog.findMany({
  where: { userId: user.id, platform: 'amazon', sentAt: { gte: since } },
  select: { sentAt: true, status: true, errorMsg: true, convertedUrl: true, originalUrl: true },
  orderBy: { sentAt: 'desc' },
})
const byDay = new Map()
for (const row of logs) {
  const day = row.sentAt.toISOString().slice(0, 10)
  const key = `${day}|${row.status}|${row.errorMsg || '-'}`
  byDay.set(key, (byDay.get(key) || 0) + 1)
}
if (!byDay.size) console.log('nenhum MessageLog platform=amazon nos últimos 30 dias')
for (const [key, n] of [...byDay.entries()].sort().reverse()) {
  const [day, status, err] = key.split('|')
  console.log(`${day}  ${String(n).padStart(4)}  ${status.padEnd(8)} ${err}`)
}

line('COMO O LINK SAIU (amostra de sucessos, antes x depois)')
const ok = logs.filter(r => r.status === 'success' && r.convertedUrl)
const classify = (url) => {
  if (/amzn\.to|a\.co/.test(url)) return 'amzn.to (SiteStripe)'
  if (/[?&]tag=/.test(url)) return '?tag= (fallback longo)'
  return 'SEM TAG (não credita!)'
}
const shape = new Map()
for (const row of ok) {
  const key = `${row.sentAt.toISOString().slice(0, 10)}|${classify(row.convertedUrl)}`
  shape.set(key, (shape.get(key) || 0) + 1)
}
for (const [key, n] of [...shape.entries()].sort().reverse()) {
  const [day, kind] = key.split('|')
  console.log(`${day}  ${String(n).padStart(4)}  ${kind}`)
}
console.log('\núltimos 5 links convertidos:')
for (const row of ok.slice(0, 5)) {
  console.log(`  ${row.sentAt.toISOString()}  ${row.convertedUrl}`)
}

line('PROBE AO VIVO — SESSÃO SITESTRIPE')
if (!creds) {
  console.log('sem credencial utilizável, pulando')
} else {
  const probe = await amazon.checkAmazonSession(creds)
  console.log({ configured: probe.configured, alive: probe.alive, reason: probe.reason })
}

line('PROBE AO VIVO — RESOLUÇÃO DE SHORT LINK + CONVERSÃO')
const lastShort = logs.find(r => /amzn\.to|amzn\.la|a\.co|amzn\.divulgador\.link|amzlink\.to|link\.amazon/.test(r.originalUrl || ''))
const testUrl = linkOverride || lastShort?.originalUrl || null
if (!testUrl) {
  console.log('nenhum short link Amazon recente no log e nenhum informado por argumento — passe um como 2º argumento')
} else if (!creds) {
  console.log('sem credencial utilizável, pulando')
} else {
  console.log('link de teste:', testUrl)
  const resolved = await amazon.resolveAmazonShortLink(testUrl)
  console.log('resolvido para:', resolved)
  console.log('achou ASIN?:', /\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i.test(resolved))
  const converted = await amazon.convert(testUrl, creds)
  console.log('convert():', converted)
  console.log('COUPON_LINK_CONVERT =', process.env.COUPON_LINK_CONVERT ?? '(ausente)')
}

await db.$disconnect()
