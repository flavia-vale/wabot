'use client'

/* Configurações avançadas da Preservação — versão Menta do painel. A lógica de
 * carregar/editar/salvar (api.preservationConfig / updatePreservationConfig) e os
 * forms são os mesmos de /dashboard/preservacao/configuracoes; o título vai para
 * a topbar via usePainelHeader. */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState, ErrorState } from '@/components/States'
import { ThrottleForm } from '@/components/preservacao/ThrottleForm'
import { FollowGuardForm } from '@/components/preservacao/FollowGuardForm'
import { QuietHoursForm } from '@/components/preservacao/QuietHoursForm'
import { CopyVariationPoolEditor } from '@/components/preservacao/CopyVariationPoolEditor'
import { ImageMutationToggle } from '@/components/preservacao/ImageMutationToggle'
import { usePainelHeader } from '../../PainelShell'

export default function ConfiguracoesAvancadasPage() {
  usePainelHeader({ title: 'Configurações avançadas', subtitle: 'Ajustes finos das defesas — os defaults já são seguros para a maioria dos casos' })

  const [config, setConfig] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      setError('')
      const data = await api.preservationConfig()
      setConfig(data.config)
      setDraft({ ...data.config, channelBurstWindowSec: 3600 })
    } catch (e) { setError(e.message) }
  }

  function update(patch) {
    setDraft(d => ({ ...d, ...patch }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const patch = {}
      for (const k of Object.keys(draft)) {
        if (draft[k] !== config?.[k]) patch[k] = draft[k]
      }
      if (Object.keys(patch).length === 0) { setSaving(false); return }
      const data = await api.updatePreservationConfig(patch)
      setConfig(data.config)
      setDraft(data.config)
      setSavedAt(new Date())
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  if (!config && !error) return <LoadingState message="Carregando configurações..." />
  if (error && !config) return <ErrorState message={error} actionLabel="Tentar novamente" onAction={load} />

  return (
    <div className="max-w-3xl">
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      {savedAt && <div className="mb-4"><Alert type="success" message={`Configurações salvas às ${savedAt.toLocaleTimeString('pt-BR')}.`} /></div>}

      <div className="flex flex-col gap-4">
        <ThrottleForm value={draft} onChange={update} disabled={saving} />
        <QuietHoursForm value={draft} onChange={update} disabled={saving} />
        <FollowGuardForm value={draft} onChange={update} disabled={saving} />
        <CopyVariationPoolEditor value={draft} onChange={update} disabled={saving} />
        <ImageMutationToggle value={draft} onChange={update} disabled={saving} />
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={save} disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar tudo'}
        </button>
      </div>
    </div>
  )
}
