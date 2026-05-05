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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (isRegister) await api.register(email, password, ref)
      else await api.login(email, password)
      setSuccess(isRegister ? 'Conta criada com sucesso. Redirecionando...' : 'Login realizado. Redirecionando...')
      setTimeout(() => router.push('/dashboard'), 300)
    } catch (err) {
      setError(err.message)
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
              src="/wabot-logo.svg"
              alt="Logo do Wabot, bot conversor para afiliados no WhatsApp"
              width={64}
              height={64}
              priority
            />
          </div>
        </div>

        <div className="mb-2 text-center">
          <h1 className={`text-2xl font-bold ${isRegister ? 'text-emerald-100' : 'text-green-700'}`}>Bot Conversor para Afiliados</h1>
        </div>
        <p className={`text-center text-sm mb-4 ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
          {isRegister ? 'Crie sua conta para converter links, organizar grupos e enviar ofertas com menos trabalho manual.' : 'Acesse seu painel para conectar o WhatsApp, converter links e acompanhar seus envios.'}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className={`block text-sm font-medium mb-1 ${isRegister ? 'text-emerald-100' : 'text-gray-700'}`}>Email</label>
            <input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 w-full"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label htmlFor="password" className={`block text-sm font-medium ${isRegister ? 'text-emerald-100' : 'text-gray-700'}`}>Senha</label>
              {!isRegister && (
                <a
                  href="mailto:suporte@wabot.app?subject=Recuperar%20senha%20do%20Wabot"
                  className="text-xs font-medium text-green-600 hover:underline"
                >
                  Esqueci minha senha
                </a>
              )}
            </div>
            <input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 w-full"
            />
          </div>

          <div aria-live="assertive">{error && <Alert type="error" title="Falha na autenticação" message={error} />}</div>
          <div aria-live="polite">{success && <Alert type="success" title="Sucesso" message={success} />}</div>

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
            className={`text-white rounded-lg py-2 font-semibold disabled:opacity-50 transition ${
              isRegister
                ? 'bg-emerald-500 hover:bg-emerald-400'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? 'Aguarde...' : isRegister ? 'Criar conta e acessar painel' : 'Entrar no painel'}
          </button>
        </form>

        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess('') }}
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
