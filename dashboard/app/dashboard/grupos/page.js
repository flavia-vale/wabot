'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { LoadingState } from '@/components/States'

const HELPER_STEPS = {
  noGroups: { label: 'Criar meu primeiro grupo', progress: 'Passo 1 de 3', message: 'Vamos começar: adicione seu primeiro grupo em menos de 1 minuto.' },
  noMonitor: { label: 'Configurar grupo de origem', progress: 'Passo 2 de 3', message: 'Ótimo! Agora escolha de onde o bot vai ler as mensagens.' },
  noPost: { label: 'Configurar grupo de destino', progress: 'Passo 3 de 3', message: 'Falta pouco: escolha para onde o bot vai publicar os links convertidos.' },
  done: { label: 'Revisar grupos configurados', progress: 'Tudo pronto ✅', message: 'Seus grupos principais já estão configurados. Você pode revisar e ajustar quando quiser.' },
}

const FRIENDLY_ERROR_HINTS = [
  { match: /not connected|desconect|conectar|connection/i, message: 'Seu WhatsApp parece desconectado. Clique em “Carregar do WhatsApp” após reconectar.' },
  { match: /permission|forbidden|admin|not-authorized|unauthorized/i, message: 'Parece faltar permissão nesse grupo. Confirme se sua conta é admin do grupo.' },
  { match: /timeout|network|fetch|temporar|ECONN|socket/i, message: 'A conexão falhou agora. Tente novamente em alguns segundos.' },
]

const IMAGE_MODE_HELP = {
  original: 'Usa a imagem que veio na mensagem monitorada.',
}

const roleLabels = {
  monitor: 'Monitorar (origem)',
  post: 'Postar (destino)',
}

const ALL_PLATFORMS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'magazineluiza', label: 'Magazine Luiza' },
]

const NO_LINK_SCOPE_OPTIONS = [
  { id: 'ALL', label: 'Tudo (texto, mídia, áudio, sticker, documentos)' },
  { id: 'TEXT_ONLY', label: 'Só texto' },
  { id: 'TEXT_IMAGE_WITH_CAPTION', label: 'Texto + imagem com legenda' },
]

export default function GruposPage() {
  const [groups, setGroups] = useState([])
  const [actionError, setActionError] = useState('')
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [waGroups, setWaGroups] = useState(null)
  const [loadingWA, setLoadingWA] = useState(false)
  const [waError, setWaError] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ waJid: '', name: '', role: 'monitor' })
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addingKey, setAddingKey] = useState('')
  const [savingGroupId, setSavingGroupId] = useState(null)
  const [savedGroupId, setSavedGroupId] = useState(null)
  const [groupErrors, setGroupErrors] = useState({})
  const [targetEditorId, setTargetEditorId] = useState(null)
  const [targetPostIds, setTargetPostIds] = useState([])
  const [targetLoading, setTargetLoading] = useState(false)
  const [imageDrafts, setImageDrafts] = useState({})
  const [copiedGroupId, setCopiedGroupId] = useState(null)

  async function load() {
    setLoadingGroups(true)
    setActionError('')
    try { setGroups(await api.groups()) } catch (err) { setActionError(err.message) } finally { setLoadingGroups(false) }
  }

  useEffect(() => {
    let active = true
    setLoadingGroups(true)
    api.groups()
      .then((data) => { if (active) setGroups(data) })
      .catch((err) => { if (active) setActionError(err.message) })
      .finally(() => { if (active) setLoadingGroups(false) })
    return () => { active = false }
  }, [])

  async function handleDelete(id) {
    setActionError('')
    try { await api.deleteGroup(id); await load() } catch (err) { setActionError(err.message) }
  }

  function getFriendlyErrorMessage(rawMessage) {
    const message = String(rawMessage || '')
    const matched = FRIENDLY_ERROR_HINTS.find((item) => item.match.test(message))
    if (matched) return matched.message
    return 'Não consegui concluir essa ação agora. Tente novamente.'
  }

  async function handleUpdateGroup(id, data) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))
    setSavingGroupId(id)
    setSavedGroupId(null)
    setGroupErrors(prev => ({ ...prev, [id]: '' }))
    try {
      await api.updateGroup(id, data)
      setSavedGroupId(id)
      window.setTimeout(() => setSavedGroupId(current => current === id ? null : current), 1500)
      return true
    } catch (err) {
      setGroupErrors(prev => ({ ...prev, [id]: err.message }))
      setActionError(err.message)
      await load()
      return false
    } finally {
      setSavingGroupId(current => current === id ? null : current)
    }
  }

  function getGroupImageSettings() {
    return {
      imageMode: 'original',
      imageLinkTarget: 'first',
      fallbackToOriginal: true,
    }
  }

  function getImageDraft(group) {
    return imageDrafts[group.id] ?? getGroupImageSettings(group)
  }

  function updateImageDraft(group, data) {
    setImageDrafts(prev => ({
      ...prev,
      [group.id]: { ...(prev[group.id] ?? getGroupImageSettings(group)), ...data },
    }))
    setSavedGroupId(current => current === group.id ? null : current)
    setGroupErrors(prev => ({ ...prev, [group.id]: '' }))
  }

  function hasImageDraftChanges(group) {
    const draft = getImageDraft(group)
    return (group.imageMode ?? 'original') !== 'original' || draft.imageMode !== 'original'
  }

  async function saveImageSettings(group) {
    const draft = getImageDraft(group)
    const saved = await handleUpdateGroup(group.id, { ...draft, imageMode: 'original', fallbackToOriginal: true })
    if (!saved) return
    setImageDrafts(prev => {
      const next = { ...prev }
      delete next[group.id]
      return next
    })
  }

  function toggleGroupPlatform(group, platformId) {
    const current = group.allowedPlatforms
      ? group.allowedPlatforms.split(',').filter(Boolean)
      : ALL_PLATFORMS.map(p => p.id)
    const next = current.includes(platformId)
      ? current.filter(p => p !== platformId)
      : [...current, platformId]
    handleUpdateGroup(group.id, { allowedPlatforms: next.join(',') })
  }

  async function openTargetEditor(groupId) {
    setActionError('')
    setTargetLoading(true)
    setTargetEditorId(groupId)
    try {
      const data = await api.groupTargets(groupId)
      setTargetPostIds(data.postIds ?? [])
    } catch (err) {
      setActionError(err.message)
      setTargetEditorId(null)
    } finally {
      setTargetLoading(false)
    }
  }

  function toggleTargetPost(postId) {
    setTargetPostIds(current => current.includes(postId)
      ? current.filter(id => id !== postId)
      : [...current, postId])
  }

  async function saveTargetPosts() {
    if (!targetEditorId) return
    setTargetLoading(true)
    setActionError('')
    try {
      await api.updateGroupTargets(targetEditorId, targetPostIds)
      setTargetEditorId(null)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setTargetLoading(false)
    }
  }

  async function handleLoadWA() {
    setLoadingWA(true)
    setWaError('')
    setWaGroups(null)
    try {
      const list = await api.sessionWAGroups()
      setWaGroups(list.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setWaError(err.message)
    } finally {
      setLoadingWA(false)
    }
  }

  async function handleAddFromWA(g, role) {
    const key = `${g.waJid}::${role}`
    setAddingKey(key)
    setActionError('')
    try {
      await api.addGroup(g.waJid, g.name, role)
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setAddingKey('')
    }
  }

  async function handleCopyGroupJid(group) {
    if (!group?.waJid || !navigator?.clipboard) return
    try {
      await navigator.clipboard.writeText(group.waJid)
      setCopiedGroupId(group.id)
      window.setTimeout(() => setCopiedGroupId((current) => (current === group.id ? null : current)), 1500)
    } catch (_err) {
      setActionError('Não foi possível copiar agora. Tente novamente.')
    }
  }

  async function handleDuplicateGroup(group) {
    setActionError('')
    try {
      await api.addGroup(group.waJid, `${group.name} (cópia)`, group.role)
      await load()
    } catch (err) {
      setActionError(getFriendlyErrorMessage(err.message))
    }
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    setManualError('')
    setActionError('')
    const jid = manualForm.waJid.trim()
    if (!jid.endsWith('@g.us')) {
      setManualError('Informe um JID de grupo válido terminado em @g.us, por exemplo 120363421377996844@g.us.')
      return
    }

    setManualLoading(true)
    try {
      await api.addGroup(jid, manualForm.name.trim(), manualForm.role)
      setManualForm({ waJid: '', name: '', role: 'monitor' })
      await load()
    } catch (err) {
      setManualError(err.message)
    } finally {
      setManualLoading(false)
    }
  }

  const monitor = groups.filter(g => g.role === 'monitor')
  const post = groups.filter(g => g.role === 'post')
  const existingJidRoles = new Set(groups.map(g => `${g.waJid}::${g.role}`))
  const helperState = groups.length === 0
    ? 'noGroups'
    : monitor.length === 0
      ? 'noMonitor'
      : post.length === 0
        ? 'noPost'
        : 'done'
  const helper = HELPER_STEPS[helperState]

  function scrollToSection(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handlePrimaryHelperAction() {
    if (helperState === 'done') {
      scrollToSection('grupos-monitorar')
      return
    }
    scrollToSection('grupos-carregar')
    if (waGroups === null && !loadingWA) {
      handleLoadWA()
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-4 rounded-2xl border border-green-100 bg-green-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">{helper.progress}</p>
        <p className="mt-1 text-sm text-green-900">{helper.message}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrimaryHelperAction}
            className="min-h-11 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            {helper.label}
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('grupos-ajuda')}
            className="min-h-11 rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-800 transition hover:bg-green-100"
          >
            Ver tutorial rápido (30s)
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Grupos</h2>
        <div id="grupos-ajuda">
          <HelpLink topic="como-cadastrar-grupos">Ajuda</HelpLink>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-6">Configure quais grupos monitorar e onde postar</p>

      {actionError && <div className="mb-4"><Alert type="error" title="Não consegui concluir essa ação" message={getFriendlyErrorMessage(actionError)} /></div>}

      {/* Carregar grupos do WhatsApp */}
      <div id="grupos-carregar" className="bg-white rounded-2xl shadow p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700">Carregar grupos existentes</h3>
          <button
            onClick={handleLoadWA}
            disabled={loadingWA}
            className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loadingWA ? 'Carregando...' : 'Carregar do WhatsApp'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">O bot precisa estar conectado para listar os grupos.</p>

        {waError && <div className="mb-3"><Alert type="error" title="Falha ao carregar grupos do WhatsApp" message={`${waError} Confirme se o bot está conectado ao WhatsApp e tente novamente.`} /></div>}

        {waGroups && waGroups.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhum grupo encontrado.</p>
        )}

        {waGroups && waGroups.length > 0 && (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {waGroups.map(g => {
              const monitorAlready = existingJidRoles.has(`${g.waJid}::monitor`)
              const postAlready = existingJidRoles.has(`${g.waJid}::post`)
              const bothAlready = monitorAlready && postAlready
              return (
                <li key={g.waJid} className="flex flex-col gap-2 text-sm border-b pb-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                  <span className={`min-w-0 break-words font-medium ${bothAlready ? 'text-gray-400' : 'text-gray-700'}`}>
                    {g.name}
                    {bothAlready && <span className="ml-2 text-xs text-gray-400">(já cadastrado)</span>}
                  </span>
                  {!bothAlready && (
                    <div className="flex flex-wrap gap-2">
                      {!monitorAlready && (
                        <button
                          onClick={() => handleAddFromWA(g, 'monitor')}
                          disabled={addingKey === `${g.waJid}::monitor`}
                          className="min-h-11 text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded hover:bg-blue-200 disabled:opacity-60 transition"
                        >
                          <span aria-hidden="true">👀</span> {addingKey === `${g.waJid}::monitor` ? 'Adicionando...' : 'Monitorar'}
                        </button>
                      )}
                      {!postAlready && (
                        <button
                          onClick={() => handleAddFromWA(g, 'post')}
                          disabled={addingKey === `${g.waJid}::post`}
                          className="min-h-11 text-xs bg-purple-100 text-purple-700 px-3 py-2 rounded hover:bg-purple-200 disabled:opacity-60 transition"
                        >
                          <span aria-hidden="true">📢</span> {addingKey === `${g.waJid}::post` ? 'Adicionando...' : 'Postar'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Grupos monitorados */}
      <div id="grupos-monitorar" className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1"><span aria-hidden="true">👀</span> Monitorar (origem)</h3>
        <p className="mb-3 text-xs text-gray-500">O bot lê mensagens desses grupos e procura links para converter.</p>
        {loadingGroups ? (
          <LoadingState message="Carregando grupos configurados..." />
        ) : monitor.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
            <p className="text-sm font-semibold text-blue-900">Você ainda não escolheu grupos de origem.</p>
            <p className="mt-1 text-xs text-blue-800">Escolha um grupo para o bot começar a ler mensagens e links.</p>
            <p className="mt-2 text-xs text-blue-700">Passo 2 de 3</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {monitor.map(g => {
              const imageDraft = getImageDraft(g)
              const imageChanged = hasImageDraftChanges(g)
              return (
              <li key={g.id} className="text-sm border border-gray-100 rounded-xl p-3">
                <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 break-words">
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{g.waJid}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {savingGroupId === g.id && <span className="text-[11px] text-blue-600">Salvando...</span>}
                    {savedGroupId === g.id && <span className="text-[11px] text-green-600">Salvo</span>}
                    {copiedGroupId === g.id && <span className="text-[11px] text-green-600">JID copiado ✅</span>}
                    <button onClick={() => openTargetEditor(g.id)} className="text-blue-500 hover:text-blue-700 text-xs">
                      Configurar alvos
                    </button>
                    <button onClick={() => handleCopyGroupJid(g)} className="text-gray-600 hover:text-gray-800 text-xs">
                      Copiar link
                    </button>
                    <button onClick={() => handleDuplicateGroup(g)} className="text-purple-600 hover:text-purple-800 text-xs">
                      Duplicar
                    </button>
                    <button onClick={() => setDeleteTarget(g)} className="text-red-400 hover:text-red-600 text-xs">
                      Remover
                    </button>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Filtros deste grupo (opcional):</p>
                  <input
                    value={g.blockedKeywords ?? ''}
                    onChange={e => handleUpdateGroup(g.id, { blockedKeywords: e.target.value })}
                    placeholder="Palavras bloqueadas só neste grupo"
                    className="mb-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PLATFORMS.map(platform => {
                      const selected = new Set((g.allowedPlatforms || '').split(',').filter(Boolean))
                      const checked = g.allowedPlatforms ? selected.has(platform.id) : true
                      return (
                        <label key={platform.id} className="flex items-center gap-1 text-xs text-gray-500">
                          <input type="checkbox" checked={checked} onChange={() => toggleGroupPlatform(g, platform.id)} />
                          {platform.label}
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">Sem seleção manual, usa as plataformas globais.</p>
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Mensagens sem link:</p>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={(g.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK'}
                      onChange={(e) => {
                        const enabled = e.target.checked
                        handleUpdateGroup(g.id, {
                          forwardMode: enabled ? 'ALLOW_NO_LINK' : 'LINK_ONLY',
                          noLinkScope: enabled ? (g.noLinkScope ?? 'TEXT_ONLY') : null,
                        })
                      }}
                    />
                    Incluir mensagens sem link
                  </label>
                  {(g.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK' && (
                    <select
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                      value={g.noLinkScope ?? 'TEXT_ONLY'}
                      onChange={(e) => handleUpdateGroup(g.id, { forwardMode: 'ALLOW_NO_LINK', noLinkScope: e.target.value })}
                    >
                      {NO_LINK_SCOPE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateGroup(g.id, { forwardMode: 'ALLOW_NO_LINK', noLinkScope: g.noLinkScope ?? 'TEXT_ONLY' })}
                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-700 hover:bg-amber-100"
                    >
                      Retomar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateGroup(g.id, { forwardMode: 'LINK_ONLY', noLinkScope: null })}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      Pausar
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-600">Ativar pode aumentar o volume de mensagens encaminhadas.</p>
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-500">Imagem da mensagem:</p>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">{IMAGE_MODE_HELP.original}</p>
                  {imageDraft.imageMode !== 'original' && (
                    <p className="mt-1 text-[11px] text-amber-600">Este grupo ainda não está usando a imagem original.</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveImageSettings(g)}
                      disabled={!imageChanged || savingGroupId === g.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingGroupId === g.id ? 'Salvando imagem...' : 'Aplicar imagem original'}
                    </button>
                    {imageChanged && <span className="text-[11px] text-amber-600">Alteração de imagem ainda não salva.</span>}
                    {!imageChanged && savedGroupId === g.id && <span className="text-[11px] text-green-600">Configuração de imagem salva.</span>}
                  </div>
                  {groupErrors[g.id] && <p className="mt-2 text-xs text-red-600" role="alert">{groupErrors[g.id]}</p>}
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Grupos de postagem */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1"><span aria-hidden="true">📢</span> Postar (destino)</h3>
        <p className="mb-3 text-xs text-gray-500">O bot publica os links convertidos nesses grupos.</p>
        {loadingGroups ? (
          <LoadingState message="Carregando grupos configurados..." />
        ) : post.length === 0 ? (
          <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/60 p-4">
            <p className="text-sm font-semibold text-purple-900">Falta escolher os grupos de destino.</p>
            <p className="mt-1 text-xs text-purple-800">Escolha para onde o bot vai publicar os links convertidos.</p>
            <p className="mt-2 text-xs text-purple-700">Passo 3 de 3</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {post.map(g => (
              <li key={g.id} className="text-sm border border-gray-100 rounded-xl p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 break-words">
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{g.waJid}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {copiedGroupId === g.id && <span className="text-[11px] text-green-600">JID copiado ✅</span>}
                    <button onClick={() => handleCopyGroupJid(g)} className="text-gray-600 hover:text-gray-800 text-xs">Copiar link</button>
                    <button onClick={() => handleDuplicateGroup(g)} className="text-purple-600 hover:text-purple-800 text-xs">Duplicar</button>
                    <button onClick={() => setDeleteTarget(g)} className="text-red-400 hover:text-red-600 text-xs">Remover</button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={g.welcomeMsg ?? ''}
                  onChange={e => handleUpdateGroup(g.id, { welcomeMsg: e.target.value })}
                  placeholder="Mensagem de boas-vindas específica deste grupo (opcional)"
                  className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <button
          type="button"
          onClick={() => setShowManual(v => !v)}
          className="text-sm text-gray-600 underline underline-offset-4"
        >
          {showManual ? 'Ocultar modo avançado' : 'Mostrar modo avançado (JID manual)'}
        </button>

        {showManual && (
          <>
            <p className="text-xs text-amber-600 mt-3 mb-2">
              Prefira carregar os grupos pelo WhatsApp. Use o JID manual apenas para casos de suporte ou migração quando você já tiver o identificador técnico do grupo.
            </p>
            <form onSubmit={handleManualAdd} className="flex flex-col gap-3">
              <div>
                <label htmlFor="manual-name" className="mb-1 block text-sm font-medium text-gray-700">Nome do grupo</label>
                <input
                id="manual-name"
                placeholder="Ex: Grupo Ofertas"
                value={manualForm.name}
                onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div>
                <label htmlFor="manual-jid" className="mb-1 block text-sm font-medium text-gray-700">JID do grupo</label>
                <input
                id="manual-jid"
                placeholder="Ex: 120363421377996844@g.us"
                value={manualForm.waJid}
                onChange={e => setManualForm(f => ({ ...f, waJid: e.target.value }))}
                required
                aria-describedby="manual-jid-help"
                className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400"
                />
                <p id="manual-jid-help" className="mt-1 text-xs text-gray-500">O JID de grupo normalmente termina em @g.us.</p>
              </div>
              <div>
                <label htmlFor="manual-role" className="mb-1 block text-sm font-medium text-gray-700">Papel do grupo</label>
                <select
                id="manual-role"
                value={manualForm.role}
                onChange={e => setManualForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="monitor">Monitorar (origem)</option>
                  <option value="post">Postar (destino)</option>
                </select>
              </div>

              {manualError && <Alert type="error" title="Não foi possível adicionar manualmente" message={manualError} />}

              <button
                type="submit"
                disabled={manualLoading}
                className="bg-gray-700 text-white rounded-lg py-3 min-h-11 font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {manualLoading ? 'Salvando...' : 'Adicionar manualmente'}
              </button>
            </form>
          </>
        )}
      </div>
      {targetEditorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Configurar alvos</h3>
            <p className="text-sm text-gray-500 mb-4">Escolha quais grupos de destino recebem mensagens deste grupo monitorado. Se nenhum for selecionado, o bot envia para todos.</p>
            {post.length === 0 ? (
              <p className="text-sm text-amber-600 mb-4">Cadastre ao menos um grupo de postagem para configurar alvos.</p>
            ) : (
              <div className="mb-4 flex max-h-64 flex-col gap-2 overflow-y-auto">
                {post.map(group => (
                  <label key={group.id} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2 text-sm text-gray-600">
                    <input type="checkbox" checked={targetPostIds.includes(group.id)} onChange={() => toggleTargetPost(group.id)} />
                    <span>{group.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setTargetEditorId(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={saveTargetPosts} disabled={targetLoading} className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50">{targetLoading ? 'Salvando...' : 'Salvar alvos'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title={deleteTarget ? `Remover “${deleteTarget.name}” de ${roleLabels[deleteTarget.role] ?? 'grupo'}?` : 'Remover grupo'} message="O grupo será removido apenas da configuração do bot. O grupo no WhatsApp não será excluído." confirmLabel="Remover" danger onCancel={() => setDeleteTarget(null)} onConfirm={async () => { const target = deleteTarget; setDeleteTarget(null); if (target?.id) await handleDelete(target.id) }} />
    </div>
  )
}
