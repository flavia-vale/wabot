'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ErrorState, LoadingState } from '@/components/States'

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
  const [loadError, setLoadError] = useState('')
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function loadConfig() {
    setLoading(true)
    setLoadError('')
    try {
      const cfg = await api.getConfig()
      setForm({
        delayMin: cfg.delayMin ?? 5,
        delayMax: cfg.delayMax ?? 15,
        platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
        blockedKeywords: cfg.blockedKeywords ?? '',
        welcomeMsg: cfg.welcomeMsg ?? '',
      })
      setLoadedOnce(true)
    } catch (err) {
      setLoadError(err.message || 'Não foi possível carregar as configurações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.getConfig()
      .then((cfg) => {
        if (!active) return
        setForm({
          delayMin: cfg.delayMin ?? 5,
          delayMax: cfg.delayMax ?? 15,
          platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
          blockedKeywords: cfg.blockedKeywords ?? '',
          welcomeMsg: cfg.welcomeMsg ?? '',
        })
        setLoadedOnce(true)
      })
      .catch((err) => { if (active) setLoadError(err.message || 'Não foi possível carregar as configurações.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function togglePlatform(id) {
    const current = form.platforms.split(',').filter(Boolean)
    const next = current.includes(id)
      ? current.filter(p => p !== id)
      : [...current, id]
    setForm(f => ({ ...f, platforms: next.join(',') }))
  }

  function parseDelay(value, label) {
    const text = String(value).trim()
    if (!text) return { error: `${label} é obrigatório` }

    const number = Number(text)
    if (!Number.isInteger(number) || number < 0 || number > 300) {
      return { error: `${label} deve ser um número inteiro entre 0 e 300` }
    }

    return { value: number }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!loadedOnce || loadError) return
    setError('')
    setSuccess(false)

    const parsedMin = parseDelay(form.delayMin, 'Delay mínimo')
    if (parsedMin.error) {
      setError(parsedMin.error)
      return
    }

    const parsedMax = parseDelay(form.delayMax, 'Delay máximo')
    if (parsedMax.error) {
      setError(parsedMax.error)
      return
    }

    if (parsedMin.value > parsedMax.value) {
      setError('Delay mínimo não pode ser maior que o máximo')
      return
    }
    setSaving(true)
    try {
      await api.saveConfig({
        delayMin: parsedMin.value,
        delayMax: parsedMax.value,
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

  if (loading) return <LoadingState />

  const enabledPlatforms = new Set(form.platforms.split(',').filter(Boolean))

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Configurações do Bot</h2>
      <p className="text-gray-500 text-sm mb-6">Ajuste o comportamento do bot</p>

      {loadError && <div className="mb-4"><ErrorState title="Falha ao carregar configurações" message={loadError} actionLabel="Tentar novamente" onAction={loadConfig} /></div>}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">⏱️ Delay entre envios</h3>
          <p className="text-xs text-gray-400 mb-4">Aguarda um tempo aleatório antes de repostar (evita bloqueios)</p>
          <div className="flex items-center gap-4">
            <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">Mínimo (segundos)</label><input type="number" min="0" max="300" step="1" required value={form.delayMin} onChange={e => setForm(f => ({ ...f, delayMin: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400" /></div>
            <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">Máximo (segundos)</label><input type="number" min="0" max="300" step="1" required value={form.delayMax} onChange={e => setForm(f => ({ ...f, delayMax: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400" /></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">🏪 Plataformas habilitadas</h3>
          <div className="flex flex-col gap-2">{ALL_PLATFORMS.map(p => <label key={p.id} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={enabledPlatforms.has(p.id)} onChange={() => togglePlatform(p.id)} className="w-4 h-4 accent-green-600" /><span className="text-sm text-gray-700">{p.label}</span></label>)}</div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5"><h3 className="font-semibold text-gray-700 mb-1">🚫 Palavras bloqueadas</h3><input type="text" placeholder="ex: proibido, spam, fora" value={form.blockedKeywords} onChange={e => setForm(f => ({ ...f, blockedKeywords: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400" /></div>

        <div className="bg-white rounded-2xl shadow p-5"><h3 className="font-semibold text-gray-700 mb-1">👋 Mensagem de boas-vindas</h3><textarea rows={3} placeholder="Ex: Bem-vindo(a)!" value={form.welcomeMsg} onChange={e => setForm(f => ({ ...f, welcomeMsg: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none" /></div>

        <div aria-live="assertive">{error && <p className="text-red-500 text-sm">{error}</p>}</div>
        <div aria-live="polite">{success && <p className="text-green-600 text-sm font-medium">✓ Configurações salvas com sucesso!</p>}</div>

        <button type="submit" disabled={saving || !!loadError || !loadedOnce} className="bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 disabled:opacity-50 transition">{saving ? 'Salvando...' : 'Salvar configurações'}</button>
      </form>
    </div>
  )
}
