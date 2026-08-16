'use client'

// "Esqueci minha senha": pede o e-mail e manda o link de nova senha.
//
// A resposta é sempre a mesma, exista ou não a conta — do contrário a tela
// vira um jeito de descobrir quem tem conta aqui.

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function enviar(event) {
    event.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      const resposta = await api.forgotPassword(email.trim())
      setEnviado(resposta?.message || 'Se existir uma conta com esse e-mail, enviamos o link.')
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <h1 className="text-xl font-black text-gray-900">Esqueci minha senha</h1>
        <p className="mt-1 text-sm text-gray-600">
          Digite o e-mail da sua conta. Vamos te mandar um link para criar uma senha nova.
        </p>

        {erro && <div className="mt-3"><Alert type="error" message={erro} /></div>}

        {enviado ? (
          <div className="mt-4">
            <Alert type="success" title="Confira seu e-mail" message={enviado} />
            <p className="mt-3 text-xs text-gray-500">
              O link vale por pouco tempo, por segurança. Se não chegar em alguns minutos, olhe a caixa de spam
              ou peça de novo.
            </p>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-4 space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <button
              type="submit"
              disabled={ocupado || !email.trim()}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {ocupado ? 'Enviando…' : 'Enviar link'}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="font-medium text-green-700 hover:underline">Voltar para entrar</Link>
        </p>
      </div>
    </main>
  )
}
