'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { HelpLink } from '@/components/HelpLink'

const PLAN_LABELS = { trial: 'Teste grátis', basic: 'Basic', pro: 'Pro' }
const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', cancelled: 'Cancelado' }

const PLAN_CARDS = [
  {
    id: 'trial',
    name: 'Teste grátis',
    price: 'R$0',
    priceClass: 'text-gray-700',
    buttonClass: 'bg-gray-700 hover:bg-gray-800',
    cardClass: 'border border-gray-100',
    description: 'Experimente o fluxo principal antes de escolher um plano pago.',
    features: ['Conversão de links suportados', 'Monitoramento de grupos', 'Envio para grupos de destino', 'Histórico de logs', 'Com anúncios'],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 'R$50',
    priceClass: 'text-blue-600',
    buttonClass: 'bg-blue-600 hover:bg-blue-700',
    cardClass: 'border border-transparent',
    description: 'Mesmos recursos técnicos do Pro, com anúncios durante o uso.',
    features: ['Conversão de links suportados', 'Monitoramento de grupos', 'Envio para grupos de destino', 'Histórico de logs', 'Com anúncios'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$100',
    priceClass: 'text-purple-600',
    buttonClass: 'bg-purple-600 hover:bg-purple-700',
    cardClass: 'border-2 border-purple-300',
    badge: 'Mais escolhido',
    description: 'Mesmos recursos técnicos do Basic, sem anúncios durante o uso.',
    features: ['Conversão de links suportados', 'Monitoramento de grupos', 'Envio para grupos de destino', 'Histórico de logs', 'Sem anúncios'],
  },
]

function daysLeft(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.max(0, Math.ceil(diff / 86400000))
}

function PlanosContent() {
  const searchParams = useSearchParams()
  const redirectStatus = searchParams.get('status')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [recoverPaymentId, setRecoverPaymentId] = useState('')
  const [recoverLoading, setRecoverLoading] = useState(false)
  const [recoverError, setRecoverError] = useState('')
  const [recoverSuccess, setRecoverSuccess] = useState('')

  useEffect(() => {
    let active = true
    api.paymentsStatus()
      .then((res) => { if (active) setData(res) })
      .catch((err) => { if (active) setLoadError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleCheckout(plan) {
    setCheckoutError('')
    setCheckoutLoading(plan)
    try {
      const { checkout_url } = await api.paymentsCheckout(plan)
      window.location.assign(checkout_url)
    } catch (err) {
      setCheckoutError(err.message)
    } finally {
      setCheckoutLoading('')
    }
  }

  async function handleRecover(e) {
    e.preventDefault()
    const trimmed = recoverPaymentId.trim()
    if (!trimmed) return
    setRecoverError('')
    setRecoverSuccess('')
    setRecoverLoading(true)
    try {
      const res = await api.paymentsRecover(trimmed)
      const days = daysLeft(res.accessExpiresAt)
      const planLabel = PLAN_LABELS[res.plan] ?? res.plan
      setRecoverSuccess(res.alreadyApplied
        ? `Esse pagamento já está aplicado. Plano ${planLabel} ativo por mais ${days} dia${days !== 1 ? 's' : ''}.`
        : `Acesso ${planLabel} ativado por 30 dias.`)
      setRecoverPaymentId('')
      const refreshed = await api.paymentsStatus().catch(() => null)
      if (refreshed) setData(refreshed)
    } catch (err) {
      setRecoverError(err.message)
    } finally {
      setRecoverLoading(false)
    }
  }

  async function copyRef() {
    const url = `${window.location.origin}/login?ref=${data.referralCode}`
    setCopyError('')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {
      setCopyError('Não foi possível copiar automaticamente. Selecione e copie o link manualmente.')
      const input = document.getElementById('ref-link-input')
      if (input) { input.focus(); input.select() }
    }
  }

  if (loading) return <p className="text-gray-500">Carregando...</p>
  if (loadError) return <p className="text-red-500 text-sm">{loadError}</p>

  const days = daysLeft(data?.accessExpiresAt)
  const planLabel = PLAN_LABELS[data?.plan] ?? data?.plan
  const hasConfirmedPaidAccess = ['basic', 'pro'].includes(data?.plan) && data?.isActive

  return (
    <div className="max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Planos</h2>
        <HelpLink topic="pagamento-pendente">Ajuda</HelpLink>
      </div>
      <p className="text-gray-500 text-sm mb-6">Escolha entre Teste grátis, Basic e Pro. Após pagar um plano pago, informe o ID do pagamento abaixo para ativar.</p>

      {redirectStatus === 'success' && hasConfirmedPaidAccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-5 text-sm">
          Acesso de 30 dias ativo.
        </div>
      )}
      {redirectStatus === 'success' && !hasConfirmedPaidAccess && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl p-4 mb-5 text-sm">
          Pagamento recebido pelo Mercado Pago. Cole o ID do pagamento (recebido por e-mail ou na tela de confirmação do MP) no formulário abaixo para ativar seu acesso.
        </div>
      )}
      {redirectStatus === 'failure' && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-5 text-sm">
          Pagamento não aprovado. Tente novamente.
        </div>
      )}
      {redirectStatus === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl p-4 mb-5 text-sm">
          Pagamento em análise. Você será notificado quando aprovado.
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-5 mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-gray-700">Plano atual</span>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            data?.plan === 'pro' ? 'bg-purple-100 text-purple-700' :
            data?.plan === 'basic' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>{planLabel}</span>
        </div>
        {data?.accessExpiresAt && (
          <p className="text-sm text-gray-500">
            {data.isActive
              ? `Acesso válido por mais ${days} dia${days !== 1 ? 's' : ''}`
              : 'Acesso expirado'}
          </p>
        )}
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5 text-xs text-indigo-800">
        <p className="font-semibold mb-2">Comparativo rápido</p>
        <ul className="space-y-1"><li><strong>Teste grátis</strong>: permite experimentar o fluxo principal sem informar duração no painel público.</li><li><strong>Basic</strong>: mesmos recursos técnicos do Pro, com anúncios.</li><li><strong>Pro</strong>: mesmos recursos técnicos do Basic, sem anúncios.</li></ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {PLAN_CARDS.map(plan => {
          const isCurrentPlan = data?.plan === plan.id && data?.isActive
          return (
            <div key={plan.id} className={`bg-white rounded-2xl shadow p-5 ${plan.cardClass}`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-800">{plan.name}</h3>
                {plan.badge && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{plan.badge}</span>}
              </div>
              <p className={`text-3xl font-bold ${plan.priceClass} mb-1`}>{plan.price}{plan.id !== 'trial' && <span className="text-sm font-normal text-gray-400"> / 30 dias</span>}</p>
              <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
              <ul className="text-xs text-gray-500 space-y-1 mb-4">
                {plan.features.map(feature => <li key={feature}>✅ {feature}</li>)}
              </ul>
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={!!checkoutLoading || isCurrentPlan || plan.id === 'trial'}
                className={`w-full ${plan.buttonClass} text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition`}
              >
                {checkoutLoading === plan.id ? 'Redirecionando...' : isCurrentPlan ? 'Acesso atual' : plan.id === 'trial' ? 'Plano gratuito' : `Comprar ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {checkoutError && <p className="text-red-500 text-sm mb-4">{checkoutError}</p>}

      <div className="bg-white rounded-2xl shadow p-5 mb-5">
        <h3 className="font-semibold text-gray-700 mb-1">Já paguei — ativar acesso</h3>
        <p className="text-xs text-gray-500 mb-3">Cole o ID do pagamento (payment_id) que o Mercado Pago enviou por e-mail ou exibiu na confirmação.</p>
        <form onSubmit={handleRecover} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={recoverPaymentId}
            onChange={e => setRecoverPaymentId(e.target.value)}
            placeholder="Ex.: 123456789012"
            className="flex-1 text-sm border rounded-lg px-3 py-2"
            disabled={recoverLoading}
          />
          <button
            type="submit"
            disabled={recoverLoading || !recoverPaymentId.trim()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition"
          >
            {recoverLoading ? 'Ativando...' : 'Ativar acesso'}
          </button>
        </form>
        {recoverError && <p className="text-red-500 text-sm mt-2">{recoverError}</p>}
        {recoverSuccess && <p className="text-green-700 text-sm mt-2">{recoverSuccess}</p>}
      </div>

      <div className="bg-white rounded-2xl shadow p-5 mb-5 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-700 mb-3">Dúvidas rápidas</h3>
        <div className="space-y-3">
          <p><strong>Quando ativa?</strong> Após pagar no Mercado Pago, cole o ID do pagamento no formulário acima — a ativação é imediata.</p>
          <p><strong>Onde encontro o ID?</strong> Na tela de confirmação do Mercado Pago e no e-mail recebido após o pagamento.</p>
          <p><strong>É recorrente?</strong> Não. No MVP o acesso dura 30 dias e pode ser renovado manualmente.</p>
          <p><strong>Qual plano escolher?</strong> Basic e Pro têm os mesmos recursos técnicos; escolha Pro apenas se quiser operar sem anúncios.</p>
        </div>
      </div>

      {data?.referralCode && (
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h3 className="font-semibold text-gray-700 mb-1">Indique e ganhe</h3>
          <p className="text-xs text-gray-500 mb-3">Cada amigo que se cadastrar pelo seu link te dá +7 dias de acesso.</p>
          <div className="flex gap-2">
            <input
              id="ref-link-input"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${data.referralCode}`}
              className="flex-1 text-xs border rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
            />
            <button
              onClick={copyRef}
              className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-700 transition"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          {copyError && <p className="text-red-500 text-xs mt-2">{copyError}</p>}
        </div>
      )}

      {data?.payments?.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Histórico</h3>
          <div className="space-y-2">
            {data.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-700">{PLAN_LABELS[p.plan] ?? p.plan}</span>
                  <span className="text-gray-400 ml-2 text-xs">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">R${p.amount.toFixed(0)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status === 'approved' ? 'bg-green-100 text-green-700' :
                    p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-600'
                  }`}>{STATUS_LABELS[p.status] ?? p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlanosPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Carregando...</p>}>
      <PlanosContent />
    </Suspense>
  )
}
