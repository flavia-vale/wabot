'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Tooltip } from '@/components/Tooltip'

const PERIODS = [
  ['today', 'Hoje'],
  ['7d', '7 dias'],
  ['30d', '30 dias'],
]

const CARDS = [
  {
    key: 'success',
    label: 'Enviadas com sucesso',
    icon: '✅',
    tone: 'good',
    tooltip:
      'Promoções que chegaram no(s) seu(s) canal/grupo de destino sem problema. Esse é o número que importa: significa que o ciclo todo funcionou — conversão de link, envio e entrega.',
  },
  {
    key: 'skippedDedup',
    label: 'Bloqueadas por repetição',
    icon: '⏭',
    tone: 'neutral',
    tooltip:
      'O mesmo link já saiu nas últimas 2 horas. Bloqueamos para os seus assinantes não receberem a mesma promoção duas vezes. Isso é proteção, não erro.',
  },
  {
    key: 'skippedConfig',
    label: 'Bloqueadas pelas suas regras',
    icon: '🛡',
    tone: 'neutral',
    tooltip:
      'Promoções que não saíram porque caíram em algum filtro que você configurou: palavra-chave proibida, link sem conversão de afiliado ou inconsistência entre o link e o texto da oferta.',
  },
  {
    key: 'timeoutTotal',
    label: 'Atraso ou lentidão',
    icon: '⏱',
    tone: 'warn',
    tooltip:
      'A promoção demorou mais do que esperamos para ser processada ou enviada. Geralmente é o site do produto (Amazon, Shopee) respondendo devagar. Se aparecer muito, fale com a gente.',
  },
  {
    key: 'errorOther',
    label: 'Outras falhas',
    icon: '❌',
    tone: 'bad',
    tooltip:
      'Erros que vieram do próprio WhatsApp ou do canal de destino (ex: canal sem permissão de postagem). Tentamos enviar 3 vezes antes de desistir. Se persistir num canal específico, verifique se o bot ainda tem permissão de admin nele.',
  },
  {
    key: 'inFlight',
    label: 'Em andamento agora',
    icon: '🔄',
    tone: 'info',
    tooltip:
      'Promoções esperando a vez ou sendo enviadas neste exato momento. Em fluxo normal esse número fica baixo (1 a 5). Se ficar alto e parado, pode ser sinal de instabilidade na conexão.',
  },
]

const TONE_STYLES = {
  good: 'bg-green-50 border-green-200 text-green-800',
  neutral: 'bg-slate-50 border-slate-200 text-slate-700',
  warn: 'bg-amber-50 border-amber-200 text-amber-800',
  bad: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

function formatNumber(n) {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('pt-BR')
}

function formatPercent(rate) {
  if (rate === null || rate === undefined) return '—'
  return `${Math.round(rate * 100)}%`
}

function MetricCard({ card, value }) {
  const tone = TONE_STYLES[card.tone] || TONE_STYLES.neutral
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">
          <span className="mr-1" aria-hidden="true">{card.icon}</span>
          {card.label}
        </span>
        <Tooltip content={card.tooltip} label={`Sobre: ${card.label}`} />
      </div>
      <div className="mt-1 text-2xl font-bold leading-tight">{formatNumber(value)}</div>
    </div>
  )
}

function DeliveryRateCard({ rate }) {
  const tone = rate === null
    ? TONE_STYLES.neutral
    : rate >= 0.9 ? TONE_STYLES.good
    : rate >= 0.7 ? TONE_STYLES.warn
    : TONE_STYLES.bad
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">
          <span className="mr-1" aria-hidden="true">📊</span>
          Taxa de entrega
        </span>
        <Tooltip
          content="De cada 100 promoções processadas com sucesso ou falha, quantas chegaram no destino. Bloqueios por repetição ou pelas suas regras não contam aqui — esse número mede só o quanto o envio em si está funcionando."
          label="Sobre: Taxa de entrega"
        />
      </div>
      <div className="mt-1 text-2xl font-bold leading-tight">{formatPercent(rate)}</div>
    </div>
  )
}

export function LogsSummary() {
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const loading = !error && (!data || data.period !== period)

  useEffect(() => {
    let active = true
    api.logsSummary(period)
      .then(d => { if (active) { setData(d); setError('') } })
      .catch(e => { if (active) { setError(e.message || 'Falha ao carregar resumo') } })
    return () => { active = false }
  }, [period])

  return (
    <section aria-labelledby="logs-summary-title" className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="logs-summary-title" className="text-sm font-semibold text-gray-700">
          Como o bot está trabalhando
        </h2>
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5" role="tablist" aria-label="Período do resumo">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                period === value ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Não foi possível carregar o resumo: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {CARDS.map(card => (
          <MetricCard key={card.key} card={card} value={loading ? null : data?.counts?.[card.key] ?? 0} />
        ))}
        <DeliveryRateCard rate={loading ? null : data?.deliveryRate} />
      </div>
    </section>
  )
}
