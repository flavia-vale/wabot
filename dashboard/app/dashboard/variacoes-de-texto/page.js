'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { CopyVariationPoolEditor } from '@/components/preservacao/CopyVariationPoolEditor'

export default function VariacoesDeTextoPage() {
  const [value, setValue] = useState({ copyVariationPoolJson: '{}' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.variationsGet()
      .then(cfg => setValue({ copyVariationPoolJson: cfg.copyVariationPoolJson ?? '{}' }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.variationsUpdate(value.copyVariationPoolJson)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ganchos e CTAs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure variações de texto para que suas ofertas automáticas nunca saiam iguais.
          O bot escolhe aleatoriamente uma opção de cada grupo a cada envio.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <CopyVariationPoolEditor
        value={value}
        onChange={next => setValue(v => ({ ...v, ...next }))}
        disabled={saving}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar variações'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Salvo!</span>}
      </div>

      <p className="text-xs text-gray-400">
        ← <a href="/dashboard/ofertas-automaticas" className="hover:underline">Voltar para Ofertas automáticas</a>
      </p>
    </div>
  )
}
