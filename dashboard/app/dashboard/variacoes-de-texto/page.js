'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { CopyVariationPoolEditor } from '@/components/preservacao/CopyVariationPoolEditor'

export default function VariacoesDeTextoPage() {
  const [value, setValue] = useState({
    copyVariationPoolJson: '{}',
    brandingGroupLink: '',
    couponLink: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.variationsGet()
      .then(cfg => setValue({
        copyVariationPoolJson: cfg.copyVariationPoolJson ?? '{}',
        brandingGroupLink: cfg.brandingGroupLink ?? '',
        couponLink: cfg.couponLink ?? '',
      }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.variationsUpdate({
        copyVariationPoolJson: value.copyVariationPoolJson,
        brandingGroupLink: value.brandingGroupLink,
        couponLink: value.couponLink,
      })
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

      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Links</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Use <code className="bg-gray-100 px-1 rounded">{'{{grupoLink}}'}</code> e{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{cupomLink}}'}</code> nos seus ganchos e CTAs.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link de convite do grupo</label>
          <input
            type="url"
            value={value.brandingGroupLink}
            onChange={e => setValue(v => ({ ...v, brandingGroupLink: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            disabled={saving}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link de cupom</label>
          <input
            type="url"
            value={value.couponLink}
            onChange={e => setValue(v => ({ ...v, couponLink: e.target.value }))}
            placeholder="https://..."
            disabled={saving}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
        </div>
      </div>

      <CopyVariationPoolEditor
        value={value}
        onChange={next => setValue(v => ({ ...v, ...next }))}
        disabled={saving}
        showPresets={false}
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
        ← <Link href="/dashboard/ofertas-automaticas" className="hover:underline">Voltar para Ofertas automáticas</Link>
      </p>
    </div>
  )
}
