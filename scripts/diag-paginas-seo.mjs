// Diagnóstico read-only por PÁGINA: quantos chegaram, quantos clicaram no CTA e
// quantos se cadastraram.
//
// Responde a pergunta que faltava em 2026-08-17: `/bot-achadinhos-whatsapp`
// recebeu 529 impressões no Google e 11 cliques — e não havia como saber o que
// aqueles 11 fizeram na página. Sem esse número, decidir entre "mexer no título"
// (trazer mais gente) e "mexer na página" (converter quem já chegou) é chute.
//
// Cruza três eventos de `AnalyticsEvent`:
//
//   1. organic_page_view  — chegou na página
//   2. organic_cta_click  — clicou em algum CTA (qual, e em que posição)
//   3. signup_created     — criou conta, com `landing_page` = primeira página da
//                           sessão (cookie first-touch)
//
// Nada é escrito. Só leitura.
//
// Uso (na VPS, DENTRO do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-paginas-seo.mjs
//   cd ~/wabot && node scripts/diag-paginas-seo.mjs --dias 30
//   cd ~/wabot && node scripts/diag-paginas-seo.mjs --pagina /bot-achadinhos-whatsapp
//
// ATENÇÃO — o rastreamento de visita e de clique só passou a ser GRAVADO no
// deploy de 2026-08-17. Antes disso os dois eventos existiam no código do
// navegador mas não estavam nas allowlists que autorizam a gravação
// (`PUBLIC_PERSISTED_EVENTS` no dashboard e `PUBLIC_ANALYTICS_EVENTS` na API),
// então eram descartados em silêncio. Não existe histórico anterior a essa data:
// se o script vier vazio, é isso, não é bug.

import db from '../src/db.js'

const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const dias = Number(flag('dias', '30'))
const filtroPagina = flag('pagina')
const desde = new Date(Date.now() - dias * 864e5)

// Data em que os dois eventos entraram nas allowlists. Serve para não deixar a
// pessoa concluir "a página não recebe visita" quando o que falta é histórico.
const RASTREAMENTO_DESDE = '2026-08-17'

const pct = (n, t) => (t ? `${((n / t) * 100).toFixed(1)}%` : '—')

function parse(ev) {
  try { return JSON.parse(ev.metadata || '{}') } catch { return {} }
}

// A página vem em `page_path` (normalizada pela rota pública a partir do
// `pathname` do navegador) ou em `path`/`slug` do contexto de rota do tracker.
// Aceita as três porque páginas de templates diferentes preenchem diferente.
function paginaDoEvento(m) {
  const bruto = m.page_path || m.path || (m.slug ? `/${m.slug}` : '')
  return String(bruto).split('?')[0] || '(sem registro)'
}

function titulo(t) {
  console.log(`\n${'='.repeat(76)}\n${t}\n${'='.repeat(76)}`)
}

async function main() {
  const [visitas, cliques, signups] = await Promise.all([
    db.analyticsEvent.findMany({ where: { event: 'organic_page_view', createdAt: { gte: desde } } }),
    db.analyticsEvent.findMany({ where: { event: 'organic_cta_click', createdAt: { gte: desde } } }),
    db.analyticsEvent.findMany({ where: { event: 'signup_created', createdAt: { gte: desde } } }),
  ])

  console.log(`\nPeríodo: últimos ${dias} dias (desde ${desde.toISOString().slice(0, 10)})`)
  if (filtroPagina) console.log(`Filtro de página: ${filtroPagina}`)

  if (!visitas.length && !cliques.length) {
    titulo('SEM DADO DE VISITA NO PERÍODO')
    console.log(`
  Nenhum 'organic_page_view' nem 'organic_cta_click' gravado.

  Se hoje é próximo de ${RASTREAMENTO_DESDE}, isso é ESPERADO: os dois eventos só
  passaram a ser gravados nessa data. Antes eram descartados em silêncio por
  faltarem nas allowlists.

  Se já passou tempo suficiente e continua vazio, conferir nesta ordem:
    1. 'organic_page_view' está em PUBLIC_ANALYTICS_EVENTS (src/analytics.js)?
    2. E em PUBLIC_PERSISTED_EVENTS (dashboard/lib/analytics.js)?
    3. O dashboard foi reconstruído depois da mudança? (o allowlist do cliente
       vai para o bundle — 'git pull' sem 'npm run build' não aplica)
    4. ANALYTICS_ENABLED não está 'false' no .env?
`)
    return
  }

  const combina = (p) => !filtroPagina || p === filtroPagina

  // ------------------------------------------------------- funil por página ---
  const porPagina = new Map()
  const garante = (p) => {
    if (!porPagina.has(p)) porPagina.set(p, { visitas: 0, cliques: 0, signups: 0, ctas: new Map() })
    return porPagina.get(p)
  }

  for (const ev of visitas) {
    const p = paginaDoEvento(parse(ev))
    if (combina(p)) garante(p).visitas += 1
  }

  for (const ev of cliques) {
    const m = parse(ev)
    const p = paginaDoEvento(m)
    if (!combina(p)) continue
    const linha = garante(p)
    linha.cliques += 1
    const nome = `${m.cta || '?'}${m.cta_position ? ` @${m.cta_position}` : ''}`
    linha.ctas.set(nome, (linha.ctas.get(nome) || 0) + 1)
  }

  for (const ev of signups) {
    const m = parse(ev)
    // `landing_page` do signup usa o mesmo sanitizador de atribuição, que troca
    // '?' e '=' por '-'. Cortar em '?' não basta: separa no primeiro '-?'.
    const bruto = String(m.landing_page || '')
    if (!bruto) continue
    const p = bruto.split('?')[0].replace(/-utm[-_].*$/, '') || '(sem registro)'
    if (combina(p)) garante(p).signups += 1
  }

  titulo(`FUNIL POR PÁGINA — ${porPagina.size} páginas com atividade`)
  console.log('\n  página                                        visitas  cliques   CTA%  cadastros')
  console.log('  --------------------------------------------  -------  -------  -----  ---------')

  const ordenado = [...porPagina.entries()].sort((a, b) => b[1].visitas - a[1].visitas)
  for (const [p, d] of ordenado) {
    console.log(
      `  ${p.slice(0, 44).padEnd(44)}  ${String(d.visitas).padStart(7)}  ${String(d.cliques).padStart(7)}  ` +
      `${pct(d.cliques, d.visitas).padStart(5)}  ${String(d.signups).padStart(9)}`
    )
  }

  // --------------------------------------------------------- qual CTA ganha ---
  titulo('QUAL CTA RECEBE O CLIQUE')
  console.log('\n  Uma página com visita e nenhum clique tem problema de página.')
  console.log('  Uma página sem visita tem problema de título no Google — outro conserto.\n')

  for (const [p, d] of ordenado) {
    if (!d.ctas.size) continue
    console.log(`  ${p}`)
    for (const [nome, n] of [...d.ctas.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(n).padStart(4)}  ${nome}`)
    }
  }

  const semClique = ordenado.filter(([, d]) => d.visitas >= 5 && d.cliques === 0)
  if (semClique.length) {
    console.log('\n  Páginas com 5+ visitas e ZERO clique (candidatas a mexer na página):')
    for (const [p, d] of semClique) console.log(`      ${String(d.visitas).padStart(4)} visitas   ${p}`)
  }

  // ------------------------------------------------------------- totais ---
  const totalVisitas = ordenado.reduce((s, [, d]) => s + d.visitas, 0)
  const totalCliques = ordenado.reduce((s, [, d]) => s + d.cliques, 0)
  const totalSignups = ordenado.reduce((s, [, d]) => s + d.signups, 0)

  titulo('RESUMO')
  console.log(`
  Visitas registradas .................. ${totalVisitas}
  Cliques em CTA ....................... ${totalCliques} (${pct(totalCliques, totalVisitas)} das visitas)
  Cadastros atribuídos a uma página .... ${totalSignups}

  Como decidir com isso:

  * Muita impressão no Google e POUCA visita aqui  -> conserto é título e
    descrição da página (o Google mostra, ninguém clica).
  * Muita visita e POUCO clique em CTA             -> conserto é a página
    (a pessoa chegou e não se convenceu, ou não achou o que buscou).
  * Muito clique e POUCO cadastro                  -> conserto é o cadastro,
    não a página — ver scripts/diag-funil-ativacao.mjs.

  As impressões do Google não estão aqui: elas vêm do Search Console
  (docs/marketing/COLETA_DADOS_KEYWORDS_PASSO_A_PASSO.md, Relatório 1).
`)
}

main()
  .catch((err) => {
    console.error('\nFalhou:', err?.message || err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
