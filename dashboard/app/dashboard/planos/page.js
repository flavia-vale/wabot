'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

const PLAN_LABELS = { trial: 'Trial', basic: 'Basic', pro: 'Pro' }
const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', cancelled: 'Cancelado' }

const PLAN_CARDS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'R$50',
    priceClass: 'text-blue-600',
    buttonClass: 'bg-blue-600 hover:bg-blue-700',
    cardClass: 'border border-transparent',
    description: 'Acesso por 30 dias para começar e validar sua operação.',
    features: ['Bot ilimitado', 'Todos os conversores', 'Anúncio a cada 50 envios'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$100',
    priceClass: 'text-purple-600',
    buttonClass: 'bg-purple-600 hover:bg-purple-700',
    cardClass: 'border-2 border-purple-300',
    badge: 'Mais escolhido',
    description: 'Acesso por 30 dias para operar com mais volume e sem anúncios.',
    features: ['Bot ilimitado', 'Todos os conversores', 'Sem anúncios'],
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
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Planos</h2>
      <p className="text-gray-500 text-sm mb-6">Compre ou renove acesso por 30 dias. A ativação só aparece após confirmação do pagamento.</p>

      {redirectStatus === 'success' && hasConfirmedPaidAccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-5 text-sm">
          Pagamento confirmado pelo backend. Seu acesso de 30 dias está ativo.
        </div>
      )}
      {redirectStatus === 'success' && !hasConfirmedPaidAccess && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl p-4 mb-5 text-sm">
          Pagamento recebido pelo Mercado Pago e aguardando confirmação do webhook. Atualize esta tela em alguns instantes para validar a ativação.
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
        <ul className="space-y-1"><li><strong>Basic</strong>: ideal para começar e validar operação por 30 dias.</li><li><strong>Pro</strong>: recomendado para volume maior e operação sem anúncios por 30 dias.</li><li><strong>Renovação</strong>: ao fim do período, faça uma nova compra pelo checkout.</li></ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {PLAN_CARDS.map(plan => {
          const isCurrentPlan = data?.plan === plan.id && data?.isActive
          return (
            <div key={plan.id} className={`bg-white rounded-2xl shadow p-5 ${plan.cardClass}`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-800">{plan.name}</h3>
                {plan.badge && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{plan.badge}</span>}
              </div>
              <p className={`text-3xl font-bold ${plan.priceClass} mb-1`}>{plan.price}<span className="text-sm font-normal text-gray-400"> / 30 dias</span></p>
              <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
              <ul className="text-xs text-gray-500 space-y-1 mb-4">
                {plan.features.map(feature => <li key={feature}>✅ {feature}</li>)}
              </ul>
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={!!checkoutLoading || isCurrentPlan}
                className={`w-full ${plan.buttonClass} text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition`}
              >
                {checkoutLoading === plan.id ? 'Redirecionando...' : isCurrentPlan ? 'Acesso atual' : `Comprar ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {checkoutError && <p className="text-red-500 text-sm mb-4">{checkoutError}</p>}

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
