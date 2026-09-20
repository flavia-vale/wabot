'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const TABS = [
  { id: 'followed', label: 'Canais que sigo' },
  { id: 'link', label: 'Colar link' },
]

// Seletor de canal (somente leitura — não cadastra grupo). Reaproveita as mesmas
// fontes do AddChannelModal: api.waChannels() (canais que a conta segue) e
// api.resolveChannelInvite() (link de convite). Devolve { jid, name } via
// onSelect. Usado para escolher o canal do botão "Ver canal" das mensagens
// espelhadas, sem precisar colar o JID cru.
export function SelectChannelModal({ open, onClose, onSelect }) {
  if (!open) return null
  return <SelectChannelModalContent onClose={onClose} onSelect={onSelect} />
}

function SelectChannelModalContent({ onClose, onSelect }) {
  const [tab, setTab] = useState('followed')
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [followedList, setFollowedList] = useState(null)
  const [loadingFollowed, setLoadingFollowed] = useState(false)

  async function loadFollowed() {
    setLoadingFollowed(true)
    setError('')
    try {
      const list = await api.waChannels()
      setFollowedList(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err.message)
      setFollowedList([])
    } finally {
      setLoadingFollowed(false)
    }
  }

  async function resolveLink() {
    setBusy(true); setError(''); setPreview(null)
    try {
      const data = await api.resolveChannelInvite(url.trim())
      setPreview(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function confirm() {
    if (!preview?.jid) return
    const name = preview.name || `Canal ${preview.jid.split('@')[0].slice(-6)}`
    onSelect?.({ jid: preview.jid, name })
    onClose?.()
  }

  return (
    <div className="ui-dialog-layer fixed inset-0 flex items-end justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-h-[90vh] sm:rounded-lg sm:p-6">
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold leading-snug">Escolher seu canal</h2>
          <button onClick={onClose} className="min-h-11 min-w-11 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        <Alert
          type="info"
          className="mb-4"
          message="O botão “Ver canal” vai apontar para o canal escolhido aqui (use um canal seu). Atenção: ativar o botão muda o formato das mensagens do grupo — elas deixam de sair como card de preview clicável e passam a sair como foto do produto + legenda + botão. Sem foto do produto encontrada, sai sem o botão."
        />

        <div className="mb-4 flex overflow-x-auto border-b">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-11 shrink-0 px-3 py-2 text-sm border-b-2 -mb-px ${tab === t.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >{t.label}</button>
          ))}
        </div>

        {tab === 'followed' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={loadFollowed}
              disabled={loadingFollowed}
              className="min-h-11 w-full rounded bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-50 sm:w-auto"
            >
              {loadingFollowed
                ? 'Carregando…'
                : followedList === null
                  ? 'Carregar canais do WhatsApp'
                  : 'Atualizar lista'}
            </button>
            {followedList !== null && followedList.length === 0 && !loadingFollowed && (
              <p className="text-sm text-slate-500">Nenhum canal encontrado na sua conta. Tente &ldquo;Colar link&rdquo;.</p>
            )}
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {followedList?.map(c => (
                <li key={c.jid}>
                  <button
                    type="button"
                    onClick={() => setPreview(c)}
                    className={`w-full rounded border px-3 py-3 text-left ${preview?.jid === c.jid ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="break-words text-sm font-medium">{c.name || 'Canal sem nome'}</div>
                    {c.isViewerOwner && <span className="text-xs text-emerald-700">Você é dono</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'link' && (
          <div className="space-y-2">
            <label className="block text-sm">URL do convite do canal</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://whatsapp.com/channel/0029Va..."
              className="min-h-12 w-full rounded border px-3 py-3 text-base sm:text-sm"
            />
            <button type="button" onClick={resolveLink} disabled={busy || !url.trim()}
              className="min-h-11 w-full rounded bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-50 sm:w-auto">
              {busy ? 'Buscando…' : 'Buscar canal'}
            </button>
          </div>
        )}

        {preview && (
          <div className="mt-4 rounded border bg-slate-50 p-3">
            <div className="break-words text-sm font-medium">{preview.name || 'Canal sem nome'}</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-500">{preview.jid}</div>
            {preview.isViewerOwner
              ? <div className="mt-1 text-sm text-emerald-700">✓ Você é dono deste canal</div>
              : <div className="mt-1 text-sm text-amber-700">⚠ Você não consta como dono.</div>}
          </div>
        )}

        {error && <Alert type="error" message={error} className="mt-4" />}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 py-2 text-sm hover:bg-slate-100">Cancelar</button>
          <button type="button" onClick={confirm} disabled={!preview?.jid}
            className="min-h-11 rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            Usar este canal
          </button>
        </div>
      </div>
    </div>
  )
}
