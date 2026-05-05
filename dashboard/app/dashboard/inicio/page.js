'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const STEPS = [
  { key: 'waConnected', title: 'WhatsApp conectado', ok: 'Número conectado ao bot', pending: 'Conecte seu número na aba WhatsApp', href: '/dashboard' },
  { key: 'hasCredentials', title: 'Chaves de afiliado', ok: 'Credenciais de afiliado configuradas', pending: 'Adicione suas chaves de afiliado', href: '/dashboard/credenciais' },
  { key: 'hasMonitorGroup', title: 'Grupo monitorado', ok: 'Grupo de origem configurado', pending: 'Adicione um grupo para monitorar (origem dos links)', href: '/dashboard/grupos' },
  { key: 'hasPostGroup', title: 'Grupo de envio', ok: 'Grupo de destino configurado', pending: 'Adicione um grupo para postar os links convertidos', href: '/dashboard/grupos' },
  { key: 'hasSuccessfulLog', title: 'Primeiro envio validado', ok: 'Já existe log de envio com sucesso', pending: 'Faça um teste de envio e confirme sucesso nos logs', href: '/dashboard/envio' },
]

export default function InicioPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const router = useRouter()

  async function fetchStatus() {
    try {
      const data = await api.dashboardStatus()
      setStatus(data)
    } catch {
      setLoadError('Não foi possível carregar o status agora. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.dashboardStatus()
      .then((data) => { if (active) setStatus(data) })
      .catch(() => { if (active) setLoadError('Não foi possível carregar o status agora. Verifique sua conexão e tente novamente.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const allOk = status && STEPS.every(s => status[s.key])
  const queue = status?.queue
  if (loading) return <LoadingState />

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Início</h2>
      <p className="text-gray-500 text-sm mb-6">Primeiros passos para sair do cadastro até o primeiro envio validado.</p>

      {loadError && (
        <div className="mb-4 space-y-3">
          <Alert type="error" title="Falha ao carregar status" message={loadError} />
          <button onClick={fetchStatus} className="text-sm bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-900">Tentar novamente</button>
        </div>
      )}

      <div className={`rounded-2xl p-4 mb-6 text-sm font-semibold ${allOk ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
        {allOk ? '🤖 Checklist completo: seu bot já teve um envio validado.' : '⚠️ Siga a ordem abaixo para configurar e testar sua operação sem depender do suporte.'}
      </div>

      {queue && (
        <div className="bg-white rounded-2xl shadow p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Saúde operacional</h3>
            <span className={`text-xs px-2 py-1 rounded-full ${queue.queueSize > 0 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {queue.queueSize > 0 ? 'Fila ativa' : 'Fila vazia'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-400">Fila atual</p>
              <p className="text-lg font-bold text-gray-800">{queue.queueSize}/{queue.maxSize}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-400">Latência média</p>
              <p className="text-lg font-bold text-gray-800">{queue.avgLatencyMs ?? 0}ms</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <p className="text-green-600">Sucessos</p>
              <p className="text-lg font-bold text-green-700">{queue.successTotal ?? 0}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-red-600">Erros</p>
              <p className="text-lg font-bold text-red-700">{queue.errorTotal ?? 0}</p>
            </div>
          </div>
          {queue.lastError && <p className="text-xs text-red-500 mt-3">Último erro: {queue.lastError}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {STEPS.map((step) => {
          const ok = status?.[step.key]
          return (
            <button
              key={step.key}
              onClick={() => router.push(step.href)}
              className={`w-full text-left bg-white rounded-2xl shadow p-5 flex items-center gap-4 hover:shadow-md transition border-2 ${ok ? 'border-green-200' : 'border-amber-200'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-amber-500'}`}>
                {ok ? '✓' : '!'}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">{step.title}</p>
                <p className={`text-xs mt-0.5 ${ok ? 'text-gray-400' : 'text-amber-700'}`}>{ok ? step.ok : step.pending}</p>
              </div>
              <span className="text-xs font-semibold text-gray-400">{ok ? 'Concluído' : 'Resolver'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
