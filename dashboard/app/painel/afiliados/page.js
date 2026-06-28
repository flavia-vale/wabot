'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const PIX_KEY_TYPE_LABELS = { cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória' }
const DEFAULT_AFFILIATE_CONFIG = { commissionPercent: 30, commissionRecurringPercent: 30, recurringCommissionEnabled: true, commissionHoldDays: 30, attributionWindowDays: 30 }

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatMonth(yyyyMm) {
  const [year, month] = yyyyMm.split('-')
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1))
}

function copyToClipboard(text, onCopied) {
  navigator.clipboard.writeText(text).then(onCopied).catch(() => {})
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

function ReferralStatusBadge({ active }) {
  return active
    ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Ativo</span>
    : <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-bold text-gray-600">Inativo</span>
}

function MyReferrals() {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    let active = true
    api.affiliateMeReferrals({ limit: '100' })
      .then(result => { if (active) setData(result) })
      .catch(() => { if (active) setData(null) })
    return () => { active = false }
  }, [])

  if (data === undefined) return null
  const referrals = data?.referrals ?? []
  if (referrals.length === 0) return null

  return (
    <div>
      <h2 className="text-base font-bold text-gray-800 mb-2">Meus indicados</h2>
      <p className="text-xs text-gray-500 mb-2">Por privacidade, mostramos apenas o nome parcial dos clientes.</p>
      <div className="rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[460px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Cliente</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Cadastro</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Situação</th>
              <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Pagamentos</th>
              <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Comissão gerada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {referrals.map((r, i) => (
              <tr key={i} className="bg-white">
                <td className="px-4 py-3 text-gray-800">{r.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3"><ReferralStatusBadge active={r.isActive} /></td>
                <td className="px-4 py-3 text-right text-gray-700">{r.paymentCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(r.commissionTotalCents ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, helper = null }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 break-words text-2xl font-black text-gray-900">{value}</p>
      {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </div>
  )
}

const MONTH_STATUS_LABELS = {
  paid: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700' },
  approved: { label: 'Aprovado', className: 'bg-blue-100 text-blue-700' },
  eligible: { label: 'Liberado', className: 'bg-cyan-100 text-cyan-700' },
  pending: { label: 'Aguardando 30 dias', className: 'bg-amber-100 text-amber-700' },
  held: { label: 'Em análise', className: 'bg-orange-100 text-orange-700' },
  reversed: { label: 'Estornado', className: 'bg-red-100 text-red-700' },
}

function MonthStatusBadge({ status }) {
  const meta = MONTH_STATUS_LABELS[status] ?? { label: 'Pendente', className: 'bg-amber-100 text-amber-700' }
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
}

function AffiliateRulesCard({ config = DEFAULT_AFFILIATE_CONFIG, affiliateLink = null }) {
  const commissionPercent = Number(config.commissionPercent ?? DEFAULT_AFFILIATE_CONFIG.commissionPercent)
  const recurringPercent = Number(config.commissionRecurringPercent ?? DEFAULT_AFFILIATE_CONFIG.commissionRecurringPercent)
  const holdDays = Number(config.commissionHoldDays ?? DEFAULT_AFFILIATE_CONFIG.commissionHoldDays)
  const attributionDays = Number(config.attributionWindowDays ?? DEFAULT_AFFILIATE_CONFIG.attributionWindowDays)
  const recurringEnabled = config.recurringCommissionEnabled ?? DEFAULT_AFFILIATE_CONFIG.recurringCommissionEnabled

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950" aria-labelledby="affiliate-rules-title">
      <p className="text-xs font-black uppercase tracking-wide text-amber-700">Regras do programa</p>
      <h2 id="affiliate-rules-title" className="mt-1 text-lg font-black text-amber-950">Leia antes de divulgar seu link</h2>

      <div className="mt-4 grid gap-4">
        <div className="rounded-xl bg-white/70 border border-amber-100 p-4">
          <h3 className="font-black text-amber-950">💰 Comissão</h3>
          <p className="mt-1 leading-6">
            Você recebe <strong>{commissionPercent}% de comissão</strong> sobre a primeira compra confirmada de cada cliente indicado.
            {recurringEnabled && <> Pagamentos recorrentes elegíveis podem gerar <strong>{recurringPercent}% de comissão recorrente</strong>, conforme as regras vigentes do programa.</>}
          </p>
        </div>

        <div className="rounded-xl bg-white/70 border border-amber-100 p-4">
          <h3 className="font-black text-amber-950">⏳ Regra de repasse e segurança (estorno/reembolso)</h3>
          <p className="mt-1 leading-6">
            Como toda transação digital e por respeito às leis de proteção ao consumidor, cada cliente tem direito a solicitar reembolso dentro do prazo legal.
            Por isso, o repasse da comissão só é válido <strong>{holdDays} dias após o pagamento do cliente</strong>.
          </p>
          <p className="mt-2 leading-6">
            Essa medida é necessária porque, caso o usuário peça reembolso, o valor é devolvido integralmente a ele — ou seja, nem nós, nem você ficamos com o dinheiro.
            Passados os <strong>{holdDays} dias de segurança</strong>, o saldo fica elegível para liberação/pagamento via PIX.
          </p>
        </div>

        <div className="rounded-xl bg-white/70 border border-amber-100 p-4">
          <h3 className="font-black text-amber-950">🔗 Como o sistema sabe que a indicação foi sua?</h3>
          <p className="mt-1 leading-6">
            Para que a comissão seja contabilizada corretamente, o cliente indicado precisa obrigatoriamente se cadastrar usando o seu link exclusivo.
            Se ele entrar pelo site geral sem o seu link, o sistema não consegue rastrear a venda para você.
          </p>
          <p className="mt-2 leading-6">
            A janela de atribuição atual é de <strong>{attributionDays} dias</strong>, e a atribuição é congelada no momento do pagamento para reduzir disputas e perda de rastreio.
          </p>
          {affiliateLink ? (
            <p className="mt-2 leading-6">Use sempre este link: <code className="rounded bg-amber-100 px-1 py-0.5 text-xs break-all">{affiliateLink}</code></p>
          ) : (
            <p className="mt-2 leading-6">Você pode resgatar seu link personalizado nesta página, em <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-bold text-amber-800 break-all">https://espelhagrupos.com.br/painel/afiliados</code>.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function ApplyForm({ onApplied }) {
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('cpf')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pixKey.trim()) return setError('Informe a chave PIX')
    setLoading(true)
    setError('')
    try {
      await api.affiliateApply({ pixKey: pixKey.trim(), pixKeyType })
      onApplied()
    } catch (err) {
      setError(err.message || 'Não foi possível enviar a candidatura agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo da chave PIX</label>
        <select
          value={pixKeyType}
          onChange={e => setPixKeyType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-900 w-full outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="cpf">CPF</option>
          <option value="email">E-mail</option>
          <option value="phone">Telefone</option>
          <option value="random">Chave aleatória</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
        <input
          type="text"
          placeholder="Sua chave PIX para receber comissões"
          value={pixKey}
          onChange={e => setPixKey(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-900 w-full outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>
      {error && <Alert type="error" message={error} />}
      <button
        type="submit"
        disabled={loading}
        className="bg-emerald-600 text-white rounded-lg py-2 font-semibold disabled:opacity-50 hover:bg-emerald-700 transition"
      >
        {loading ? 'Enviando...' : 'Solicitar entrada no programa'}
      </button>
    </form>
  )
}

function PixEditForm({ profile, onUpdated }) {
  const [pixKey, setPixKey] = useState(profile.pixKey)
  const [pixKeyType, setPixKeyType] = useState(profile.pixKeyType)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pixKey.trim()) return setMessage('Informe a chave PIX')
    setLoading(true)
    setMessage('')
    try {
      await api.affiliateMeUpdate({ pixKey: pixKey.trim(), pixKeyType })
      setMessage('Chave PIX atualizada com sucesso.')
      onUpdated()
    } catch (err) {
      setMessage(err.message || 'Não foi possível atualizar agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-100 bg-gray-50 p-4 mt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">Atualizar chave PIX</p>
      <div className="flex flex-col gap-3">
        <select
          value={pixKeyType}
          onChange={e => setPixKeyType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="cpf">CPF</option>
          <option value="email">E-mail</option>
          <option value="phone">Telefone</option>
          <option value="random">Chave aleatória</option>
        </select>
        <input
          type="text"
          value={pixKey}
          onChange={e => setPixKey(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-emerald-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50 hover:bg-emerald-700 transition"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </div>
    </form>
  )
}

export default function AffiliatePage() {
  const [data, setData] = useState(undefined)
  const [copied, setCopied] = useState(false)
  const [showPixEdit, setShowPixEdit] = useState(false)

  function loadData() {
    Promise.all([
      api.affiliateMe(),
      api.affiliateConfig().catch(() => DEFAULT_AFFILIATE_CONFIG),
    ])
      .then(([result, config]) => setData({ ...result, config }))
      .catch(() => setData(null))
  }

  useEffect(() => {
    let active = true
    Promise.all([
      api.affiliateMe(),
      api.affiliateConfig().catch(() => DEFAULT_AFFILIATE_CONFIG),
    ])
      .then(([result, config]) => { if (active) setData({ ...result, config }) })
      .catch(() => { if (active) setData(null) })
    return () => { active = false }
  }, [])

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    )
  }

  const profile = data?.profile ?? null
  const affiliateConfig = data?.config ?? DEFAULT_AFFILIATE_CONFIG

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-black text-gray-900 mb-2">Programa de Afiliados</h1>
        <p className="text-gray-600 text-sm mb-4">
          Ganhe {affiliateConfig.commissionPercent ?? 30}% de comissão sobre a primeira compra de cada cliente que você indicar.
          Compartilhe seu link único, acompanhe indicações e receba via PIX após a janela de segurança.
        </p>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 mb-4">
          <ul className="text-sm text-emerald-800 space-y-1">
            <li>✅ Código e link únicos gerados automaticamente</li>
            <li>✅ Comissão de {affiliateConfig.commissionPercent ?? 30}% sobre a primeira compra</li>
            <li>✅ Pagamento via PIX após {affiliateConfig.commissionHoldDays ?? 30} dias de segurança</li>
            <li>✅ Painel para acompanhar indicações e ganhos</li>
          </ul>
        </div>
        <AffiliateRulesCard config={affiliateConfig} />
        <ApplyForm onApplied={loadData} />
      </div>
    )
  }

  if (profile.status === 'pending') {
    return (
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-black text-gray-900 mb-4">Programa de Afiliados</h1>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-amber-800 font-semibold">Candidatura em análise</p>
          <p className="text-amber-700 text-sm mt-1">Sua candidatura está em análise. Você receberá uma resposta em breve.</p>
        </div>
        <div className="mt-4"><AffiliateRulesCard config={affiliateConfig} /></div>
      </div>
    )
  }

  if (profile.status === 'rejected') {
    return (
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-2xl font-black text-gray-900 mb-4">Programa de Afiliados</h1>
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 mb-4">
          <p className="text-red-800 font-semibold">Candidatura não aprovada</p>
          {profile.adminNotes && <p className="text-red-700 text-sm mt-1">{profile.adminNotes}</p>}
        </div>
        <AffiliateRulesCard config={affiliateConfig} />
        <ApplyForm onApplied={loadData} />
      </div>
    )
  }

  const affiliateLink = `https://espelhagrupos.com.br/cadastro?aff=${profile.code}`
  const { stats = {}, months = [] } = data

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-black text-gray-900">Programa de Afiliados</h1>

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-2">Seu link de indicação</p>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <code className="w-full min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-800 break-all">
            {affiliateLink}
          </code>
          <button
            onClick={() => copyToClipboard(affiliateLink, () => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
            className="min-h-11 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto whitespace-nowrap"
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <p className="mt-2 break-words text-xs text-emerald-600">Código: <strong className="break-all">{profile.code}</strong> · PIX: <span className="break-all">{profile.pixKey}</span> ({PIX_KEY_TYPE_LABELS[profile.pixKeyType] ?? profile.pixKeyType})</p>
      </div>

      <AffiliateRulesCard config={affiliateConfig} affiliateLink={affiliateLink} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de indicados" value={stats.totalReferrals ?? 0} />
        <StatCard label="Vendas válidas" value={stats.totalSales ?? 0} helper="Não inclui estornos/reembolsos." />
        <StatCard label="Saldo a liberar" value={formatCurrency(stats.pendingCents ?? 0)} helper="Aguardando a janela de segurança." />
        <StatCard label="Disponível para saque" value={formatCurrency(stats.payableCents ?? 0)} helper="Comissões liberadas ou aprovadas." />
        <StatCard label="Total pago" value={formatCurrency(stats.totalEarnedCents ?? 0)} helper="Somente valores já pagos via PIX." />
        <StatCard label="Estornado/revertido" value={formatCurrency(stats.reversedCents ?? 0)} helper="Reembolsos e chargebacks removidos do saldo." />
      </div>

      <MyReferrals />

      {months.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-2">Histórico por mês</h2>
          <div className="rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[440px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Mês</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Vendas</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Valor</th>
                  <th className="text-right px-4 py-2 text-xs font-bold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {months.map(m => (
                  <tr key={m.month} className="bg-white">
                    <td className="px-4 py-3 text-gray-800">{formatMonth(m.month)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{m.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(m.totalCents)}</td>
                    <td className="px-4 py-3 text-right"><MonthStatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <button
          onClick={() => setShowPixEdit(v => !v)}
          className="text-sm text-emerald-700 hover:underline font-semibold"
        >
          {showPixEdit ? 'Cancelar edição' : 'Editar chave PIX'}
        </button>
        {showPixEdit && <PixEditForm profile={profile} onUpdated={() => { setShowPixEdit(false); loadData() }} />}
      </div>
    </div>
  )
}
