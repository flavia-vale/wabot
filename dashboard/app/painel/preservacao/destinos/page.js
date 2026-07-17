'use client'

/* Plano B — Preservação por destino. Gerencia PRESETS reutilizáveis (anti-ban +
 * horário de funcionamento) e a atribuição/override por destino-post. A config
 * global legada continua em "Configurações avançadas" até a aposentadoria (B-5). */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState, ErrorState, EmptyState } from '@/components/States'
import { OperatingHoursForm } from '@/components/preservacao/OperatingHoursForm'
import { PreservationLimitsForm } from '@/components/preservacao/PreservationLimitsForm'
import { usePainelHeader } from '../../PainelShell'

const NEW_PRESET = {
  name: '',
  isDefault: false,
  operatingHoursEnabled: false,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 30,
  burstCap: 6,
  burstWindowSec: 600,
  dailyCap: null,
}

function summarizePreset(p) {
  const parts = []
  if (p.operatingHoursEnabled) {
    try { const h = JSON.parse(p.operatingHoursJson); parts.push(`envia ${h.startHour}h–${h.endHour}h`) }
    catch { /* ignore */ }
  } else parts.push('envia 24h')
  if (p.throttleEnabled !== false) parts.push(`min ${p.minIntervalSec}s · ${p.burstCap}/janela${p.dailyCap ? ` · ${p.dailyCap}/dia` : ''}`)
  else parts.push('sem limite anti-ban')
  return parts.join(' · ')
}

export default function PreservacaoPorDestinoPage() {
  usePainelHeader({ title: 'Preservação por grupo e canal', subtitle: 'Presets reutilizáveis e ajustes por grupo/canal de destino' })

  const [presets, setPresets] = useState(null)
  const [destinations, setDestinations] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null) // preset em edição (objeto) ou null
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      setError('')
      const [pres, dest] = await Promise.all([api.preservationPresets(), api.preservationDestinations()])
      setPresets(pres.presets)
      setDestinations(dest.destinations)
    } catch (e) { setError(e.message) }
  }

  function flash(msg) { setNotice(msg); setTimeout(() => setNotice(''), 4000) }

  async function savePreset() {
    setBusy(true); setError('')
    try {
      const body = { ...editing }
      delete body.id; delete body.createdAt; delete body.updatedAt
      if (editing.id) await api.updatePreservationPreset(editing.id, body)
      else await api.createPreservationPreset(body)
      setEditing(null)
      await load()
      flash('Preset salvo.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function removePreset(id) {
    setBusy(true); setError('')
    try { await api.deletePreservationPreset(id); await load(); flash('Preset excluído.') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function assignPreset(destId, presetId) {
    setError('')
    try {
      await api.updatePreservationDestination(destId, { preservationPresetId: presetId || null })
      setDestinations(ds => ds.map(d => d.id === destId ? { ...d, preservationPresetId: presetId || null } : d))
      flash('Destino atualizado.')
    } catch (e) { setError(e.message) }
  }

  if (!presets && !error) return <LoadingState message="Carregando preservação por destino..." />
  if (error && !presets) return <ErrorState message={error} actionLabel="Tentar novamente" onAction={load} />

  return (
    <div className="max-w-3xl">
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      {notice && <div className="mb-4"><Alert type="success" message={notice} /></div>}

      {/* ----- Presets ----- */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Presets</h2>
          {!editing && (
            <button onClick={() => setEditing({ ...NEW_PRESET })}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
              + Novo preset
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <fieldset className="bg-white rounded-2xl shadow p-5">
              <legend className="text-base font-semibold text-gray-800">{editing.id ? 'Editar preset' : 'Novo preset'}</legend>
              <label className="block mb-3">
                <span className="text-xs font-medium text-gray-700">Nome</span>
                <input type="text" value={editing.name}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex.: Conservador, Comercial…"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400" />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!editing.isDefault}
                  onChange={e => setEditing(p => ({ ...p, isDefault: e.target.checked }))} />
                Usar como padrão da conta (aplica a destinos sem preset próprio)
              </label>
            </fieldset>
            <OperatingHoursForm value={editing} onChange={patch => setEditing(p => ({ ...p, ...patch }))} disabled={busy} />
            <PreservationLimitsForm value={editing} onChange={patch => setEditing(p => ({ ...p, ...patch }))} disabled={busy} />
            <div className="flex gap-3">
              <button onClick={savePreset} disabled={busy}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {busy ? 'Salvando...' : 'Salvar preset'}
              </button>
              <button onClick={() => setEditing(null)} disabled={busy}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        ) : presets.length === 0 ? (
          <EmptyState title="Nenhum preset ainda" message="Crie um preset para reutilizar configurações de preservação em vários destinos." />
        ) : (
          <ul className="flex flex-col gap-2">
            {presets.map(p => (
              <li key={p.id} className="bg-white rounded-xl shadow px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {p.name} {p.isDefault && <span className="ml-1 text-[11px] rounded bg-green-100 text-green-700 px-1.5 py-0.5">padrão</span>}
                  </div>
                  <div className="text-xs text-gray-500">{summarizePreset(p)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing({ ...p })} className="text-sm text-gray-600 hover:text-gray-900">Editar</button>
                  {!p.isDefault && <button onClick={() => removePreset(p.id)} className="text-sm text-red-600 hover:text-red-800">Excluir</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----- Destinos ----- */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Destinos</h2>
        <p className="text-xs text-gray-500 mb-3">
          Cada grupo/canal de destino usa um preset. Sem preset próprio, herda o preset padrão da conta.
        </p>
        {destinations.length === 0 ? (
          <EmptyState title="Nenhum destino" message="Cadastre grupos/canais de destino para configurá-los aqui." />
        ) : (
          <ul className="flex flex-col gap-2">
            {destinations.map(d => (
              <li key={d.id} className="bg-white rounded-xl shadow px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{d.name || d.waJid}</div>
                  <div className="text-xs text-gray-500 truncate">{d.kind === 'channel' ? 'Canal' : 'Grupo'}</div>
                </div>
                <select value={d.preservationPresetId || ''}
                  onChange={e => assignPreset(d.id, e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-400">
                  <option value="">Preset padrão da conta</option>
                  {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
