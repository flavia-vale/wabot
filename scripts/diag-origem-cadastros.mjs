// Diagnóstico read-only: DE ONDE vieram os cadastros (e quais viraram pagante).
//
// Responde a pergunta "os clientes estão chegando por SEO?" com dado em vez de
// impressão. Cruza três fontes que já existem:
//
//   1. AnalyticsEvent 'signup_created' — a origem declarada no momento do
//      cadastro: source, utm_*, landing_page (FIRST touch, via cookie) e gclid.
//   2. Payment  — quem virou pagante de fato, e quanto tempo levou.
//   3. AnalyticsEvent 'referral_visit' — de onde vieram as VISITAS (IA / busca /
//      social), disponível a partir de 04/08/2026.
//
// Nada é escrito. Só leitura.
//
// Uso (na VPS, DENTRO do diretório do ambiente — o .env aponta o banco certo):
//   cd ~/wabot && node scripts/diag-origem-cadastros.mjs
//   cd ~/wabot && node scripts/diag-origem-cadastros.mjs --dias 30
//   cd ~/wabot && node scripts/diag-origem-cadastros.mjs --desde 2026-06-01
//
// ATENÇÃO ao ler o resultado — atribuição é aproximação, não verdade absoluta:
//
//   * "direct" NÃO significa "veio sozinho". A pessoa pode ter achado no
//     Google, fechado, e voltado dias depois digitando o endereço. Esse caso
//     aparece como direto e o SEO fica sem crédito.
//   * `landing_page` é a PRIMEIRA página da sessão (cookie first-touch). É o
//     sinal mais honesto de qual conteúdo trouxe a pessoa — mais do que o
//     utm_source, que só existe se o link tinha parâmetro.
//   * Cadastro por página de conteúdo (/blog/..., /alternativas/...) é
//     evidência FORTE de SEO: ninguém digita esse endereço de cabeça.
//   * Cadastro com landing_page = '/' ou '/login' é ambíguo.

import db from '../src/db.js'

const args = process.argv.slice(2)
function flag(name, fallback = null) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const dias = Number(flag('dias', '90'))
const desdeArg = flag('desde')
const desde = desdeArg ? new Date(`${desdeArg}T00:00:00`) : new Date(Date.now() - dias * 864e5)

const fmt = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ')
const pct = (n, total) => (total ? `${((n / total) * 100).toFixed(0)}%` : '0%')

function titulo(t) {
  console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`)
}

function tabela(mapa, total, rotulo) {
  const linhas = [...mapa.entries()].sort((a, b) => b[1] - a[1])
  if (!linhas.length) {
    console.log('  (nada no período)')
    return
  }
  const largura = Math.max(rotulo.length, ...linhas.map(([k]) => String(k).length))
  console.log(`  ${rotulo.padEnd(largura)}  qtd   %`)
  console.log(`  ${'-'.repeat(largura)}  ---  ----`)
  for (const [k, v] of linhas) {
    console.log(`  ${String(k).padEnd(largura)}  ${String(v).padStart(3)}  ${pct(v, total).padStart(4)}`)
  }
}

// Classifica a página de entrada em "isso é conteúdo de SEO?" — a distinção
// que responde a pergunta original.
function classificaLanding(landing) {
  const p = String(landing || '').split('?')[0]
  if (!p) return 'sem registro'
  if (p.startsWith('/blog/')) return 'CONTEÚDO (blog)'
  if (p.startsWith('/alternativas/')) return 'CONTEÚDO (comparativo)'
  if (p.startsWith('/materiais/') || p.startsWith('/ferramentas/')) return 'CONTEÚDO (ferramenta/material)'
  if (/^\/(bot-|anti-ban|faq-antiban|protecao-|programa-de-afiliados|espelhar-|automacao-|grupo-para-canal|como-funciona|comparativos|melhores-bots|botinho-vs|glossario|conteudos|diagnostico-)/.test(p)) {
    return 'CONTEÚDO (página de busca)'
  }
  if (p === '/' ) return 'home (ambíguo)'
  if (p.startsWith('/login') || p.startsWith('/cadastro')) return 'direto no cadastro (ambíguo)'
  if (p.startsWith('/r/')) return 'link de indicação'
  return `outro: ${p}`
}

async function main() {
  console.log(`\nPeríodo: desde ${fmt(desde)}\n`)

  const signups = await db.analyticsEvent.findMany({
    where: { event: 'signup_created', createdAt: { gte: desde } },
    orderBy: { createdAt: 'asc' },
  })

  if (!signups.length) {
    console.log('Nenhum cadastro no período. Aumente a janela com --dias 180.')
    return
  }

  const total = signups.length
  const porOrigem = new Map()
  const porLandingClasse = new Map()
  const porLandingExata = new Map()
  const userIds = []

  for (const ev of signups) {
    let m = {}
    try { m = JSON.parse(ev.metadata || '{}') } catch {}
    if (ev.userId) userIds.push(ev.userId)

    const origem = m.utm_source || m.source || 'direct'
    porOrigem.set(origem, (porOrigem.get(origem) || 0) + 1)

    const classe = classificaLanding(m.landing_page)
    porLandingClasse.set(classe, (porLandingClasse.get(classe) || 0) + 1)

    const exata = String(m.landing_page || '(sem registro)').split('?')[0]
    porLandingExata.set(exata, (porLandingExata.get(exata) || 0) + 1)
  }

  titulo(`CADASTROS NO PERÍODO: ${total}`)

  console.log('\n-- Por origem declarada (utm_source / source) --\n')
  tabela(porOrigem, total, 'origem')
  console.log('\n  Leia com cuidado: "direct" inclui quem achou no Google e voltou depois.')

  console.log('\n-- Por TIPO da página de entrada (o sinal mais honesto) --\n')
  tabela(porLandingClasse, total, 'tipo de página')

  const conteudo = [...porLandingClasse.entries()]
    .filter(([k]) => k.startsWith('CONTEÚDO'))
    .reduce((s, [, v]) => s + v, 0)
  console.log(`\n  >> Entraram por página de conteúdo: ${conteudo} de ${total} (${pct(conteudo, total)})`)
  console.log('     Ninguém digita /blog/... de cabeça. Isso é SEO com alta confiança.')

  console.log('\n-- Página de entrada exata (top 15) --\n')
  const top = new Map([...porLandingExata.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))
  tabela(top, total, 'landing_page')

  // ---------------------------------------------------------- pagantes ---
  titulo('QUEM VIROU PAGANTE')

  const pagamentos = userIds.length
    ? await db.payment.findMany({
        where: { userId: { in: userIds }, status: 'approved' },
        orderBy: { createdAt: 'asc' },
      })
    : []

  const primeiroPagamentoPorUser = new Map()
  for (const p of pagamentos) {
    if (!primeiroPagamentoPorUser.has(p.userId)) primeiroPagamentoPorUser.set(p.userId, p)
  }

  console.log(`\n  Cadastros com userId registrado: ${userIds.length}`)
  console.log(`  Viraram pagante: ${primeiroPagamentoPorUser.size} (${pct(primeiroPagamentoPorUser.size, userIds.length)})`)

  if (primeiroPagamentoPorUser.size) {
    const porClassePagante = new Map()
    let somaDias = 0
    for (const ev of signups) {
      if (!ev.userId || !primeiroPagamentoPorUser.has(ev.userId)) continue
      let m = {}
      try { m = JSON.parse(ev.metadata || '{}') } catch {}
      const classe = classificaLanding(m.landing_page)
      porClassePagante.set(classe, (porClassePagante.get(classe) || 0) + 1)
      somaDias += (new Date(primeiroPagamentoPorUser.get(ev.userId).createdAt) - new Date(ev.createdAt)) / 864e5
    }
    console.log('\n-- Pagantes por tipo de página de entrada --\n')
    tabela(porClassePagante, primeiroPagamentoPorUser.size, 'tipo de página')
    console.log(`\n  Tempo médio entre cadastro e 1º pagamento: ${(somaDias / primeiroPagamentoPorUser.size).toFixed(1)} dias`)
    console.log('  (é esse número que define o teto de CAC — ver PLANO_GOOGLE_ADS)')
  }

  // ------------------------------------------------ origem das visitas ---
  titulo('ORIGEM DAS VISITAS (referral_visit)')

  const visitas = await db.analyticsEvent.findMany({
    where: { event: 'referral_visit', createdAt: { gte: desde } },
  })

  if (!visitas.length) {
    console.log('\n  Nenhuma visita registrada. Isso é esperado se o rastreamento')
    console.log('  subiu há pouco (04/08/2026) ou se ninguém chegou de fora ainda.')
  } else {
    const porTipo = new Map()
    const porFonte = new Map()
    for (const v of visitas) {
      let m = {}
      try { m = JSON.parse(v.metadata || '{}') } catch {}
      porTipo.set(m.referrer_kind || '?', (porTipo.get(m.referrer_kind || '?') || 0) + 1)
      porFonte.set(m.referrer_source || '?', (porFonte.get(m.referrer_source || '?') || 0) + 1)
    }
    console.log(`\n  Total de visitas vindas de fora: ${visitas.length}\n`)
    console.log('-- Por tipo --\n')
    tabela(porTipo, visitas.length, 'tipo')
    console.log('\n-- Por fonte --\n')
    tabela(porFonte, visitas.length, 'fonte')
  }

  // ------------------------------------------------------------ resumo ---
  titulo('RESUMO')
  console.log(`
  Cadastros no período .................. ${total}
  Entraram por página de conteúdo ....... ${conteudo} (${pct(conteudo, total)})
  Viraram pagante ....................... ${primeiroPagamentoPorUser.size}

  O número que importa para decidir sobre anúncios é o tempo médio entre
  cadastro e primeiro pagamento, acima — e quantos meses o assinante fica,
  que este script ainda não mede (precisa de histórico de renovação).
`)
}

main()
  .catch((err) => {
    console.error('\nFalhou:', err?.message || err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
