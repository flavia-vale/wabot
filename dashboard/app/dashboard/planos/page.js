'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { HelpLink } from '@/components/HelpLink'

const PLAN_LABELS = { trial: 'Teste grátis', basic: 'Basic', pro: 'Pro' }
const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', cancelled: 'Cancelado' }

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
    price: 'R$40',
    priceClass: 'text-blue-600',
    buttonClass: 'bg-blue-600 hover:bg-blue-700',
    cardClass: 'border border-transparent',
    description: 'Mesmos recursos técnicos do Pro, com anúncios durante o uso.',
    features: ['Conversão de links suportados', 'Monitoramento de grupos', 'Envio para grupos de destino', 'Histórico de logs', 'Com anúncios'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$70',
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
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([api.paymentsStatus(), api.paymentsOverview().catch(() => null), api.publicPlans().catch(() => ({ plans: [] }))])
      .then(([res, overviewRes, plansRes]) => { if (active) { setData(res); setOverview(overviewRes); setPublicPlans(Array.isArray(plansRes?.plans) ? plansRes.plans : []) } })
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
      setCheckoutError(err.message || 'Não foi possível iniciar o checkout. Tente novamente.')
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
      <p className="text-gray-500 text-sm mb-6">Escolha entre Teste grátis, Basic e Pro. O pagamento é feito via Mercado Pago (PIX ou cartão) e o acesso é ativado automaticamente após a confirmação.</p>

      {/* Retorno do Mercado Pago após pagamento */}
      {redirectStatus === 'success' && hasConfirmedPaidAccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 mb-5 text-sm font-medium">
          ✅ Acesso de 30 dias ativado com sucesso!
        </div>
      )}
      {redirectStatus === 'success' && !hasConfirmedPaidAccess && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl p-4 mb-5 text-sm">
          <p className="font-semibold mb-1">Pagamento recebido, aguardando confirmação</p>
          <p>Se pagou via PIX, aguarde até 2 minutos e recarregue a página. Se o acesso não ativar automaticamente, use o formulário de recuperação no final desta página.</p>
        </div>
      )}
      {redirectStatus === 'failure' && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-5 text-sm">
          <p className="font-semibold mb-1">Pagamento não aprovado</p>
          <p>Verifique os dados do cartão ou saldo disponível e tente novamente. Se o valor já foi debitado, entre em contato com o suporte.</p>
        </div>
      )}
      {redirectStatus === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl p-4 mb-5 text-sm">
          <p className="font-semibold mb-1">Pagamento em análise</p>
          <p>Para PIX, a confirmação ocorre em até 2 minutos. Para cartão, pode levar alguns instantes. Recarregue a página após o prazo.</p>
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

      {/* Informações de cobrança (sem jargão técnico) */}
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
          {overview.actionRequired && (
            <p className="mt-2 text-xs font-medium text-red-600">{overview.actionRequired}</p>
          )}
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
                {checkoutLoading === plan.id ? 'Abrindo checkout seguro...' : isCurrentPlan ? 'Acesso atual' : plan.id === 'trial' ? 'Plano gratuito' : `Comprar ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {checkoutLoading && (
        <p className="text-gray-500 text-xs text-center mb-4">Você será redirecionado para o checkout seguro do Mercado Pago (PIX ou cartão).</p>
      )}
      {checkoutError && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">
          {checkoutError}
          <button onClick={() => setCheckoutError('')} className="ml-2 underline text-xs">Fechar</button>
        </div>
      )}

      {/* Dúvidas rápidas */}
      <div className="bg-white rounded-2xl shadow p-5 mb-5 text-sm text-gray-600">
        <h3 className="font-semibold text-gray-700 mb-3">Dúvidas rápidas</h3>
        <div className="space-y-3">
          <p><strong>Como funciona o pagamento?</strong> Ao clicar em "Comprar", você é direcionado para o Mercado Pago onde pode pagar com PIX ou cartão. O acesso é ativado automaticamente após a confirmação.</p>
          <p><strong>É recorrente?</strong> Não. O acesso dura 30 dias e você renova manualmente quando quiser continuar.</p>
          <p><strong>Basic ou Pro?</strong> Basic e Pro têm os mesmos recursos técnicos; a única diferença é que o Pro opera sem anúncios.</p>
          <p><strong>Quanto tempo leva para ativar?</strong> Com cartão, é imediato. Com PIX, pode levar até 2 minutos após o pagamento.</p>
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
              className="flex-1 text-xs border rounded-lg px-3 py-2.5 min-h-11 bg-gray-50 text-gray-600"
            />
            <button
              onClick={copyRef}
              className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-green-700 transition"
              aria-live="polite"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          {copyError && <p className="text-red-500 text-xs mt-2">{copyError}</p>}
        </div>
      )}

      {/* Histórico de pagamentos */}
      {data?.payments?.length > 0 ? (
        <div className="bg-white rounded-2xl shadow p-5 mb-5">
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
        <div className="bg-white rounded-2xl shadow p-5 mb-5 text-sm text-gray-400 text-center">
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
