import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  DEFAULT_TEST_ACCOUNT_EMAILS,
  excludeUserIdsWhere,
  isTestAccountEmail,
  loadTestAccountUserIds,
  resolveTestAccountEmails,
} from '../src/domain/admin/testAccounts.js'
import {
  COST_CATEGORIES,
  costForMonth,
  costSeries,
  firstCostMonth,
  monthKeyOf,
  monthlyRecurringCost,
  resolveCostConfig,
} from '../src/domain/admin/operatingCosts.js'
import {
  MAX_MONTHLY_GROWTH,
  MAX_OPTIMISTIC_GROWTH,
  MIN_MONTHS_FOR_GROWTH,
  buildRoiReport,
  observedMonthlyGrowth,
} from '../src/domain/admin/roi.js'

/*
 * ROI do BOTinho (2026-09-17).
 *
 * Duas coisas nasceram juntas e são a mesma conversa: a assinatura de TESTE
 * saindo das somas (esse dinheiro não cai no caixa) e a conta de quanto o
 * produto custa contra quanto ele devolve.
 */

// ---------------------------------------------------------------------------
// Conta de teste fora das somas
// ---------------------------------------------------------------------------

test('a assinatura de teste sai da soma, mas continua sendo uma conta conhecida', () => {
  assert.ok(DEFAULT_TEST_ACCOUNT_EMAILS.includes('tacianeaas02@gmail.com'))
  assert.equal(isTestAccountEmail('TACIANEAAS02@Gmail.com '), true)
  assert.equal(isTestAccountEmail('cliente@exemplo.com'), false)
  assert.equal(isTestAccountEmail(''), false)
  assert.equal(isTestAccountEmail(null), false)
})

test('a env SUBSTITUI a lista — é assim que a conta de teste vira cliente de verdade sem deploy', () => {
  assert.deepEqual(resolveTestAccountEmails({}), [...DEFAULT_TEST_ACCOUNT_EMAILS])
  assert.deepEqual(resolveTestAccountEmails({ FINANCE_TEST_ACCOUNT_EMAILS: 'a@b.com, C@D.com' }), ['a@b.com', 'c@d.com'])
  // String vazia = nenhuma conta de teste. Sem isso não haveria como desligar.
  assert.deepEqual(resolveTestAccountEmails({ FINANCE_TEST_ACCOUNT_EMAILS: '' }), [])
})

test('falha de banco NÃO pode sumir com receita — fail-safe é não excluir ninguém', async () => {
  const quebrado = { user: { findMany: async () => { throw new Error('SQLITE_BUSY') } } }
  assert.deepEqual(await loadTestAccountUserIds(quebrado), { ids: [], emails: [] })
  // E a cláusula vazia não filtra nada.
  assert.deepEqual(excludeUserIdsWhere([]), {})
  assert.deepEqual(excludeUserIdsWhere(['u1'], 'referredUserId'), { referredUserId: { notIn: ['u1'] } })
})

test('a lista de contas de teste é procurada por e-mail, e devolve os ids para as agregações', async () => {
  let queried = null
  const db = {
    user: {
      findMany: async args => {
        queried = args
        return [{ id: 'u-taciane', email: 'tacianeaas02@gmail.com' }]
      },
    },
  }
  const resultado = await loadTestAccountUserIds(db, { env: {} })
  assert.deepEqual(resultado.ids, ['u-taciane'])
  assert.deepEqual(queried.where.email.in, [...DEFAULT_TEST_ACCOUNT_EMAILS])
})

test('a exclusão mora no backend: a rota de visão geral filtra TODAS as somas, não só uma', () => {
  const fonte = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const overview = fonte.slice(fonte.indexOf("app.get('/finance/overview'"), fonte.indexOf("app.get('/finance/subscription-charges'"))

  // Receita, LTV, contagem de pagantes, planos ativos (MRR), comissões e taxas.
  assert.ok(overview.includes('loadTestAccountUserIds'), 'a rota precisa resolver as contas de teste')
  assert.ok(overview.includes('excludedTestAccounts'), 'a tela precisa saber quem ficou de fora para poder dizer')
  const ocorrencias = (overview.match(/notTestUser|excludeUserIdsWhere/g) ?? []).length
  assert.ok(ocorrencias >= 8, `esperado filtro em todas as somas, achei ${ocorrencias}`)

  // Nenhuma agregação de pagamento pode ficar sem o filtro. A chamada pode
  // ocupar várias linhas (a de taxas do Mercado Pago ocupa), então a janela é
  // por trecho, não por linha.
  const chamadas = overview.split('db.payment.').slice(1)
  assert.ok(chamadas.length >= 6, `esperava as somas de pagamento na rota, achei ${chamadas.length}`)
  for (const trecho of chamadas) {
    const janela = trecho.slice(0, 320)
    assert.ok(janela.includes('notTestUser'), `soma de pagamento sem excluir conta de teste: ${janela.slice(0, 80)}`)
  }

  // A conta de teste é uma ASSINATURA, e a receita de assinatura vem de
  // `SubscriptionCharge` (a reconciliação horária recupera cobrança cujo
  // webhook se perdeu e nunca grava `Payment`). Filtrar só `Payment` tiraria
  // a assinatura de teste do avulso e a deixaria inteira na outra metade.
  const assinaturas = overview.split('db.subscriptionCharge.').slice(1)
  assert.ok(assinaturas.length >= 3, `esperava as somas de assinatura na rota, achei ${assinaturas.length}`)
  for (const trecho of assinaturas) {
    const janela = trecho.slice(0, 320)
    assert.ok(janela.includes('notTestUser'), `soma de assinatura sem excluir conta de teste: ${janela.slice(0, 80)}`)
  }
})

test('o ROI lê as MESMAS duas fontes de receita da visão geral', () => {
  const fonte = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const rota = fonte.slice(fonte.indexOf("app.get('/finance/roi'"), fonte.indexOf("app.get('/payments'"))

  // Avulso (Payment, fora o que já é assinatura pelo prefixo) + assinatura
  // (SubscriptionCharge). Ler só Payment subestimaria a receita toda vez que
  // um webhook de renovação se perdeu — e o ROI é a conta em que isso não pode
  // acontecer.
  assert.ok(rota.includes('db.payment.findMany'), 'o ROI precisa do avulso')
  assert.ok(rota.includes('db.subscriptionCharge.findMany'), 'o ROI precisa da assinatura')
  assert.ok(rota.includes("startsWith: 'sub_'"), 'sem o prefixo a assinatura entraria duas vezes')
  assert.ok(rota.includes('notTestUser'), 'a conta de teste também sai do ROI')
  // E as quatro leituras (incluindo reembolsos) são limitadas — nenhuma varredura sem teto.
  assert.equal((rota.match(/take: ROI_ROW_LIMIT/g) ?? []).length, 4)
})

// ---------------------------------------------------------------------------
// Ledger de custos
// ---------------------------------------------------------------------------

test('fatura em dólar é guardada em dólar e convertida na leitura', () => {
  const config = resolveCostConfig({ USD_BRL_RATE: '5' })
  const maio = costForMonth('2026-05', config)
  // 110 de Claude + 5,59 USD de servidor.
  assert.equal(maio.claude, 110)
  assert.equal(maio.vps, 27.95)
  assert.equal(maio.total, 137.95)
  assert.equal(maio.source, 'realizado')

  // Cotação inválida cai no padrão, nunca em zero — custo zerado mentiria.
  assert.ok(resolveCostConfig({ USD_BRL_RATE: 'abacaxi' }).usdBrlRate > 0)
})

test('a partir do mês da virada o custo é o patamar fixo, e faturas antigas não são somadas duas vezes', () => {
  const config = resolveCostConfig({})
  assert.equal(monthlyRecurringCost(config), 755)

  const setembro = costForMonth('2026-09', config)
  assert.equal(setembro.source, 'fixo')
  assert.equal(setembro.total, 755)
  assert.equal(setembro.entries.length, 0, 'mês fixo não pode arrastar fatura avulsa junto')

  // Todo mês daqui pra frente é o mesmo patamar — inclusive os projetados.
  assert.equal(costForMonth('2027-06', config).total, 755)

  // E nenhuma fatura histórica pode existir a partir da virada.
  for (const entrada of config.historical) {
    assert.ok(entrada.month < config.recurring.startMonth, `fatura em ${entrada.month} seria contada duas vezes`)
  }
})

test('o patamar fixo é ajustável por env, sem deploy', () => {
  const config = resolveCostConfig({ COST_CLAUDE_MONTHLY_BRL: '700', COST_VPS_MONTHLY_BRL: '250', COST_RECURRING_START_MONTH: '2026-10' })
  assert.equal(monthlyRecurringCost(config), 950)
  assert.equal(costForMonth('2026-10', config).total, 950)
  // ⚠️ Adiar a virada faz o mês descoberto ficar sem custo, porque as faturas
  // históricas param onde a recorrência começa (é isso que impede contar o
  // mesmo mês duas vezes). Quem mexer nessa env precisa mexer no ledger junto.
  assert.equal(costForMonth('2026-09', config).source, 'sem_custo')
})

test('a linha do tempo começa na primeira fatura e não pula mês nenhum', () => {
  const config = resolveCostConfig({})
  assert.equal(firstCostMonth(config), '2026-04')
  const serie = costSeries('2026-04', '2026-09', config)
  assert.deepEqual(serie.map(m => m.month), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
  // Junho tem três faturas de Claude (110 + 5 + 5).
  assert.equal(serie[2].claude, 120)
})

test('o mês do dinheiro é o de Brasília, não o de UTC', () => {
  // 01/09 00:30 UTC ainda é 31/08 no Brasil — o pagamento é de agosto.
  assert.equal(monthKeyOf(new Date('2026-09-01T00:30:00Z')), '2026-08')
  assert.equal(monthKeyOf(new Date('2026-09-01T12:00:00Z')), '2026-09')
  assert.equal(monthKeyOf('data-invalida'), null)
})

// ---------------------------------------------------------------------------
// Crescimento e projeção
// ---------------------------------------------------------------------------

test('crescimento só é confiável com amostra — e nunca é extrapolado sem teto', () => {
  const curto = observedMonthlyGrowth([{ net: 100 }, { net: 200 }])
  assert.equal(curto.reliable, false)
  assert.equal(curto.reason, 'amostra_curta')
  assert.ok(MIN_MONTHS_FOR_GROWTH >= 3)

  // Dobrando todo mês: real é 100%, mas a projeção usa o teto.
  const explosivo = observedMonthlyGrowth([{ net: 100 }, { net: 200 }, { net: 400 }, { net: 800 }])
  assert.equal(explosivo.reason, 'limitado')
  assert.equal(explosivo.rate, MAX_MONTHLY_GROWTH)
  assert.ok(explosivo.rawRate > MAX_MONTHLY_GROWTH)

  // Queda não vira crescimento negativo composto por um ano.
  const caindo = observedMonthlyGrowth([{ net: 400 }, { net: 200 }, { net: 100 }])
  assert.equal(caindo.rate, 0)
  assert.equal(caindo.reason, 'queda')
})

test('o cenário otimista precisa ser diferente da base mesmo com o crescimento no teto', () => {
  assert.ok(MAX_OPTIMISTIC_GROWTH > MAX_MONTHLY_GROWTH, 'senão as duas linhas viram a mesma e a tela não ajuda a decidir')
})

// ---------------------------------------------------------------------------
// O relatório inteiro
// ---------------------------------------------------------------------------

const RECEITA = {
  '2026-06': { gross: 110, mpFees: 5.49, payments: 1, payingUsers: 1 },
  '2026-07': { gross: 220, mpFees: 10.98, payments: 2, payingUsers: 2 },
  '2026-08': { gross: 345, affiliateCommissions: 20, mpFees: 17.2, payments: 4, payingUsers: 4 },
  '2026-09': { gross: 207, mpFees: 10.3, payments: 3, payingUsers: 3 },
}

function round(value) {
  return Math.round(value * 100) / 100
}

function relatorio(extra = {}) {
  return buildRoiReport({ revenueByMonth: RECEITA, now: new Date('2026-09-17T15:00:00Z'), env: {}, activeMrr: 400, ...extra })
}

test('o passado é só mês FECHADO — o mês corrente nunca entra no que já é fato', () => {
  const r = relatorio()
  assert.deepEqual(r.past.map(m => m.month), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'])
  assert.equal(r.currentMonth, '2026-09')
  assert.ok(r.past.every(m => m.source === 'realizado'))
  assert.equal(r.present.source, 'parcial')

  // O total investido é só o fechado — somar projeção aqui seria decidir
  // dinheiro em cima de estimativa.
  const somaCustos = r.past.reduce((acc, m) => acc + m.cost, 0)
  assert.equal(r.summary.totalInvested, Math.round(somaCustos * 100) / 100)
  assert.equal(r.summary.monthsClosed, 5)
})

test('o acumulado com o mês corrente existe, mas SEPARADO do que já é fato', () => {
  const r = relatorio()
  assert.notEqual(r.summary.cumulativeProfit, r.summary.cumulativeProfitWithCurrent)
  assert.equal(r.summary.cumulativeProfit, r.past[r.past.length - 1].cumulativeProfit)
})

test('a receita do passado é LÍQUIDA: já saíram comissões de afiliada e taxas', () => {
  const r = relatorio()
  const agosto = r.past.find(m => m.month === '2026-08')
  assert.equal(agosto.gross, 345)
  assert.equal(agosto.net, 307.8) // 345 − 20 − 17,20
  assert.ok(agosto.net < agosto.gross)
})

test('o mês corrente projeta pelo ritmo dos dias e diz quanto falta para se pagar', () => {
  const r = relatorio()
  assert.equal(r.present.daysElapsed, 17)
  assert.equal(r.present.daysInMonth, 30)
  assert.equal(r.present.cost, 755)
  // 196,70 em 17 de 30 dias -> ~347 no mês.
  assert.ok(r.present.projectedNet > r.present.net)
  assert.equal(r.present.missingToBreakEven, 558.3)
  assert.equal(r.present.breakEvenCustomers, 12) // 755 / 65,57
})

test('sem cliente pagante NÃO se afirma ponto de equilíbrio — null é resposta honesta', () => {
  const r = buildRoiReport({ revenueByMonth: {}, now: new Date('2026-09-17T15:00:00Z'), env: {} })
  assert.equal(r.present.breakEvenCustomers, null)
  assert.equal(r.present.avgTicketNet, 0)
  // E nenhum cenário promete que se paga.
  const conservador = r.future.scenarios.find(s => s.scenario === 'conservador')
  assert.equal(conservador.paybackMonth, null)
})

test('o cenário "nada muda" nunca inventa crescimento', () => {
  const r = relatorio()
  const conservador = r.future.scenarios.find(s => s.scenario === 'conservador')
  assert.equal(conservador.monthlyGrowthPct, 0)
  const receitas = conservador.months.map(m => m.net)
  assert.equal(new Set(receitas).size, 1, 'sem crescimento a receita repete todo mês')
})

test('a projeção respeita o teto de clientes do servidor — receita que a infra não entrega não é receita', () => {
  const r = relatorio({ projectionMonths: 24 })
  assert.ok(r.future.revenueCeiling > 0)
  assert.equal(r.future.capacityCustomers, 40)
  for (const cenario of r.future.scenarios) {
    for (const mes of cenario.months) {
      assert.ok(mes.net <= r.future.revenueCeiling + 0.01, `${cenario.scenario} projeta ${mes.net} acima do teto ${r.future.revenueCeiling}`)
    }
  }
  const otimista = r.future.scenarios.find(s => s.scenario === 'otimista')
  assert.ok(otimista.cappedFromMonth, 'a tela precisa poder dizer a partir de quando o servidor lota')
})

test('o custo dos meses projetados é o patamar fixo, não zero', () => {
  const r = relatorio()
  for (const cenario of r.future.scenarios) {
    assert.ok(cenario.months.every(m => m.cost === 755), 'projeção sem custo faria o produto se pagar sozinho no papel')
  }
})

test('a projeção começa no mês SEGUINTE ao corrente — não reescreve o mês que está correndo', () => {
  const r = relatorio()
  assert.equal(r.future.startMonth, '2026-10')
  for (const cenario of r.future.scenarios) {
    assert.equal(cenario.months[0].month, '2026-10')
    assert.ok(cenario.months.every(m => m.source === 'previsto'))
  }
})

test('quanto mais crescimento, mais cedo se paga — a ordem dos cenários não pode inverter', () => {
  const r = relatorio({ projectionMonths: 24 })
  const [conservador, base, otimista] = ['conservador', 'base', 'otimista'].map(nome => r.future.scenarios.find(s => s.scenario === nome))
  assert.ok(otimista.cumulativeProfitAtEnd > base.cumulativeProfitAtEnd)
  assert.ok(base.cumulativeProfitAtEnd > conservador.cumulativeProfitAtEnd)
  assert.ok(otimista.paybackMonth <= base.paybackMonth)
})

test('a tela fala em linguagem leiga — nada de jargão financeiro', () => {
  const fonte = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  // Nomes de campo do backend (`paybackMonth`, `breakEvenMonth`) são código,
  // não texto de tela — a checagem é sobre o que a pessoa LÊ.
  const painel = fonte
    .slice(fonte.indexOf('function RoiPanel('), fonte.indexOf('function SubscriptionChargesPanel('))
    .replace(/\b(payback|breakEven)Month\b/g, '')
    .replace(/\b(activeMrr|avgLtv|avgTicketNet)\b/g, '')
  for (const jargao of ['payback', 'break-even', 'burn rate', 'churn', 'runway', 'MRR', 'LTV']) {
    assert.ok(!painel.toLowerCase().includes(jargao.toLowerCase()), `jargão "${jargao}" chegou à tela`)
  }
  assert.ok(painel.includes('Se paga em') || painel.includes('se paga'), 'a tela precisa dizer quando se paga, em português')
})

test('o gráfico não depende só da cor — verde e vermelho são o par que mais confunde', () => {
  const fonte = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  const grafico = fonte.slice(fonte.indexOf('function CumulativeProfitChart('), fonte.indexOf('function RoiPanel('))
  assert.ok(grafico.includes('signedCurrency'), 'o valor precisa sair escrito com sinal')
  assert.ok(grafico.includes('R$ 0'), 'a linha do zero é o que separa vermelho de azul sem usar cor')
  assert.ok(grafico.includes('border-dashed'), 'previsto precisa se distinguir de realizado sem ser só pela cor')
})

test('a sub-aba ROI só busca dados quando é aberta', () => {
  const fonte = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  assert.match(fonte, /if \(tab !== 'financeiro' \|\| financeTab !== 'roi'\) return/)
})


// ---------------------------------------------------------------------------
// Conciliação com a Visão geral (RCA 2026-09-17)
// ---------------------------------------------------------------------------

/*
 * A dona do produto leu R$ 543,22 no ROI e mais de mil na Visão geral e
 * perguntou onde estava o erro. Havia DOIS erros meus e uma diferença legítima
 * que a tela não explicava.
 */

test('receita ANTERIOR à primeira fatura de custo entra na conta', () => {
  // Era o erro #1: a rota lia pagamento só a partir do mês da primeira fatura
  // do Claude (abr/2026), então quem pagou antes disso desaparecia do ROI —
  // e receita de antes do primeiro custo é receita do produto.
  const r = buildRoiReport({
    now: new Date('2026-09-17T15:00:00Z'),
    env: {},
    revenueByMonth: {
      '2026-02': { gross: 69, mpFees: 3.44, payments: 1, payingUsers: 1 },
      '2026-08': { gross: 345, mpFees: 17.2, payments: 4, payingUsers: 4 },
    },
  })
  assert.equal(r.past[0].month, '2026-02', 'a linha do tempo começa no primeiro mês COM RECEITA OU CUSTO')
  assert.ok(r.past.some(m => m.month === '2026-02' && m.net > 0), 'fevereiro precisa aparecer com a receita dele')
})

test('a rota NÃO corta a receita por data — era o que apagava mês e criava mês fantasma', () => {
  const fonte = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  const rota = fonte.slice(fonte.indexOf("app.get('/finance/roi'"), fonte.indexOf("app.get('/payments'"))

  // O corte era montado em UTC e o mês é decidido no fuso de Brasília, então
  // as 3 últimas horas do mês anterior entravam e viravam um mês parcial com
  // custo zero. Sem corte, os dois defeitos somem juntos.
  assert.ok(!rota.includes('gte: startDate'), 'a leitura de receita não pode voltar a cortar por data')
  assert.ok(!rota.includes('Date.UTC('), 'não montar corte de data em UTC nesta rota')

  // O teto de linhas é a única coisa que ainda pode deixar a conta incompleta,
  // e bater nele não pode virar um total silenciosamente menor.
  assert.ok(rota.includes('truncated'), 'bater o teto de linhas precisa ser avisado, não escondido')
})

test('a cascata de conciliação FECHA: líquido do histórico menos o mês corrente é o placar', () => {
  const r = relatorio()
  const c = r.reconciliation

  assert.equal(round(c.grossAllTime - c.affiliateCommissionsAllTime - c.mpFeesAllTime), c.netAllTime)
  assert.equal(round(c.netAllTime - c.currentMonthNet), c.netClosedMonths)
  assert.equal(c.netToDate, r.summary.netToDate, 'o fim da cascata É o número do placar')
  assert.equal(c.netToDate, c.netAllTime, 'o placar cobre todo o histórico, inclusive o mês corrente')

  // E o valor cheio é maior que o líquido — é essa diferença que a Visão geral
  // mostra e que fazia os dois números parecerem incompatíveis.
  assert.ok(c.grossAllTime > c.netAllTime)
  assert.ok(c.currentMonthGross >= c.currentMonthNet)
})

test('a tela mostra a cascata em linguagem leiga, sem mandar a pessoa perguntar', () => {
  const fonte = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  // Comentário de código não é tela — a checagem de jargão olha só o que a
  // pessoa LÊ, senão explicar o motivo num comentário reprova o teste.
  const painel = fonte
    .slice(fonte.indexOf('function RoiPanel('), fonte.indexOf('function FinancePeriodSelector('))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  assert.ok(painel.includes('Conferindo com a aba Visão geral'), 'a dúvida precisa estar respondida na própria tela')
  assert.ok(painel.includes('valor cheio'), 'dizer "bruto" não explica nada para quem não é contador')
  assert.ok(painel.includes('reconciliation.netToDate'), 'a cascata precisa terminar no número do placar')
  for (const jargao of ['bruto', 'líquido', 'gateway']) {
    assert.ok(!painel.toLowerCase().includes(jargao), `jargão "${jargao}" chegou à tela`)
  }
})


// ---------------------------------------------------------------------------
// A régua do placar (RCA 2026-09-17, segunda rodada)
// ---------------------------------------------------------------------------

/*
 * O placar contava só mês FECHADO. Com os números reais da conta, isso deixava
 * R$ 640 de receita JÁ RECEBIDA e R$ 755 de custo JÁ PAGO fora da pergunta "já
 * se pagou?" — e a dona do produto leu R$ 543,22 no ROI contra R$ 1.183,33 de
 * líquido na Visão geral. A aritmética estava certa; a régua, errada.
 */

test('o placar conta o que JÁ ENTROU no mês corrente — é fato, não estimativa', () => {
  const r = relatorio()
  const s = r.summary

  // O mês corrente tem receita realizada; ela precisa estar no placar.
  assert.ok(r.present.net > 0, 'a fixture precisa ter receita no mês corrente')
  assert.equal(s.netToDate, round(s.totalNetRevenue + r.present.net))
  assert.ok(s.netToDate > s.totalNetRevenue, 'o placar não pode ignorar o mês corrente')

  // E o custo do mês corrente entra junto, senão o resultado infla.
  assert.equal(s.investedToDate, round(s.totalInvested + r.present.cost))
  assert.equal(s.resultToDate, round(s.netToDate - s.investedToDate))
})

test('o custo do mês corrente entra CHEIO, não proporcional aos dias', () => {
  const r = relatorio()
  // 17 de 30 dias corridos, e mesmo assim o custo do mês é o cheio: as faturas
  // são mensais e já foram cobradas. Inflar o resultado é o erro que custa
  // decisão errada, então a conta pesa contra — de propósito.
  assert.equal(r.present.daysElapsed, 17)
  assert.equal(r.present.cost, 755)
  assert.equal(r.summary.investedToDate, round(r.summary.totalInvested + 755))
})

test('previsto continua FORA do placar — só o realizado entra', () => {
  const r = relatorio()
  // O fechamento estimado do mês existe, mas vive no bloco Presente.
  assert.ok(r.present.projectedNet > r.present.net)
  assert.notEqual(r.summary.netToDate, round(r.summary.totalNetRevenue + r.present.projectedNet))
  assert.equal(r.summary.netToDate, round(r.summary.totalNetRevenue + r.present.net))
})

test('os números de mês fechado continuam existindo — a tabela do passado soma neles', () => {
  const r = relatorio()
  assert.equal(r.summary.totalNetRevenue, r.past[r.past.length - 1].cumulativeNet)
  assert.equal(r.summary.totalInvested, r.past[r.past.length - 1].cumulativeCost)
})

test('a tela usa a régua do placar e mostra a conta ABERTA', () => {
  const fonte = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  const painel = fonte.slice(fonte.indexOf('function RoiPanel('), fonte.indexOf('function FinancePeriodSelector('))

  for (const campo of ['netToDate', 'investedToDate', 'resultToDate', 'roiPctToDate']) {
    assert.ok(painel.includes(`summary.${campo}`), `o placar precisa usar ${campo}`)
  }
  // Recolhido, quem estava confusa não tinha motivo para clicar.
  assert.match(painel, /<details open/, 'a conciliação precisa nascer aberta')
  assert.ok(painel.includes('incluindo o que entrou este mês'), 'a tela precisa dizer que o mês corrente conta')
})


test('o script de conciliação é read-only e usa as MESMAS duas fontes do produto', () => {
  const script = readFileSync(new URL('../scripts/diag-roi-conciliacao.mjs', import.meta.url), 'utf8')

  // Read-only: diagnóstico que escreve no banco é armadilha.
  for (const escrita of ['.create(', '.update(', '.delete(', '.upsert(', 'sendTemplateEmail']) {
    assert.ok(!script.includes(escrita), `script de diagnóstico não pode ${escrita}`)
  }

  // Precisa ler as duas fontes de receita, senão discorda do produto — que é
  // exatamente o problema que ele existe para resolver.
  assert.ok(script.includes('db.payment.findMany'))
  assert.ok(script.includes('db.subscriptionCharge.findMany'))
  assert.ok(script.includes("startsWith: 'sub_'"), 'sem o prefixo a assinatura entraria duas vezes')
  assert.ok(script.includes('loadTestAccountUserIds'), 'a conta de teste sai da soma aqui também')

  // Erro engolido em script de diagnóstico vira conclusão errada.
  assert.ok(script.includes('FALHA ao montar a conciliação'))
})


test('o script imprime os meses EM ORDEM, inclusive os que só têm custo', () => {
  const script = readFileSync(new URL('../scripts/diag-roi-conciliacao.mjs', import.meta.url), 'utf8')

  // Na primeira execução em produção, abr/2026 (custo de R$ 110, receita zero)
  // saiu impresso DEPOIS de setembro: os meses só-custo eram adicionados após o
  // loop de impressão. Linha do tempo fora de ordem numa conta de dinheiro é
  // convite a ler errado.
  const posInsercao = script.indexOf('if (!meses.has(entry.month)) meses.set(entry.month')
  const posSort = script.indexOf('const ordenados = [...meses.keys()].sort()')
  assert.ok(posInsercao > 0, 'os meses só-custo precisam ser inseridos no mapa')
  assert.ok(posInsercao < posSort, 'a inserção tem que vir ANTES do sort, senão a ordem quebra')

  // E o mês corrente não pode aparecer negativo sem dizer que o custo entra
  // cheio contra receita parcial — "negativo" se leria como piora.
  assert.ok(script.includes('ESTIMATIVA, no ritmo deste mês'))
  assert.ok(script.includes('cheio, já cobrado'))
})
