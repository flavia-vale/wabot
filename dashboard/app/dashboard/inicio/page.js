'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const STEPS = [
  {
    key: 'waConnected',
    title: 'WhatsApp conectado',
    ok: 'Número conectado ao bot',
    pending: 'Conecte seu número na aba WhatsApp',
    href: '/dashboard',
  },
  {
    key: 'hasCredentials',
    title: 'Chaves de afiliado',
    ok: 'Credenciais de afiliado configuradas',
    pending: 'Adicione suas chaves de afiliado',
    href: '/dashboard/credenciais',
  },
  {
    key: 'hasMonitorGroup',
    title: 'Grupo monitorado',
    ok: 'Grupo de origem configurado',
    pending: 'Adicione um grupo para monitorar (origem dos links)',
    href: '/dashboard/grupos',
  },
  {
    key: 'hasPostGroup',
    title: 'Grupo de envio',
    ok: 'Grupo de destino configurado',
    pending: 'Adicione um grupo para postar os links convertidos',
    href: '/dashboard/grupos',
  },
]

export default function InicioPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    api.dashboardStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const allOk = status && STEPS.every(s => status[s.key])

  if (loading) return <p className="text-gray-400 text-sm">Carregando...</p>

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Início</h2>
      <p className="text-gray-500 text-sm mb-6">Status do seu bot</p>

      <div className={`rounded-2xl p-4 mb-6 text-sm font-semibold ${
        allOk
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
      }`}>
        {allOk
          ? '🤖 Bot ativo e funcionando!'
          : '⚠️ Complete os passos abaixo para ativar o bot.'}
      </div>

      <div className="flex flex-col gap-3">
        {STEPS.map((step) => {
          const ok = status?.[step.key]
          return (
            <button
              key={step.key}
              onClick={() => router.push(step.href)}
              className={`w-full text-left bg-white rounded-2xl shadow p-5 flex items-center gap-4 hover:shadow-md transition border-2 ${
                ok ? 'border-green-200' : 'border-red-200'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                ok ? 'bg-green-500' : 'bg-red-400'
              }`}>
                {ok ? '✓' : '✗'}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">{step.title}</p>
                <p className={`text-xs mt-0.5 ${ok ? 'text-gray-400' : 'text-red-500'}`}>
                  {ok ? step.ok : step.pending}
                </p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
