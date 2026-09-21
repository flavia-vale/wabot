'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const TABS = [
  { id: 'link', label: 'Colar link' },
  { id: 'followed', label: 'Canais que sigo' },
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
  const [preview, setPreview] = useState(null)
  const [nameDraft, setNameDraft] = useState('')
  const [role, setRole] = useState('monitor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lintWarnings, setLintWarnings] = useState([])
  // followedList: null = não carregado ainda (usuária precisa clicar "Carregar"),
  // array = resultado da chamada (possivelmente vazio)
  const [followedList, setFollowedList] = useState(null)
  const [loadingFollowed, setLoadingFollowed] = useState(false)
  const canPublishPreview = preview?.isViewerAdmin ?? preview?.isViewerOwner

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

  async function submit() {
    if (!preview) return
    const finalName = nameDraft.trim()
    if (!finalName) {
      setError('Dê um nome para este canal antes de cadastrar.')
      return
    }
    if (role === 'post' && canPublishPreview !== true) {
      setError('Este número não administra o canal. Torne-o administrador no WhatsApp antes de cadastrá-lo como destino.')
      return
    }
    setBusy(true); setError('')
    try {
      // PR-5.E.2: lint o título antes de salvar. Warnings não bloqueiam —
      // ficam visíveis acima do submit para o cliente revisar depois.
      try {
        const result = await api.lintChannelCopy({ title: finalName })
        setLintWarnings(result?.warnings ?? [])
      } catch {
        setLintWarnings([])
      }
      const group = await api.addGroup(preview.jid, finalName, role, 'channel')
      if (role === 'monitor') {
        api.followChannelNow(group.id).catch(() => {})
      }
      onCreated?.(group)
      onClose?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    /* `ui-dialog-layer`: esta janela nasce de dentro da janela "Adicionar
     * grupo", que no painel vive em z-index 80 — com o `z-50` do Tailwind ela
     * abria ATRÁS, escurecida pelo véu da outra. Ver globals.css. */
    <div className="ui-dialog-layer fixed inset-0 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
      {/* `ui-dialog-sheet`: cabeçalho preso e corpo rolando, como a janela
        * "Adicionar grupo". A altura sai de `dvh` (com `vh` como plano B) —
        * `100vh` não desconta a barra de endereço do celular. O fallback mora
        * no CSS porque duas utilities do Tailwind para a mesma propriedade não
        * garantem ordem de declaração. */}
      <div className="ui-dialog-sheet w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-lg">
        <div className="flex shrink-0 items-start justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-3">
          <h2 className="text-lg font-semibold">Adicionar canal</h2>
          <button onClick={onClose} aria-label="Fechar" className="min-h-11 min-w-11 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0 sm:p-6 sm:pt-0">

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
              <p className="text-sm text-slate-500">Nenhum canal encontrado na sua conta. Tente &ldquo;Colar link&rdquo;.</p>
            )}
            {/* Uma rolagem só no celular: duas rolagens encaixadas fazem a de
              * dentro roubar o gesto da de fora. No computador o teto vale. */}
            <ul className="space-y-1 overflow-y-auto max-h-none sm:max-h-64">
              {followedList?.map(c => (
                <li key={c.jid}>
                  <button
                    type="button"
                    onClick={() => setPreview(c)}
                    className={`w-full text-left px-3 py-2 rounded border ${preview?.jid === c.jid ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="font-medium text-sm">{c.name || 'Canal sem nome'}</div>
                    {(c.isViewerAdmin ?? c.isViewerOwner) && <span className="text-xs text-emerald-700">Você administra</span>}
                  </button>
                </li>
              ))}
            </ul>
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
              {canPublishPreview
                ? <span className="text-emerald-700">✓ Você administra este canal</span>
                : <span className="text-rose-700">⚠ Este número não administra o canal.</span>}
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">O que fazer com este canal?</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-2 py-1">
                <option value="monitor">Monitorar (origem)</option>
                <option value="post">Postar (destino)</option>
              </select>
            </div>

            {role === 'post' && canPublishPreview !== true && (
              <Alert type="error" className="mt-3" message="Não é possível usar este canal como destino. No WhatsApp, adicione o número conectado como administrador do canal e depois tente novamente." />
            )}
          </div>
        )}

        {error && <Alert type="error" message={error} className="mt-4" />}

        <div className="flex gap-2 justify-end mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancelar</button>
          <button type="button" onClick={submit} disabled={busy || !preview || (role === 'post' && canPublishPreview !== true)}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm disabled:opacity-50">
            {busy ? 'Salvando…' : 'Cadastrar canal'}
          </button>
        </div>

        {lintWarnings.length > 0 && (
          <div className="mt-3 p-3 border border-amber-300 bg-amber-50 rounded text-sm">
            <div className="font-medium text-amber-900 mb-1">⚠ Aviso sobre o nome do canal</div>
            <ul className="list-disc pl-5 text-amber-900">
              {lintWarnings.map((w, i) => <li key={i}>{w.message}</li>)}
            </ul>
            <p className="mt-2 text-xs text-amber-700">
              O canal foi cadastrado — esses avisos são sugestões para reduzir risco de denúncia.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
