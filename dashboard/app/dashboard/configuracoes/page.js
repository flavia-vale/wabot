'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ErrorState, LoadingState } from '@/components/States'

const URL_PROTOCOL_RE = /^https?:\/\//i

const URL_PROTOCOL_RE = /^https?:\/\//i

const DELAY_PRESETS = [
  { id: 'fast', label: 'Rápido', min: 2, max: 5, description: 'Para baixo volume e operação acompanhada.' },
  { id: 'default', label: 'Padrão', min: 5, max: 15, description: 'Recomendado para operações leves do dia a dia.' },
  { id: 'safe', label: 'Conservador', min: 15, max: 30, description: 'Use em grupos com alto volume ou maior cautela.' },
]

export default function ConfigPage() {
  const [form, setForm] = useState({
    delayMin: 5,
    delayMax: 15,
    platforms: 'shopee,amazon,mercadolivre,magazineluiza',
    blockedKeywords: '',
    welcomeMsg: '',
    feedGlobal: false,
    postToStatus: false,
    brandingGroupLink: '',
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [delayError, setDelayError] = useState('')
  const [platformError, setPlatformError] = useState('')
  const [brandingError, setBrandingError] = useState('')

  function applyConfig(cfg) {
    setForm({
      delayMin: cfg.delayMin ?? 5,
      delayMax: cfg.delayMax ?? 15,
      platforms: cfg.platforms ?? 'shopee,amazon,mercadolivre,magazineluiza',
      blockedKeywords: normalizeKeywords(cfg.blockedKeywords ?? '').join(','),
      welcomeMsg: cfg.welcomeMsg ?? '',
      feedGlobal: cfg.feedGlobal ?? false,
      postToStatus: cfg.postToStatus ?? false,
      brandingGroupLink: cfg.brandingGroupLink ?? '',
    })
    setLoadedOnce(true)
  }

  async function loadConfig() {
    setLoading(true)
    setLoadError('')
    try {
      const cfg = await api.getConfig()
      applyConfig(cfg)
    } catch (err) {
      setLoadError(err.message || 'Não foi possível carregar as configurações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.getConfig()
      .then((cfg) => { if (active) applyConfig(cfg) })
      .catch((err) => { if (active) setLoadError(err.message || 'Não foi possível carregar as configurações.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function applyDelayPreset(preset) {
    setDelayError('')
    setError('')
    setForm(f => ({ ...f, delayMin: preset.min, delayMax: preset.max }))
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
    setDelayError('')
    setPlatformError('')
    setBrandingError('')
    setSuccess(false)

    const parsedMin = parseDelay(form.delayMin, 'Delay mínimo')
    if (parsedMin.error) {
      setDelayError(parsedMin.error)
      setError(parsedMin.error)
      return
    }

    const parsedMax = parseDelay(form.delayMax, 'Delay máximo')
    if (parsedMax.error) {
      setDelayError(parsedMax.error)
      setError(parsedMax.error)
      return
    }

    if (parsedMin.value > parsedMax.value) {
      const message = 'Delay mínimo não pode ser maior que o máximo'
      setDelayError(message)
      setError(message)
      return
    }

    const brandingGroupLink = form.brandingGroupLink.trim()
    if (brandingGroupLink && !URL_PROTOCOL_RE.test(brandingGroupLink)) {
      const message = 'Informe um link válido começando com http:// ou https://'
      setBrandingError(message)
      setError(message)
      return
    }

    setSaving(true)
    try {
      await api.saveConfig({
        delayMin: parsedMin.value,
        delayMax: parsedMax.value,
        platforms: form.platforms,
        blockedKeywords: normalizeKeywords(form.blockedKeywords).join(','),
        welcomeMsg: form.welcomeMsg,
        feedGlobal: form.feedGlobal,
        postToStatus: form.postToStatus,
        brandingGroupLink,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState message="Carregando configurações do bot..." />

  const enabledPlatforms = new Set(form.platforms.split(',').filter(Boolean))
  const welcomePreview = form.welcomeMsg.trim() || 'Exemplo: Bem-vindo(a)! As ofertas convertidas aparecerão por aqui.'
  const brandingPreview = form.brandingGroupLink.trim()
    ? `Oferta convertida com seu link de afiliado\n\nParticipe do grupo: ${form.brandingGroupLink.trim()}`
    : 'Oferta convertida com seu link de afiliado'

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Configurações do Bot</h2>
      <p className="text-gray-500 text-sm mb-6">Ajuste o delay e o branding das mensagens do bot</p>

      {loadError && <div className="mb-4"><ErrorState title="Falha ao carregar configurações" message={loadError} actionLabel="Tentar novamente" onAction={loadConfig} /></div>}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl shadow p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 mb-1">⏱️ Delay entre envios</h3>
            <p className="text-xs text-gray-500">O bot escolhe um tempo diferente dentro do intervalo abaixo antes de enviar cada mensagem. Isso evita uma cadência robótica, como “sempre a cada 30 segundos”.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 mb-4">
            {DELAY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDelayPreset(preset)}
                disabled={saving}
                className="rounded-xl border border-gray-200 p-3 text-left hover:border-green-400 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
              >
                <span className="block text-sm font-semibold text-gray-700">{preset.label}</span>
                <span className="block text-xs text-gray-500">{preset.min}-{preset.max}s</span>
                <span className="block text-[11px] text-gray-400">{preset.description}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Mínimo (segundos)</label>
              <input type="number" min="0" max="300" step="1" required value={form.delayMin} onChange={e => { setDelayError(''); setForm(f => ({ ...f, delayMin: e.target.value })) }} className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Máximo (segundos)</label>
              <input type="number" min="0" max="300" step="1" required value={form.delayMax} onChange={e => { setDelayError(''); setForm(f => ({ ...f, delayMax: e.target.value })) }} className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>
          {delayError && <p className="mt-2 text-xs font-medium text-red-600" role="alert">{delayError}</p>}

          <div className="mt-4 rounded-2xl border border-green-100 bg-green-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">O que acontece na prática</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-700">1. Tempo aleatório</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Se você escolher 5 a 15s, cada envio sai em um ponto diferente desse intervalo.</p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-700">2. Fila organizada</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Quando chegam muitas ofertas, elas aguardam em ordem. O painel continua funcionando enquanto o bot espera.</p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-gray-700">3. “Digitando...”</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Antes de enviar, o bot simula alguns segundos de digitação para parecer mais natural.</p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <p className="font-semibold">Se a fila ficar cheia</p>
            <p className="mt-1 leading-relaxed">As mensagens que já entraram continuam aguardando. Novas mensagens podem ser recusadas e aparecem nos logs como erro de fila cheia; isso protege o servidor contra travamentos por acúmulo infinito.</p>
          </div>

          <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">
            <p className="font-semibold">Como zerar a fila</p>
            <p className="mt-1 leading-relaxed">Vá em <Link href="/dashboard" className="font-semibold underline underline-offset-2">WhatsApp</Link> e clique em <strong>Desligar bot</strong>. Isso encerra a fila atual em memória; envios que ainda estavam “Na fila” ou “Enviando” são marcados como interrompidos nos logs. Depois, ligue o bot novamente quando quiser retomar.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">🏷️ Branding das mensagens</h3>
          <p className="text-xs text-gray-500 mb-3">Deseja anexar o link do seu grupo no final das mensagens? Preencha o campo abaixo para adicionar automaticamente o rodapé personalizado.</p>
          <label className="text-xs text-gray-500 mb-1 block" htmlFor="brandingGroupLink">Link do seu grupo (opcional)</label>
          <input
            id="brandingGroupLink"
            type="url"
            placeholder="https://chat.whatsapp.com/seu-grupo"
            value={form.brandingGroupLink}
            onChange={e => { setBrandingError(''); setForm(f => ({ ...f, brandingGroupLink: e.target.value })) }}
            className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
          <p className="mt-2 text-xs text-gray-500">Se ficar vazio, o bot mantém apenas o conteúdo original sanitizado e o link de afiliado convertido.</p>
          {brandingError && <p className="mt-2 text-xs font-medium text-red-600" role="alert">{brandingError}</p>}
          <div className="mt-3 rounded-2xl bg-green-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Prévia do rodapé</p>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white px-3 py-2.5 min-h-11 text-sm text-gray-700 shadow-sm">{brandingPreview}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="font-semibold text-gray-700 mb-1">👋 Mensagem de boas-vindas</h3>
          <p className="text-xs text-gray-500 mb-3">Enviada para grupos de destino configurados quando o bot identifica entrada/boas-vindas no WhatsApp. Variáveis dinâmicas não são suportadas no momento.</p>
          <textarea rows={3} placeholder="Ex: Bem-vindo(a)!" value={form.welcomeMsg} onChange={e => setForm(f => ({ ...f, welcomeMsg: e.target.value }))} className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          <div className="mt-3 rounded-2xl bg-green-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Prévia do rodapé</p>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white px-3 py-2.5 min-h-11 text-sm text-gray-700 shadow-sm">{brandingPreview}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {error && <Alert type="error" title="Não foi possível salvar" message={error} />}
          {success && <Alert type="success" title="Configurações salvas" message="Suas alterações foram aplicadas com sucesso." />}
        </div>

        <button type="submit" disabled={saving || !!loadError || !loadedOnce} className="bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">{saving ? 'Salvando...' : 'Salvar configurações'}</button>
      </form>
    </div>
  )
}
