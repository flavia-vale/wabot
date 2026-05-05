'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { EmptyState, LoadingState } from '@/components/States'
import { ConfirmDialog } from '@/components/ConfirmDialog'

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function classifyError(message = '') {
  const text = message.toLowerCase()
  if (text.includes('network') || text.includes('fetch') || text.includes('conex')) {
    return 'conectividade'
  }
  if (text.includes('invalid') || text.includes('obrigat') || text.includes('required')) {
    return 'validação'
  }
  return 'regra de negócio'
}

function StatusBadge({ status }) {
  const map = {
    pending: ['Agendado', 'bg-yellow-100 text-yellow-700'],
    sent: ['Enviado', 'bg-green-100 text-green-700'],
    failed: ['Falhou', 'bg-red-100 text-red-600'],
    cancelled: ['Cancelado', 'bg-gray-100 text-gray-500'],
  }
  const [label, cls] = map[status] ?? [status, 'bg-gray-100 text-gray-500']
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

export default function EnvioPage() {
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [broadcastError, setBroadcastError] = useState('')

  const [schedText, setSchedText] = useState('')
  const [schedAt, setSchedAt] = useState('')
  const [schedLoading, setSchedLoading] = useState(false)
  const [schedError, setSchedError] = useState('')

  const [scheduled, setScheduled] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [listInfo, setListInfo] = useState('')
  const [cancelLoadingId, setCancelLoadingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [cancelTargetId, setCancelTargetId] = useState(null)
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false)

  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [minDateTime] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16))

  async function loadScheduled() {
    setListError('')
    setListInfo('')
    try {
      const data = await api.scheduledList()
      setScheduled(data)
    } catch (err) {
      setListError(err.message)
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.scheduledList()
      .then((data) => {
        if (active) setScheduled(data)
      })
      .catch((err) => {
        if (active) setListError(err.message)
      })
      .finally(() => {
        if (active) setListLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function sendBroadcastNow() {
    setBroadcastLoading(true)
    try {
      const res = await api.broadcastSend(broadcastText.trim())
      localStorage.setItem('broadcastConfirmShown', '1')
      setBroadcastResult(res)
      setBroadcastText('')
    } catch (err) {
      setBroadcastError(err.message)
    } finally {
      setBroadcastLoading(false)
      setBroadcastConfirmOpen(false)
    }
  }

  async function handleBroadcast(e) {
    e.preventDefault()
    setBroadcastError('')
    setBroadcastResult(null)

    const hasConfirmedBefore = localStorage.getItem('broadcastConfirmShown') === '1'
    const shouldConfirm = !hasConfirmedBefore || broadcastText.trim().length > 280

    if (shouldConfirm) {
      setBroadcastConfirmOpen(true)
      return
    }

    await sendBroadcastNow()
  }

  async function handleSchedule(e) {
    e.preventDefault()
    setSchedError('')
    setSchedLoading(true)
    try {
      await api.scheduledCreate(schedText.trim(), new Date(schedAt).toISOString())
      setSchedText('')
      setSchedAt('')
      await loadScheduled()
    } catch (err) {
      setSchedError(err.message)
    } finally {
      setSchedLoading(false)
    }
  }

  async function handleCancel(id) {

    setCancelLoadingId(id)
    setListError('')
    setListInfo('')
    try {
      const res = await api.scheduledCancel(id)
      if (res?.alreadyCancelled) {
        setListInfo('Este agendamento já estava cancelado.')
      }
      await loadScheduled()
    } catch (err) {
      setListError(err.message)
    } finally {
      setCancelLoadingId(null)
    }
  }

  const filtered = useMemo(
    () => scheduled.filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter)),
    [scheduled, statusFilter],
  )

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Envio de mensagens</h2>
      <p className="text-gray-500 text-sm mb-6">Envie manualmente ou agende mensagens para seus grupos de postagem</p>

      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">📤 Enviar agora</h3>
        <p className="text-xs text-amber-700 mb-2">Impacto: a mensagem será enviada para todos os grupos de destino configurados.</p>

        <form onSubmit={handleBroadcast} className="flex flex-col gap-3">
          <textarea
            rows={4}
            placeholder="Digite a mensagem..."
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          {broadcastError && (
            <Alert
              type="error"
              title={`Erro de ${classifyError(broadcastError)}`}
              message={broadcastError}
            />
          )}

          {broadcastResult && (
            <Alert
              type="success"
              title="Envio concluído"
              message={`Enviado para ${broadcastResult.sent} grupo(s).`}
            />
          )}

          <button
            type="submit"
            disabled={broadcastLoading || !broadcastText.trim()}
            className="bg-green-600 text-white rounded-xl py-2.5 font-semibold disabled:opacity-50"
          >
            {broadcastLoading ? 'Enviando...' : '📤 Enviar agora'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">🗓️ Agendar mensagem</h3>
        <p className="text-xs text-gray-500 mb-2">Fuso detectado: <strong>{timezoneLabel}</strong>.</p>

        <form onSubmit={handleSchedule} className="flex flex-col gap-3">
          <textarea
            rows={3}
            placeholder="Digite a mensagem..."
            value={schedText}
            onChange={(e) => setSchedText(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            min={minDateTime}
            value={schedAt}
            onChange={(e) => setSchedAt(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          {schedError && (
            <Alert type="error" title={`Erro de ${classifyError(schedError)}`} message={schedError} />
          )}

          <button
            type="submit"
            disabled={schedLoading || !schedText.trim() || !schedAt}
            className="bg-blue-600 text-white rounded-xl py-2.5 font-semibold disabled:opacity-50"
          >
            {schedLoading ? 'Agendando...' : '🗓️ Agendar'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">📋 Mensagens agendadas</h3>

        <div className="flex gap-2 mb-3">
          {[['all', 'Todos'], ['pending', 'Pendentes'], ['sent', 'Enviados'], ['failed', 'Falhos'], ['cancelled', 'Cancelados']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`text-xs px-2 py-1 rounded-full border ${statusFilter === value ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {listError && <Alert type="error" title={`Erro de ${classifyError(listError)}`} message={listError} />}
        {listInfo && <Alert type="warning" title="Aviso" message={listInfo} />}
        {listLoading && <LoadingState />}

        {!listLoading && filtered.length === 0 && <EmptyState message="Nenhuma mensagem agendada" />}

        {!listLoading && filtered.length > 0 && (
          <ul className="flex flex-col gap-3">
            {filtered.map((m) => (
              <li key={m.id} className="border rounded-xl p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-sm text-gray-700 line-clamp-2 flex-1">{m.text}</p>
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">
                    {m.status === 'sent' && m.sentAt
                      ? `Enviado em ${formatDateTime(m.sentAt)}`
                      : `Agendado para ${formatDateTime(m.scheduledAt)}`}
                  </span>
                  {m.status === 'pending' && (
                    <button
                      disabled={cancelLoadingId === m.id}
                      onClick={() => setCancelTargetId(m.id)}
                      className="text-xs text-red-500 disabled:opacity-50"
                    >
                      {cancelLoadingId === m.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog open={broadcastConfirmOpen} title="Confirmar envio imediato" message="Esta mensagem será enviada agora para todos os grupos de destino configurados." confirmLabel="Enviar agora" onCancel={() => setBroadcastConfirmOpen(false)} onConfirm={sendBroadcastNow} />
      <ConfirmDialog open={!!cancelTargetId} title="Cancelar agendamento" message="Esta ação interrompe o envio futuro dessa mensagem." confirmLabel="Sim, cancelar" danger onCancel={() => setCancelTargetId(null)} onConfirm={async () => { const id = cancelTargetId; setCancelTargetId(null); if (id) await handleCancel(id) }} />
    </div>
  )
}
