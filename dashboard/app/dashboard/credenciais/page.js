'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const PLATFORMS = [
  { id: 'shopee', label: 'Shopee', fields: [{ key: 'appId', label: 'App ID' }, { key: 'secretKey', label: 'Secret Key' }] },
  { id: 'amazon', label: 'Amazon', fields: [{ key: 'tag', label: 'Tag de afiliado' }, { key: 'marketplace', label: 'Marketplace', placeholder: 'amazon.com.br' }] },
  { id: 'mercadolivre', label: 'Mercado Livre', fields: [{ key: 'tag', label: 'Tag numérica' }, { key: 'ssid', label: 'SSID (cookie)' }] },
  { id: 'magazineluiza', label: 'Magazine Luiza', fields: [{ key: 'tag', label: 'Tag de afiliado' }] },
]

function PlatformCard({ platform, initialData, onSave }) {
  const [values, setValues] = useState(initialData ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialData) setValues(initialData)
  }, [initialData])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      await onSave(platform.id, values)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-4">
      <h3 className="font-semibold text-gray-700 mb-3">{platform.label}</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {platform.fields.map(f => (
          <input
            key={f.key}
            placeholder={f.label + (f.placeholder ? ` (ex: ${f.placeholder})` : '')}
            value={values[f.key] ?? ''}
            onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        ))}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-green-600 text-white rounded-lg py-2 font-semibold hover:bg-green-700 disabled:opacity-50 transition text-sm"
        >
          {saving ? 'Salvando...' : saved ? '✅ Salvo!' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}

export default function CredenciaisPage() {
  const [credMap, setCredMap] = useState({})

  useEffect(() => {
    api.credentials().then(list => {
      const map = {}
      for (const c of list) map[c.platform] = c.data
      setCredMap(map)
    }).catch(() => {})
  }, [])

  async function handleSave(platform, data) {
    await api.saveCredential(platform, data)
    setCredMap(m => ({ ...m, [platform]: data }))
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Credenciais</h2>
      <p className="text-gray-500 text-sm mb-6">Configure suas contas de afiliado por plataforma</p>

      {PLATFORMS.map(p => (
        <PlatformCard
          key={p.id}
          platform={p}
          initialData={credMap[p.id]}
          onSave={handleSave}
        />
      ))}
    </div>
  )
}
