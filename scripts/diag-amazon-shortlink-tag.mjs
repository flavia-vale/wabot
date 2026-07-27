// Verifica para QUAL tag de afiliado os short links amzn.to que já enviamos
// realmente resolvem.
//
// Hipótese sob teste: em `createAmazonShortLink` (src/converters/amazon.js) o
// `longUrl` passado ao endpoint getShortUrl do SiteStripe é construído por
// `buildLongUrl`, que devolve a URL do produto SEM `?tag=`; a tag vai só como
// query param separado (`tag=`) da chamada. Se a Amazon encurtar o `longUrl`
// como recebido e ignorar esse param, o amzn.to gerado nasce SEM tag — a
// oferta sai, é clicada, e nenhum clique é creditado.
//
// O teste é direto: pegar amzn.to reais já gravados em MessageLog, seguir os
// redirects e ler o parâmetro `tag` da URL final.
//
// Read-only: não escreve no banco, só faz GET nos próprios links.
//
// Uso: cd ~/wabot && node scripts/diag-amazon-shortlink-tag.mjs flavia.vale@usp.br
import 'dotenv/config'

const email = process.argv[2]
if (!email) {
  console.error('uso: node scripts/diag-amazon-shortlink-tag.mjs <email>')
  process.exit(1)
}

const { default: db } = await import('../src/db.js')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Segue redirects manualmente com cookie jar (o fetch do Node não propaga
// Set-Cookie entre hops, e a Amazon usa isso na cadeia do amzn.to).
async function followChain(startUrl, maxHops = 8) {
  let current = startUrl
  const jar = new Map()
  const chain = [current]
  for (let hop = 0; hop < maxHops; hop++) {
    let res
    try {
      const cookie = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ')
      res = await fetch(current, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      })
    } catch (err) {
      return { chain, final: current, error: err.message }
    }
    try {
      for (const raw of res.headers.getSetCookie?.() || []) {
        const pair = raw.split(';')[0]
        const eq = pair.indexOf('=')
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
      }
    } catch {}
    const location = res.headers.get('location')
    if (!location) return { chain, final: current, status: res.status }
    try {
      current = new URL(location, current).href
    } catch {
      return { chain, final: current, status: res.status }
    }
    chain.push(current)
  }
  return { chain, final: current, truncated: true }
}

const tagOf = (url) => {
  try {
    return new URL(url).searchParams.get('tag')
  } catch {
    return null
  }
}

const user = await db.user.findUnique({ where: { email } })
if (!user) {
  console.error(`usuária não encontrada: ${email}`)
  process.exit(1)
}

const rows = await db.messageLog.findMany({
  where: {
    userId: user.id,
    platform: 'amazon',
    status: 'success',
    convertedUrl: { contains: 'amzn.to' },
  },
  select: { sentAt: true, convertedUrl: true },
  orderBy: { sentAt: 'desc' },
  take: 400,
})

console.log(`amzn.to gravados em MessageLog: ${rows.length}`)
if (!rows.length) {
  console.log('nenhum amzn.to encontrado — nada a testar')
  await db.$disconnect()
  process.exit(0)
}

// Amostra distribuída: links distintos, do mais recente para o mais antigo.
const seen = new Set()
const sample = []
for (const row of rows) {
  if (seen.has(row.convertedUrl)) continue
  seen.add(row.convertedUrl)
  sample.push(row)
  if (sample.length >= 8) break
}

console.log(`\ntestando ${sample.length} short links distintos:\n`)
const tally = new Map()
for (const row of sample) {
  const result = await followChain(row.convertedUrl)
  const tag = tagOf(result.final)
  const key = tag === null ? 'SEM TAG' : tag
  tally.set(key, (tally.get(key) || 0) + 1)
  console.log(`enviado em : ${row.sentAt.toISOString()}`)
  console.log(`short link : ${row.convertedUrl}`)
  console.log(`final      : ${result.final}`)
  console.log(`tag final  : ${tag === null ? '>>> NENHUMA <<<' : tag}`)
  if (result.error) console.log(`erro       : ${result.error}`)
  console.log(`hops       : ${result.chain.length}`)
  console.log('')
}

console.log('===== RESUMO — tag creditada pelos amzn.to =====')
for (const [tag, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(n).padStart(3)}  ${tag}`)
}

await db.$disconnect()
