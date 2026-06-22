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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">Escolher seu canal</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        <Alert
          type="info"
          className="mb-4"
          message="O botão “Ver canal” das mensagens espelhadas vai apontar para o canal escolhido aqui. Use um canal seu."
        />

        <div className="flex border-b mb-4">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >{t.label}</button>
          ))}
        </div>

        {tab === 'followed' && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={loadFollowed}
              disabled={loadingFollowed}
              className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm disabled:opacity-50"
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
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {followedList?.map(c => (
                <li key={c.jid}>
                  <button
                    type="button"
                    onClick={() => setPreview(c)}
                    className={`w-full text-left px-3 py-2 rounded border ${preview?.jid === c.jid ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium text-sm">{c.name || 'Canal sem nome'}</div>
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
              className="w-full border rounded px-3 py-2"
            />
            <button type="button" onClick={resolveLink} disabled={busy || !url.trim()}
              className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm disabled:opacity-50">
              {busy ? 'Buscando…' : 'Buscar canal'}
            </button>
          </div>
        )}

        {preview && (
          <div className="mt-4 p-3 border rounded bg-slate-50">
            <div className="font-medium text-sm">{preview.name || 'Canal sem nome'}</div>
            <div className="text-xs text-slate-500 font-mono mt-1">{preview.jid}</div>
            {preview.isViewerOwner
              ? <div className="mt-1 text-sm text-emerald-700">✓ Você é dono deste canal</div>
              : <div className="mt-1 text-sm text-amber-700">⚠ Você não consta como dono.</div>}
          </div>
        )}

        {error && <Alert type="error" message={error} className="mt-4" />}

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancelar</button>
          <button type="button" onClick={confirm} disabled={!preview?.jid}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">
            Usar este canal
          </button>
        </div>
      </div>
    </div>
  )
}
