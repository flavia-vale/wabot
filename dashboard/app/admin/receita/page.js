'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { TestAccountTag } from '@/components/TestAccountTag'

// Página "Receita" (G2 da auditoria do painel, 2026-10-02). Era a aba
// Financeiro dentro do Início (`/admin/page.js`). Veio inteira para cá para o
// Início parar de carregar 20 consultas de uma vez — esta página só busca o
// que ela mesma mostra. Clicar numa cliente abre a ficha (/admin/clientes/:id).

const asArray = (value) => Array.isArray(value) ? value : []

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}


function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
}

// Avulso (pagou 30 dias, sem renovação automática) vs. recorrente (assinatura
// Mercado Pago, cobra sozinha) — mesmo plano pode ter vindo dos dois jeitos.
// Sub-aba "Cobranças recorrentes" (Financeiro). Uma linha por TENTATIVA de
// cobrança da assinatura, com o que o banco devolveu: código cru (para abrir
// caso no Mercado Pago) E a frase do que fazer (o código sozinho manda a
// pessoa tomar ações opostas). Quem decide o texto é o backend — tela e script
// de diagnóstico não podem discordar sobre o motivo de uma recusa.
const CHARGE_OUTCOME_TONES = {
  aprovada: 'bg-ds-accent/20 text-ds-accent-strong',
  recusada: 'bg-ds-danger/20 text-ds-danger',
  pendente: 'bg-ds-warn/20 text-ds-warn-ink',
  devolvida: 'bg-ds-bg-soft text-ds-ink',
  desconhecida: 'bg-ds-bg-soft text-ds-ink-soft',
}

const CHARGE_ACTION_LABELS = {
  cliente: 'Ação da cliente',
  nossa: 'Ação nossa',
  mercado_pago: 'Ação do Mercado Pago',
  esperar: 'Só esperar',
  ninguem: '—',
}

// ---------------------------------------------------------------------------
// Sub-aba "ROI" do Financeiro (2026-09-17).
//
// Passado, presente e futuro na mesma tela, cada bloco dizendo de onde veio o
// número. Regra que sustenta a tela inteira: REALIZADO e PREVISTO nunca se
// misturam num total só — mês fechado é medição, mês corrente é parcial e
// projeção é cenário. Somar os três num número só seria decidir dinheiro em
// cima de estimativa.
//
// Linguagem leiga obrigatória: "quanto entrou", "quanto saiu", "sobrou",
// "quando se paga". Nada de ROI negativo sem explicar, "payback", "burn".
// ---------------------------------------------------------------------------

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function formatMonth(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? ''))
  if (!match) return '—'
  return `${MONTH_LABELS[Number(match[2]) - 1] ?? '?'}/${match[1].slice(2)}`
}

function formatMonthLong(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? ''))
  if (!match) return '—'
  const full = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${full[Number(match[2]) - 1] ?? '?'} de ${match[1]}`
}

function signedCurrency(value) {
  const numeric = Number(value ?? 0)
  const formatted = formatCurrency(Math.abs(numeric))
  if (numeric > 0) return `+ ${formatted}`
  if (numeric < 0) return `− ${formatted}`
  return formatted
}

/**
 * Gráfico do dinheiro acumulado, mês a mês: o que já foi gasto contra o que já
 * entrou, e para onde isso vai.
 *
 * Forma: barras ancoradas no zero. Uma série só (não precisa de legenda de
 * cores), com DUAS codificações além da cor — a barra fica abaixo ou acima da
 * linha do zero, e o valor sai escrito com sinal. Isso não é enfeite: verde e
 * vermelho sozinhos são o par que quem tem daltonismo mais confunde (ΔE 6,0 em
 * deuteranopia), e a regra só permite esse par COM codificação secundária.
 * Não remover a linha do zero nem os rótulos com sinal.
 *
 * Realizado é barra cheia; previsto é barra vazada (tracejada) — de novo, nunca
 * só pela cor.
 */
function CumulativeProfitChart({ past, present, projection, paybackMonth }) {
  // O gráfico existe para responder UMA coisa: quando a linha cruza o zero.
  // Por isso ele para pouco depois da virada, em vez de desenhar o horizonte
  // inteiro — crescimento composto num ano faz a última barra ficar dezenas de
  // vezes maior que as primeiras, e aí o vermelho de hoje (que é justamente a
  // situação atual) vira um risco fino e ilegível. A tabela logo abaixo mostra
  // todos os meses; aqui o que importa é enxergar a travessia.
  const realizedValues = [...past.map(row => row.cumulativeProfit), Number(present.cumulativeProfitWithCurrent ?? 0)]
  const deepestRed = Math.abs(Math.min(0, ...realizedValues))
  // Depois que a linha cruza o zero, o crescimento composto dispara: mais duas
  // barras já bastam para a maior ficar 10x a menor e achatar todo o resto. O
  // corte é pela ALTURA, não por um número fixo de meses — segue desenhando
  // enquanto o azul não passar de 1,5x a profundidade do vermelho, e sempre
  // inclui o mês da virada, que é o ponto que o gráfico existe para mostrar.
  const visibleProjection = []
  let crossed = false
  for (const row of projection) {
    const isCrossing = row.month === paybackMonth
    if (crossed && !isCrossing && Math.abs(row.cumulativeProfit) > Math.max(deepestRed * 1.5, 1)) break
    visibleProjection.push(row)
    if (isCrossing) crossed = true
  }
  const points = [
    ...past.map(row => ({ month: row.month, value: row.cumulativeProfit, kind: 'realizado' })),
    { month: present.month, value: Number(present.cumulativeProfitWithCurrent ?? 0), kind: 'parcial' },
    ...visibleProjection.map(row => ({ month: row.month, value: row.cumulativeProfit, kind: 'previsto' })),
  ]
  if (!points.length) return null
  const truncated = visibleProjection.length < projection.length

  const values = points.map(point => point.value)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const height = 180
  const zeroY = ((max - 0) / span) * height
  const slot = 100 / points.length
  const barWidth = Math.max(slot * 0.62, 0.8)

  return (
    <figure className="mt-4">
      <figcaption className="text-sm font-bold text-ds-ink">
        Dinheiro acumulado desde o começo
        <span className="ml-2 font-normal text-ds-ink-soft">o que entrou menos o que custou, somando mês a mês</span>
      </figcaption>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-ds-ink-soft">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-ds-accent-strong" />já aconteceu</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border border-dashed border-ds-line-strong bg-ds-surface" />projeção</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-ds-danger" />ainda no vermelho</span>
      </div>

      <div className="relative mt-2" style={{ height: `${height}px` }}>
        {/* Linha do zero: é ela que separa "no vermelho" de "no azul" sem depender da cor. */}
        <div className="absolute inset-x-0 border-t border-ds-line-strong" style={{ top: `${zeroY}px` }} />
        <div className="absolute -left-1 -translate-y-1/2 text-[10.5px] font-bold text-ds-ink-faint" style={{ top: `${zeroY}px` }}>R$ 0</div>
        <div className="absolute inset-0 flex items-stretch">
          {points.map((point, index) => {
            const magnitude = (Math.abs(point.value) / span) * height
            const positive = point.value >= 0
            const previsto = point.kind === 'previsto'
            const parcial = point.kind === 'parcial'
            const tone = positive
              ? (previsto ? 'border-2 border-dashed border-ds-accent-strong bg-ds-accent/10' : 'bg-ds-accent-strong')
              : (previsto ? 'border-2 border-dashed border-ds-danger bg-ds-danger/10' : 'bg-ds-danger')
            return (
              <div
                key={`${point.month}-${point.kind}`}
                className="group relative flex flex-col justify-end"
                style={{ width: `${slot}%` }}
                title={`${formatMonthLong(point.month)} · ${signedCurrency(point.value)}${previsto ? ' (projeção)' : parcial ? ' (mês em andamento)' : ''}`}
              >
                <div
                  className={`absolute rounded ${tone} ${parcial ? 'opacity-80 ring-2 ring-ds-ink ring-offset-1' : ''}`}
                  style={{
                    left: `${(slot - barWidth) / 2 / slot * 100}%`,
                    width: `${(barWidth / slot) * 100}%`,
                    top: positive ? `${zeroY - magnitude}px` : `${zeroY}px`,
                    height: `${Math.max(magnitude, 2)}px`,
                  }}
                />
                {point.month === paybackMonth && (
                  // Colado na linha do zero, não no topo do gráfico: é a
                  // travessia que ele marca.
                  // A virada costuma cair na última coluna do desenho, e aí
                  // um rótulo centrado sai pela borda direita. Perto do fim ele
                  // ancora pela direita.
                  <span
                    className={`pointer-events-none absolute whitespace-nowrap rounded bg-ds-accent-strong px-1.5 py-0.5 text-[10.5px] font-black text-ds-surface ${index > points.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
                    style={{ top: `${Math.max(zeroY - 22, 0)}px` }}
                  >
                    se paga aqui
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-1 flex text-[10.5px] text-ds-ink-faint">
        {points.map((point, index) => (
          <div key={`label-${point.month}-${point.kind}`} className="text-center" style={{ width: `${slot}%` }}>
            {index % 2 === 0 ? formatMonth(point.month) : ''}
          </div>
        ))}
      </div>
      {truncated && (
        <p className="mt-2 text-[10.5px] text-ds-ink-soft">
          O desenho para em {formatMonth(points[points.length - 1].month)} para o vermelho de hoje continuar legível. Os meses seguintes estão na tabela abaixo.
        </p>
      )}
    </figure>
  )
}

// Gastos fixos editáveis: simula troca de plano do Claude/servidor. Salvar
// grava no backend e a tela pede o ROI de novo — todas as contas são refeitas.
function FixedCostsEditor({ config, onSave }) {
  const toField = value => (value === null || value === undefined ? '' : String(value).replace('.', ','))
  const initial = {
    claudeMonthlyBrl: toField(config?.claudeMonthly),
    vpsMonthlyBrl: toField(config?.vpsMonthly),
    usdBrlRate: toField(config?.usdBrlRate),
  }
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  // Valores novos vindos do servidor (depois de salvar) repõem o formulário.
  const configKey = `${config?.claudeMonthly}|${config?.vpsMonthly}|${config?.usdBrlRate}`
  const [syncedKey, setSyncedKey] = useState(configKey)
  if (syncedKey !== configKey) {
    setSyncedKey(configKey)
    setForm(initial)
  }

  const dirty = Object.keys(initial).some(key => form[key] !== initial[key])

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await onSave(form)
      setMessage({ type: 'ok', text: 'Salvo. As contas foram refeitas com os valores novos.' })
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível salvar agora.' })
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    ['claudeMonthlyBrl', 'Claude por mês (R$)'],
    ['vpsMonthlyBrl', 'Servidor por mês (R$)'],
    ['usdBrlRate', 'Cotação do dólar (R$)'],
  ]

  return (
    <form onSubmit={save} className="mt-4 rounded-xl border border-ds-line bg-ds-surface p-4">
      <h4 className="text-xs font-black uppercase tracking-wide text-ds-ink-soft">Gastos fixos</h4>
      <p className="mt-1 text-[10.5px] text-ds-ink-soft">
        Mudou de plano do Claude ou do servidor? Troque aqui e salve para ver quanto sobra. Vale a partir de {formatMonthLong(config?.recurringStartMonth)}. Campo vazio volta ao valor padrão.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {fields.map(([key, label]) => (
          <label key={key} className="block text-xs font-bold text-ds-ink-soft">
            {label}
            <input
              type="text"
              inputMode="decimal"
              value={form[key]}
              onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-ds-line px-3 py-2 text-sm font-normal text-ds-ink"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || !dirty} className="rounded-xl bg-ds-accent-strong px-4 py-2 text-xs font-black text-ds-surface shadow-sm hover:bg-ds-accent-strong/85 disabled:opacity-60">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        {message && (
          <span className={`text-xs font-bold ${message.type === 'ok' ? 'text-ds-accent-strong' : 'text-ds-danger'}`}>{message.text}</span>
        )}
      </div>
    </form>
  )
}

function RoiPanel({ data, loading, months, onMonths, onReconcile, reconciling, onSaveCosts }) {
  const [scenario, setScenario] = useState('base')

  if (loading && !data) return <LoadingState message="Montando a conta do ROI…" />
  if (!data) return <p className="text-sm text-ds-ink-faint">Não foi possível carregar o ROI agora.</p>

  const summary = data.summary ?? {}
  const present = data.present ?? {}
  const future = data.future ?? {}
  const reconciliation = data.reconciliation ?? null
  const chosen = (future.scenarios ?? []).find(item => item.scenario === scenario) ?? (future.scenarios ?? [])[0] ?? null
  const seCustear = (summary.resultToDate ?? summary.netResult) >= 0

  return (
    <div className="space-y-8">
      {/* ------------------------------ RESUMO ------------------------------ */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink-soft">O placar até agora</h3>
            <p className="text-xs text-ds-ink-soft">
              Tudo que já entrou contra tudo que já saiu, <span className="font-bold">incluindo o que entrou este mês</span> — é dinheiro no bolso, não estimativa. O que ainda deve entrar até o fim do mês fica no bloco Presente.
            </p>
          </div>
          {!!data.excludedTestAccounts?.length && (
            <span className="rounded-full bg-ds-warn/20 px-3 py-1 text-[10.5px] font-bold text-ds-warn-ink">
              Fora da conta: {data.excludedTestAccounts.join(', ')} (assinatura de teste)
            </span>
          )}
          <button type="button" onClick={onReconcile} disabled={reconciling} className="rounded-xl bg-ds-accent-strong px-4 py-2 text-xs font-black text-ds-surface shadow-sm hover:bg-ds-accent-strong/85 disabled:opacity-60">
            {reconciling ? 'Conciliando…' : '↻ Conciliar com o Financeiro'}
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-ds-accent/10 p-4 ring-1 ring-ds-accent/20">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-accent-strong">Entrou (já descontado)</p>
            <p className="mt-1 text-[28px] font-black text-ds-accent-strong">{formatCurrency(summary.netToDate ?? summary.totalNetRevenue)}</p>
            <p className="mt-1 text-[10.5px] text-ds-accent-strong">depois das comissões de afiliada e das taxas do Mercado Pago</p>
          </div>
          <div className="rounded-xl bg-ds-danger/10 p-4 ring-1 ring-ds-danger/20">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-danger">Saiu (Claude + servidor)</p>
            <p className="mt-1 text-[28px] font-black text-ds-danger">{formatCurrency(summary.investedToDate ?? summary.totalInvested)}</p>
            <p className="mt-1 text-[10.5px] text-ds-danger">tudo que você já pagou para o Espelha Grupos existir, com a conta deste mês inteira</p>
          </div>
          <div className={`rounded-xl p-4 ring-1 ${seCustear ? 'bg-ds-accent/20 ring-ds-accent' : 'bg-ds-bg-soft ring-ds-line'}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-ds-ink-soft">{seCustear ? 'Já sobrou' : 'Ainda falta'}</p>
            <p className="mt-1 text-[28px] font-black text-ds-ink">{signedCurrency(summary.resultToDate ?? summary.netResult)}</p>
            <p className="mt-1 text-[10.5px] text-ds-ink-soft">
              {seCustear ? 'o produto já pagou tudo que custou' : 'para o produto pagar tudo que custou até aqui'}
            </p>
          </div>
          <div className="rounded-xl bg-ds-bg p-4 ring-1 ring-ds-line">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-ink-soft">Retorno sobre o gasto</p>
            <p className={`mt-1 text-[28px] font-black ${(summary.roiPctToDate ?? 0) >= 0 ? 'text-ds-accent-strong' : 'text-ds-danger'}`}>
              {summary.roiPctToDate === null || summary.roiPctToDate === undefined ? '—' : `${summary.roiPctToDate > 0 ? '+' : ''}${formatNumber(summary.roiPctToDate)}%`}
            </p>
            <p className="mt-1 text-[10.5px] text-ds-ink-soft">cada R$ 100 gastos devolveram {(summary.investedToDate ?? 0) > 0 ? formatCurrency(((summary.netToDate ?? 0) / summary.investedToDate) * 100) : '—'}</p>
          </div>
        </div>

        {/* Cascata que liga este placar aos cartões da aba Visão geral. Os dois
            respondem perguntas diferentes (aqui líquido e só mês fechado, lá
            bruto e com o mês corrente), então dão números diferentes — sem
            mostrar a conta, a diferença parece defeito. */}
        {reconciliation && (
          // ABERTO por padrão de propósito: recolhido, quem estava confusa com
          // a diferença entre as duas abas não tinha motivo para clicar — e
          // continuou achando que havia defeito. A conta tem que estar à vista.
          <details open className="mt-4 rounded-xl border border-ds-line bg-ds-bg p-3">
            <summary className="cursor-pointer text-xs font-black text-ds-ink">
              Conferindo com a aba Visão geral
            </summary>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-ds-ink-soft">Tudo que entrou, desde o começo (valor cheio)</span>
                <span className="font-bold text-ds-ink">{formatCurrency(reconciliation.grossAllTime)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-ds-ink-soft">(–) comissões que você pagou às afiliadas</span>
                <span className="font-bold text-ds-warn-ink">− {formatCurrency(reconciliation.affiliateCommissionsAllTime)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-ds-ink-soft">(–) taxas que o Mercado Pago retém</span>
                <span className="font-bold text-ds-danger">− {formatCurrency(reconciliation.mpFeesAllTime)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-ds-ink-soft">(–) reembolsos devolvidos por PIX</span>
                <span className="font-bold text-ds-danger">− {formatCurrency(reconciliation.refundsAllTime ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t-2 border-ds-line-strong pt-1">
                <span className="font-bold text-ds-ink">(=) o número do placar acima</span>
                <span className="font-black text-ds-accent-strong">{formatCurrency(reconciliation.netToDate ?? reconciliation.netAllTime)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 text-[10.5px] text-ds-ink-soft">
                <span>disso, {formatMonthLong(present.month)} (mês em andamento) já trouxe</span>
                <span className="font-bold">{formatCurrency(reconciliation.currentMonthNet)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[10.5px] text-ds-ink-soft">
                <span>e os {formatNumber(summary.monthsClosed ?? 0)} meses já fechados somam</span>
                <span className="font-bold">{formatCurrency(reconciliation.netClosedMonths)}</span>
              </div>
            </div>
            <p className="mt-3 text-[10.5px] text-ds-ink-soft">
              A diferença com a aba Visão geral é só esta: lá aparece o <span className="font-bold">valor cheio</span>, porque a pergunta é
              &quot;quanto está entrando&quot;; aqui entra o que de fato <span className="font-bold">sobrou para você</span>, porque a pergunta é
              &quot;o produto já se pagou&quot;. As duas contam o mesmo período, inclusive este mês. E a conta deste mês entra
              <span className="font-bold"> inteira</span> do lado do custo — a fatura do Claude e a do servidor são mensais e já foram cobradas.
            </p>
          </details>
        )}

        {data.truncated && (
          <p className="mt-3 rounded-xl bg-ds-warn/10 px-3 py-2 text-[10.5px] font-semibold text-ds-warn-ink ring-1 ring-ds-warn/40">
            ⚠️ Passamos de {formatNumber(data.rowLimit)} registros e a conta pode estar incompleta. Avise para aumentarmos o limite.
          </p>
        )}

        <CumulativeProfitChart
          past={data.past ?? []}
          present={{ month: present.month, cumulativeProfitWithCurrent: summary.cumulativeProfitWithCurrent }}
          projection={chosen?.months ?? []}
          paybackMonth={chosen?.paybackMonth ?? null}
        />
      </div>

      {/* ------------------------------ PASSADO ------------------------------ */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink-soft">Passado · mês a mês, tudo já aconteceu</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-ds-line">
          <table className="adm-zebra min-w-[520px] w-full text-sm">
            <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
              <tr>
                <th className="px-3 py-2">Mês</th>
                <th className="px-3 py-2">Entrou (já descontado)</th>
                <th className="px-3 py-2">Claude</th>
                <th className="px-3 py-2">Servidor</th>
                <th className="px-3 py-2">Sobrou no mês</th>
                <th className="px-3 py-2">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-line">
              {(data.past ?? []).map(row => (
                <tr key={row.month} className="hover:bg-ds-bg">
                  <td className="px-3 py-2 font-bold text-ds-ink">{formatMonth(row.month)}</td>
                  <td className="px-3 py-2">
                    {formatCurrency(row.net)}
                    {row.gross > row.net && (
                      <span className="ml-1 text-[10.5px] text-ds-ink-faint">(valor cheio {formatCurrency(row.gross)})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ds-danger">{row.costClaude ? `− ${formatCurrency(row.costClaude)}` : '—'}</td>
                  <td className="px-3 py-2 text-ds-danger">{row.costVps ? `− ${formatCurrency(row.costVps)}` : '—'}</td>
                  <td className={`px-3 py-2 font-bold ${row.profit >= 0 ? 'text-ds-accent-strong' : 'text-ds-danger'}`}>{signedCurrency(row.profit)}</td>
                  <td className={`px-3 py-2 font-black ${row.cumulativeProfit >= 0 ? 'text-ds-accent-strong' : 'text-ds-danger'}`}>{signedCurrency(row.cumulativeProfit)}</td>
                </tr>
              ))}
              {!(data.past ?? []).length && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-ds-ink-faint">Nenhum mês fechado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10.5px] text-ds-ink-soft">
          Faturas em dólar convertidas a R$ {formatNumber(data.config?.usdBrlRate ?? 0)}. A partir de {formatMonthLong(data.config?.recurringStartMonth)} o custo passa a ser o valor fixo combinado: {formatCurrency(data.config?.claudeMonthly)} de Claude + {formatCurrency(data.config?.vpsMonthly)} de servidor.
        </p>
        {onSaveCosts && <FixedCostsEditor config={data.config} onSave={onSaveCosts} />}
      </div>

      {/* ------------------------------ PRESENTE ------------------------------ */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink-soft">Presente · {formatMonthLong(present.month)}, dia {formatNumber(present.daysElapsed)} de {formatNumber(present.daysInMonth)}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-ds-bg p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-ink-soft">Já entrou este mês</p>
            <p className="mt-1 text-[22px] font-black text-ds-ink">{formatCurrency(present.net)}</p>
            <p className="mt-1 text-[10.5px] text-ds-ink-soft">{formatNumber(present.payments)} pagamentos · {formatNumber(present.payingUsers)} clientes</p>
          </div>
          <div className="rounded-xl bg-ds-danger/10 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-danger">Custo fixo do mês</p>
            <p className="mt-1 text-[22px] font-black text-ds-danger">{formatCurrency(present.cost)}</p>
            <p className="mt-1 text-[10.5px] text-ds-danger">{formatCurrency(present.costClaude)} Claude + {formatCurrency(present.costVps)} servidor</p>
          </div>
          <div className={`rounded-xl p-4 ${present.missingToBreakEven > 0 ? 'bg-ds-warn/10' : 'bg-ds-accent/10'}`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${present.missingToBreakEven > 0 ? 'text-ds-warn-ink' : 'text-ds-accent-strong'}`}>
              {present.missingToBreakEven > 0 ? 'Falta este mês' : 'Mês já pago'}
            </p>
            <p className={`mt-1 text-[22px] font-black ${present.missingToBreakEven > 0 ? 'text-ds-warn-ink' : 'text-ds-accent-strong'}`}>
              {present.missingToBreakEven > 0 ? formatCurrency(present.missingToBreakEven) : '✓'}
            </p>
            <p className="mt-1 text-[10.5px] text-ds-ink-soft">para o mês cobrir o próprio custo</p>
          </div>
          <div className="rounded-xl bg-ds-bg-soft p-4 ring-1 ring-ds-line">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-ink-soft">Quantas clientes pagam a conta</p>
            <p className="mt-1 text-[22px] font-black text-ds-ink">{present.breakEvenCustomers ? `${formatNumber(present.breakEvenCustomers)} por mês` : '—'}</p>
            <p className="mt-1 text-[10.5px] text-ds-ink-soft">
              {present.avgTicketNet > 0 ? `com o que cada uma deixa hoje (${formatCurrency(present.avgTicketNet)} já descontado)` : 'sem cliente pagante ainda para calcular'}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[10.5px] text-ds-ink-soft">
          No ritmo deste mês, o mês deve fechar com {formatCurrency(present.projectedNet)} de entrada — <span className="font-bold">isso é estimativa</span>, não fato. Assinaturas ativas hoje somam {formatCurrency(present.activeMrr)} por mês.
        </p>
      </div>

      {/* ------------------------------ FUTURO ------------------------------ */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink-soft">Futuro · os próximos {formatNumber(future.months)} meses</h3>
            <p className="text-xs text-ds-ink-soft">Três cenários. Nenhum é promessa — o primeiro é literalmente &quot;nada muda a partir de hoje&quot;.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={months} onChange={event => onMonths(Number(event.target.value))} className="rounded-xl border border-ds-line px-2 py-1.5 text-xs font-bold text-ds-ink">
              {[6, 12, 18, 24].map(value => <option key={value} value={value}>{value} meses</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {(future.scenarios ?? []).map(item => {
            const active = item.scenario === scenario
            return (
              <button
                key={item.scenario}
                type="button"
                onClick={() => setScenario(item.scenario)}
                className={`rounded-xl p-4 text-left ring-1 transition ${active ? 'bg-ds-ink text-ds-surface ring-ds-ink' : 'bg-ds-surface ring-ds-line hover:bg-ds-bg'}`}
              >
                <p className={`text-xs font-bold uppercase tracking-wide ${active ? 'text-ds-accent' : 'text-ds-ink-soft'}`}>{item.label}</p>
                <p className="mt-1 text-lg font-black">
                  {item.paybackMonth ? `Se paga em ${formatMonthLong(item.paybackMonth)}` : 'Não se paga nesse prazo'}
                </p>
                <p className={`mt-1 text-[10.5px] ${active ? 'text-ds-ink-faint' : 'text-ds-ink-soft'}`}>
                  {item.monthlyGrowthPct > 0 ? `crescendo ${formatNumber(item.monthlyGrowthPct)}% ao mês` : 'sem entrar nenhuma cliente nova'}
                  {item.breakEvenMonth ? ` · mês se paga sozinho a partir de ${formatMonth(item.breakEvenMonth)}` : ' · nenhum mês se paga sozinho'}
                </p>
                <p className={`mt-2 text-sm font-black ${item.cumulativeProfitAtEnd >= 0 ? (active ? 'text-ds-accent' : 'text-ds-accent-strong') : (active ? 'text-ds-danger' : 'text-ds-danger')}`}>
                  {signedCurrency(item.cumulativeProfitAtEnd)} no fim do período
                </p>
                {item.cappedFromMonth && (
                  <p className={`mt-1 text-[10.5px] ${active ? 'text-ds-warn' : 'text-ds-warn-ink'}`}>
                    a partir de {formatMonth(item.cappedFromMonth)} o servidor de hoje lota ({formatNumber(future.capacityCustomers)} clientes)
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {chosen && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-ds-line">
            <table className="adm-zebra min-w-[520px] w-full text-sm">
              <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
                <tr>
                  <th className="px-3 py-2">Mês</th>
                  <th className="px-3 py-2">Entrada estimada</th>
                  <th className="px-3 py-2">Custo</th>
                  <th className="px-3 py-2">Sobra no mês</th>
                  <th className="px-3 py-2">Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-line">
                {chosen.months.map(row => (
                  <tr key={row.month} className={row.month === chosen.paybackMonth ? 'bg-ds-accent/10' : 'hover:bg-ds-bg'}>
                    <td className="px-3 py-2 font-bold text-ds-ink">{formatMonth(row.month)}</td>
                    <td className="px-3 py-2 text-ds-ink-soft">{formatCurrency(row.net)}</td>
                    <td className="px-3 py-2 text-ds-danger">− {formatCurrency(row.cost)}</td>
                    <td className={`px-3 py-2 font-bold ${row.profit >= 0 ? 'text-ds-accent-strong' : 'text-ds-danger'}`}>{signedCurrency(row.profit)}</td>
                    <td className={`px-3 py-2 font-black ${row.cumulativeProfit >= 0 ? 'text-ds-accent-strong' : 'text-ds-danger'}`}>{signedCurrency(row.cumulativeProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-[10.5px] text-ds-ink-soft">
          Base da projeção: {formatCurrency(future.baselineNet)} por mês.{' '}
          {data.growth?.reliable
            ? `Crescimento medido nos meses fechados${data.growth.reason === 'limitado' ? ' (estava alto demais para esticar por um ano, então foi limitado)' : ''}.`
            : 'Ainda não há meses fechados suficientes para medir crescimento — por isso o cenário do meio não promete nada além do que já acontece.'}
        </p>
      </div>
    </div>
  )
}

// Mesmos seis períodos da rota GET /finance/overview (src/domain/admin/financePeriod.js)
// — compartilhado pelos Cards (Visão geral) e pela tabela de Cobranças
// recorrentes, para as duas telas nunca discordarem sobre "os últimos 30 dias".
const FINANCE_PERIOD_OPTIONS = [
  ['7d', '7 dias'],
  ['30d', '30 dias'],
  ['current_month', 'Mês atual'],
  ['last_month', 'Último mês'],
  ['3m', '3 meses'],
  ['6m', '6 meses'],
]

function FinancePeriodSelector({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-ds-bg-soft p-1">
      {FINANCE_PERIOD_OPTIONS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${value === key ? 'bg-ds-surface text-ds-accent-strong shadow-sm' : 'text-ds-ink-soft hover:text-ds-ink'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SubscriptionChargesPanel({ data, loading, filters, onFilters, search, onSearch, onOpenDetail, testAccountEmails }) {
  const summary = data?.summary ?? null
  const rows = asArray(data?.charges)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10.5px] font-bold uppercase tracking-wide text-ds-ink-soft">Resultado</label>
          <select
            value={filters.outcome}
            onChange={(event) => onFilters({ ...filters, outcome: event.target.value })}
            className="mt-1 rounded-xl border border-ds-line px-3 py-1.5 text-sm"
          >
            <option value="all">Todos</option>
            <option value="aprovada">Cobrou</option>
            <option value="recusada">Recusada</option>
            <option value="pendente">Em andamento</option>
            <option value="devolvida">Estornada</option>
          </select>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => { event.preventDefault(); onFilters({ ...filters, q: search }) }}
        >
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-wide text-ds-ink-soft">Cliente</label>
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="e-mail ou nome"
              className="mt-1 rounded-xl border border-ds-line px-3 py-1.5 text-sm"
            />
          </div>
          <button type="submit" className="rounded-xl bg-ds-ink px-3 py-1.5 text-xs font-black text-ds-surface">Buscar</button>
        </form>
      </div>

      {/* A tabela não responde "e se a cobrança parou de rodar?" — vazio pode
          ser mês tranquilo ou máquina parada. Esta faixa separa os dois. */}
      {data?.health && data.health.severity !== 'ok' && (
        <div className={`mb-4 rounded-xl p-4 ring-1 ${data.health.severity === 'critico' ? 'bg-ds-danger/10 ring-ds-danger/40' : data.health.severity === 'atencao' ? 'bg-ds-warn/10 ring-ds-warn/40' : 'bg-ds-bg ring-ds-line'}`}>
          <p className={`text-sm font-black ${data.health.severity === 'critico' ? 'text-ds-danger' : 'text-ds-warn-ink'}`}>{data.health.headline}</p>
          <ul className="mt-2 space-y-2">
            {asArray(data.health.problems).map(problema => (
              <li key={problema.code} className="text-sm text-ds-ink">
                <span className="font-bold">{problema.title}.</span> {problema.detail}
                <span className="block text-xs text-ds-ink-soft">O que fazer: {problema.fix}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl bg-ds-bg p-3">
            <p className="text-xs text-ds-ink-soft">Tentativas no período</p>
            <p className="text-[22px] font-black text-ds-ink">{formatNumber(summary.tentativas)}</p>
            <p className="text-[10.5px] text-ds-ink-soft">{formatNumber(summary.assinaturasCobradas)} assinatura(s) cobraram</p>
          </div>
          <div className="rounded-xl bg-ds-accent/10 p-3">
            <p className="text-xs text-ds-accent-strong">Cobrou</p>
            <p className="text-[22px] font-black text-ds-accent-strong">{formatNumber(summary.aprovadas)}</p>
            <p className="text-[10.5px] text-ds-accent-strong">{formatCurrency(summary.valorAprovado)}</p>
          </div>
          <div className="rounded-xl bg-ds-danger/10 p-3">
            <p className="text-xs text-ds-danger">Recusadas</p>
            <p className="text-[22px] font-black text-ds-danger">{formatNumber(summary.recusadas)}</p>
            <p className="text-[10.5px] text-ds-danger">{formatCurrency(summary.valorRecusado)} não entraram</p>
          </div>
          <div className="rounded-xl bg-ds-bg-soft p-3">
            <p className="text-xs text-ds-ink-soft">Taxa de sucesso</p>
            <p className="text-[22px] font-black text-ds-ink-soft">{summary.taxaSucesso == null ? '—' : `${summary.taxaSucesso}%`}</p>
            <p className="text-[10.5px] text-ds-ink-soft">das cobranças decididas</p>
          </div>
          <div className="rounded-xl bg-ds-warn/10 p-3">
            <p className="text-xs text-ds-warn-ink">Assinaturas em risco</p>
            <p className="text-[22px] font-black text-ds-warn-ink">{formatNumber(summary.clientesEmRisco)}</p>
            <p className="text-[10.5px] text-ds-warn-ink">última cobrança recusada</p>
          </div>
        </div>
      )}

      {summary && asArray(summary.motivos).length > 0 && (
        <div className="mb-4 rounded-xl border border-ds-line p-3">
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Por que as cobranças foram recusadas</h3>
          <div className="space-y-1">
            {summary.motivos.map(motivo => (
              <div key={motivo.code} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="text-ds-ink">{motivo.label}</span>
                <span className="text-xs text-ds-ink-soft">{formatNumber(motivo.total)}× · {formatCurrency(motivo.valor)} · <code className="text-[10.5px]">{motivo.code}</code></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-ds-line">
        <table className="adm-zebra min-w-[520px] w-full text-sm">
          <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
            <tr>
              <th className="px-3 py-2 font-bold">Tentativa em</th>
              <th className="px-3 py-2 font-bold">Cliente</th>
              <th className="px-3 py-2 font-bold">Plano</th>
              <th className="px-3 py-2 font-bold">Valor</th>
              <th className="px-3 py-2 font-bold">Resultado</th>
              <th className="px-3 py-2 font-bold">Código do Mercado Pago</th>
              <th className="px-3 py-2 font-bold">O que isso quer dizer</th>
              <th className="px-3 py-2 font-bold">Nº da tentativa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-line">
            {rows.map(charge => (
              <tr key={charge.id} className={onOpenDetail ? 'cursor-pointer hover:bg-ds-bg' : ''} onClick={() => charge.userId && onOpenDetail?.(charge.userId)}>
                <td className="whitespace-nowrap px-3 py-2 text-ds-ink">{formatDate(charge.attemptedAt)}</td>
                <td className="px-3 py-2 font-semibold text-ds-ink">
                  {charge.email ?? '—'}
                  <TestAccountTag email={charge.email} emails={testAccountEmails} compact className="ml-1 align-middle" />
                </td>
                <td className="px-3 py-2 text-ds-ink-soft">{charge.plan ?? '—'}</td>
                <td className="px-3 py-2 text-ds-ink-soft">{charge.amount == null ? '—' : formatCurrency(charge.amount)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold ${CHARGE_OUTCOME_TONES[charge.outcome] ?? CHARGE_OUTCOME_TONES.desconhecida}`}>{charge.statusLabel}</span>
                </td>
                <td className="px-3 py-2 text-xs text-ds-ink-soft">
                  <code>{charge.returnCode ?? '—'}</code>
                  {charge.providerStatus && <span className="ml-1 text-ds-ink-faint">({charge.providerStatus})</span>}
                </td>
                <td className="px-3 py-2 text-ds-ink">
                  {charge.returnMessage}
                  {charge.actionOwner && charge.actionOwner !== 'ninguem' && (
                    <span className="ml-1 rounded-full bg-ds-bg-soft px-2 py-0.5 text-[10.5px] font-bold text-ds-ink-soft">{CHARGE_ACTION_LABELS[charge.actionOwner] ?? charge.actionOwner}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ds-ink-soft">
                  {charge.retryAttempt ?? '—'}
                  {charge.nextRetryAt && <span className="block text-[10.5px] text-ds-ink-faint">tenta de novo {formatDate(charge.nextRetryAt)}</span>}
                </td>
              </tr>
            ))}
            {!loading && !rows.length && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-ds-ink-faint">Nenhuma cobrança de assinatura no período. Cobrança só aparece aqui depois que o Mercado Pago tenta — assinatura recém-ligada ainda não tem histórico.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-ds-ink-faint">Carregando…</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] text-ds-ink-faint">
        As cobranças vêm do próprio Mercado Pago e são atualizadas de hora em hora — recusa que não gera aviso também aparece aqui.
      </p>
    </div>
  )
}

// Sub-aba "Retenção" (G3, item 13): LTV por coorte de primeiro pagamento e
// churn com motivo. Os números vêm de `ltvRetention.js` / `churnReason.js` —
// os mesmos dos scripts diag-ltv-retencao / diag-motivo-nao-renovou.
const formatPercent = (value) => (value == null ? '—' : `${Math.round(value * 100)}%`)

function cohortSentence(cohort) {
  const marks = [['m1', 'no 1º mês'], ['m2', 'em 2 meses'], ['m3', 'em 3 meses'], ['m6', 'em 6 meses']]
  const last = [...marks].reverse().find(([key]) => cohort.retention?.[key])
  if (!last) return 'Coorte recente demais: ainda não dá para dizer quantas ficam.'
  const cell = cohort.retention[last[0]]
  return `Entraram ${cohort.customers} clientes; ${cell.retained} de ${cell.measurable} ainda tinham acesso pago ${last[1]} (${formatPercent(cell.rate)}).`
}

function RetentionPanel({ ltv, churn, loading }) {
  if (loading) return <LoadingState message="Calculando retenção…" />
  if (!ltv || !churn) return <Alert type="error">Não foi possível carregar a retenção agora. Tente de novo em instantes.</Alert>
  const projection = ltv.projection
  return (
    <div className="space-y-6">
      <p className="text-xs text-ds-ink-soft">
        Acesso liberado na mão e conta de teste ficam de fora. “Retida” = ainda tinha acesso <span className="font-bold">pago</span> naquele marco. “—” = coorte nova demais para medir (não é zero).
        {(ltv.truncated || churn.truncated) && ' Atenção: o teto de pagamentos foi atingido, os números podem estar incompletos.'}
      </p>

      <section>
        <h3 className="mb-2 text-sm font-black text-ds-ink">LTV por mês do primeiro pagamento</h3>
        <div className="overflow-x-auto rounded-xl border border-ds-line">
          <table className="adm-zebra min-w-[520px] w-full text-sm">
            <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
              <tr>
                <th className="px-3 py-2">Coorte</th>
                <th className="px-3 py-2">Clientes</th>
                <th className="px-3 py-2">Receita</th>
                <th className="px-3 py-2">1 mês</th>
                <th className="px-3 py-2">2 meses</th>
                <th className="px-3 py-2">3 meses</th>
                <th className="px-3 py-2">6 meses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-line">
              {asArray(ltv.cohorts).length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-ds-ink-soft">Nenhum pagamento aprovado ainda.</td></tr>
              )}
              {asArray(ltv.cohorts).map(cohort => (
                <tr key={cohort.cohort} className="align-top hover:bg-ds-bg">
                  <td className="px-3 py-2 font-bold text-ds-ink">
                    {formatMonth(cohort.cohort)}
                    <p className="mt-1 max-w-[260px] text-[10.5px] font-normal text-ds-ink-soft">{cohortSentence(cohort)}</p>
                  </td>
                  <td className="px-3 py-2 text-ds-ink-soft">{formatNumber(cohort.customers)}</td>
                  <td className="px-3 py-2 text-ds-ink-soft">{formatCurrency(cohort.revenue)}</td>
                  {['m1', 'm2', 'm3', 'm6'].map(key => {
                    const cell = cohort.retention?.[key]
                    return (
                      <td key={key} className="px-3 py-2 text-ds-ink">
                        {cell ? <><span className="font-bold">{formatPercent(cell.rate)}</span> <span className="text-[10.5px] text-ds-ink-soft">({cell.retained}/{cell.measurable})</span></> : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10.5px] text-ds-ink-soft">
          Realizado: {formatNumber(ltv.totals?.payingCustomers)} pagantes, média de {formatCurrency(ltv.totals?.avgLtvRealized)} deixados por cliente.{' '}
          {projection?.projectedLtv != null
            ? `Projeção (estimativa, confiança ${projection.confidence}): ${formatCurrency(projection.projectedLtv)} por cliente ao longo da vida. Não some com o realizado.`
            : `Sem projeção: ${projection?.reason ?? 'amostra pequena'}.`}
        </p>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-black text-ds-ink">Quem deixou de pagar nos últimos {churn.months} meses</h3>
        <p className="mb-2 text-[10.5px] text-ds-ink-soft">{churn.note}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {asArray(churn.byReason).map(item => (
            <div key={item.reason} className="rounded-xl bg-ds-bg p-3 ring-1 ring-ds-line">
              <p className="text-[22px] font-black text-ds-ink">{formatNumber(item.count)}</p>
              <p className="text-[10.5px] text-ds-ink-soft">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-ds-line">
          <table className="adm-zebra min-w-[520px] w-full text-sm">
            <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
              <tr>
                <th className="px-3 py-2">Mês em que venceu</th>
                <th className="px-3 py-2">Voluntário</th>
                <th className="px-3 py-2">Involuntário</th>
                <th className="px-3 py-2">Sem como afirmar</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-line">
              {asArray(churn.monthly).map(row => (
                <tr key={row.month} className="hover:bg-ds-bg">
                  <td className="px-3 py-2 font-bold text-ds-ink">{formatMonth(row.month)}</td>
                  <td className="px-3 py-2 text-ds-ink-soft">{formatNumber(row.voluntario)}</td>
                  <td className="px-3 py-2 text-ds-ink-soft">{formatNumber(row.involuntario)}</td>
                  <td className="px-3 py-2 text-ds-ink-soft">{formatNumber(row.incerto)}</td>
                  <td className="px-3 py-2 font-black text-ds-ink">{formatNumber(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10.5px] text-ds-ink-soft">Amostra pequena: trate como pista, não como causa provada.</p>
      </section>
    </div>
  )
}

function BillingKindBadge({ customer }) {
  const sub = customer?.recurringSubscription
  if (customer?.billingKind === 'recorrente' && sub) {
    // `awaitingConfirmation`: já pagou, falta só a confirmação do Mercado Pago
    // chegar até nós — não é conta parada no meio do caminho.
    const tone = sub.autoRenew
      ? 'bg-ds-accent/20 text-ds-accent-strong'
      : sub.awaitingConfirmation ? 'bg-ds-warn/20 text-ds-warn-ink' : 'bg-ds-bg-soft text-ds-ink-soft'
    return <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${tone}`}>Recorrente · {sub.statusLabel}</span>
  }
  if (customer?.billingKind === 'avulso') {
    return <span className="inline-block rounded-full bg-ds-bg-soft px-2 py-0.5 text-[10.5px] font-bold text-ds-ink-soft">Avulso</span>
  }
  return <span className="text-xs text-ds-ink-faint">—</span>
}

function ManualPaymentModal({ onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ plan: 'pro', days: '30', amount: '55,20', paymentMethod: 'pix', note: '' })
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selected || search.trim().length < 2) return
    let active = true
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.adminUsers({ search: search.trim(), limit: 8, incluirVencidos: 1 })
        if (active) setResults(asArray(data?.users))
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível buscar clientes.')
      } finally { if (active) setSearching(false) }
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [search, selected])

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!selected) { setError('Selecione a cliente que pagou.'); return }
    setSaving(true)
    try {
      const result = await api.adminCreateManualPayment({ userId: selected.id, ...form })
      await onSaved(result)
    } catch (err) {
      setError(err.message || 'Não foi possível registrar o pagamento.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ds-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-ds-surface shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="border-b border-ds-line bg-ds-bg-soft px-6 py-5 text-ds-ink">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.08em] text-ds-accent-strong">Financeiro</p><h2 className="mt-1 text-[15px] font-black">Registrar pagamento por fora</h2><p className="mt-1 text-sm text-ds-ink-soft">Confirme o recebimento e libere o acesso em uma só operação auditada.</p></div>
            <button type="button" onClick={onClose} className="rounded-full bg-ds-surface px-3 py-1.5 text-sm font-bold ring-1 ring-ds-line hover:bg-ds-bg" aria-label="Fechar">Fechar</button>
          </div>
        </div>
        <div className="space-y-5 p-6">
          {error && <Alert type="error">{error}</Alert>}
          <div>
            <label className="text-sm font-bold text-ds-ink">Cliente</label>
            {selected ? (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-ds-accent/40 bg-ds-accent/10 p-3">
                <div><p className="font-bold text-ds-ink">{selected.name || selected.email}</p><p className="text-xs text-ds-accent-strong">{selected.email} · vence {formatDate(selected.accessExpiresAt)}</p></div>
                <button type="button" onClick={() => { setSelected(null); setSearch('') }} className="text-xs font-bold text-ds-accent-strong underline">Trocar</button>
              </div>
            ) : (
              <div className="relative mt-2">
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Busque por nome, e-mail ou telefone" autoFocus className="w-full rounded-xl border border-ds-line px-4 py-3 text-sm outline-none focus:border-ds-accent-strong focus:ring-2 focus:ring-ds-accent/20" />
                {search.trim().length >= 2 && (searching || results.length > 0) && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-ds-line bg-ds-surface shadow-xl">
                  {searching ? <p className="p-3 text-sm text-ds-ink-soft">Buscando...</p> : results.map(user => <button key={user.id} type="button" onClick={() => setSelected(user)} className="block w-full border-b border-ds-line p-3 text-left last:border-0 hover:bg-ds-accent/10"><span className="block text-sm font-bold text-ds-ink">{user.name || 'Sem nome'}</span><span className="block text-xs text-ds-ink-soft">{user.email} · {user.contactPhone || 'sem telefone'}</span></button>)}
                </div>}
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-ds-ink">Plano<select value={form.plan} onChange={event => setForm({ ...form, plan: event.target.value })} className="mt-2 w-full rounded-xl border border-ds-line bg-ds-surface px-4 py-3 font-normal"><option value="basic">Basic</option><option value="pro">Pro</option><option value="premium">Premium</option></select></label>
            <label className="text-sm font-bold text-ds-ink">Dias de acesso<input type="number" min="1" max="3650" value={form.days} onChange={event => setForm({ ...form, days: event.target.value })} className="mt-2 w-full rounded-xl border border-ds-line px-4 py-3 font-normal" /></label>
            <label className="text-sm font-bold text-ds-ink">Valor recebido (R$)<input inputMode="decimal" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className="mt-2 w-full rounded-xl border border-ds-line px-4 py-3 font-normal" /></label>
            <label className="text-sm font-bold text-ds-ink">Forma de pagamento<select value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value })} className="mt-2 w-full rounded-xl border border-ds-line bg-ds-surface px-4 py-3 font-normal"><option value="pix">Pix</option><option value="transfer">Transferência</option><option value="cash">Dinheiro</option><option value="card">Cartão</option><option value="other">Outro</option></select></label>
          </div>
          <label className="block text-sm font-bold text-ds-ink">Observação (opcional)<textarea value={form.note} maxLength={500} onChange={event => setForm({ ...form, note: event.target.value })} placeholder="Ex.: renovação com 20% de desconto, comprovante conferido" className="mt-2 min-h-20 w-full rounded-xl border border-ds-line px-4 py-3 font-normal" /></label>
          <div className="rounded-xl bg-ds-bg-soft p-3 text-xs leading-relaxed text-ds-ink-soft">Os dias serão somados ao vencimento atual se o acesso ainda estiver ativo. Se estiver vencido, contam a partir de hoje. O registro entra na receita e no histórico, sem taxa do Mercado Pago.</div>
          <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-ds-ink-soft hover:bg-ds-line-strong">Cancelar</button><button disabled={saving} className="rounded-xl bg-ds-accent-strong px-5 py-3 text-sm font-black text-ds-surface hover:bg-ds-accent-strong/85 disabled:opacity-60">{saving ? 'Registrando...' : 'Confirmar pagamento'}</button></div>
        </div>
      </form>
    </div>
  )
}

export default function ReceitaPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState(null)
  const [finance, setFinance] = useState(null)
  const [payments, setPayments] = useState(null)
  const [subscriptions, setSubscriptions] = useState(null)
  const [overduePaidList, setOverduePaidList] = useState(null)
  const [paidCustomersList, setPaidCustomersList] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false)
  // Sub-abas. "Cobranças recorrentes" é tentativa a tentativa da assinatura,
  // com o retorno do banco — pergunta de outra natureza que a visão geral.
  const [financeTab, setFinanceTab] = useState('visao')
  // Filtro de tempo COMPARTILHADO entre os Cards (Visão geral) e a tabela de
  // Cobranças recorrentes — as duas respondem "quanto entrou" e não podem
  // discordar sobre o que é "os últimos 30 dias".
  const [financePeriod, setFinancePeriod] = useState('30d')
  const [chargeFilters, setChargeFilters] = useState({ outcome: 'all', q: '' })
  const [chargeSearch, setChargeSearch] = useState('')
  const [charges, setCharges] = useState(null)
  const [roi, setRoi] = useState(null)
  const [roiMonths, setRoiMonths] = useState(12)
  const [reconcilingRoi, setReconcilingRoi] = useState(false)
  const [retention, setRetention] = useState(null)

  function openUserDetail(id) {
    if (!id) return
    router.push(`/admin/clientes/${id}`)
  }

  async function carregar() {
    const [adminData, financeData, paymentsData, subscriptionsData, overdueData, paidData] = await Promise.all([
      api.adminMe(),
      api.adminFinanceOverview({ period: financePeriod }),
      api.adminPayments({ limit: 10 }).catch(() => null),
      api.adminSubscriptions({ limit: 10, status: 'expiring_soon' }).catch(() => null),
      api.adminSubscriptions({ limit: 50, status: 'overdue' }).catch(() => null),
      api.adminSubscriptions({ limit: 50, status: 'paid' }).catch(() => null),
    ])
    setError('')
    setAdmin(adminData)
    setFinance(financeData)
    setPayments(paymentsData)
    setSubscriptions(subscriptionsData)
    setOverduePaidList(overdueData)
    setPaidCustomersList(paidData)
  }

  useEffect(() => {
    let active = true
    // Chamada dentro de um callback, não no corpo do effect: a regra
    // react-hooks/set-state-in-effect do lint do dashboard barra setState síncrono ali.
    Promise.resolve().then(() => carregar())
      .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar a Receita.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Carregando" é DERIVADO do filtro que já foi respondido — o resultado
  // carrega a chave do filtro que o gerou. Sem isso, trocar o período mostraria
  // por um instante o número do período anterior como se fosse o novo.
  const chargeKey = `${financePeriod}|${chargeFilters.outcome}|${chargeFilters.q}`
  const chargesLoading = financeTab === 'cobrancas' && charges?.key !== chargeKey

  useEffect(() => {
    // Só busca quando a sub-aba é aberta — carregar isso no boot custaria
    // consulta para quem nem abriu a aba.
    if (financeTab !== 'cobrancas') return
    let active = true
    api.adminSubscriptionCharges({ ...chargeFilters, period: financePeriod, limit: 100 })
      .then(data => { if (active) setCharges({ ...data, key: chargeKey }) })
      .catch(() => { if (active) setCharges({ charges: [], summary: null, erro: true, key: chargeKey }) })
    return () => { active = false }
  }, [financeTab, chargeFilters, financePeriod, chargeKey])

  // Cards da Visão geral seguem o MESMO período — mesma lógica de "carregando
  // deriva da chave" acima.
  const financeLoading = financeTab === 'visao' && finance != null && finance?.period !== financePeriod

  useEffect(() => {
    if (financeTab !== 'visao' || loading) return
    let active = true
    api.adminFinanceOverview({ period: financePeriod })
      .then(data => { if (active) setFinance(data) })
      .catch(() => {})
    return () => { active = false }
  }, [financeTab, financePeriod, loading])

  // Sub-aba "ROI": passado, presente e futuro do dinheiro. Só busca quando a
  // aba é aberta, e a resposta carrega a chave do horizonte que a gerou.
  const roiLoading = financeTab === 'roi' && roi?.key !== roiMonths

  useEffect(() => {
    if (financeTab !== 'roi') return
    let active = true
    api.adminFinanceRoi(roiMonths)
      .then(data => { if (active) setRoi({ ...data, key: roiMonths }) })
      .catch(() => { if (active) setRoi(null) })
    return () => { active = false }
  }, [financeTab, roiMonths])

  // Sub-aba "Retenção": só busca quando a aba é aberta (uma vez).
  const retentionLoading = financeTab === 'retencao' && retention == null

  useEffect(() => {
    if (financeTab !== 'retencao') return
    let active = true
    Promise.all([api.adminFinanceLtv(), api.adminFinanceChurn(6)])
      .then(([ltv, churn]) => { if (active) setRetention({ ltv, churn }) })
      .catch(() => { if (active) setRetention({ ltv: null, churn: null }) })
    return () => { active = false }
  }, [financeTab])

  async function reconcileRoi() {
    setReconcilingRoi(true)
    try {
      const [financeData, roiData] = await Promise.all([
        api.adminFinanceOverview({ period: financePeriod }),
        api.adminFinanceRoi(roiMonths),
      ])
      setFinance(financeData)
      setRoi({ ...roiData, key: roiMonths })
    } finally {
      setReconcilingRoi(false)
    }
  }

  async function saveFixedCosts(costs) {
    await api.adminUpdateFinanceCosts(costs)
    const roiData = await api.adminFinanceRoi(roiMonths)
    setRoi({ ...roiData, key: roiMonths })
  }

  async function refundPayment(customer) {
    const payment = customer?.lastPayment
    if (!payment?.id || payment?.refund) return
    const reason = window.prompt(`Motivo do reembolso integral de ${formatCurrency(payment.amount)} para ${customer.email}:`)
    if (!reason?.trim()) return
    if (!window.confirm(`Confirmar devolução integral por PIX? A taxa do Mercado Pago continuará como prejuízo.`)) return
    try {
      await api.adminRefundPayment(payment.id, reason.trim())
    } catch (err) {
      setError(err.message || 'Não consegui registrar o reembolso.')
      return
    }
    setPaidCustomersList(null)
    const [financeData, roiData, paidData] = await Promise.all([
      api.adminFinanceOverview({ period: financePeriod }),
      api.adminFinanceRoi(roiMonths),
      api.adminSubscriptions({ limit: 50, status: 'paid' }).catch(() => null),
    ])
    setFinance(financeData)
    setRoi({ ...roiData, key: roiMonths })
    setPaidCustomersList(paidData)
  }

  async function manualPaymentSaved() {
    setManualPaymentOpen(false)
    await carregar().catch((err) => setError(err.message || 'Pagamento registrado, mas não consegui recarregar a tela.'))
  }

  if (loading) return <LoadingState />

  return (
    <main className="min-h-screen bg-ds-bg px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-ds-accent/20 bg-ds-surface/95 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-ds-ink">Receita</span>
              <span className="text-xs font-semibold text-ds-ink-faint">assinaturas, pagamentos, ROI</span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/afiliados" className="rounded-xl border border-ds-warn/40 bg-ds-warn/10 px-3 py-2 text-sm font-semibold text-ds-warn-ink hover:bg-ds-warn/20">Afiliados</Link>
              <button onClick={() => carregar().catch((err) => setError(err.message || 'Falha ao atualizar.'))} className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink hover:bg-ds-bg">Atualizar</button>
              <Link href="/admin" className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink hover:bg-ds-bg">Início</Link>
            </div>
          </div>
        </div>

        {error && <Alert type="error" title="Receita" message={error} />}
        {!finance && !error && <Alert type="warning" title="Receita" message="Sem dados financeiros para mostrar." />}

        {finance && (
          <section className="rounded-2xl bg-ds-surface p-5 shadow-sm ring-1 ring-ds-line">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-accent-strong">Financeiro · Etapa 3</p>
                <h2 className="text-lg font-black text-ds-ink">Assinaturas e pagamentos</h2>
                <p className="text-sm text-ds-ink-soft">MRR ativo, LTV, inadimplência, expirações e últimos pagamentos.</p>
              </div>
              <div className="flex items-center gap-2">
                {admin?.permissions?.includes('billing:write') && <button onClick={() => setManualPaymentOpen(true)} className="rounded-xl bg-ds-accent-strong px-4 py-2 text-xs font-black text-ds-surface shadow-sm hover:bg-ds-accent-strong/85">+ Registrar pagamento por fora</button>}
                <span className="rounded-full bg-ds-accent/20 px-3 py-1 text-xs font-bold text-ds-accent-strong">MRR: {formatCurrency(finance.activeMrr)}</span>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ds-line pb-3">
              <div className="flex flex-wrap gap-2">
                {[['visao', 'Visão geral'], ['roi', 'ROI'], ['retencao', 'Retenção'], ['cobrancas', 'Cobranças recorrentes']].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFinanceTab(id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black ${financeTab === id ? 'bg-ds-accent-strong text-ds-surface' : 'bg-ds-bg-soft text-ds-ink-soft hover:bg-ds-line-strong'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Filtro de tempo compartilhado — vale para os Cards E para a
                  tabela de Cobranças recorrentes, nunca só um dos dois. */}
              <FinancePeriodSelector value={financePeriod} onChange={setFinancePeriod} />
            </div>

            {financeTab === 'roi' && (
              <RoiPanel data={roi} loading={roiLoading} months={roiMonths} onMonths={setRoiMonths} onReconcile={reconcileRoi} reconciling={reconcilingRoi} onSaveCosts={saveFixedCosts} />
            )}

            {financeTab === 'retencao' && (
              <RetentionPanel ltv={retention?.ltv} churn={retention?.churn} loading={retentionLoading} />
            )}

            {financeTab === 'cobrancas' && (
              <SubscriptionChargesPanel
                data={charges}
                loading={chargesLoading}
                filters={chargeFilters}
                onFilters={setChargeFilters}
                testAccountEmails={finance?.excludedTestAccounts}
                search={chargeSearch}
                onSearch={setChargeSearch}
                onOpenDetail={openUserDetail}
              />
            )}

            {financeTab === 'visao' && (<>
            {!!finance.excludedTestAccounts?.length && (
              <p className="mb-3 rounded-xl bg-ds-warn/10 px-3 py-2 text-[10.5px] font-semibold text-ds-warn-ink ring-1 ring-ds-warn/40">
                🧪 Assinatura de teste fora de todas as somas desta aba ({finance.excludedTestAccounts.join(', ')}). Ela continua aparecendo nas listas e nas cobranças recorrentes, com etiqueta.
              </p>
            )}
            <div className={`mb-4 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 transition-opacity ${financeLoading ? 'opacity-50' : ''}`}>
              <div className="rounded-xl bg-ds-accent/10 p-4 ring-1 ring-ds-accent/20">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-accent-strong">Receita bruta · {finance.periodLabel ?? '30 dias'}</p>
                <p className="mt-1 text-[28px] font-black text-ds-accent-strong">{formatCurrency(finance.revenue30d)}</p>
                <p className="mt-1 text-[10.5px] text-ds-accent-strong">{formatNumber(finance.approvedPayments30d)} pagamentos aprovados (avulso + assinatura)</p>
              </div>
              <div className="rounded-xl bg-ds-warn/10 p-4 ring-1 ring-ds-warn/20">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-warn-ink">(–) Comissões de afiliados</p>
                <p className="mt-1 text-[28px] font-black text-ds-warn-ink">− {formatCurrency(finance.affiliateCommissions30d ?? 0)}</p>
                <p className="mt-1 text-[10.5px] text-ds-warn-ink">{formatNumber(finance.affiliateCommissions30dCount ?? 0)} comissões geradas no período</p>
              </div>
              <div className="rounded-xl bg-ds-danger/10 p-4 ring-1 ring-ds-danger/20">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-danger">(–) Taxas Mercado Pago</p>
                <p className="mt-1 text-[28px] font-black text-ds-danger">− {formatCurrency(finance.mpFees30d ?? 0)}</p>
                <p className="mt-1 text-[10.5px] text-ds-danger">{finance.mpFeePercent ?? 0}% do bruto{finance.mpFeeFixedCents ? ` + ${formatCurrency((finance.mpFeeFixedCents ?? 0) / 100)}/transação` : ''}</p>
              </div>
              <div className="rounded-xl bg-ds-danger/10 p-4 ring-1 ring-ds-danger/40">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-danger">(–) Reembolsos por PIX</p>
                <p className="mt-1 text-[28px] font-black text-ds-danger">− {formatCurrency(finance.refunds30d ?? 0)}</p>
                <p className="mt-1 text-[10.5px] text-ds-danger">{formatNumber(finance.refunds30dCount ?? 0)} devolução(ões) · taxa perdida {formatCurrency(finance.refundFeeLoss30d ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-ds-bg-soft p-4 ring-1 ring-ds-line">
                <p className="text-xs font-bold uppercase tracking-wide text-ds-ink-soft">(=) Receita líquida · {finance.periodLabel ?? '30 dias'}</p>
                <p className="mt-1 text-[28px] font-black text-ds-accent-strong">{formatCurrency(finance.netRevenue30d ?? finance.revenue30d)}</p>
                <p className="mt-1 text-[10.5px] text-ds-ink-soft">Após afiliados e taxas do Mercado Pago</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-ds-danger/10 p-3"><p className="text-xs text-ds-danger">Taxa Mercado Pago</p><p className="text-[22px] font-black text-ds-danger">{finance.mpFeePercent ?? 0}%</p><p className="text-[10.5px] text-ds-danger">estimada · ajuste em MP_FEE_PERCENT</p></div>
              <div className="rounded-xl bg-ds-bg p-3"><p className="text-xs text-ds-ink-faint">LTV médio</p><p className="text-[22px] font-black">{formatCurrency(finance.avgLtv)}</p></div>
              <div className="rounded-xl bg-ds-warn/10 p-3"><p className="text-xs text-ds-warn-ink">Comissões a pagar</p><p className="text-[22px] font-black text-ds-warn-ink">{formatCurrency(finance.affiliateCommissionsPayable ?? 0)}</p><p className="text-[10.5px] text-ds-warn-ink">{formatNumber(finance.affiliateCommissionsPayableCount ?? 0)} em aberto</p></div>
              <div className="rounded-xl bg-ds-warn/10 p-3"><p className="text-xs text-ds-warn-ink">Pendentes</p><p className="text-[22px] font-black text-ds-warn-ink">{finance.pendingPayments}</p></div>
              <div className="rounded-xl bg-ds-danger/10 p-3"><p className="text-xs text-ds-danger">Pagos vencidos</p><p className="text-[22px] font-black text-ds-danger">{finance.overduePaid}</p></div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-bold text-ds-ink">Expirações próximas</h3>
                <div className="space-y-2">
                  {asArray(subscriptions?.subscriptions).map(subscription => (
                    <button key={subscription?.id ?? subscription?.email} onClick={() => openUserDetail(subscription?.id)} className="w-full rounded-xl border border-ds-line p-3 text-left text-sm hover:bg-ds-bg">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-ds-ink">
                          {subscription?.email ?? 'Cliente sem e-mail'}
                          <TestAccountTag email={subscription?.email} emails={finance?.excludedTestAccounts} compact className="ml-1 align-middle" />
                        </p>
                        <span className="rounded-full bg-ds-warn/20 px-2 py-1 text-[10.5px] font-bold text-ds-warn-ink">{subscription?.daysRemaining ?? '—'} dias</span>
                      </div>
                      <p className="mt-1 text-xs text-ds-ink-soft">{subscription?.plan ?? '—'} · LTV {formatCurrency(subscription?.ltv)} · expira {formatDate(subscription?.accessExpiresAt)}</p>
                    </button>
                  ))}
                  {!asArray(subscriptions?.subscriptions).length && <p className="text-sm text-ds-ink-faint">Sem assinaturas expirando no filtro atual.</p>}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-ds-ink">Pagamentos recentes</h3>
                <div className="space-y-2">
                  {asArray(payments?.payments).map(payment => (
                    <div key={payment?.id ?? `${payment?.user?.email}-${payment?.createdAt}`} className="rounded-xl border border-ds-line p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-ds-ink">
                          {payment?.user?.email ?? 'Cliente sem e-mail'}
                          <TestAccountTag email={payment?.user?.email} emails={finance?.excludedTestAccounts} compact className="ml-1 align-middle" />
                        </p>
                        <span className={`rounded-full px-2 py-1 text-[10.5px] font-bold ${payment?.status === 'approved' ? 'bg-ds-accent/20 text-ds-accent-strong' : payment?.status === 'pending' ? 'bg-ds-warn/20 text-ds-warn-ink' : 'bg-ds-danger/20 text-ds-danger'}`}>{payment?.status ?? '—'}</span>
                      </div>
                      <p className="mt-1 text-xs text-ds-ink-soft">{payment?.plan ?? '—'} · {formatCurrency(payment?.amount)} · {formatDate(payment?.createdAt)}{payment?.provider === 'manual' ? ` · Por fora (${payment.paymentMethod || 'outro'})` : ''}</p>
                    </div>
                  ))}
                  {!payments?.payments?.length && <p className="text-sm text-ds-ink-faint">Sem pagamentos no período.</p>}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-ds-ink">Pagos vencidos ({formatNumber(overduePaidList?.total ?? finance.overduePaid ?? 0)})</h3>
              <p className="mb-2 text-xs text-ds-ink-soft">Plano pago, conta ainda ativa, acesso já vencido — cobrar renovação.</p>
              <div className="overflow-x-auto rounded-xl border border-ds-line">
                <table className="adm-zebra min-w-full text-sm">
                  <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
                    <tr>
                      <th className="px-3 py-2 font-bold">Cliente</th>
                      <th className="px-3 py-2 font-bold">Plano</th>
                      <th className="px-3 py-2 font-bold">Cobrança</th>
                      <th className="px-3 py-2 font-bold">Venceu em</th>
                      <th className="px-3 py-2 font-bold">Total pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-line">
                    {asArray(overduePaidList?.subscriptions).map(customer => (
                      <tr key={customer.id} className="cursor-pointer hover:bg-ds-bg" onClick={() => openUserDetail(customer.id)}>
                        <td className="px-3 py-2"><span className="font-bold text-ds-ink">{customer.email}</span></td>
                        <td className="px-3 py-2 text-ds-ink-soft">{customer.plan}</td>
                        <td className="px-3 py-2"><BillingKindBadge customer={customer} /></td>
                        <td className="px-3 py-2 text-ds-danger font-semibold">{formatDate(customer.accessExpiresAt)}</td>
                        <td className="px-3 py-2 text-ds-ink-soft">{formatCurrency(customer.ltv)}</td>
                      </tr>
                    ))}
                    {overduePaidList && !asArray(overduePaidList?.subscriptions).length && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-ds-ink-faint">Nenhum cliente pago com acesso vencido agora.</td></tr>
                    )}
                    {!overduePaidList && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-ds-ink-faint">Carregando…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-ds-ink">Todos que já pagaram ({formatNumber(paidCustomersList?.total ?? 0)})</h3>
              <p className="mb-2 text-xs text-ds-ink-soft">Todo cliente com ao menos um pagamento aprovado, avulso ou recorrente, em qualquer situação atual.</p>
              <div className="overflow-x-auto rounded-xl border border-ds-line">
                <table className="adm-zebra min-w-full text-sm">
                  <thead className="bg-ds-surface text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-ink-faint">
                    <tr>
                      <th className="px-3 py-2 font-bold">Cliente</th>
                      <th className="px-3 py-2 font-bold">Plano atual</th>
                      <th className="px-3 py-2 font-bold">Cobrança</th>
                      <th className="px-3 py-2 font-bold">Último pagamento</th>
                      <th className="px-3 py-2 font-bold">Vence em</th>
                      <th className="px-3 py-2 font-bold">Próxima cobrança / cancelou</th>
                      <th className="px-3 py-2 font-bold">Pagamentos</th>
                      <th className="px-3 py-2 font-bold">Total pago</th>
                      <th className="px-3 py-2 font-bold">Reembolso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-line">
                    {asArray(paidCustomersList?.subscriptions).map(customer => {
                      const sub = customer.recurringSubscription
                      const isExpired = customer.accessExpiresAt && new Date(customer.accessExpiresAt) < new Date()
                      return (
                        <tr key={customer.id} className="cursor-pointer hover:bg-ds-bg" onClick={() => openUserDetail(customer.id)}>
                          <td className="px-3 py-2"><span className="font-bold text-ds-ink">{customer.email}</span></td>
                          <td className="px-3 py-2 text-ds-ink-soft">{customer.plan}</td>
                          <td className="px-3 py-2"><BillingKindBadge customer={customer} /></td>
                          <td className="px-3 py-2 text-ds-ink-soft">{formatDate(customer.lastPayment?.createdAt)}</td>
                          <td className={`px-3 py-2 font-semibold ${isExpired ? 'text-ds-danger' : 'text-ds-ink'}`}>{formatDate(customer.accessExpiresAt)}</td>
                          <td className="px-3 py-2 text-ds-ink-soft">
                            {sub?.cancelledAt
                              ? `Cancelou ${formatDate(sub.cancelledAt)}`
                              : sub?.autoRenew
                                ? `Cobra ${formatDate(sub.nextChargeAt)}`
                                : '—'}
                          </td>
                          <td className="px-3 py-2 text-ds-ink-soft">{formatNumber(customer.paidCount)}</td>
                          <td className="px-3 py-2 text-ds-ink-soft">{formatCurrency(customer.ltv)}</td>
                          <td className="px-3 py-2" onClick={event => event.stopPropagation()}>
                            {customer.lastPayment?.refund
                              ? <span className="rounded-full bg-ds-danger/20 px-2 py-1 text-[10.5px] font-black text-ds-danger">Reembolsado por PIX</span>
                              : admin?.permissions?.includes('billing:write') && customer.lastPayment?.id
                                ? <button type="button" onClick={() => refundPayment(customer)} className="rounded-lg border border-ds-danger/40 px-2 py-1 text-[10.5px] font-black text-ds-danger hover:bg-ds-danger/10">Marcar reembolso</button>
                                : '—'}
                          </td>
                        </tr>
                      )
                    })}
                    {paidCustomersList && !asArray(paidCustomersList?.subscriptions).length && (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-ds-ink-faint">Ninguém pagou ainda.</td></tr>
                    )}
                    {!paidCustomersList && (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-ds-ink-faint">Carregando…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </>)}
          </section>
        )}

        {manualPaymentOpen && <ManualPaymentModal onClose={() => setManualPaymentOpen(false)} onSaved={manualPaymentSaved} />}
      </div>
    </main>
  )
}
