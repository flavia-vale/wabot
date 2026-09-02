'use client'

// Funil de ativação: onde as pessoas param entre criar a conta e pagar.
//
// A tela é de leitura e serve para UMA decisão: onde mexer primeiro. Por isso a
// etapa com a maior perda aparece destacada em vez de escondida numa tabela.
// Linguagem leiga como no resto do produto — nada de "coorte", "funil de
// conversão" ou nome de tabela na tela.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const PERIODOS = [
  [4, '4 semanas'],
  [8, '8 semanas'],
  [12, '12 semanas'],
  [26, '26 semanas'],
]

const asArray = (value) => (Array.isArray(value) ? value : [])

function formatPct(value) {
  const n = Number(value ?? 0)
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function formatWeek(value) {
  if (!value || value === 'sem data') return 'sem data'
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return `semana de ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)}`
}

function Barra({ pct }) {
  const largura = Math.max(2, Math.min(100, Number(pct ?? 0)))
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${largura}%` }} />
    </div>
  )
}

export default function AdminFunilPage() {
  const [weeks, setWeeks] = useState(8)
  // Mesmo padrão da lista de clientes: o resultado carrega a janela que o
  // produziu, e "carregando" é derivado disso. Assim o efeito não mexe em
  // estado de forma síncrona (o que dispara renderização em cascata) e a tela
  // anterior não pisca vazia enquanto a próxima janela chega.
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.adminFunnel(weeks)
      .then((data) => { if (!cancelled) setResult({ key: weeks, data, error: '' }) })
      .catch((err) => { if (!cancelled) setResult({ key: weeks, data: null, error: err?.message || 'Não foi possível carregar o funil agora.' }) })
    return () => { cancelled = true }
  }, [weeks])

  const isCurrent = result?.key === weeks
  const loading = !isCurrent
  const error = isCurrent ? result.error : ''
  const data = isCurrent ? result.data : null

  const steps = asArray(data?.steps)
  const motivos = asArray(data?.stalls)
  const semanas = asArray(data?.weeks)
  const origens = asArray(data?.origins)

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Onde as pessoas param</h1>
          <p className="text-sm text-slate-600">Do cadastro até o pagamento, contando pessoas — não envios.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
          >
            {PERIODOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Link href="/admin" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Voltar</Link>
        </div>
      </header>

      {error && <Alert type="error">{error}</Alert>}
      {loading && <LoadingState />}

      {!loading && data && (
        <>
          {data.biggestDrop && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                A maior perda é em “{data.biggestDrop.label}”: {data.biggestDrop.lost} {data.biggestDrop.lost === 1 ? 'pessoa parou' : 'pessoas pararam'} aí.
              </p>
              <p className="mt-1 text-xs text-amber-800">É a etapa onde uma melhoria rende mais.</p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Etapa por etapa</h2>
            <ul className="mt-3 space-y-3">
              {steps.map((step) => (
                <li key={step.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">{step.label}</span>
                    <span className="tabular-nums text-slate-600">
                      {step.count} <span className="text-slate-400">({formatPct(step.pctOfSignups)} de quem se cadastrou)</span>
                    </span>
                  </div>
                  <div className="mt-1"><Barra pct={step.pctOfSignups} /></div>
                  {step.lostFromPrevious > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {step.lostFromPrevious} {step.lostFromPrevious === 1 ? 'pessoa não passou' : 'pessoas não passaram'} da etapa anterior
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              “Tiveram oferta publicada” conta só oferta que saiu de verdade. Quem gerou tentativa sem
              cadastrar a etiqueta de afiliada não entra aqui — é justamente quem parece ativo e não é.
            </p>
            {(data.medianDaysToDelivery !== null || data.medianDaysToPaid !== null) && (
              <p className="mt-2 text-xs text-slate-500">
                Metade das pessoas leva até {data.medianDaysToDelivery ?? '—'} dia(s) para a primeira oferta sair
                e até {data.medianDaysToPaid ?? '—'} dia(s) para pagar.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Por que pararam</h2>
            <p className="text-xs text-slate-500">
              Só quem ainda não pagou ({data.unpaidCount ?? 0} {data.unpaidCount === 1 ? 'pessoa' : 'pessoas'}).
              Cada uma aparece no PRIMEIRO obstáculo que encontrou.
            </p>
            <ul className="mt-3 space-y-3">
              {motivos.map((motivo) => (
                <li key={motivo.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800">{motivo.label}</span>
                    <span className="shrink-0 tabular-nums text-sm text-slate-600">
                      {motivo.count} <span className="text-slate-400">({formatPct(motivo.pctOfUnpaid)})</span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{motivo.hint}</p>
                  {asArray(motivo.people).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <span className="text-slate-500">Falar com:</span>
                      {motivo.people.map((pessoa) => (
                        <Link
                          key={pessoa.id}
                          href={`/admin/clientes/${pessoa.id}`}
                          className="font-medium text-indigo-700 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-900"
                          title={pessoa.email ?? ''}
                        >
                          {pessoa.name || pessoa.email || 'cliente'}
                        </Link>
                      ))}
                      {motivo.count > motivo.people.length && (
                        <span className="text-slate-400">+{motivo.count - motivo.people.length} outras</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
              {!motivos.length && <li className="text-sm text-slate-500">Ninguém parado no período.</li>}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Por onde chegaram</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2">Origem</th>
                    <th className="py-2 text-right">Cadastros</th>
                    <th className="py-2 text-right">Conectaram</th>
                    <th className="py-2 text-right">Oferta publicada</th>
                    <th className="py-2 text-right">Pagaram</th>
                  </tr>
                </thead>
                <tbody>
                  {origens.map((linha) => (
                    <tr key={linha.origin} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{linha.origin}</td>
                      <td className="py-2 text-right tabular-nums">{linha.signups}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{linha.connected} <span className="text-slate-400">({formatPct(linha.pctConnected)})</span></td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{linha.delivered} <span className="text-slate-400">({formatPct(linha.pctDelivered)})</span></td>
                      <td className="py-2 text-right tabular-nums font-semibold text-emerald-700">{linha.paid} <span className="font-normal text-slate-400">({formatPct(linha.pctPaid)})</span></td>
                    </tr>
                  ))}
                  {!origens.length && <tr><td className="py-3 text-slate-500" colSpan={5}>Nenhum cadastro no período.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              “Direto / ambíguo” não quer dizer que a pessoa veio sozinha: quem achou no Google,
              fechou e voltou depois digitando o endereço aparece assim.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Semana a semana</h2>
            <p className="text-xs text-slate-500">Cada linha segue quem se cadastrou naquela semana, mesmo que tenha pago depois.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2">Semana do cadastro</th>
                    <th className="py-2 text-right">Cadastros</th>
                    <th className="py-2 text-right">Conectaram</th>
                    <th className="py-2 text-right">Oferta publicada</th>
                    <th className="py-2 text-right">Pagaram</th>
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((linha) => (
                    <tr key={linha.week} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{formatWeek(linha.week)}</td>
                      <td className="py-2 text-right tabular-nums">{linha.signups}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{linha.connected} <span className="text-slate-400">({formatPct(linha.pctConnected)})</span></td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{linha.delivered} <span className="text-slate-400">({formatPct(linha.pctDelivered)})</span></td>
                      <td className="py-2 text-right tabular-nums font-semibold text-emerald-700">{linha.paid} <span className="font-normal text-slate-400">({formatPct(linha.pctPaid)})</span></td>
                    </tr>
                  ))}
                  {!semanas.length && <tr><td className="py-3 text-slate-500" colSpan={5}>Nenhum cadastro no período.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              As semanas mais recentes ainda estão em andamento: quem se cadastrou ontem pode pagar amanhã.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
