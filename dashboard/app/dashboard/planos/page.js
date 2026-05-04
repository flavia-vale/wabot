'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

const PLAN_LABELS = { trial: 'Trial', basic: 'Basic', pro: 'Pro' }
const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', cancelled: 'Cancelado' }

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
      window.location.href = checkout_url
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

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Planos</h2>
      <p className="text-gray-500 text-sm mb-6">Gerencie sua assinatura</p>

      {redirectStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-5 text-sm">
          Pagamento aprovado! Seu plano foi ativado.
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
        <ul className="space-y-1"><li><strong>Basic</strong>: ideal para começar e validar operação.</li><li><strong>Pro</strong>: recomendado para volume maior e operação sem anúncios.</li><li><strong>Economia de tempo</strong>: Pro evita interrupções durante campanhas.</li></ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-bold text-gray-800 mb-1">Basic</h3>
          <p className="text-3xl font-bold text-blue-600 mb-1">R$50<span className="text-sm font-normal text-gray-400">/mês</span></p>
          <ul className="text-xs text-gray-500 space-y-1 mb-4">
            <li>✅ Bot ilimitado</li>
            <li>✅ Todos os conversores</li>
            <li>⚠️ Anúncio a cada 50 envios</li>
          </ul>
          <button
            onClick={() => handleCheckout('basic')}
            disabled={!!checkoutLoading || data?.plan === 'basic'}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {checkoutLoading === 'basic' ? 'Redirecionando...' : data?.plan === 'basic' ? 'Plano atual' : 'Assinar Basic'}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 border-2 border-purple-300">
          <div className="flex items-center justify-between mb-1"><h3 className="font-bold text-gray-800">Pro</h3><span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Mais escolhido</span></div>
          <p className="text-3xl font-bold text-purple-600 mb-1">R$100<span className="text-sm font-normal text-gray-400">/mês</span></p>
          <ul className="text-xs text-gray-500 space-y-1 mb-4">
            <li>✅ Bot ilimitado</li>
            <li>✅ Todos os conversores</li>
            <li>✅ Sem anúncios</li>
          </ul>
          <button
            onClick={() => handleCheckout('pro')}
            disabled={!!checkoutLoading || data?.plan === 'pro'}
            className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {checkoutLoading === 'pro' ? 'Redirecionando...' : data?.plan === 'pro' ? 'Plano atual' : 'Assinar Pro'}
          </button>
        </div>
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
          {copyError && <p className="text-red-500 text-xs mt-2">{copyError}</p>}
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
