import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_INPUTS,
  calculateAffiliateCommission,
  clampCommissionInput,
  sanitizeCommissionInputs,
} from '../dashboard/lib/free-tools/commission-calculator.js'

test('a conta segue cliques × conversão × valor médio × comissão', () => {
  const r = calculateAffiliateCommission({
    monthlyClicks: 1000, conversionRatePct: 2, averageTicket: 100, commissionRatePct: 5, monthlyCost: 50,
  })
  assert.equal(r.orders, 20)
  assert.equal(r.soldValue, 2000)
  assert.equal(r.commission, 100)
  assert.equal(r.netResult, 50)
  assert.equal(r.roiPct, 100)
  assert.equal(r.commissionPerOrder, 5)
  assert.equal(r.breakEvenOrders, 10)
  assert.equal(r.breakEvenClicks, 500)
  assert.equal(r.coversCost, true)
})

test('comissão abaixo do custo não cobre e o resultado fica negativo', () => {
  const r = calculateAffiliateCommission({
    monthlyClicks: 100, conversionRatePct: 1, averageTicket: 100, commissionRatePct: 5, monthlyCost: 69,
  })
  assert.equal(r.coversCost, false)
  assert.ok(r.netResult < 0)
})

test('sem custo não há retorno percentual; sem comissão por pedido não há ponto de equilíbrio', () => {
  const semCusto = calculateAffiliateCommission({ ...DEFAULT_INPUTS, monthlyCost: 0 })
  assert.equal(semCusto.roiPct, null)
  const semComissao = calculateAffiliateCommission({ ...DEFAULT_INPUTS, commissionRatePct: 0 })
  assert.equal(semComissao.breakEvenOrders, null)
  assert.equal(semComissao.breakEvenClicks, null)
})

test('sem conversão o ponto de equilíbrio em cliques não existe', () => {
  const r = calculateAffiliateCommission({ ...DEFAULT_INPUTS, conversionRatePct: 0 })
  assert.equal(r.orders, 0)
  assert.equal(r.breakEvenClicks, null)
})

test('entradas inválidas caem no padrão e os limites são respeitados', () => {
  assert.equal(clampCommissionInput('conversionRatePct', 'abc'), DEFAULT_INPUTS.conversionRatePct)
  assert.equal(clampCommissionInput('conversionRatePct', 500), 100)
  assert.equal(clampCommissionInput('monthlyClicks', -5), 0)
  const limpo = sanitizeCommissionInputs({ monthlyClicks: 'x' })
  assert.equal(limpo.monthlyClicks, DEFAULT_INPUTS.monthlyClicks)
})

test('a página deixa claro que o exemplo não é média de mercado nem promessa', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync(new URL('../dashboard/app/ferramentas/calculadora-comissao-afiliado-whatsapp/page.js', import.meta.url), 'utf8')
  const comp = readFileSync(new URL('../dashboard/components/free-tools/CommissionCalculator.jsx', import.meta.url), 'utf8')
  assert.match(page, /não são médias de mercado|Não\. São só um exemplo/)
  assert.match(comp, /não é previsão nem promessa de ganho/)
})
