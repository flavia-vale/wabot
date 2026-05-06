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


function formatSchedulePreview(value, timezoneLabel) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `Será enviado em ${formatDateTime(date.toISOString())} (fuso ${timezoneLabel}).`
}

function isPastSchedule(value) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return true
  return date.getTime() <= Date.now()
}

function excerpt(text, max = 140) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max).trim()}…`
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

function MessagePreview({ text, title = 'Prévia da mensagem' }) {
  const trimmed = text.trim()

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <span className="text-xs text-gray-400">{text.length} caractere(s)</span>
      </div>
      {trimmed ? (
        <p className="whitespace-pre-wrap rounded-2xl bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">{text}</p>
      ) : (
        <p className="text-sm text-gray-400">Digite uma mensagem para visualizar a prévia antes de enviar.</p>
      )}
    </div>
  )
}

const MESSAGE_TEMPLATES = [
  { label: 'Oferta relâmpago', text: '⚡ Oferta relâmpago!\n\nProduto:\nPreço:\nLink:' },
  { label: 'Cupom', text: '🎟️ Cupom disponível!\n\nUse o cupom:\nLink da oferta:' },
  { label: 'Últimas unidades', text: '🔥 Últimas unidades!\n\nGaranta antes que acabe:' },
]

function StatusBadge({ status }) {
  const map = {
    pending: ['Agendado', 'bg-yellow-100 text-yellow-700'],
    queued: ['Na fila', 'bg-slate-100 text-slate-700'],
    sending: ['Enviando', 'bg-blue-100 text-blue-700'],
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
  const [cancelTarget, setCancelTarget] = useState(null)
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false)
  const [targetGroups, setTargetGroups] = useState([])
  const [targetGroupsLoading, setTargetGroupsLoading] = useState(true)
  const [targetGroupsError, setTargetGroupsError] = useState('')

  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [minDateTime] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16))

  async function loadTargetGroups() {
    setTargetGroupsError('')
    setTargetGroupsLoading(true)
    try {
      const groups = await api.groups()
      setTargetGroups(groups.filter((group) => group.role === 'post'))
    } catch (err) {
      setTargetGroupsError(err.message || 'Não foi possível carregar os grupos de destino.')
    } finally {
      setTargetGroupsLoading(false)
    }
  }

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

    api.groups()
      .then((groups) => {
        if (active) setTargetGroups(groups.filter((group) => group.role === 'post'))
      })
      .catch((err) => {
        if (active) setTargetGroupsError(err.message || 'Não foi possível carregar os grupos de destino.')
      })
      .finally(() => {
        if (active) setTargetGroupsLoading(false)
      })

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
    if (broadcastLoading) return
    setBroadcastLoading(true)
    try {
      const res = await api.broadcastSend(broadcastText.trim())
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

    if (!targetGroupsError && !targetGroups.length) {
      setBroadcastError('Nenhum grupo de destino configurado. Adicione um grupo de postagem antes de enviar.')
      return
    }

    setBroadcastConfirmOpen(true)
  }

  async function handleSchedule(e) {
    e.preventDefault()
    setSchedError('')

    if (isPastSchedule(schedAt)) {
      setSchedError('Escolha uma data e horário futuros para agendar a mensagem.')
      return
    }

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
  const targetGroupCount = targetGroups.length
  const schedulePreview = formatSchedulePreview(schedAt, timezoneLabel)
  const scheduleInvalid = isPastSchedule(schedAt)
  const cancelConfirmMessage = cancelTarget
    ? `Cancelar o agendamento de ${formatDateTime(cancelTarget.scheduledAt)}? Mensagem: “${excerpt(cancelTarget.text)}”. Esta ação interrompe apenas este envio futuro.`
    : ''
  const broadcastConfirmMessage = targetGroupsError
    ? 'Você está prestes a enviar esta mensagem agora para os grupos de destino configurados. Não foi possível contar os grupos neste momento; a API fará a validação final.'
    : `Você está prestes a enviar esta mensagem agora para ${targetGroupCount} grupo(s) de destino configurado(s).`

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Envio de mensagens</h2>
      <p className="text-gray-500 text-sm mb-6">Envie manualmente ou agende mensagens para seus grupos de postagem</p>

      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">📤 Enviar agora</h3>
        <p className="text-xs text-amber-700 mb-2">Impacto: a mensagem será enviada para todos os grupos de destino configurados{targetGroupsLoading ? '' : ` (${targetGroupCount})`}.</p>
        {targetGroupsError && (
          <div className="mb-3">
            <Alert type="warning" title="Grupos indisponíveis" message={`${targetGroupsError} A confirmação usará a validação da API ao enviar.`} />
            <button type="button" onClick={loadTargetGroups} className="mt-2 text-xs font-semibold text-amber-700 underline">Recarregar grupos</button>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {MESSAGE_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => setBroadcastText(template.text)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-green-400 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {template.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleBroadcast} className="flex flex-col gap-3">
          <textarea
            rows={4}
            placeholder="Digite a mensagem..."
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <MessagePreview text={broadcastText} />

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
              title="Broadcast enfileirado"
              message={`Enfileirado para ${broadcastResult.queued ?? 0} grupo(s). ${broadcastResult.rejected ? `${broadcastResult.rejected} rejeitado(s) pela fila.` : ''}`}
            />
          )}

          <button
            type="submit"
            disabled={broadcastLoading || targetGroupsLoading || !broadcastText.trim()}
            className="bg-green-600 text-white rounded-xl py-2.5 font-semibold disabled:opacity-50"
          >
            {broadcastLoading ? 'Enviando...' : <><span aria-hidden="true">📤</span> Enviar agora</>}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">🗓️ Agendar mensagem</h3>
        <p className="text-xs text-gray-500 mb-2">Fuso detectado: <strong>{timezoneLabel}</strong>. O horário abaixo será salvo no fuso detectado deste navegador.</p>

        <div className="mb-3 flex flex-wrap gap-2">
          {MESSAGE_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => setSchedText(template.text)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {template.label}
            </button>
          ))}
        </div>

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
            id="scheduled-at"
            type="datetime-local"
            min={minDateTime}
            value={schedAt}
            onChange={(e) => setSchedAt(e.target.value)}
            required
            aria-describedby="scheduled-at-help"
            aria-invalid={scheduleInvalid}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <div id="scheduled-at-help" className="text-xs">
            {schedAt && !scheduleInvalid && <p className="text-blue-700">{schedulePreview}</p>}
            {schedAt && scheduleInvalid && <p className="text-red-600" role="alert">Escolha um horário futuro no fuso {timezoneLabel}.</p>}
          </div>

          <MessagePreview text={schedText} title="Prévia do agendamento" />

          {schedError && (
            <Alert type="error" title={`Erro de ${classifyError(schedError)}`} message={schedError} />
          )}

          <button
            type="submit"
            disabled={schedLoading || !schedText.trim() || !schedAt || scheduleInvalid}
            className="bg-blue-600 text-white rounded-xl py-2.5 font-semibold disabled:opacity-50"
          >
            {schedLoading ? 'Agendando...' : <><span aria-hidden="true">🗓️</span> Agendar</>}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">📋 Mensagens agendadas</h3>

        <div className="mb-3 flex flex-wrap gap-2">
          {[['all', 'Todos'], ['pending', 'Pendentes'], ['queued', 'Na fila'], ['sending', 'Enviando'], ['sent', 'Enviados'], ['failed', 'Falhos'], ['cancelled', 'Cancelados']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              aria-pressed={statusFilter === value}
              className={`min-h-9 px-3 py-2 text-xs rounded-full border transition ${statusFilter === value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
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
                      onClick={() => setCancelTarget(m)}
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
      <ConfirmDialog open={broadcastConfirmOpen} title="Confirmar envio imediato" message={broadcastConfirmMessage} confirmLabel={broadcastLoading ? 'Enviando...' : 'Enviar agora'} onCancel={() => setBroadcastConfirmOpen(false)} onConfirm={sendBroadcastNow} />
      <ConfirmDialog open={!!cancelTarget} title="Cancelar agendamento" message={cancelConfirmMessage} confirmLabel={cancelLoadingId === cancelTarget?.id ? 'Cancelando...' : 'Sim, cancelar'} danger onCancel={() => setCancelTarget(null)} onConfirm={async () => { const target = cancelTarget; setCancelTarget(null); if (target?.id) await handleCancel(target.id) }} />
    </div>
  )
}
