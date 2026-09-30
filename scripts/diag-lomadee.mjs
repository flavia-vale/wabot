// Diagnóstico da Lomadee (SOMENTE LEITURA) — docs/plano-integracao-lomadee.md, seção 13.5.
// Uso (na VPS, no diretório do ambiente):
//   LOMADEE_KEY='<chave>' node scripts/diag-lomadee.mjs [--nome="Up4you"] [--timeout=120]
// A chave vem SÓ da variável de ambiente e nunca é impressa nem gravada.
// Mede: tempo de cada chamada, canais, lojas, campanhas "Oferta" ativas, o
// formato real do campo `channels` e se a oferta procurada aparece.

const BASE = 'https://api.lomadee.com.br'
const key = process.env.LOMADEE_KEY
const arg = (name, fallback) => {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const timeoutMs = Math.max(5, Number(arg('timeout', 120))) * 1000
const wanted = String(arg('nome', 'Up4you'))

if (!key) {
  console.error("Falta a chave. Rode: LOMADEE_KEY='sua-chave' node scripts/diag-lomadee.mjs")
  process.exit(1)
}

async function call(path, params = {}, limitMs = timeoutMs) {
  const url = new URL(path, BASE)
  for (const [name, value] of Object.entries(params)) {
    for (const item of [].concat(value)) url.searchParams.append(name, String(item))
  }
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), limitMs)
  try {
    const response = await fetch(url, { headers: { 'x-api-key': key }, signal: controller.signal })
    const text = await response.text()
    let body = null
    try { body = JSON.parse(text) } catch { /* corpo não-JSON */ }
    return { ok: response.ok, status: response.status, ms: Date.now() - started, body, rate: response.headers.get('x-ratelimit-remaining') }
  } catch (error) {
    return { ok: false, status: error?.name === 'AbortError' ? `timeout ${limitMs / 1000}s` : `erro ${error?.code || error?.message}`, ms: Date.now() - started, body: null }
  } finally {
    clearTimeout(timer)
  }
}

const line = (label, result, extra = '') => console.log(`${label.padEnd(34)} status=${result.status} tempo=${result.ms}ms ${extra}`.trim())
const cut = (value, size = 300) => JSON.stringify(value)?.slice(0, size)

const channels = await call('/affiliate/channels')
line('canais', channels, `qtd=${channels.body?.count ?? '?'}`)
for (const channel of channels.body?.data ?? []) console.log(`  canal id=${channel.id} nome="${channel.name}" ativo=${channel.active}`)

const brands = await call('/affiliate/brands', { limit: 20, page: 1 })
line('lojas (pág. 1)', brands, `total=${brands.body?.pagination?.total ?? '?'} páginas=${brands.body?.pagination?.totalPages ?? '?'}`)
const brandNames = new Map((brands.body?.data ?? []).map((brand) => [brand.id, brand.name]))

// Medido em 2026-09-30: a listagem de campanhas SEM filtro de nome/loja é INSTÁVEL (travou 6 vezes seguidas por 45 s e depois respondeu em 3,7 s)
// (intermitente). Com `name` ou `organizationIds` responde em 1–7 s.
const semFiltro = await call('/affiliate/campaigns', { types: 'Offer', status: 'onTime', limit: 20, page: 1 }, 20000)
line('campanhas SEM filtro (instável)', semFiltro)

const offers = await call('/affiliate/campaigns', { types: 'Offer', status: 'onTime', name: '%', limit: 20, page: 1 })
line('campanhas Oferta ativas (name=%)', offers, `total=${offers.body?.meta?.total ?? '?'} páginas=${offers.body?.meta?.totalPages ?? '?'}`)
const list = offers.body?.data ?? []
const permanentes = list.filter((item) => !item.period).length
console.log(`  nesta página: ${list.length} campanhas, ${permanentes} permanentes (sem data de fim)`)
for (const item of list.slice(0, 5)) {
  console.log(`  - "${String(item.name).slice(0, 70)}" loja=${brandNames.get(item.organizationId) ?? item.organizationId} fim=${item.period?.endAt ?? 'permanente'} tipo=${item.offerType} url=${String(item.url ?? '').slice(0, 60)}`)
}
if (list[0]) {
  console.log(`  formato de channels (1ª): ${cut(list[0].channels)}`)
  console.log(`  descrição (1ª, 200 caracteres): ${cut(String(list[0].description ?? '').slice(0, 200), 260)}`)
}

const scheduled = await call('/affiliate/campaigns', { types: 'Offer', status: 'scheduled', name: '%', limit: 5, page: 1 })
line('campanhas Oferta agendadas', scheduled, `total=${scheduled.body?.meta?.total ?? '?'}`)

const search = await call('/affiliate/campaigns', { types: 'Offer', name: wanted, limit: 5, page: 1 })
line(`busca por nome "${wanted}"`, search, `achou=${search.body?.data?.length ?? 0}`)
for (const item of (search.body?.data ?? []).slice(0, 3)) {
  console.log(`  - "${item.name}" status=${item.status} fim=${item.period?.endAt ?? 'permanente'} url=${item.url} channels=${cut(item.channels, 200)}`)
}

const products = await call('/affiliate/products', { limit: 1 })
line('produtos (só para medir tempo)', products, `total=${products.body?.count ?? '?'}`)
