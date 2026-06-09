'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TERMS_VERSION, api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { mapAuthError, trackEvent, TRACKING_EVENTS } from '@/lib/analytics'

const COUPON_CODE = 'VIP7DIAS'

export default function PromoVipPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!termsAccepted) {
      setError('Você precisa aceitar os Termos de Uso e declarar ciência dos riscos de automação no WhatsApp para criar a conta.')
      return
    }
    setLoading(true)
    try {
      trackEvent(TRACKING_EVENTS.AUTH_SUBMIT_ATTEMPT, {
        origin: 'promo_vip_7dias',
        mode: 'register',
        coupon: COUPON_CODE,
      })
      await api.registerPromoVip(name, email, password, contactPhone, COUPON_CODE, { termsAccepted, termsVersion: TERMS_VERSION })
      trackEvent(TRACKING_EVENTS.SIGNUP_SUCCESS, { origin: 'promo_vip_7dias', coupon: COUPON_CODE })
      router.push('/painel')
    } catch (err) {
      trackEvent(TRACKING_EVENTS.AUTH_ERROR, {
        origin: 'promo_vip_7dias',
        mode: 'register',
        coupon: COUPON_CODE,
        error_type: mapAuthError(err),
      })
      setError(err.message || 'Não foi possível concluir seu cadastro agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <section className="mx-auto max-w-xl rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-8">
        <h1 className="text-3xl font-bold">Acesso VIP · 7 dias grátis</h1>
        <p className="mt-3 text-emerald-100">Complete seu cadastro e entre direto no painel, sem passar pela tela de login.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Navegação rápida">
          <Link href="/" className="rounded-lg border border-emerald-300/60 px-4 py-2 text-center font-semibold text-emerald-50 transition hover:border-emerald-200 hover:bg-emerald-400/10">
            Página inicial
          </Link>
          <Link href="/login" className="rounded-lg border border-emerald-300/60 px-4 py-2 text-center font-semibold text-emerald-50 transition hover:border-emerald-200 hover:bg-emerald-400/10">
            Login
          </Link>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input type="hidden" name="coupon_code" value={COUPON_CODE} />

          <div>
            <label htmlFor="name" className="block text-sm mb-1">Nome</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-emerald-300/40 bg-white px-3 py-2 text-gray-900" />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm mb-1">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-emerald-300/40 bg-white px-3 py-2 text-gray-900" />
          </div>

          <div>
            <label htmlFor="contactPhone" className="block text-sm mb-1">Telefone (WhatsApp)</label>
            <input id="contactPhone" type="tel" inputMode="tel" placeholder="5511999999999" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required className="w-full rounded-lg border border-emerald-300/40 bg-white px-3 py-2 text-gray-900" />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm mb-1">Senha</label>
            <input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-lg border border-emerald-300/40 bg-white px-3 py-2 text-gray-900" />
          </div>

          <div className="rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-amber-950">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Aceite obrigatório</p>
            <p className="mt-2 text-sm leading-6">
              O BOTinho automatiza envios no WhatsApp Web e não utiliza a API oficial do WhatsApp/Meta para mensagens em grupos. Há risco de bloqueio, limitação ou banimento do número conectado e dos grupos/canais.
            </p>
            <label htmlFor="termsAccepted" className="mt-3 flex cursor-pointer gap-3 rounded-xl border border-amber-300 bg-white/80 p-3 text-sm leading-5">
              <input id="termsAccepted" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} required className="mt-1 h-4 w-4 shrink-0" />
              <span>Li e aceito os <Link href="/termos" target="_blank" rel="noreferrer" className="font-bold underline">Termos de Uso</Link>, incluindo a ciência dos riscos e a responsabilidade do usuário pela cadência, conteúdo, consentimento e limites de envio.</span>
            </label>
          </div>

          {error && <Alert type="error" title="Falha no cadastro" message={error} />}

          <button disabled={loading} type="submit" className="w-full rounded-lg bg-emerald-500 py-2 font-semibold text-black disabled:opacity-70">
            {loading ? 'Criando sua conta...' : 'Começar agora'}
          </button>
        </form>
      </section>
    </main>
  )
}
