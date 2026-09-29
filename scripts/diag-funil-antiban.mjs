// Diagnóstico read-only: relatório SEMANAL da campanha Canais + Preservação
// (utm_campaign=canais-preservacao). P1 do backlog pós-P3
// (docs/marketing/canais-antiban/backlog-pos-p3-prioridades.md).
//
// Responde, com dado:
//   - qual página de entrada trouxe lead;
//   - qual botão (CTA) foi clicado e para onde levou;
//   - qual faixa de risco (diagnóstico/calculadora) converte melhor;
//   - quantos chegaram ao cadastro e quantos abandonaram no meio.
//
// A montagem é a MESMA da tela /admin/marketing-growth
// (src/domain/admin/campaignFunnel.js): script e tela não podem discordar.
// Consultas agregadas (GROUP BY + LIMIT) na janela máxima de 90 dias.
// Nada é escrito.
//
// Uso (na VPS, DENTRO do diretório do ambiente — o .env aponta o banco certo):
//   cd ~/wabot && node scripts/diag-funil-antiban.mjs            # últimos 7 dias
//   cd ~/wabot && node scripts/diag-funil-antiban.mjs --dias 30
//   cd ~/wabot && node scripts/diag-funil-antiban.mjs --desde 2026-09-22
//
// Leitura:
//   * Visita/clique/diagnóstico são ANÔNIMOS. As etapas são contagens do
//     período por página, não a mesma pessoa andando pelo funil.
//   * Eventos do diagnóstico e da calculadora só são gravados a partir do
//     deploy de 29/09/2026 (antes a API recusava os três com 400). Semana
//     anterior a isso mostra zero nessas etapas — não é queda.
//   * `entry_utm_*` (o link do post/anúncio que trouxe a pessoa) também só
//     existe a partir desse deploy.

import { pathToFileURL } from 'node:url'
import { boundedRange, MAX_RANGE_DAYS } from '../src/domain/admin/campaignFunnel.js'

const args = process.argv.slice(2)
export function periodoDosArgs(argv = args, now = new Date()) {
  const get = (name) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null
  }
  const desde = get('desde')
  const dias = Math.min(Math.max(Number(get('dias') || 7), 1), MAX_RANGE_DAYS)
  const from = desde ? new Date(`${desde}T00:00:00`) : new Date(now.getTime() - dias * 864e5)
  return boundedRange({ from: from.toISOString(), to: now.toISOString() }, now)
}

const fmt = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ')

function titulo(t) {
  console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`)
}

function tabela(linhas, colunas) {
  if (!linhas.length) {
    console.log('  (nada no período)')
    return
  }
  const larguras = colunas.map(([chave, rotulo]) => Math.max(rotulo.length, ...linhas.map((l) => String(l[chave] ?? '').length)))
  console.log(`  ${colunas.map(([, rotulo], i) => rotulo.padEnd(larguras[i])).join('  ')}`)
  console.log(`  ${larguras.map((w) => '-'.repeat(w)).join('  ')}`)
  for (const l of linhas) {
    console.log(`  ${colunas.map(([chave], i) => String(l[chave] ?? '').padEnd(larguras[i])).join('  ')}`)
  }
}

export function imprimirRelatorio(r) {
  titulo(`CAMPANHA ${r.campaign} — ${fmt(r.from)} → ${fmt(r.to)}`)
  console.log('')
  for (const step of r.steps) console.log(`  ${step.label.padEnd(36, '.')} ${step.count}`)
  if (r.truncated) console.log('\n  ⚠️  A consulta bateu no teto de linhas — totais podem estar abaixo do real. Use --dias menor.')

  titulo('PÁGINA DE ENTRADA (qual página trouxe lead?)')
  tabela(r.byPage, [['page', 'página'], ['views', 'visitas'], ['ctaClicks', 'cliques'], ['diagnosticSubmitted', 'diag.env'], ['calculatorClicks', 'calc'], ['signups', 'cadastros'], ['ctaRate', 'clique%']])

  titulo('CTA CLICADO → DESTINO')
  tabela(r.ctaClicks.slice(0, 15), [['page', 'página'], ['cta', 'botão'], ['destination', 'destino'], ['clicks', 'cliques']])

  titulo('CADASTRO POR BOTÃO (utm_content do link de cadastro)')
  tabela(r.signupsByCta, [['key', 'botão'], ['signups', 'cadastros']])

  titulo('FAIXA DE RISCO (qual converte melhor?)')
  tabela(r.bands, [['kind', 'ferramenta'], ['band', 'faixa'], ['diagnosticViewed', 'viu'], ['diagnosticSubmitted', 'enviou'], ['calculatorClicks', 'calc'], ['signups', 'cadastros'], ['signupRate', 'conv%']])

  titulo('LINK DE ORIGEM (UTM de entrada)')
  tabela(r.byUtm.slice(0, 15), [['utm_source', 'source'], ['utm_content', 'utm_content'], ['views', 'visitas'], ['ctaClicks', 'cliques'], ['signups', 'cadastros']])

  titulo('CADASTRO CONCLUÍDO x ABANDONO')
  const enviou = r.totals.diagnosticSubmitted
  const comFaixa = r.bands.filter((b) => b.kind === 'diagnóstico').reduce((soma, b) => soma + b.signups, 0)
  console.log(`\n  Enviaram o diagnóstico ................ ${enviou}`)
  console.log(`  Cadastros com faixa do diagnóstico .... ${comFaixa}`)
  console.log(`  Abandono aproximado ................... ${Math.max(enviou - comFaixa, 0)}`)
  console.log(`  Cadastros da campanha (total) ......... ${r.totals.signups}`)
  console.log('\n  Perfil (segmento):')
  tabela(r.segmentos, [['key', 'segmento'], ['signups', 'cadastros']])
}

async function main() {
  const { default: db } = await import('../src/db.js')
  const { loadCampaignFunnel } = await import('../src/domain/admin/campaignFunnelQuery.js')
  try {
    const { from, to } = periodoDosArgs()
    const relatorio = await loadCampaignFunnel(db, { from, to })
    imprimirRelatorio(relatorio)
  } finally {
    await db.$disconnect()
  }
}

// Só roda quando chamado direto na linha de comando — importar para testar não
// abre o banco (a suíte db-free não pode exigir DATABASE_URL).
const chamadoDireto = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (chamadoDireto) {
  main().catch((err) => {
    console.error('\nFalhou:', err?.message || err)
    process.exitCode = 1
  })
}
