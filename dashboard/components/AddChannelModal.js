'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const TABS = [
  { id: 'link', label: 'Colar link' },
  { id: 'followed', label: 'Canais que sigo' },
  { id: 'jid', label: 'JID manual' },
]

// Wrapper que remonta o conteúdo via `key` quando abre — substitui o effect
// que resetava state ao fechar. Padrão idiomático React 19 (evita setState
// síncrono em useEffect, regra react-hooks/set-state-in-effect).
export function AddChannelModal({ open, onClose, onCreated }) {
  if (!open) return null
  return <AddChannelModalContent onClose={onClose} onCreated={onCreated} />
}

function AddChannelModalContent({ onClose, onCreated }) {
  const [tab, setTab] = useState('link')
  const [url, setUrl] = useState('')
  const [jid, setJid] = useState('')
  const [preview, setPreview] = useState(null)
  const [nameDraft, setNameDraft] = useState('')
  const [role, setRole] = useState('monitor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // followedList: null = não carregado ainda (usuária precisa clicar "Carregar"),
  // array = resultado da chamada (possivelmente vazio)
  const [followedList, setFollowedList] = useState(null)
  const [loadingFollowed, setLoadingFollowed] = useState(false)
  const [confirmNonAdmin, setConfirmNonAdmin] = useState(false)

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

  function applyPreview(data) {
    setPreview(data)
    setNameDraft(data?.name || (data?.jid ? `Canal ${data.jid.split('@')[0].slice(-6)}` : ''))
  }

  async function resolveLink() {
    setBusy(true); setError(''); applyPreview(null)
    try {
      const data = await api.resolveChannelInvite(url.trim())
      applyPreview(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function resolveJid() {
    if (!jid.trim().endsWith('@newsletter')) { setError('JID deve terminar com @newsletter'); return }
    setBusy(true); setError(''); applyPreview(null)
    try {
      const data = await api.resolveChannelJid(jid.trim())
      applyPreview(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function submit() {
    if (!preview) return
    const finalName = nameDraft.trim()
    if (!finalName) {
      setError('Dê um nome para este canal antes de cadastrar.')
      return
    }
    if (role === 'post' && preview.isViewerOwner === false && !confirmNonAdmin) {
      setError('Confirme que você é admin desse canal antes de cadastrar como destino.')
      return
    }
    setBusy(true); setError('')
    try {
      const group = await api.addGroup(preview.jid, finalName, role, 'channel')
      if (role === 'monitor') {
        api.followChannelNow(group.id).catch(() => {})
      }
      onCreated?.(group)
      onClose?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">Adicionar canal</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        <Alert
          type="info"
          className="mb-4"
          message="Canais funcionam diferente de grupos: para monitorar você precisa seguir o canal; para postar você precisa ser admin. Só cadastre canais onde você é admin como destino — tentar postar em canais alheios pode causar restrição na sua conta."
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

        {tab === 'link' && (
          <div className="space-y-2">
            <label className="block text-sm">URL do convite</label>
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
              <p className="text-sm text-slate-500">Nenhum canal encontrado na sua conta. Tente &ldquo;Colar link&rdquo; ou &ldquo;JID manual&rdquo;.</p>
            )}
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {followedList?.map(c => (
                <li key={c.jid}>
                  <button
                    type="button"
                    onClick={() => setPreview(c)}
                    className={`w-full text-left px-3 py-2 rounded border ${preview?.jid === c.jid ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.jid}</div>
                    {c.isViewerOwner && <span className="text-xs text-emerald-700">Você é dono</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'jid' && (
          <div className="space-y-2">
            <label className="block text-sm">JID do canal</label>
            <input
              type="text"
              value={jid}
              onChange={(e) => setJid(e.target.value)}
              placeholder="xxxxxxxxxxxx@newsletter"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
            />
            <button type="button" onClick={resolveJid} disabled={busy || !jid.trim()}
              className="px-3 py-1.5 bg-sky-600 text-white rounded text-sm disabled:opacity-50">
              {busy ? 'Buscando…' : 'Buscar canal'}
            </button>
          </div>
        )}

        {preview && (
          <div className="mt-4 p-3 border rounded bg-slate-50">
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome do canal</label>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Dê um nome para identificar este canal"
              className="w-full border rounded px-2 py-1 text-sm font-medium"
            />
            {!preview.name && (
              <p className="mt-1 text-xs text-amber-700">O WhatsApp não devolveu nome para esse canal — defina um para identificar na sua lista.</p>
            )}
            <div className="text-xs text-slate-500 font-mono mt-2">{preview.jid}</div>
            <div className="mt-2 text-sm">
              {preview.isViewerOwner
                ? <span className="text-emerald-700">✓ Você é dono deste canal</span>
                : <span className="text-amber-700">⚠ Você não consta como dono. Só prossiga se for admin.</span>}
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">O que fazer com este canal?</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-2 py-1">
                <option value="monitor">Monitorar (origem)</option>
                <option value="post">Postar (destino)</option>
              </select>
            </div>

            {role === 'post' && preview.isViewerOwner === false && (
              <label className="mt-3 flex gap-2 items-start text-sm text-amber-800">
                <input type="checkbox" checked={confirmNonAdmin} onChange={(e) => setConfirmNonAdmin(e.target.checked)} />
                <span>Confirmo que sou admin deste canal e quero prosseguir.</span>
              </label>
            )}
          </div>
        )}

        {error && <Alert type="error" message={error} className="mt-4" />}

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancelar</button>
          <button type="button" onClick={submit} disabled={busy || !preview}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">
            {busy ? 'Salvando…' : 'Cadastrar canal'}
          </button>
        </div>
      </div>
    </div>
  )
}
