'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const ALL_PLATFORMS = [
  { id: 'shopee', label: '🛍️ Shopee' },
  { id: 'amazon', label: '📦 Amazon' },
  { id: 'mercadolivre', label: '🛒 Mercado Livre' },
  { id: 'magazineluiza', label: '🛒 Magazine Luiza' },
]

export default function ConfigPage() {
  const [form, setForm] = useState({
    delayMin: 5,
    delayMax: 15,
    platforms: 'shopee,amazon,mercadolivre,magazineluiza',
    blockedKeywords: '',
    welcomeMsg: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getConfig()
      .then(cfg => setForm({
        delayMin: cfg.delayMin ?? 5,
        delayMax: cfg.delayMax ?? 15,
        platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
        blockedKeywords: cfg.blockedKeywords ?? '',
        welcomeMsg: cfg.welcomeMsg ?? '',
      }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function togglePlatform(id) {
    const current = form.platforms.split(',').filter(Boolean)
    const next = current.includes(id)
      ? current.filter(p => p !== id)
      : [...current, id]
    setForm(f => ({ ...f, platforms: next.join(',') }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (Number(form.delayMin) > Number(form.delayMax)) {
      setError('Delay mínimo não pode ser maior que o máximo')
      return
    }
    setSaving(true)
    try {
      await api.saveConfig({
        delayMin: Number(form.delayMin),
        delayMax: Number(form.delayMax),
        platforms: form.platforms,
        blockedKeywords: form.blockedKeywords,
        welcomeMsg: form.welcomeMsg,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>

  const enabledPlatforms = new Set(form.platforms.split(',').filter(Boolean))

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Configurações do Bot</h2>
      <p className="text-gray-500 text-sm mb-6">Ajuste o comportamento do bot</p>

      <form onSubmit={handleSave} className="flex flex-col gap-4">

        {/* Delay */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">⏱️ Delay entre envios</h3>
          <p className="text-xs text-gray-400 mb-4">Aguarda um tempo aleatório antes de repostar (evita bloqueios)</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Mínimo (segundos)</label>
              <input
                type="number" min="0" max="300"
                value={form.delayMin}
                onChange={e => setForm(f => ({ ...f, delayMin: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Máximo (segundos)</label>
              <input
                type="number" min="0" max="300"
                value={form.delayMax}
                onChange={e => setForm(f => ({ ...f, delayMax: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Defina 0 e 0 para enviar sem delay. Recomendado: 5–15s.
          </p>
        </div>

        {/* Plataformas */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">🏪 Plataformas habilitadas</h3>
          <p className="text-xs text-gray-400 mb-4">Apenas links destas plataformas serão convertidos e repostados</p>
          <div className="flex flex-col gap-2">
            {ALL_PLATFORMS.map(p => (
              <label key={p.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledPlatforms.has(p.id)}
                  onChange={() => togglePlatform(p.id)}
                  className="w-4 h-4 accent-green-600"
                />
                <span className="text-sm text-gray-700">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Palavras bloqueadas */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">🚫 Palavras bloqueadas</h3>
          <p className="text-xs text-gray-400 mb-3">
            Mensagens que contêm estas palavras serão ignoradas (separadas por vírgula)
          </p>
          <input
            type="text"
            placeholder="ex: proibido, spam, fora"
            value={form.blockedKeywords}
            onChange={e => setForm(f => ({ ...f, blockedKeywords: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Welcome msg */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">👋 Mensagem de boas-vindas</h3>
          <p className="text-xs text-gray-400 mb-3">
            Enviada automaticamente quando alguém entra nos seus grupos de postagem. Deixe vazio para desativar.
          </p>
          <textarea
            rows={3}
            placeholder="Ex: Bem-vindo(a)! Aqui compartilhamos as melhores ofertas 🔥"
            value={form.welcomeMsg}
            onChange={e => setForm(f => ({ ...f, welcomeMsg: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm font-medium">✓ Configurações salvas com sucesso!</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 disabled:opacity-50 transition"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </form>
    </div>
  )
}
