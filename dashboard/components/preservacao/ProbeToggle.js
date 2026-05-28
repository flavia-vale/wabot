'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const STATE_LABEL = {
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  qr_pending: 'Aguardando QR',
  connected: 'Conectado',
  error: 'Erro',
}

export function ProbeToggle({ value, onChange, disabled, probeAccountSessionId }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [sessionInput, setSessionInput] = useState('')

  async function refreshStatus() {
    try {
      const out = await api.preservationProbeSessionStatus()
      setSession(out?.session || null)
      if (!sessionInput && out?.session?.sessionId) setSessionInput(out.session.sessionId)
    } catch (err) {
      setMsg(err?.message || 'Falha ao carregar status da sessão probe.')
    }
  }

  useEffect(() => {
    refreshStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(action) {
    setLoading(true)
    setMsg('')
    try {
      if (action === 'start') {
        const out = await api.preservationProbeSessionStart()
        setSession(out?.session || null)
        setSessionInput(out?.session?.sessionId || sessionInput)
      }
      if (action === 'stop') {
        const out = await api.preservationProbeSessionStop()
        setSession(out?.session || null)
      }
      if (action === 'select') {
        await api.preservationProbeSessionSelect(sessionInput.trim())
        setMsg('Sessão probe selecionada com sucesso. Clique em salvar tudo para persistir o toggle.')
      }
      await refreshStatus()
    } catch (err) {
      setMsg(err?.message || 'Ação não concluída.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🔭 Probe externo</legend>
      <p className="text-xs text-gray-500 mb-3">
        Configure uma segunda conta WhatsApp como observadora. Ela valida se as mensagens chegam no canal e ajuda a detectar risco de shadowban.
      </p>

      <div className="grid gap-2 mb-3 rounded-lg border border-slate-200 p-3 bg-slate-50">
        <div className="text-xs text-slate-700">
          Sessão atual: <strong>{STATE_LABEL[session?.state] || 'Desconhecido'}</strong>
          {session?.sessionId ? <span className="ml-1 font-mono">({session.sessionId})</span> : null}
        </div>
        {session?.qrExpiresAt ? (
          <div className="text-[11px] text-slate-500">
            QR expira em: {new Date(session.qrExpiresAt).toLocaleString('pt-BR')}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled || loading} onClick={() => run('start')} className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 disabled:opacity-60">Iniciar sessão probe</button>
          <button type="button" disabled={disabled || loading} onClick={() => run('stop')} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700 disabled:opacity-60">Parar sessão probe</button>
          <button type="button" disabled={disabled || loading} onClick={refreshStatus} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-60">Atualizar status</button>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-600 block mb-1">Selecionar ID da sessão probe</label>
        <div className="flex gap-2">
          <input
            value={sessionInput}
            onChange={(e) => setSessionInput(e.target.value)}
            placeholder="probe_<userId>"
            disabled={disabled || loading}
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-mono"
          />
          <button type="button" disabled={disabled || loading || !sessionInput.trim()} onClick={() => run('select')} className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 disabled:opacity-60">Selecionar</button>
        </div>
      </div>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value.probeEnabled}
          onChange={e => onChange({ probeEnabled: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
        />
        <span className="text-sm text-gray-700">Ativar observador externo</span>
      </label>
      <p className="text-[11px] text-gray-500 mt-2">
        Conta probe vinculada no config: <span className="font-mono">{probeAccountSessionId ?? 'nenhuma'}</span>.
      </p>
      {msg ? <p className="mt-2 text-xs text-slate-600">{msg}</p> : null}
    </fieldset>
  )
}
