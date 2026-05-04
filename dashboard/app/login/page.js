'use client'
import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

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
    const message = localStorage.getItem('loginRedirectMessage')
    if (reason === 'session-expired' && message) {
      localStorage.removeItem('loginRedirectMessage')
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
      const res = isRegister
        ? await api.register(email, password, ref)
        : await api.login(email, password)
      localStorage.setItem('token', res.token)
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
      <div className={`rounded-2xl shadow-lg p-8 w-full max-w-sm transition-all duration-500 ${
        isRegister
          ? 'bg-emerald-950/95 text-emerald-50 border border-emerald-700 shadow-emerald-900/20'
          : 'bg-white text-gray-900 border border-transparent'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-lg ${isRegister ? 'text-emerald-300' : 'text-green-600'}`}>
            {isRegister ? '✨' : '🤖'}
          </span>
          <h1 className={`text-2xl font-bold ${isRegister ? 'text-emerald-100' : 'text-green-700'}`}>WaBot</h1>
        </div>
        <p className={`text-sm mb-6 ${isRegister ? 'text-emerald-200' : 'text-gray-500'}`}>
          {isRegister ? 'Modo cadastro: crie sua conta para começar' : 'Entrar na sua conta'}
        </p>

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
              className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 w-full transition-colors ${
                isRegister
                  ? 'bg-white border-emerald-300 text-black placeholder:text-gray-600 focus:ring-emerald-400'
                  : 'bg-white border-gray-300 text-black placeholder:text-gray-600 focus:ring-green-400'
              }`}
            />
          </div>
          <div>
            <label htmlFor="password" className={`block text-sm font-medium mb-1 ${isRegister ? 'text-emerald-100' : 'text-gray-700'}`}>Senha</label>
            <input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 w-full transition-colors ${
                isRegister
                  ? 'bg-white border-emerald-300 text-black placeholder:text-gray-600 focus:ring-emerald-400'
                  : 'bg-white border-gray-300 text-black placeholder:text-gray-600 focus:ring-green-400'
              }`}
            />
          </div>

          {error && <Alert type="error" title="Falha na autenticação" message={error} />}
          {success && <Alert type="success" title="Sucesso" message={success} />}

          <button
            type="submit"
            disabled={loading}
            className={`text-white rounded-lg py-2 font-semibold disabled:opacity-50 transition ${
              isRegister
                ? 'bg-emerald-500 hover:bg-emerald-400'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess('') }}
          className={`mt-4 text-sm hover:underline w-full text-center ${isRegister ? 'text-emerald-200' : 'text-green-600'}`}
        >
          {isRegister ? 'Já tenho conta — Entrar' : 'Não tenho conta — Criar agora'}
        </button>
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
