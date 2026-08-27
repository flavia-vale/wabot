'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const asArray = (value) => (Array.isArray(value) ? value : [])

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
}

const SITUACAO_LABELS = {
  active: 'Ativo',
  banned: 'Banido',
  suspended: 'Suspenso',
}

// Cada aba mostra no máximo 8 linhas; o resto fica atrás de "ver tudo". É o que
// impede a página de virar parede de detalhe.
const VISIBLE_ROWS = 8

function Card({ label, value, helper }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-black text-slate-900">{value}</p>
      {helper && <p className="text-xs text-slate-500">{helper}</p>}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-800">{value ?? '—'}</span>
    </div>
  )
}

function ExpandableList({ items, render, emptyLabel }) {
  const [expanded, setExpanded] = useState(false)
  const list = asArray(items)
  if (!list.length) return <p className="py-3 text-sm text-slate-400">{emptyLabel}</p>
  const shown = expanded ? list : list.slice(0, VISIBLE_ROWS)
  return (
    <>
      <div className="space-y-2">{shown.map(render)}</div>
      {list.length > VISIBLE_ROWS && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-xs font-bold text-emerald-700 hover:underline">
          {expanded ? 'Mostrar menos' : `Ver tudo (${list.length})`}
        </button>
      )}
    </>
  )
}

function Row({ children }) {
  return <div className="rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-600">{children}</div>
}

function CadastroTab({ cadastro }) {
  const origem = cadastro?.origin
  const origemTexto = origem
    ? origem.type === 'affiliate'
      ? `Afiliado · ${origem.affiliateName || origem.affiliateEmail || origem.affiliateCode || '—'}`
      : origem.type === 'referral'
        ? `Indicação de ${origem.referrerName || origem.referrerEmail}`
        : [origem.label, origem.detail].filter(Boolean).join(' · ')
    : '—'

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <Field label="Nome" value={cadastro?.name} />
        <Field label="E-mail" value={cadastro?.email} />
        <Field label="Celular" value={cadastro?.contactPhone} />
        <Field label="Celular confirmado" value={formatDateTime(cadastro?.phoneVerifiedAt)} />
        <Field label="Situação da conta" value={SITUACAO_LABELS[cadastro?.status] ?? cadastro?.status} />
      </div>
      <div>
        <Field label="Criou a conta" value={`${formatDate(cadastro?.createdAt)}${cadastro?.ageDays != null ? ` (há ${cadastro.ageDays} dias)` : ''}`} />
        <Field label="Veio por" value={origemTexto} />
        <Field label="Último acesso" value={formatDateTime(cadastro?.lastLoginAt)} />
        <Field label="Aceitou os termos" value={cadastro?.termsAcceptedAt ? `${formatDate(cadastro.termsAcceptedAt)} (versão ${cadastro.termsVersion || '—'})` : '—'} />
        <Field label="Código de indicação" value={cadastro?.referralCode} />
      </div>
    </div>
  )
}

function FinanceiroTab({ financeiro }) {
  const trial = financeiro?.trial ?? {}
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Teste grátis" value={trial.converted ? 'Converteu' : trial.expired ? 'Venceu sem assinar' : 'Em andamento'} helper={trial.converted ? `em ${trial.daysToConvert} dias` : trial.endsAt ? `vence ${formatDate(trial.endsAt)}` : null} />
        <Card label="Plano atual" value={financeiro?.planLabel} helper={financeiro?.accessExpiresAt ? `vence ${formatDate(financeiro.accessExpiresAt)}` : 'sem vencimento'} />
        <Card label="Total pago" value={formatCurrency(financeiro?.ltv)} helper={`${financeiro?.paidCount ?? 0} pagamento(s)`} />
        <Card label="Primeiro pagamento" value={formatDate(financeiro?.firstPaymentAt)} helper={financeiro?.lastPaymentAt ? `último: ${formatDate(financeiro.lastPaymentAt)}` : null} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Assinaturas</h3>
          <ExpandableList
            items={financeiro?.subscriptions}
            emptyLabel="Nunca assinou."
            render={(sub) => (
              <Row key={sub.id ?? sub.startedAt}>
                <span className="font-bold text-slate-900">{sub.planLabel}</span> · {sub.status}
                <span className="block text-xs text-slate-500">
                  Assinou {formatDate(sub.startedAt)}
                  {sub.nextChargeAt ? ` · próxima cobrança ${formatDate(sub.nextChargeAt)}` : ''}
                  {sub.cancelledAt ? ` · cancelou ${formatDate(sub.cancelledAt)}` : ''}
                </span>
              </Row>
            )}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Pagamentos</h3>
          <ExpandableList
            items={financeiro?.payments}
            emptyLabel="Sem pagamentos."
            render={(payment) => (
              <Row key={payment.id ?? payment.createdAt}>
                <span className="font-bold text-slate-900">{formatCurrency(payment.amount)}</span> · {payment.planLabel} · {payment.status}
                <span className="block text-xs text-slate-500">{formatDate(payment.createdAt)}{payment.expiresAt ? ` · acesso até ${formatDate(payment.expiresAt)}` : ''}</span>
              </Row>
            )}
          />
        </div>
      </div>

      {asArray(financeiro?.manualGrants).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Acessos liberados na mão</h3>
          <ExpandableList
            items={financeiro?.manualGrants}
            emptyLabel="Nenhum."
            render={(grant) => (
              <Row key={grant.at}>
                {formatDateTime(grant.at)}
                {grant.reason && <span className="block text-xs text-slate-500">{grant.reason}</span>}
              </Row>
            )}
          />
        </div>
      )}
    </div>
  )
}

function TecnicoTab({ tecnico }) {
  const quedas = tecnico?.disconnects ?? {}
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="WhatsApp" value={tecnico?.waStatus === 'connected' ? 'Conectado' : 'Fora do ar'} helper={tecnico?.waLifecycle === 'reconnecting' ? 'tentando reconectar sozinho' : null} />
        <Card label="Robô" value={tecnico?.botRunning ? 'Rodando' : 'Parado'} helper={tecnico?.lastHeartbeatAt ? `sinal ${formatDateTime(tecnico.lastHeartbeatAt)}` : null} />
        <Card label="Quedas 7 dias" value={formatNumber(quedas.last7d)} helper={`24h: ${formatNumber(quedas.last24h)} · 30d: ${formatNumber(quedas.last30d)}`} />
        <Card label="Última queda" value={tecnico?.lastDisconnectCode || '—'} helper="código informado pelo WhatsApp" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Por que caiu (30 dias)</h3>
          <ExpandableList
            items={quedas.topCodes}
            emptyLabel="Nenhuma queda registrada."
            render={(item) => (
              <Row key={item.code}>
                <span className="font-bold text-slate-900">{item.count}×</span> código {item.code}
              </Row>
            )}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Erros de envio (30 dias)</h3>
          <ExpandableList
            items={tecnico?.errorsByCategory30d}
            emptyLabel="Nenhum erro registrado."
            render={(item) => (
              <Row key={item.category}>
                <span className="font-bold text-slate-900">{item.count}×</span> {item.label}
              </Row>
            )}
          />
        </div>
      </div>

      {asArray(tecnico?.credentialHealth).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Lojas cadastradas</h3>
          <div className="flex flex-wrap gap-2">
            {asArray(tecnico.credentialHealth).map(health => (
              <span
                key={health.platform}
                className={`rounded-full px-3 py-1 text-xs font-bold ${health.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}
              >
                {health.label || health.platform}{health.configured ? '' : ' · falta preencher'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Sparkline({ series }) {
  const data = asArray(series)
  const max = Math.max(1, ...data.map(day => day.success + day.error))
  return (
    <div className="flex h-16 items-end gap-[3px]">
      {data.map(day => {
        const total = day.success + day.error
        return (
          <div
            key={day.date}
            title={`${formatDate(day.date)}: ${day.success} enviadas${day.error ? `, ${day.error} com erro` : ''}`}
            className="flex-1 rounded-t bg-emerald-400"
            style={{ height: `${Math.max(2, (total / max) * 100)}%`, opacity: day.error ? 0.6 : 1 }}
          />
        )
      })}
    </div>
  )
}

function UsoTab({ uso }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Grupos monitorados" value={formatNumber(uso?.groupCounts?.monitor)} helper={`${formatNumber(uso?.groupCounts?.post)} de destino`} />
        <Card label="Enviadas em 30 dias" value={formatNumber(uso?.success30d)} helper={`7 dias: ${formatNumber(uso?.success7d)} · 24h: ${formatNumber(uso?.success24h)}`} />
        <Card label="Enviadas desde sempre" value={formatNumber(uso?.sendCountTotal)} helper={uso?.lastMessageAt ? `última ${formatDateTime(uso.lastMessageAt)}` : 'nunca enviou'} />
        <Card label="Automações" value={formatNumber(uso?.automations?.enabled)} helper={`${formatNumber(uso?.automations?.total)} cadastradas`} />
      </div>

      <div className="rounded-2xl border border-slate-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Envios por dia (30 dias)</h3>
          <span className="text-xs text-slate-500">{formatNumber(uso?.error30d)} com erro · {formatNumber(uso?.dedupBlocked30d)} repetições bloqueadas</span>
        </div>
        <Sparkline series={uso?.byDay} />
      </div>
    </div>
  )
}

const KIND_STYLES = {
  cadastro: ['bg-slate-100 text-slate-700', 'Cadastro'],
  financeiro: ['bg-emerald-100 text-emerald-800', 'Financeiro'],
  tecnico: ['bg-red-100 text-red-700', 'Técnico'],
  uso: ['bg-sky-100 text-sky-800', 'Uso'],
  suporte: ['bg-violet-100 text-violet-800', 'Suporte'],
}

function Timeline({ events }) {
  const list = asArray(events)
  if (!list.length) return <p className="text-sm text-slate-400">Sem histórico ainda.</p>
  return (
    <ol className="space-y-3">
      {list.map((event, index) => {
        const [tone, label] = KIND_STYLES[event.kind] ?? ['bg-slate-100 text-slate-700', event.kind]
        return (
          <li key={`${event.at}-${index}`} className="border-l-2 border-slate-100 pl-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{label}</span>
              <span className="text-xs text-slate-400">{formatDate(event.at)}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">{event.title}</p>
            {event.detail && <p className="text-xs text-slate-500">{event.detail}</p>}
          </li>
        )
      })}
    </ol>
  )
}

const TABS = [
  ['cadastro', 'Cadastro'],
  ['financeiro', 'Financeiro'],
  ['tecnico', 'Técnico'],
  ['uso', 'Uso'],
]

export default function AdminClienteHistoricoPage() {
  const params = useParams()
  const id = params?.id
  const [tab, setTab] = useState('cadastro')
  // Estado único carimbado com o cliente que o produziu. "Carregando" e "erro"
  // são DERIVADOS — flag de loading setada dentro do efeito dispara
  // renderização em cascata (react-hooks/set-state-in-effect) e ainda podia
  // mostrar o histórico de um cliente enquanto a URL já apontava para outro.
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    api.adminCustomerHistory(id)
      .then(history => { if (!cancelled) setResult({ id, history, error: '' }) })
      .catch(err => { if (!cancelled) setResult({ id, history: null, error: err?.message || 'Não foi possível carregar o histórico.' }) })
    return () => { cancelled = true }
  }, [id])

  const isCurrent = result?.id === id
  const loading = !isCurrent
  const error = isCurrent ? result.error : ''
  const history = isCurrent ? result.history : null

  if (loading) return <main className="min-h-screen bg-slate-50 px-5 py-8"><LoadingState /></main>
  if (error) return <main className="min-h-screen bg-slate-50 px-5 py-8"><div className="mx-auto max-w-3xl"><Alert type="error" title="Histórico do cliente" message={error} /></div></main>
  if (!history) return null

  const headline = history.headline ?? {}

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Histórico do cliente</p>
            <h1 className="text-2xl font-black text-slate-900">{history.cadastro?.name || history.cadastro?.email}</h1>
            <p className="text-sm text-slate-500">{history.cadastro?.email} · {history.cadastro?.contactPhone || 'sem celular'}</p>
          </div>
          <Link href="/admin/clientes" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Voltar à lista</Link>
        </div>

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Situação" value={SITUACAO_LABELS[headline.situacao] ?? headline.situacao ?? '—'} />
          <Card label="Plano" value={headline.plano} />
          <Card label="Vence em" value={formatDate(headline.vencimento)} />
          <Card label="Total pago" value={formatCurrency(headline.ltv)} />
          <Card label="Envios 30d" value={formatNumber(headline.envios30d)} />
          <Card label="Quedas 7d" value={formatNumber(headline.quedas7d)} />
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <nav className="mb-4 flex flex-wrap gap-1">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === key ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'cadastro' && <CadastroTab cadastro={history.cadastro} />}
            {tab === 'financeiro' && <FinanceiroTab financeiro={history.financeiro} />}
            {tab === 'tecnico' && <TecnicoTab tecnico={history.tecnico} />}
            {tab === 'uso' && <UsoTab uso={history.uso} />}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-800">Linha do tempo</h2>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <Timeline events={history.timeline} />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
