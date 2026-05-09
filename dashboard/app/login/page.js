'use client'
import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const LOGIN_BENEFITS = [
  'Conversão automática de links de afiliado',
  'Grupos de WhatsApp organizados por origem e destino',
  'Envio e agendamento de ofertas em menos tempo',
]

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [isRegister, setIsRegister] = useState(false)
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (isRegister) await api.register(name, email, password, contactPhone, ref)
      else await api.login(email, password)
      setSuccess(isRegister ? 'Conta criada com sucesso. Redirecionando para o checklist...' : 'Login realizado. Redirecionando para o checklist...')
      setTimeout(() => router.push('/dashboard/inicio'), 300)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-start justify-center px-3 py-4 sm:px-4 sm:py-6 md:items-center transition-colors duration-500 ${
      isRegister
        ? 'bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100'
        : 'bg-green-50'
    }`}>
      <div className={`rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 w-full max-w-md transition-all duration-500 ${
        isRegister
          ? 'bg-emerald-950/95 text-emerald-50 border border-emerald-700 shadow-emerald-900/20'
          : 'bg-white text-gray-900 border border-transparent'
      }`}>
        <div className="mb-4 flex justify-center sm:mb-5">
          <div className={`rounded-2xl p-2.5 sm:p-3 shadow-sm ${isRegister ? 'bg-emerald-900' : 'bg-green-50'}`}>
            <Image
              src="/wabot-logo.svg"
              alt="Logo do BOTinho, bot conversor para afiliados no WhatsApp"
              width={64}
              height={64}
              priority
            />
          </div>
        </div>

        <div className="mb-2 text-center">
          <p className={`text-sm font-semibold ${isRegister ? 'text-emerald-200' : 'text-green-700'}`}><span aria-hidden="true">🤖</span> Bot Conversor para Afiliados</p>
          <h1 className={`mt-2 text-xl sm:text-2xl font-bold leading-tight ${isRegister ? 'text-emerald-100' : 'text-gray-900'}`}>{isRegister ? 'Criar sua conta' : 'Entrar na sua conta'}</h1>
        </div>
        <p className={`text-center text-sm leading-5 mb-4 ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
          {isRegister ? 'Comece configurando seu WhatsApp e suas credenciais de afiliado.' : 'Acesse seu painel para conectar o WhatsApp e gerenciar seus grupos.'}
        </p>

        {ref && (
          <p className={`mb-4 rounded-lg px-3 py-2 text-xs font-medium ${
            isRegister ? 'bg-emerald-800 text-emerald-100' : 'bg-green-50 text-green-700'
          }`}>
            Você chegou por um convite. Crie sua conta para receber o benefício de indicação disponível.
          </p>
        )}

        <ul className={`mb-5 space-y-2 text-xs leading-5 ${isRegister ? 'text-emerald-100' : 'text-gray-600'}`}>
          {LOGIN_BENEFITS.map(benefit => (
            <li key={benefit} className="flex gap-2">
              <span aria-hidden="true">✅</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4">
          {isRegister && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1 text-emerald-100">Nome completo</label>
              <input
                id="name"
                type="text"
                placeholder="Como podemos te chamar"
                value={name}
                onChange={e => setName(e.target.value)}
                required={isRegister}
                autoComplete="name"
                className="border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 w-full min-h-11"
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
              onChange={e => setEmail(e.target.value)}
              required={!isRegister}
              autoComplete="email"
              className="border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-400 w-full rounded-lg min-h-11"
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
                onChange={e => setContactPhone(e.target.value)}
                required={isRegister}
                className="border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400 w-full min-h-11"
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
                  href="mailto:suporte@BOTinho.app?subject=Recuperar%20senha%20do%20BOTinho"
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
                onChange={e => setPassword(e.target.value)}
                required={!isRegister}
                minLength={isRegister ? 0 : undefined}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="w-full rounded-lg border bg-white px-3 py-2.5 pr-24 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-green-400 min-h-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-1 right-1 rounded-md px-3 text-xs font-semibold text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 min-h-9"
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
              Depois do cadastro, você poderá conectar seu WhatsApp, cadastrar suas credenciais e escolher os grupos do bot.
            </p>
          )}

          <p className={`text-xs leading-5 ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
            Ao continuar, você concorda com os <Link href="/termos" className="font-semibold underline">Termos de Uso</Link> e a <Link href="/privacidade" className="font-semibold underline">Política de Privacidade</Link>.
          </p>

          <button
            type="submit"
            disabled={loading}
            className={`text-white rounded-lg py-3 min-h-11 font-semibold disabled:opacity-50 transition ${
              isRegister
                ? 'bg-emerald-500 hover:bg-emerald-400'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? (isRegister ? 'Criando conta...' : 'Entrando...') : isRegister ? 'Criar conta e acessar painel' : 'Entrar no painel'}
          </button>
        </form>

        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess(''); setContactPhone('') }}
          className={`mt-4 text-sm min-h-11 hover:underline w-full text-center ${isRegister ? 'text-emerald-200' : 'text-green-600'}`}
        >
          {isRegister ? 'Já tenho conta — Entrar' : 'Ainda não tenho conta — começar agora'}
        </button>

        <nav className={`mt-6 flex flex-wrap justify-center gap-2 sm:gap-3 text-xs ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
          <Link href="/suporte" className="hover:underline min-h-11 inline-flex items-center px-2">Suporte</Link>
          <Link href="/termos" className="hover:underline min-h-11 inline-flex items-center px-2">Termos</Link>
          <Link href="/privacidade" className="hover:underline min-h-11 inline-flex items-center px-2">Privacidade</Link>
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
