'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Agendado', cls: 'bg-yellow-100 text-yellow-700' },
    sent:    { label: 'Enviado',  cls: 'bg-green-100 text-green-700' },
    failed:  { label: 'Falhou',   cls: 'bg-red-100 text-red-600' },
    cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
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

  async function loadScheduled() {
    setListError('')
    try { setScheduled(await api.scheduledList()) } catch (err) { setListError(err.message) }
    setListLoading(false)
  }

  useEffect(() => { loadScheduled() }, [])

  async function handleBroadcast(e) {
    e.preventDefault()
    setBroadcastError('')
    setBroadcastResult(null)
    setBroadcastLoading(true)
    try {
      const res = await api.broadcastSend(broadcastText.trim())
      setBroadcastResult(res)
      setBroadcastText('')
    } catch (err) {
      setBroadcastError(err.message)
    } finally {
      setBroadcastLoading(false)
    }
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
    if (!confirm('Cancelar este agendamento?')) return
    setListError('')
    try { await api.scheduledCancel(id); await loadScheduled() } catch (err) { setListError(err.message) }
  }

  // min datetime para o picker (agora + 1 min)
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16)

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Envio de mensagens</h2>
      <p className="text-gray-500 text-sm mb-6">Envie manualmente ou agende mensagens para seus grupos de postagem</p>

      {/* Envio manual */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">📤 Enviar agora</h3>
        <p className="text-xs text-gray-400 mb-3">Envia imediatamente para todos os grupos de destino configurados</p>
        <form onSubmit={handleBroadcast} className="flex flex-col gap-3">
          <textarea
            rows={4}
            placeholder="Digite a mensagem..."
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
          {broadcastError && <p className="text-red-500 text-sm">{broadcastError}</p>}
          {broadcastResult && (
            <p className="text-green-600 text-sm font-medium">
              ✓ Enviado para {broadcastResult.sent} grupo{broadcastResult.sent !== 1 ? 's' : ''}
              {broadcastResult.errors?.length > 0 && ` (${broadcastResult.errors.length} erro${broadcastResult.errors.length > 1 ? 's' : ''})`}
            </p>
          )}
          <button
            type="submit"
            disabled={broadcastLoading || !broadcastText.trim()}
            className="bg-green-600 text-white rounded-xl py-2.5 font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {broadcastLoading ? 'Enviando...' : '📤 Enviar agora'}
          </button>
        </form>
      </div>

      {/* Agendar mensagem */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">🗓️ Agendar mensagem</h3>
        <p className="text-xs text-gray-400 mb-3">A mensagem será enviada automaticamente na data e hora escolhidas</p>
        <form onSubmit={handleSchedule} className="flex flex-col gap-3">
          <textarea
            rows={3}
            placeholder="Digite a mensagem..."
            value={schedText}
            onChange={e => setSchedText(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data e hora do envio</label>
            <input
              type="datetime-local"
              min={minDateTime}
              value={schedAt}
              onChange={e => setSchedAt(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          {schedError && <p className="text-red-500 text-sm">{schedError}</p>}
          <button
            type="submit"
            disabled={schedLoading || !schedText.trim() || !schedAt}
            className="bg-blue-600 text-white rounded-xl py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {schedLoading ? 'Agendando...' : '🗓️ Agendar'}
          </button>
        </form>
      </div>

      {/* Lista de agendamentos */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">📋 Mensagens agendadas</h3>
        {listError && <p className="text-red-500 text-sm mb-2">{listError}</p>}
        {listLoading && <p className="text-gray-400 text-sm">Carregando...</p>}
        {!listLoading && !listError && scheduled.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhuma mensagem agendada</p>
        )}
        {!listLoading && scheduled.length > 0 && (
          <ul className="flex flex-col gap-3">
            {scheduled.map(m => (
              <li key={m.id} className="border rounded-xl p-3 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 line-clamp-2 flex-1">{m.text}</p>
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {m.status === 'sent' && m.sentAt
                      ? `Enviado em ${formatDateTime(m.sentAt)}`
                      : `Agendado para ${formatDateTime(m.scheduledAt)}`}
                  </span>
                  {m.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(m.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
