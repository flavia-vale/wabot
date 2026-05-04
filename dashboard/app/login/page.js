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
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-green-700 mb-2">🤖 WaBot</h1>
        <p className="text-gray-500 text-sm mb-6">
          {isRegister ? 'Criar conta' : 'Entrar na sua conta'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
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

          {error && <Alert type="error" title="Falha na autenticação" message={error} />}
          {success && <Alert type="success" title="Sucesso" message={success} />}

          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white rounded-lg py-2 font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); setSuccess('') }}
          className="mt-4 text-sm text-green-600 hover:underline w-full text-center"
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
