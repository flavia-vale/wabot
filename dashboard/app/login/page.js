'use client'
import { useState, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { TERMS_VERSION, api } from '@/lib/api'
import { resolvePostAuthRedirect } from '@/lib/onboardingProgress'
import { Alert } from '@/components/Alert'
import { mapAuthError, trackEvent, TRACKING_EVENTS } from '@/lib/analytics'
import { attributionForTracking, readAttributionFromSearchParams, getFirstTouchLandingPage } from '@/lib/marketing-attribution'
import { SUPPORT_WHATSAPP_URL } from '@/lib/marketing-content'
import { SUPPORT_PHONE_LABEL } from '@/lib/mobilePixUtils'

const LOGIN_BENEFITS = [
  'Conversão automática de links de afiliado',
  'Grupos de WhatsApp organizados por origem e destino',
  'Envio e agendamento de ofertas em menos tempo',
]

const PHONE_ALREADY_REGISTERED_ERROR = 'Este número de telefone já está cadastrado'
const PHONE_RECOVERY_WHATSAPP_URL = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent('Oi! Meu WhatsApp já está cadastrado no BOTinho e preciso recuperar o acesso da minha conta.')}`

function normalizePhoneInput(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 15)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
}


function resolveRegisterLandingPage() {
  if (typeof window === 'undefined') return ''
  try {
    const firstTouch = getFirstTouchLandingPage()
    if (firstTouch) return firstTouch
    return `${window.location.pathname}${window.location.search}`.slice(0, 500)
  } catch {
    return ''
  }
}

function getOrCreateAffiliateVisitorId() {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem('aff_visitor_id')
    if (existing) return existing
    const generated = (window.crypto?.randomUUID?.() || `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`).slice(0, 120)
    window.localStorage.setItem('aff_visitor_id', generated)
    return generated
  } catch {
    return `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`.slice(0, 120)
  }
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const signupAttribution = readAttributionFromSearchParams(searchParams)
  const trackingAttribution = attributionForTracking(signupAttribution)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(() => searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [isRegister, setIsRegister] = useState(() => searchParams.get('mode') === 'register')
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return ''
    const reason = new URLSearchParams(window.location.search).get('reason')
    const message = sessionStorage.getItem('loginRedirectMessage')
    if (reason === 'session-expired' && message) {
      sessionStorage.removeItem('loginRedirectMessage')
      return message
    }
    return ''
  })
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formStarted, setFormStarted] = useState(false)
  const [affCode, setAffCode] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    if (!isRegister) return
    const fromUrl = searchParams.get('aff')
    if (fromUrl) {
      const visitorId = getOrCreateAffiliateVisitorId()
      const landingPage = `${window.location.pathname}${window.location.search}`.slice(0, 500)
      const persistCode = (hours = 24) => {
        const expires = new Date(Date.now() + hours * 3600 * 1000).toUTCString()
        document.cookie = `aff_code=${fromUrl}; expires=${expires}; path=/; SameSite=Lax`
        document.cookie = `aff_visitor_id=${visitorId}; expires=${expires}; path=/; SameSite=Lax`
        setAffCode(fromUrl)
      }
      api.affiliateConfig()
        // R4: a duração do cookie segue a JANELA DE ATRIBUIÇÃO do servidor
        // (fonte de verdade), para o browser não esquecer o código antes — nem
        // mantê-lo muito depois — da janela em que a venda conta. Fallback para
        // cookieDurationHours e, por fim, 24h.
        .then(cfg => persistCode(cfg?.attributionWindowDays ? cfg.attributionWindowDays * 24 : (cfg?.cookieDurationHours ?? 24)))
        .catch(() => persistCode(24))
      api.affiliateTrack({
        affiliateCode: fromUrl,
        visitorId,
        source: signupAttribution.source || signupAttribution.utm_source || 'affiliate_link',
        medium: signupAttribution.utm_medium || null,
        campaign: signupAttribution.utm_campaign || null,
        landingPage,
      }).catch(() => {})
    } else {
      const match = document.cookie.match(/(?:^|;\s*)aff_code=([^;]+)/)
      if (match) Promise.resolve(decodeURIComponent(match[1])).then(code => setAffCode(code))
    }
    // signupAttribution.* derivam de searchParams (já nas deps); listadas para o
    // exhaustive-deps sem alterar a semântica do efeito.
  }, [isRegister, searchParams, signupAttribution.source, signupAttribution.utm_source, signupAttribution.utm_medium, signupAttribution.utm_campaign])

  function markFormStarted(field) {
    if (formStarted) return
    setFormStarted(true)
    trackEvent(TRACKING_EVENTS.SIGNUP_FORM_STARTED, {
      origin: 'login_page',
      mode: isRegister ? 'register' : 'login',
      first_field: field,
      has_ref: Boolean(ref),
    })
  }

  function blockSubmit(field, message) {
    trackEvent(TRACKING_EVENTS.SIGNUP_SUBMIT_BLOCKED_CLIENT, {
      origin: 'login_page',
      mode: isRegister ? 'register' : 'login',
      field,
    })
    setError(message)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanEmail = email.trim()
    const cleanPhone = normalizePhoneInput(contactPhone)

    if (isRegister) {
      if (!cleanName) return blockSubmit('name', 'Informe seu nome para criar a conta.')
      if (!cleanEmail) return blockSubmit('email', 'Informe seu email para criar a conta e recuperar acesso depois.')
      if (!isValidEmail(cleanEmail)) return blockSubmit('email', 'Confira o formato do email antes de continuar.')
      // Celular é obrigatório de propósito: é por ele que a operação procura a
      // cliente quando ela trava na configuração. A proposta de torná-lo
      // opcional (auditoria de funil §3.4) foi revertida a pedido dela — não
      // reabrir sem pedido explícito.
      if (!cleanPhone || cleanPhone.length < 10) return blockSubmit('contactPhone', 'Informe seu WhatsApp com DDD para o suporte falar com você se algo travar.')
      if (!password) return blockSubmit('password', 'Crie uma senha para acessar o painel depois.')
      if (password.length < 8) return blockSubmit('password', 'Use pelo menos 8 caracteres na senha.')
      if (!termsAccepted) return blockSubmit('termsAccepted', 'Você precisa aceitar os Termos de Uso e declarar ciência dos riscos de automação no WhatsApp para criar a conta.')
    } else {
      if (!cleanEmail) return blockSubmit('email', 'Informe seu email para entrar.')
      if (!isValidEmail(cleanEmail)) return blockSubmit('email', 'Confira o formato do email antes de continuar.')
      if (!password) return blockSubmit('password', 'Informe sua senha para entrar.')
    }

    setLoading(true)
    try {
      trackEvent(TRACKING_EVENTS.AUTH_SUBMIT_ATTEMPT, {
        origin: 'login_page',
        mode: isRegister ? 'register' : 'login',
        has_ref: Boolean(ref),
        ...(isRegister ? trackingAttribution : {}),
      })
      if (isRegister) {
        await api.register(cleanName, cleanEmail, password, cleanPhone, { ...signupAttribution, landingPage: resolveRegisterLandingPage(), ...(ref && { ref }), ...(affCode && { aff_code: affCode, affiliateVisitorId: getOrCreateAffiliateVisitorId() }), termsAccepted, termsVersion: TERMS_VERSION })
        trackEvent(TRACKING_EVENTS.SIGNUP_SUCCESS, { origin: 'login_page', has_ref: Boolean(ref), ...trackingAttribution })
      } else {
        await api.login(cleanEmail, password)
        trackEvent(TRACKING_EVENTS.LOGIN_SUCCESS, { origin: 'login_page' })
      }
      let redirectTo = '/painel/checklist'
      if (!isRegister) {
        try {
          const status = await api.dashboardStatus()
          redirectTo = resolvePostAuthRedirect({ status, isRegister: false })
        } catch {
          redirectTo = resolvePostAuthRedirect({ status: null, isRegister: false })
        }
      }
      setSuccess(isRegister
        ? 'Conta criada. Agora vamos conectar seu WhatsApp e validar o primeiro teste guiado.'
        : redirectTo === '/painel'
          ? 'Login realizado. Redirecionando para o painel...'
          : 'Login realizado. Redirecionando para o checklist...')
      setTimeout(() => router.push(redirectTo), 300)
    } catch (err) {
      trackEvent(TRACKING_EVENTS.AUTH_ERROR, {
        origin: 'login_page',
        mode: isRegister ? 'register' : 'login',
        error_type: mapAuthError(err),
        ...(isRegister ? trackingAttribution : {}),
      })
      setError(err?.message || 'Não foi possível concluir a autenticação agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 transition-colors duration-500 ${
      isRegister
        ? 'bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100'
        : 'bg-green-50'
    }`}>
      <div className={`rounded-2xl shadow-lg p-8 w-full max-w-md transition-all duration-500 ${
        isRegister
          ? 'bg-emerald-950/95 text-emerald-50 border border-emerald-700 shadow-emerald-900/20'
          : 'bg-white text-gray-900 border border-transparent'
      }`}>
        <div className="mb-5 flex justify-center">
          <div className={`rounded-2xl p-3 shadow-sm ${isRegister ? 'bg-emerald-900' : 'bg-green-50'}`}>
            <Image
              src="/botinho-logo.svg"
              alt="Logo do BOTinho, ferramenta para espelhar grupos e espalhar ofertas no WhatsApp"
              width={64}
              height={64}
              priority
            />
          </div>
        </div>

        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            aria-label="Voltar para a página principal do BOTinho"
            className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 ${
              isRegister
                ? 'border-emerald-400/40 bg-emerald-900/70 text-emerald-100 hover:border-emerald-300 hover:bg-emerald-800 focus-visible:ring-emerald-300'
                : 'border-green-100 bg-green-50 text-green-700 hover:border-green-200 hover:bg-green-100 focus-visible:ring-green-500'
            }`}
          >
            <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">←</span>
            Voltar para a página principal
          </Link>
        </div>

        <div className="mb-2 text-center">
          <p className={`text-sm font-semibold ${isRegister ? 'text-emerald-200' : 'text-green-700'}`}><span aria-hidden="true">🤖</span> O BOTinho que espelha grupos</p>
          <h1 className={`mt-2 text-xl sm:text-2xl font-bold leading-tight ${isRegister ? 'text-emerald-100' : 'text-gray-900'}`}>{isRegister ? 'Criar sua conta' : 'Entrar na sua conta'}</h1>
        </div>
        <p className={`text-center text-sm mb-4 ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
          {isRegister ? 'Teste por 7 dias sem cartão e valide o primeiro envio guiado.' : 'Acesse seu painel para conectar o WhatsApp e gerenciar seus grupos.'}
        </p>

        {ref && (
          <p className={`mb-4 rounded-lg px-3 py-2 text-xs font-medium ${
            isRegister ? 'bg-emerald-800 text-emerald-100' : 'bg-green-50 text-green-700'
          }`}>
            Você chegou por um convite. Crie sua conta para receber o benefício de indicação disponível.
          </p>
        )}

        <ul className={`mb-5 space-y-2 text-xs ${isRegister ? 'text-emerald-100' : 'text-gray-600'}`}>
          {LOGIN_BENEFITS.map(benefit => (
            <li key={benefit} className="flex gap-2">
              <span aria-hidden="true">✅</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1 text-emerald-100">Nome completo</label>
              <input
                id="name"
                type="text"
                placeholder="Como podemos te chamar"
                value={name}
                onFocus={() => markFormStarted('name')}
                onChange={e => setName(e.target.value)}
                required={isRegister}
                autoComplete="name"
                className="border rounded-lg bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-400 w-full"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className={`block text-sm font-medium mb-1 ${isRegister ? 'text-emerald-100' : 'text-gray-700'}`}>Email</label>
            <input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onFocus={() => markFormStarted('email')}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-400 w-full rounded-lg"
            />
          </div>
          {isRegister && (
            <>
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium mb-1 text-emerald-100">Seu WhatsApp</label>
                <input
                  id="contactPhone"
                  type="tel"
                  inputMode="tel"
                  placeholder="Ex: 5511999999999"
                  value={contactPhone}
                  onFocus={() => markFormStarted('contactPhone')}
                  onChange={e => setContactPhone(normalizePhoneInput(e.target.value))}
                  required={isRegister}
                  minLength={10}
                  maxLength={15}
                  autoComplete="tel"
                  className="border rounded-lg bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-400 w-full"
                />
                <p className="mt-1 text-[11px] leading-4 text-emerald-200">
                  É por aqui que a gente te avisa se o robô parar ou se a configuração travar. Não usamos para divulgação.
                </p>
              </div>
              <div>
                <label htmlFor="affCode" className="block text-sm font-medium mb-1 text-emerald-100">Código de indicação <span className="text-emerald-300 font-normal">(opcional)</span></label>
                <input
                  id="affCode"
                  type="text"
                  placeholder="Ex: ABCD1234"
                  value={affCode}
                  onChange={e => setAffCode(e.target.value.trim().toUpperCase())}
                  autoComplete="off"
                  className="border rounded-lg bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-400 w-full uppercase"
                />
              </div>
            </>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label htmlFor="password" className={`block text-sm font-medium ${isRegister ? 'text-emerald-100' : 'text-gray-700'}`}>Senha</label>
              {!isRegister && (
                <a
                  href="mailto:suporte@botinho.app?subject=Recuperar%20senha%20do%20BOTinho"
                  className="text-xs font-medium text-green-600 hover:underline"
                >
                  Esqueci minha senha
                </a>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={password}
                onFocus={() => markFormStarted('password')}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={isRegister ? 8 : undefined}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="w-full rounded-lg border bg-white px-3 py-2 pr-24 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-1 right-1 rounded-md px-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {isRegister && <p className="mt-1 text-[11px] leading-4 text-emerald-200">Use pelo menos 8 caracteres para reduzir erros no cadastro.</p>}
          </div>

          {error && error === PHONE_ALREADY_REGISTERED_ERROR && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert" aria-live="assertive">
              <p className="font-semibold"><span aria-hidden="true">⚠️</span> {error}</p>
              <p className="mt-1">Para recuperar sua conta envie uma mensagem para nosso suporte: {SUPPORT_PHONE_LABEL}</p>
              <a
                href={PHONE_RECOVERY_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Chamar suporte no WhatsApp
              </a>
            </div>
          )}
          {error && error !== PHONE_ALREADY_REGISTERED_ERROR && <Alert type="error" title="Falha na autenticação" message={error} />}
          {success && <Alert type="success" title="Sucesso" message={success} />}

          {isRegister && (
            <label htmlFor="termsAccepted" className="flex cursor-pointer gap-3 text-sm leading-5 text-emerald-100">
              <input
                id="termsAccepted"
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                onFocus={() => markFormStarted('termsAccepted')}
                required
                className="mt-1 h-4 w-4 shrink-0 rounded border-white/60 text-emerald-600 focus:ring-emerald-400"
              />
              <span>
                Li e aceito os <Link href="/termos" className="font-bold underline" target="_blank" rel="noreferrer">Termos de Uso</Link>, incluindo a ciência de risco de bloqueio/banimento do WhatsApp e dos grupos, e a <Link href="/privacidade" className="font-bold underline" target="_blank" rel="noreferrer">Política de Privacidade</Link>.
              </span>
            </label>
          )}

          {!isRegister && (
            <p className="text-xs leading-5 text-gray-500">
              Ao entrar, você continua sujeito aos <Link href="/termos" className="font-semibold underline">Termos de Uso</Link> e à <Link href="/privacidade" className="font-semibold underline">Política de Privacidade</Link>.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`text-white rounded-lg py-2 font-semibold disabled:opacity-50 transition ${
              isRegister
                ? 'bg-emerald-500 hover:bg-emerald-400'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? (isRegister ? 'Criando conta...' : 'Entrando...') : isRegister ? 'Criar conta e acessar painel' : 'Entrar no painel'}
          </button>
        </form>

        <button
          onClick={() => {
            const nextMode = !isRegister
            trackEvent(TRACKING_EVENTS.AUTH_MODE_SWITCH, {
              origin: 'login_page',
              mode: nextMode ? 'register' : 'login',
            })
            setIsRegister(nextMode)
            setError('')
            setSuccess('')
            setContactPhone('')
            setTermsAccepted(false)
            setFormStarted(false)
          }}
          className={`mt-4 text-sm hover:underline w-full text-center ${isRegister ? 'text-emerald-200' : 'text-green-600'}`}
        >
          {isRegister ? 'Já tenho conta — Entrar' : 'Ainda não tenho conta — começar agora'}
        </button>

        <nav className={`mt-6 flex flex-wrap justify-center gap-3 text-xs ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
          <Link href="/suporte" className="hover:underline">Suporte</Link>
          <Link href="/termos" className="hover:underline">Termos</Link>
          <Link href="/privacidade" className="hover:underline">Privacidade</Link>
        </nav>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
