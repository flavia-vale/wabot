'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DEFAULT_INPUTS,
  INPUT_LIMITS,
  calculateAffiliateCommission,
  formatBRL,
} from '@/lib/free-tools/commission-calculator'

const fields = [
  { key: 'monthlyClicks', label: 'Cliques nos seus links por mês', suffix: 'cliques', step: 1 },
  { key: 'conversionRatePct', label: 'Quantos cliques viram pedido', suffix: '%', step: 0.1 },
  { key: 'averageTicket', label: 'Valor médio de cada pedido', suffix: 'R$', step: 1 },
  { key: 'commissionRatePct', label: 'Comissão média da loja', suffix: '%', step: 0.1 },
  { key: 'monthlyCost', label: 'Custo mensal de ferramentas', suffix: 'R$/mês', step: 1 },
]

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">{hint}</p>
    </div>
  )
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

export function CommissionCalculator() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const result = useMemo(() => calculateAffiliateCommission(inputs), [inputs])

  const signupHref = '/login?' + new URLSearchParams({
    mode: 'register',
    source: 'tool_commission_calculator',
    utm_source: 'ferramentas',
    utm_medium: 'organic',
    utm_campaign: 'free-tools',
    utm_content: 'calculadora-comissao-afiliado-whatsapp',
    tool_id: 'commission_calculator',
  }).toString()

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]" aria-labelledby="calculadora-comissao-title">
      <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Calculadora gratuita</p>
            <h2 id="calculadora-comissao-title" className="mt-2 text-2xl font-black tracking-tight text-gray-950">Coloque os seus números</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">Os valores que já aparecem são só um exemplo para a conta funcionar. Troque pelos seus, que você vê no relatório da loja.</p>
          </div>
          <button type="button" onClick={() => setInputs(DEFAULT_INPUTS)} className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
            Restaurar exemplo
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const limits = INPUT_LIMITS[field.key]
            return (
              <label key={field.key} className="block rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <span className="text-sm font-bold text-gray-800">{field.label}</span>
                <span className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-emerald-500">
                  <input
                    type="number"
                    min={limits.min}
                    max={limits.max}
                    step={field.step}
                    value={inputs[field.key]}
                    onChange={(event) => setInputs((current) => ({ ...current, [field.key]: event.target.value }))}
                    className="w-full border-0 bg-transparent text-lg font-black text-gray-950 outline-none"
                    aria-describedby={`${field.key}-hint`}
                  />
                  <span id={`${field.key}-hint`} className="shrink-0 text-xs font-bold uppercase tracking-wide text-gray-400">{field.suffix}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="mt-5 rounded-2xl bg-emerald-950 p-5 text-white">
          <p className="text-sm font-bold text-emerald-100">Como calculamos</p>
          <p className="mt-2 text-sm leading-7 text-emerald-50">Pedidos = cliques × conversão. Comissão = pedidos × valor médio × comissão da loja. Resultado = comissão − custo de ferramentas. É aritmética simples sobre os números que você informa; não é previsão nem promessa de ganho.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className={`rounded-[2rem] border p-5 shadow-sm md:p-7 ${result.coversCost ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <p className="text-xs font-black uppercase tracking-[0.16em] opacity-80">Com estes números</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight">
            {result.coversCost ? 'A comissão cobre o custo das ferramentas' : 'A comissão ainda não cobre o custo das ferramentas'}
          </h3>
          <p className="mt-2 text-sm leading-7">
            {result.breakEvenOrders === null
              ? 'Sem comissão por pedido, não há ponto de equilíbrio.'
              : `Para pagar ${formatBRL(inputs.monthlyCost)} por mês você precisa de cerca de ${formatCount(result.breakEvenOrders)} pedidos${result.breakEvenClicks === null ? '.' : `, o que dá em torno de ${formatCount(result.breakEvenClicks)} cliques por mês.`}`}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard label="Pedidos por mês" value={formatCount(result.orders)} hint="Cliques que viram pedido, pela conversão que você informou." />
          <MetricCard label="Vendas geradas" value={formatBRL(result.soldValue)} hint="Valor total dos pedidos, antes da comissão." />
          <MetricCard label="Comissão estimada" value={formatBRL(result.commission)} hint="O que a loja paga sobre esses pedidos, se todos forem confirmados." />
          <MetricCard label="Resultado do mês" value={formatBRL(result.netResult)} hint={result.roiPct === null ? 'Sem custo informado, não há retorno percentual.' : `Retorno de ${formatCount(result.roiPct)}% sobre o custo informado.`} />
        </div>

        <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm md:p-7">
          <h3 className="text-xl font-black tracking-tight text-gray-950">Antes de confiar no resultado</h3>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            <li>• Use a conversão e o valor médio do seu relatório da loja, não os do exemplo.</li>
            <li>• A comissão só é paga depois que a loja confirma a venda, e cada categoria tem percentual próprio.</li>
            <li>• Preço, cupom, estoque e regras da plataforma mudam: revise antes de divulgar.</li>
          </ul>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href={signupHref} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
              Começar teste grátis de 7 dias
            </Link>
            <Link href="/ferramentas" className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-5 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-50">
              Ver outras ferramentas
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
