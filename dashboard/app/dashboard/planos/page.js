'use client'
import { useEffect, useCallback, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { HelpLink } from '@/components/HelpLink'

const PLAN_LABELS = { trial: 'Teste grátis', basic: 'Basic', pro: 'Pro' }
const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', cancelled: 'Cancelado' }
const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 20 * 60 * 1000 // 20 min

const DEFAULT_PLAN_CARDS = [
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

function mergePlanCards(plans) {
  const byId = new Map((plans ?? []).map(plan => [plan.id, plan]))
  return DEFAULT_PLAN_CARDS.map((card) => {
    const dynamicPlan = byId.get(card.id)
    return {
      ...card,
      name: dynamicPlan?.title || card.name,
      price: dynamicPlan?.price || card.price,
      description: dynamicPlan?.description || card.description,
      features: Array.isArray(dynamicPlan?.features) && dynamicPlan.features.length ? dynamicPlan.features : card.features,
    }
  })
}

function daysLeft(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.max(0, Math.ceil(diff / 86400000))
}

function PixPayment({ pix, onSuccess, onCancel }) {
  const [copied, setCopied] = useState(false)
  const [pollStatus, setPollStatus] = useState('waiting') // waiting | confirmed | expired
  const pollRef = useRef(null)
  const timeoutRef = useRef(null)

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current)
    clearTimeout(timeoutRef.current)
  }, [])

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.pixStatus(pix.payment_id)
        if (res.activated) {
          stopPolling()
          setPollStatus('confirmed')
          setTimeout(() => onSuccess(res), 1500)
        }
      } catch (_) {}
    }, POLL_INTERVAL_MS)

    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setPollStatus('expired')
    }, POLL_TIMEOUT_MS)

    return stopPolling
  }, [pix.payment_id, stopPolling, onSuccess])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(pix.qr_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (_) {}
  }

  if (pollStatus === 'confirmed') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="text-3xl mb-2">✅</p>
        <p className="font-bold text-green-700 text-lg">Pagamento confirmado!</p>
        <p className="text-green-600 text-sm mt-1">Ativando seu acesso...</p>
      </div>
    )
  }

  if (pollStatus === 'expired') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 text-center">
        <p className="font-semibold text-yellow-800 mb-2">QR Code expirado</p>
        <p className="text-yellow-700 text-sm mb-4">O tempo para pagamento expirou. Gere um novo QR Code para tentar novamente.</p>
        <button onClick={onCancel} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          Gerar novo QR Code
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">Pague via PIX</h3>
          <p className="text-sm text-gray-500">Plano {PLAN_LABELS[pix.plan]} — R${pix.amount}</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm transition">Cancelar</button>
      </div>

      {/* QR Code */}
      {pix.qr_code_base64 && (
        <div className="flex justify-center mb-4">
          <img
            src={`data:image/png;base64,${pix.qr_code_base64}`}
            alt="QR Code PIX"
            className="w-48 h-48 border border-gray-200 rounded-xl"
          />
        </div>
      )}

      {/* Copia e cola */}
      {pix.qr_code && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1 font-medium">PIX Copia e Cola</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={pix.qr_code}
              className="flex-1 text-xs border rounded-lg px-3 py-2 bg-gray-50 text-gray-600 font-mono"
            />
            <button
              onClick={copyCode}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {/* Status de aguardo */}
      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        <span>Aguardando confirmação do pagamento...</span>
      </div>

      <p className="text-xs text-gray-400 text-center mt-3">
        O acesso é ativado automaticamente após o pagamento ser confirmado. QR Code válido por 30 minutos.
      </p>

      {pix.ticket_url && (
        <p className="text-xs text-center mt-2">
          <a href={pix.ticket_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
            Abrir no Mercado Pago
          </a>
        </p>
      )}
    </div>
  )
}

function PlanosContent() {
  const searchParams = useSearchParams()
  const redirectStatus = searchParams.get('status')

  const [data, setData] = useState(null)
  const [publicPlans, setPublicPlans] = useState([])
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [pixData, setPixData] = useState(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  const loadData = useCallback(async () => {
    const [res, overviewRes, plansRes] = await Promise.all([
      api.paymentsStatus(),
      api.paymentsOverview().catch(() => null),
      api.publicPlans().catch(() => ({ plans: [] })),
    ])
    setData(res)
    setOverview(overviewRes)
    setPublicPlans(Array.isArray(plansRes?.plans) ? plansRes.plans : [])
  }, [])

  useEffect(() => {
    let active = true
    loadData()
      .catch((err) => { if (active) setLoadError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [loadData])

  async function handleCheckout(plan) {
    setCheckoutError('')
    setCheckoutLoading(plan)
    setPixData(null)
    try {
      const res = await api.paymentsCheckout(plan)
      if (res.type === 'pix') {
        setPixData(res)
        document.getElementById('pix-section')?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch (err) {
      setCheckoutError(err.message || 'Não foi possível gerar o PIX. Tente novamente.')
    } finally {
      setCheckoutLoading('')
    }
  }

  function handlePixSuccess(result) {
    setPixData(null)
    setData(prev => prev ? { ...prev, plan: result.plan, accessExpiresAt: result.accessExpiresAt, isActive: true } : prev)
    loadData().catch(() => {})
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

  const planCards = useMemo(() => mergePlanCards(publicPlans), [publicPlans])

  if (loading) return <p className="text-gray-500">Carregando...</p>
  if (loadError) return <p className="text-red-500 text-sm">{loadError}</p>

  const days = daysLeft(data?.accessExpiresAt)
  const planLabel = PLAN_LABELS[data?.plan] ?? data?.plan
  const hasConfirmedPaidAccess = ['basic', 'pro'].includes(data?.plan) && data?.isActive
  const isExpired = data?.accessExpiresAt && !data?.isActive

  return (
    <div className="max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Planos</h2>
        <HelpLink topic="pagamento-pendente">Ajuda</HelpLink>
      </div>
      <p className="text-gray-500 text-sm mb-6">Escolha seu plano e pague via PIX. O acesso é ativado automaticamente após a confirmação do pagamento.</p>

      {redirectStatus === 'success' && hasConfirmedPaidAccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-5 text-sm font-medium">
          ✅ Acesso de 30 dias ativado com sucesso!
        </div>
      )}
      {redirectStatus === 'failure' && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-5 text-sm">
          <p className="font-semibold mb-1">Pagamento não aprovado</p>
          <p>Tente gerar um novo QR Code abaixo.</p>
        </div>
      )}

      {/* Status do plano atual */}
      <div className={`rounded-2xl shadow p-5 mb-5 ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-gray-700">Plano atual</span>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            data?.plan === 'pro' ? 'bg-purple-100 text-purple-700' :
            data?.plan === 'basic' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>{planLabel}</span>
        </div>
        {data?.accessExpiresAt ? (
          <p className={`text-sm ${isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {data.isActive
              ? `Acesso válido por mais ${days} dia${days !== 1 ? 's' : ''}`
              : 'Acesso expirado — renove seu plano abaixo'}
          </p>
        ) : null}
        {isExpired && (
          <button
            onClick={() => document.getElementById('planos-cards')?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-3 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-lg transition"
          >
            Renovar acesso →
          </button>
        )}
      </div>

      {/* PIX QR Code */}
      {pixData && (
        <div id="pix-section" className="mb-5">
          <PixPayment
            pix={pixData}
            onSuccess={handlePixSuccess}
            onCancel={() => setPixData(null)}
          />
        </div>
      )}

      {/* Cards de planos */}
      <div id="planos-cards" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {planCards.map(plan => {
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
                {checkoutLoading === plan.id ? 'Gerando PIX...' : isCurrentPlan ? 'Acesso atual' : plan.id === 'trial' ? 'Plano gratuito' : `Pagar ${plan.name} via PIX`}
              </button>
            </div>
          )
        })}
      </div>

      {checkoutError && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">
          {checkoutError}
          <button onClick={() => setCheckoutError('')} className="ml-2 underline text-xs">Fechar</button>
        </div>
      )}

      {/* Informações de cobrança */}
      {overview && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 text-sm text-gray-700">
          <p className="font-semibold mb-2 text-gray-800">Informações de cobrança</p>
          <ul className="space-y-1 text-xs text-gray-600">
            <li><strong>Renovação:</strong> {overview.billingModel}</li>
            <li><strong>Método aceito:</strong> {overview.paymentMethod}</li>
            {overview.lastApprovedPayment?.createdAt && (
              <li><strong>Último pagamento:</strong> {new Date(overview.lastApprovedPayment.createdAt).toLocaleDateString('pt-BR')}</li>
            )}
            {overview.accessExpiresAt && (
              <li><strong>Acesso válido até:</strong> {new Date(overview.accessExpiresAt).toLocaleDateString('pt-BR')}</li>
            )}
          </ul>
        </div>
      )}

      {/* Dúvidas rápidas */}
      <div className="bg-white rounded-2xl shadow p-5 mb-5 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-700 mb-3">Dúvidas rápidas</h3>
        <div className="space-y-3">
          <p><strong>Como funciona?</strong> Clique em "Pagar via PIX", escaneie o QR Code ou copie o código, e pague pelo app do seu banco. O acesso é ativado automaticamente em segundos.</p>
          <p><strong>É recorrente?</strong> Não. O acesso dura 30 dias e você renova quando quiser.</p>
          <p><strong>Basic ou Pro?</strong> Mesmos recursos técnicos — a única diferença é que o Pro opera sem anúncios.</p>
        </div>
      </div>

      {/* Indicação */}
      {data?.referralCode && (
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
          <h3 className="font-semibold text-gray-700 mb-1">Indique e ganhe</h3>
          <p className="text-xs text-gray-500 mb-3">Cada amigo que se cadastrar pelo seu link te dá +7 dias de acesso.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="ref-link-input"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${data.referralCode}`}
              className="flex-1 text-xs border rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
            />
            <button onClick={copyRef} className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-700 transition" aria-live="polite">
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          {copyError && <p className="text-red-500 text-xs mt-2">{copyError}</p>}
        </div>
      )}

      {/* Histórico de pagamentos */}
      {data?.payments?.length > 0 ? (
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
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 text-sm text-gray-400 text-center">
          Nenhum pagamento registrado ainda.
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
