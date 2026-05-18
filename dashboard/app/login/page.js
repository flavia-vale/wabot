'use client'
import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { mapAuthError, trackEvent, TRACKING_EVENTS } from '@/lib/analytics'
import { attributionForTracking, readAttributionFromSearchParams } from '@/lib/marketing-attribution'

const LOGIN_BENEFITS = [
  'Conversão automática de links de afiliado',
  'Grupos de WhatsApp organizados por origem e destino',
  'Envio e agendamento de ofertas em menos tempo',
]

function normalizePhoneInput(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 15)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
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
      if (!cleanPhone || cleanPhone.length < 10) return blockSubmit('contactPhone', 'Informe seu WhatsApp com DDD para suporte do teste.')
      if (!password) return blockSubmit('password', 'Crie uma senha para acessar o painel depois.')
      if (password.length < 8) return blockSubmit('password', 'Use pelo menos 8 caracteres na senha.')
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
        await api.register(name, email, password, contactPhone, { ...signupAttribution, ...(ref && { ref }) })
        trackEvent(TRACKING_EVENTS.SIGNUP_SUCCESS, { origin: 'login_page', has_ref: Boolean(ref), ...trackingAttribution })
      } else {
        await api.login(cleanEmail, password)
        trackEvent(TRACKING_EVENTS.LOGIN_SUCCESS, { origin: 'login_page' })
      }
      setSuccess(isRegister ? 'Conta criada. Agora vamos conectar seu WhatsApp e validar o primeiro teste guiado.' : 'Login realizado. Redirecionando para o checklist...')
      setTimeout(() => router.push('/dashboard/inicio'), 300)
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
            <div>
              <label htmlFor="contactPhone" className="block text-sm font-medium mb-1 text-emerald-100">Celular/WhatsApp para suporte</label>
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
                Usaremos este contato para suporte proativo, como avisar se seu robô ficar parado por 2 dias ou se detectarmos dificuldade na configuração.
              </p>
            </div>
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

          {error && <Alert type="error" title="Falha na autenticação" message={error} />}
          {success && <Alert type="success" title="Sucesso" message={success} />}

          {isRegister && (
            <p className={`text-xs ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
Depois do cadastro, você entra no painel para conectar o WhatsApp, escolher grupos e validar o primeiro teste. Sem cartão no trial.
            </p>
          )}

          <p className={`text-xs leading-5 ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
            Ao continuar, você concorda com os <Link href="/termos" className="font-semibold underline">Termos de Uso</Link> e a <Link href="/privacidade" className="font-semibold underline">Política de Privacidade</Link>.
          </p>

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
