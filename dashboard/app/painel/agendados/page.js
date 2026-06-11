'use client'

/* Agendamentos — versão Menta.
 * Lista os envios agendados (api.scheduledList) e permite cancelar os que ainda
 * não saíram (api.scheduledCancel). Mesmo contrato da tela mobile
 * (/m/op/scheduled) e do legado /dashboard/envio; aqui só muda a apresentação. */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { usePainelHeader, PainelContentActions } from '../PainelShell'

const STATUS_STYLES = {
  sent: { label: 'Enviado', cls: 'bg-green-100 text-green-700' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600' },
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  queued: { label: 'Na fila', cls: 'bg-amber-100 text-amber-700' },
  sending: { label: 'Enviando', cls: 'bg-amber-100 text-amber-700' },
}

const CANCELLABLE = new Set(['pending', 'queued'])

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function AgendadosPage() {
  usePainelHeader({ title: 'Agendamentos', subtitle: 'Envios programados aguardando a hora marcada' })

  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.scheduledList()
      setItems(Array.isArray(result) ? result : (result?.items ?? []))
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os agendamentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    // Deferido para fora do corpo síncrono do effect: a regra
    // react-hooks/set-state-in-effect (React 19) proíbe setState síncrono aqui.
    const timer = setTimeout(() => { if (active) load() }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [load])

  async function cancelScheduled(id) {
    setCancellingId(id)
    setConfirmId(null)
    setError('')
    try {
      await api.scheduledCancel(id)
      await load()
    } catch (err) {
      setError(err.message || 'Não foi possível cancelar o agendamento.')
    } finally {
      setCancellingId(null)
    }
  }

  const list = items ?? []

  return (
    <div className="max-w-2xl">
      <PainelContentActions>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </PainelContentActions>

      {error && (
        <div className="mb-4">
          <Alert type="error" title="Erro ao carregar" message={error} />
        </div>
      )}

      {loading && !items && (
        <div className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow">Carregando agendamentos…</div>
      )}

      {!loading && list.length === 0 && !error && (
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="mb-1 text-base font-semibold text-gray-800">Nenhum agendamento</p>
          <p className="mb-4 text-sm text-gray-500">
            Programe um envio na tela de criar oferta ou enviar mensagem para vê-lo aqui.
          </p>
          <Link
            href="/painel/criar-oferta"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-800"
          >
            Criar oferta
          </Link>
        </div>
      )}

      {list.length > 0 && (
        <ul className="flex flex-col gap-3">
          {list.map((item) => {
            const status = STATUS_STYLES[item.status] ?? { label: item.status || '—', cls: 'bg-gray-100 text-gray-600' }
            const cancellable = CANCELLABLE.has(item.status)
            const isCancelling = cancellingId === item.id
            return (
              <li key={item.id} className="rounded-2xl bg-white p-4 shadow">
                <p className="mb-3 whitespace-pre-wrap break-words text-sm text-gray-700 line-clamp-3">
                  {item.text || '(sem texto)'}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.cls}`}>{status.label}</span>
                    <span className="text-xs text-gray-500">{formatWhen(item.scheduledAt)}</span>
                  </div>
                  {cancellable && (
                    <button
                      type="button"
                      onClick={() => setConfirmId(item.id)}
                      disabled={isCancelling}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {isCancelling ? 'Cancelando…' : 'Cancelar'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmId != null}
        title="Cancelar agendamento"
        message="O envio programado será cancelado e não sairá. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar envio"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => cancelScheduled(confirmId)}
      />
    </div>
  )
}
