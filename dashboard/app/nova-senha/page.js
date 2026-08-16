'use client'

// Tela do link de recuperação: escolhe a senha nova e já entra na conta.

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

function NovaSenhaForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('c') || ''

  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const curta = senha.length > 0 && senha.length < 8
  const diferente = confirmacao.length > 0 && confirmacao !== senha

  async function salvar(event) {
    event.preventDefault()
    setErro('')
    setOcupado(true)
    try {
      await api.resetPassword(token, senha, confirmacao)
      router.push('/painel')
    } catch (err) {
      setErro(err.message)
    } finally {
      setOcupado(false)
    }
  }

  if (!token) {
    return (
      <div>
        <Alert type="error" title="Link incompleto" message="Abra o link direto do e-mail que enviamos — ele traz um código que esta tela precisa." />
        <p className="mt-4 text-center text-sm">
          <Link href="/esqueci-senha" className="font-medium text-green-700 hover:underline">Pedir um link novo</Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      {erro && <Alert type="error" message={erro} />}
      <div>
        <label htmlFor="senha" className="mb-1 block text-sm font-medium text-gray-700">Senha nova</label>
        <input
          id="senha"
          type="password"
          required
          minLength={8}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Pelo menos 8 caracteres"
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-400"
        />
        {curta && <p className="mt-1 text-xs text-amber-700">Precisa ter pelo menos 8 caracteres.</p>}
      </div>
      <div>
        <label htmlFor="confirmacao" className="mb-1 block text-sm font-medium text-gray-700">Repita a senha</label>
        <input
          id="confirmacao"
          type="password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-green-400"
        />
        {diferente && <p className="mt-1 text-xs text-amber-700">As duas senhas não estão iguais.</p>}
      </div>
      <button
        type="submit"
        disabled={ocupado || curta || diferente || !senha || !confirmacao}
        className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {ocupado ? 'Salvando…' : 'Salvar e entrar'}
      </button>
    </form>
  )
}

export default function NovaSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <h1 className="text-xl font-black text-gray-900">Criar uma nova senha</h1>
        <p className="mt-1 mb-4 text-sm text-gray-600">Escolha a senha que você vai usar para entrar.</p>
        <Suspense fallback={<p className="text-sm text-gray-500">Carregando…</p>}>
          <NovaSenhaForm />
        </Suspense>
        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="font-medium text-green-700 hover:underline">Voltar para entrar</Link>
        </p>
      </div>
    </main>
  )
}
