'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const PLATFORMS = [
  {
    id: 'shopee',
    label: 'Shopee',
    instructions: 'Use as credenciais do app de afiliado/API. O Secret Key deve ser mantido privado.',
    fields: [
      { key: 'appId', label: 'App ID', hint: 'Identificador do seu app na Shopee.' },
      { key: 'secretKey', label: 'Secret Key', hint: 'Chave secreta do app (não compartilhe).' },
    ]
  },
  {
    id: 'amazon',
    label: 'Amazon',
    instructions: 'Informe seu tracking ID (tag) e o marketplace correto onde os links serão resolvidos.',
    fields: [
      { key: 'tag', label: 'Tag de afiliado', hint: 'Ex.: suatag-20' },
      { key: 'marketplace', label: 'Marketplace', placeholder: 'amazon.com.br', hint: 'Domínio da loja Amazon alvo.' },
    ]
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    instructions: 'Para gerar meli.la corretamente, preencha os 3 campos: Tag, SSID e CSRF.',
    fields: [
      { key: 'tag', label: 'Tag numérica', hint: 'Somente números da sua afiliação.' },
      { key: 'ssid', label: 'SSID (cookie)', hint: 'Valor do cookie ssid da conta afiliada.' },
      { key: 'csrf', label: 'CSRF (cookie _csrf)', hint: 'Valor do cookie _csrf da sessão ativa.' },
    ]
  },
  {
    id: 'magazineluiza',
    label: 'Magazine Luiza',
    instructions: 'Preencha a tag de afiliado usada nos links do Magalu.',
    fields: [{ key: 'tag', label: 'Tag de afiliado', hint: 'Ex.: parceiro123' }]
  },
]

function PlatformCard({ platform, initialData, onSave, disabled }) {
  const [values, setValues] = useState(initialData ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')


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
      <h3 className="font-semibold text-gray-700 mb-1">{platform.label}</h3>
      {platform.instructions && (
        <p className="text-xs text-gray-500 mb-3">{platform.instructions}</p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {platform.fields.map(f => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <input
              placeholder={f.placeholder ? `ex: ${f.placeholder}` : ''}
              value={values[f.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
            />
            {f.hint && <p className="text-[11px] text-gray-400">{f.hint}</p>}
          </div>
        ))}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving || disabled}
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  async function loadCredentials() {
    try {
      const list = await api.credentials()
      const map = {}
      for (const c of list) map[c.platform] = c.data
      setCredMap(map)
    } catch (err) {
      setLoadError(err.message || 'Falha ao carregar credenciais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.credentials()
      .then((list) => {
        if (!active) return
        const map = {}
        for (const c of list) map[c.platform] = c.data
        setCredMap(map)
      })
      .catch((err) => { if (active) setLoadError(err.message || 'Falha ao carregar credenciais.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleSave(platform, data) {
    await api.saveCredential(platform, data)
    setCredMap(m => ({ ...m, [platform]: data }))
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Credenciais</h2>
      <p className="text-gray-500 text-sm mb-6">Configure suas contas de afiliado por plataforma</p>
      <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs mb-4">
        Mercado Livre: para gerar link curto correto (meli.la), preencha obrigatoriamente Tag, SSID e CSRF.
      </p>

      {loading && <p className="text-gray-500 text-sm mb-4">Carregando credenciais...</p>}
      {loadError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm mb-4">{loadError} <button onClick={loadCredentials} className="underline ml-2">Recarregar</button></div>}

      {PLATFORMS.map(p => (
        <PlatformCard
          key={`${p.id}-${JSON.stringify(credMap[p.id] ?? {})}`}
          platform={p}
          initialData={credMap[p.id]}
          onSave={handleSave}
          disabled={loading || !!loadError}
        />
      ))}
    </div>
  )
}
