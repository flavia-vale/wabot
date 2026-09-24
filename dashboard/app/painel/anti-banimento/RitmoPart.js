'use client'

/* Parte "Ritmo por grupo" do Anti-banimento — presets reutilizáveis
 * ("Bem devagar" / "Equilibrado" / "Mais rápido" mais os personalizados) e o
 * ajuste por destino. Reaproveita a lógica da antiga tela "Preservação por
 * grupo e canal" (dashboard/components/preservacao/*), com o acréscimo de
 * abrir/realçar um destino específico via ?destino=<groupId> (atalho vindo do
 * painel de Espelhamento). Linguagem leiga completa e a etiqueta "Ritmo mais
 * cuidadoso"/"recomeçou do padrão" ficam para a User Story 2 — aqui a parte
 * ainda reaproveita os componentes/textos existentes. */

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState, ErrorState, EmptyState } from '@/components/States'
import { OperatingHoursForm } from '@/components/preservacao/OperatingHoursForm'
import { PreservationLimitsForm } from '@/components/preservacao/PreservationLimitsForm'

const NEW_PRESET = {
  name: '',
  isDefault: false,
  operatingHoursEnabled: false,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 30,
  dailyCap: null,
  // Descarte por idade na fila: 5h. Ver src/core/queueExpiry.js.
  queueMaxAgeMin: 300,
}

// "Máximo de envios na janela"/"Janela de rajada" não entram no resumo: viraram
// campos fixos (piso anti-banimento), não são mais informação que a cliente
// escolheu — mostrar o valor herdado confundiria com "isto é ajustável".
function summarizePreset(p) {
  const parts = []
  if (p.operatingHoursEnabled) {
    try { const h = JSON.parse(p.operatingHoursJson); parts.push(`envia ${h.startHour}h–${h.endHour}h`) }
    catch { /* ignore */ }
  } else parts.push('envia 24h')
  parts.push(`espera pelo menos ${p.minIntervalSec}s entre envios${p.dailyCap ? ` · até ${p.dailyCap}/dia` : ''}`)
  if (Number(p.queueMaxAgeMin) > 0) parts.push(`descarta após ${Math.round(Number(p.queueMaxAgeMin) / 60)}h na fila`)
  return parts.join(' · ')
}

// Campos de override DIRETO no destino (Group), fora do preset atribuído —
// "Voltar ao ritmo padrão" zera só estes, mantendo o preset atribuído
// (contracts/ui-anti-banimento.md § Ritmo por grupo).
const DESTINATION_OVERRIDE_KEYS = [
  'throttleEnabled', 'minIntervalSec', 'dailyCap', 'burstCap', 'burstWindowSec',
  'operatingHoursEnabled', 'operatingHoursJson', 'queueMaxAgeMin',
]

function hasOwnOverride(d) {
  return DESTINATION_OVERRIDE_KEYS.some((k) => d[k] !== null && d[k] !== undefined)
}

export default function RitmoPart({ initialDestino }) {
  const [presets, setPresets] = useState(null)
  const [destinations, setDestinations] = useState([])
  const [busca, setBusca] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null) // preset em edição (objeto) ou null
  const [busy, setBusy] = useState(false)
  const destinoRef = useRef(null)

  useEffect(() => { load() }, [])

  // Atalho vindo do painel de Espelhamento (?destino=<groupId>): rola até a
  // linha do destino e a realça brevemente, para a cliente confirmar que caiu
  // no lugar certo.
  useEffect(() => {
    if (!initialDestino || !destinations.length) return
    const el = destinoRef.current
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [initialDestino, destinations])

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
      delete body.ritmoMaisCuidadoso; delete body.recomecouDoPadrao
      // O liga/desliga dos limites virou fixo (sempre ligado) — salvar sempre
      // manda throttleEnabled: true, o que faz o destino sair do estado
      // "limites desligados" pelo caminho normal de escrita (T037).
      body.throttleEnabled = true
      if (editing.id) await api.updatePreservationPreset(editing.id, body)
      else await api.createPreservationPreset(body)
      setEditing(null)
      await load()
      flash('Ritmo salvo.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function removePreset(id) {
    setBusy(true); setError('')
    try { await api.deletePreservationPreset(id); await load(); flash('Ritmo excluído.') }
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

  // "Voltar ao ritmo padrão": zera só os campos de override GRAVADOS direto no
  // destino (nunca o preset atribuído), fazendo-o voltar a herdar do preset ou
  // do padrão da conta (contracts/ui-anti-banimento.md).
  async function resetDestino(destId) {
    setError('')
    try {
      const patch = Object.fromEntries(DESTINATION_OVERRIDE_KEYS.map((k) => [k, null]))
      const { destination } = await api.updatePreservationDestination(destId, patch)
      await load()
      flash('Destino voltou ao ritmo padrão.')
      void destination
    } catch (e) { setError(e.message) }
  }

  const destinationsFiltradas = busca.trim()
    ? destinations.filter((d) => (d.name || d.waJid || '').toLowerCase().includes(busca.trim().toLowerCase()))
    : destinations

  if (!presets && !error) return <LoadingState message="Carregando ritmo por grupo..." />
  if (error && !presets) return <ErrorState message={error} actionLabel="Tentar novamente" onAction={load} />

  return (
    <div className="max-w-3xl">
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      {notice && <div className="mb-4"><Alert type="success" message={notice} /></div>}

      {/* ----- Presets ----- */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Ritmos prontos</h2>
          {!editing && (
            <button onClick={() => setEditing({ ...NEW_PRESET })}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
              + Novo
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <fieldset className="bg-white rounded-2xl shadow p-5">
              <legend className="text-base font-semibold text-gray-800">{editing.id ? 'Editar' : 'Novo'}</legend>
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
                Usar como padrão da conta (aplica a destinos sem ritmo próprio)
              </label>
            </fieldset>
            <OperatingHoursForm value={editing} onChange={patch => setEditing(p => ({ ...p, ...patch }))} disabled={busy} />
            <PreservationLimitsForm value={editing} onChange={patch => setEditing(p => ({ ...p, ...patch }))} disabled={busy} />
            <div className="flex gap-3">
              <button onClick={savePreset} disabled={busy}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setEditing(null)} disabled={busy}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        ) : presets.length === 0 ? (
          <EmptyState title="Nenhum ritmo ainda" message="Crie um ritmo para reutilizar em vários grupos e canais." />
        ) : (
          <ul className="flex flex-col gap-2">
            {presets.map(p => (
              <li key={p.id} className="bg-white rounded-xl shadow px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {p.name} {p.isDefault && <span className="ml-1 text-[11px] rounded bg-green-100 text-green-700 px-1.5 py-0.5">padrão</span>}
                    {p.ritmoMaisCuidadoso && <span className="ml-1 text-[11px] rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">🐢 Ritmo mais cuidadoso</span>}
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
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Grupos e canais</h2>
        <p className="text-xs text-gray-500 mb-3">
          Cada grupo/canal de destino usa um ritmo. Sem ritmo próprio, herda o ritmo padrão da conta.
        </p>
        {destinations.length === 0 ? (
          <EmptyState title="Nenhum destino" message="O ritmo por grupo aparece quando você tiver grupos de envio." actionLabel="Ir para Espelhamento" actionHref="/painel/espelhamento" />
        ) : (
          <>
            {destinations.length > 6 && (
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar grupo ou canal..."
                className="mb-3 w-full max-w-sm border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
            )}
            {destinationsFiltradas.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum grupo ou canal encontrado para &quot;{busca}&quot;.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {destinationsFiltradas.map(d => (
                  <li
                    key={d.id}
                    ref={d.id === initialDestino ? destinoRef : undefined}
                    className={`bg-white rounded-xl shadow px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between${d.id === initialDestino ? ' ring-2 ring-green-400' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{d.name || d.waJid}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {d.kind === 'channel' ? 'Canal' : 'Grupo'}
                        {d.ritmoMaisCuidadoso && <span className="ml-1 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">🐢 Ritmo mais cuidadoso</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={d.preservationPresetId || ''}
                        onChange={e => assignPreset(d.id, e.target.value)}
                        className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-green-400">
                        <option value="">Ritmo padrão da conta</option>
                        {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {hasOwnOverride(d) && (
                        <button
                          type="button"
                          onClick={() => resetDestino(d.id)}
                          className="whitespace-nowrap text-xs font-semibold text-green-700 hover:underline"
                        >
                          Voltar ao ritmo padrão
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
