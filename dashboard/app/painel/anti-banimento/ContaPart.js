'use client'

/* Parte "Ajustes da conta" do Anti-banimento — o que vale para a conta toda,
 * não por grupo/canal: o intervalo entre destinos (ex-"atraso entre canais"),
 * seguir no máximo X canais por dia, e a variação de imagem. Reaproveita a
 * lógica/forms da antiga tela "Configurações avançadas"; a linguagem leiga
 * completa do campo de intervalo é da User Story 4 (T052/T053) — aqui a
 * parte ainda usa o form existente (ChannelStaggerForm). */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState, ErrorState } from '@/components/States'
import { ChannelStaggerForm } from '@/components/preservacao/ChannelStaggerForm'
import { FollowGuardForm } from '@/components/preservacao/FollowGuardForm'
import { ImageMutationToggle } from '@/components/preservacao/ImageMutationToggle'

export default function ContaPart() {
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
      setDraft({ ...data.config })
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
        if (k === 'effective') continue // campo aditivo de leitura, nunca enviado
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

  if (!config && !error) return <LoadingState message="Carregando ajustes da conta..." />
  if (error && !config) return <ErrorState message={error} actionLabel="Tentar novamente" onAction={load} />

  return (
    <div className="max-w-3xl">
      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}
      {savedAt && <div className="mb-4"><Alert type="success" message={`Ajustes salvos às ${savedAt.toLocaleTimeString('pt-BR')}.`} /></div>}

      <div className="flex flex-col gap-4">
        <ChannelStaggerForm value={draft} onChange={update} disabled={saving} />
        <FollowGuardForm value={draft} onChange={update} disabled={saving} />
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
