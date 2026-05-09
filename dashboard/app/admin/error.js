'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error('[admin] route error', error)
  }, [error])

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Falha no painel Admin</p>
        <h1 className="mt-2 text-2xl font-black text-gray-900">Não foi possível carregar esta página</h1>
        <p className="mt-3 text-sm text-gray-600">
          Ocorreu um erro inesperado no carregamento do Admin. Tente recarregar e, se continuar, volte ao dashboard.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Recarregar Admin
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
