'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

const STEPS = [
  { key: 'waConnected', title: 'WhatsApp conectado', ok: 'Número conectado ao bot', pending: 'Conecte seu WhatsApp para permitir que o bot monitore e poste ofertas.', description: 'Permite que o bot leia e envie mensagens pelos seus grupos.', href: '/dashboard' },
  { key: 'hasCredentials', title: 'Chaves de afiliado', ok: 'Credenciais de afiliado configuradas', pending: 'Adicione suas chaves para converter links com suas tags.', description: 'Garante que os links convertidos usem suas credenciais de afiliado.', href: '/dashboard/credenciais' },
  { key: 'hasMonitorGroup', title: 'Grupo monitorado', ok: 'Grupo de origem configurado', pending: 'Escolha onde o bot deve encontrar os links originais.', description: 'É o grupo de origem onde o bot procura ofertas para converter.', href: '/dashboard/grupos' },
  { key: 'hasPostGroup', title: 'Grupo de envio', ok: 'Grupo de destino configurado', pending: 'Escolha onde publicar os links convertidos.', description: 'É o destino onde os links convertidos serão publicados.', href: '/dashboard/grupos' },
  { key: 'hasSuccessfulLog', title: 'Primeiro envio validado', ok: 'Já existe log de envio com sucesso', pending: 'Faça um teste de envio e confirme sucesso nos logs.', description: 'Confirma que a operação completa está funcionando antes do uso diário.', href: '/dashboard/envio' },
]

export default function InicioPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  async function fetchStatus() {
    setLoadError('')
    setLoading(true)
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

  const completedCount = useMemo(
    () => STEPS.filter((step) => status?.[step.key]).length,
    [status],
  )
  const allOk = status && completedCount === STEPS.length
  const nextStep = status ? STEPS.find((step) => !status?.[step.key]) : null
  const progressPercent = Math.round((completedCount / STEPS.length) * 100)
  const queue = status?.queue

  if (loading) return <LoadingState message="Carregando status do bot..." />

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Checklist de ativação</h2>
      <p className="text-gray-500 text-sm mb-6">Complete estes passos para deixar o bot pronto para converter e postar links.</p>

      {loadError && (
        <div className="mb-4 space-y-3">
          <Alert type="error" title="Falha ao carregar status" message={`${loadError} Se continuar, confira sua conexão e tente recarregar o painel.`} />
          <button onClick={fetchStatus} className="text-sm bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">Tentar novamente</button>
        </div>
      )}

      <div className={`rounded-2xl p-4 mb-6 text-sm font-semibold ${allOk ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
        <div className="flex items-center justify-between gap-3">
          <span>{allOk ? '🤖 Checklist completo: seu bot já teve um envio validado.' : '⚠️ Siga a ordem abaixo para configurar e testar sua operação sem depender do suporte.'}</span>
          <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-xs">{completedCount} de {STEPS.length}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70" aria-label={`${completedCount} de ${STEPS.length} passos concluídos`}>
          <div className={`h-full rounded-full ${allOk ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${progressPercent}%` }} />
        </div>
        {!allOk && nextStep && (
          <Link href={nextStep.href} className="mt-3 inline-flex rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">
            Próximo passo: {nextStep.title}
          </Link>
        )}
        {allOk && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/envio" className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">Enviar mensagem agora</Link>
            <Link href="/dashboard/logs" className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-green-800 ring-1 ring-green-200 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">Ver logs</Link>
          </div>
        )}
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
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-400">Fila atual</p><p className="text-lg font-bold text-gray-800">{queue.queueSize}/{queue.maxSize}</p></div>
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-400">Latência média</p><p className="text-lg font-bold text-gray-800">{queue.avgLatencyMs ?? 0}ms</p></div>
            <div className="rounded-xl bg-green-50 p-3"><p className="text-green-600">Sucessos</p><p className="text-lg font-bold text-green-700">{queue.successTotal ?? 0}</p></div>
            <div className="rounded-xl bg-red-50 p-3"><p className="text-red-600">Erros</p><p className="text-lg font-bold text-red-700">{queue.errorTotal ?? 0}</p></div>
          </div>
          {queue.lastError && <p className="text-xs text-red-500 mt-3">Último erro: {queue.lastError}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {STEPS.map((step) => {
          const ok = status?.[step.key]
          const isNext = nextStep?.key === step.key
          return (
            <Link
              key={step.key}
              href={step.href}
              aria-label={`${step.title}: ${ok ? 'concluído' : 'pendente'}. ${ok ? step.ok : step.pending}`}
              className={`w-full text-left bg-white rounded-2xl shadow p-5 flex items-start gap-4 hover:shadow-md transition border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 ${ok ? 'border-green-200' : isNext ? 'border-amber-400 ring-2 ring-amber-100' : 'border-amber-200'}`}
            >
              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-amber-500'}`} aria-hidden="true">
                {ok ? '✓' : '!'}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-800 text-sm">{step.title}</p>
                  {isNext && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Próximo passo</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>{ok ? 'Concluído' : 'Pendente'}</span>
                </div>
                <p className={`text-xs mt-1 ${ok ? 'text-gray-400' : 'text-amber-700'}`}>{ok ? step.ok : step.pending}</p>
                <p className="text-xs mt-1 text-gray-500">{step.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
