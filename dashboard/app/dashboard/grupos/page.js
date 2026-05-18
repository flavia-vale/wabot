'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { LoadingState } from '@/components/States'
import { AddChannelModal } from '@/components/AddChannelModal'
import { TypeBadge, FollowBadge, AdminBadge, HealthBadge } from '@/components/ChannelStatusBadges'
import { ChannelHealthPanel } from '@/components/ChannelHealthPanel'

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
  // Set de IDs de grupo já em processo de auto-fix (ensureHiddenImageDefaults)
  // pra evitar disparar UPDATE em paralelo no mesmo grupo. Ref pq não precisa
  // re-renderizar quando muda.
  const autoFixingImageModeRef = useRef(new Set())
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [filter, setFilter] = useState('all')
  const [followStatus, setFollowStatus] = useState({})
  const [adminStatus, setAdminStatus] = useState({})
  const [refreshingAdminId, setRefreshingAdminId] = useState(null)
  const [healthByGroup, setHealthByGroup] = useState({})
  const [expandedHealthId, setExpandedHealthId] = useState(null)

  async function load() {
    setLoadingGroups(true)
    setActionError('')
    try {
      const list = await api.groups()
      setGroups(list)
      await ensureHiddenImageDefaults(list)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setLoadingGroups(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoadingGroups(true)
    Promise.all([api.groups(), api.me()])
      .then(async ([data, me]) => {
        setPlanSubject({ plan: me?.plan ?? 'trial', accessExpiresAt: me?.accessExpiresAt ?? null })
        if (!active) return
        setGroups(data)
        await ensureHiddenImageDefaults(data)
      })
      .catch((err) => { if (active) setActionError(err.message) })
      .finally(() => { if (active) setLoadingGroups(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // PR-5.C.1 follow-up: busca saúde dos canais-destino para os badges.
  useEffect(() => {
    let active = true
    const postChannels = groups.filter(g => g.kind === 'channel' && g.role === 'post')
    if (postChannels.length === 0) return
    Promise.all(postChannels.map(async (g) => {
      try {
        const h = await api.channelHealth(g.id)
        return [g.id, h]
      } catch { return [g.id, null] }
    })).then((entries) => {
      if (!active) return
      setHealthByGroup(prev => {
        const next = { ...prev }
        for (const [id, h] of entries) if (h) next[id] = h
        return next
      })
    })
    return () => { active = false }
  }, [groups])

  async function refreshAdmin(group) {
    setRefreshingAdminId(group.id)
    try {
      const data = await api.refreshChannelAdmin(group.id)
      setAdminStatus(prev => ({ ...prev, [group.id]: data.isViewerOwner ? 'owner' : 'not-owner' }))
    } catch {
      setAdminStatus(prev => ({ ...prev, [group.id]: 'error' }))
    } finally {
      setRefreshingAdminId(null)
    }
  }

  async function handleChannelCreated(group) {
    setGroups(prev => [...prev, group])
    if (group.kind === 'channel' && group.role === 'monitor') {
      setFollowStatus(prev => ({ ...prev, [group.id]: 'pending' }))
      try {
        await api.followChannelNow(group.id)
        setFollowStatus(prev => ({ ...prev, [group.id]: 'followed' }))
      } catch {
        setFollowStatus(prev => ({ ...prev, [group.id]: 'error' }))
      }
    }
    if (group.kind === 'channel' && group.role === 'post') {
      refreshAdmin(group)
    }
  }

  async function handleDelete(id) {
    setActionError('')
    try { await api.deleteGroup(id); await load() } catch (err) { setActionError(err.message) }
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

  async function ensureHiddenImageDefaults(list) {
    const monitorGroups = list.filter(g => g.role === 'monitor')
    for (const group of monitorGroups) {
      const needsFix = (group.imageMode ?? 'original') !== 'original' || group.fallbackToOriginal === false
      if (!needsFix || autoFixingImageModeRef.current.has(group.id)) continue
      autoFixingImageModeRef.current.add(group.id)
      await handleUpdateGroup(group.id, {
        imageMode: 'original',
        imageLinkTarget: group.imageLinkTarget ?? 'first',
        fallbackToOriginal: true,
      })
      autoFixingImageModeRef.current.delete(group.id)
    }
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

  const canUseChannels = (() => {
    if (planSubject.plan === 'pro') return true
    if (planSubject.plan !== 'trial' || !planSubject.accessExpiresAt) return false
    const expiresAt = new Date(planSubject.accessExpiresAt)
    return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
  })()

  return (
    <div className="max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Grupos e Canais</h2>
        <HelpLink topic="como-cadastrar-grupos">Ajuda</HelpLink>
      </div>
      <p className="text-gray-500 text-sm mb-6">Configure quais grupos monitorar e onde postar</p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {['all', 'group', 'channel'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm ${filter === f ? 'bg-sky-600 text-white' : 'bg-slate-100'}`}>
            {f === 'all' ? `Todos (${groups.length})` :
              f === 'group' ? `Grupos (${groups.filter(g => g.kind !== 'channel').length})` :
              `Canais (${groups.filter(g => g.kind === 'channel').length})`}
          </button>
        ))}
        <button
          onClick={() => canUseChannels ? setShowChannelModal(true) : setActionError('Canais estão disponíveis no Trial ativo e no plano Pro.')}
          className={`ml-auto px-3 py-1.5 rounded text-sm ${canUseChannels ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}
        >
          + Adicionar canal {!canUseChannels && '(Pro)'}
        </button>
      </div>

      {actionError && <div className="mb-4"><Alert type="error" title="Falha ao atualizar grupos" message={actionError} /></div>}
      {!canUseChannels && (
        <div className="mb-4"><Alert type="info" title="Canais bloqueados no Basic" message="Canais já cadastrados ficam preservados. Faça upgrade para o Pro para reativar monitoramento e envio em canais." /></div>
      )}

      {/* Carregar grupos do WhatsApp */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
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
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1"><span aria-hidden="true">👀</span> Monitorar (origem)</h3>
        <p className="mb-3 text-xs text-gray-500">O bot lê mensagens desses grupos e procura links para converter.</p>
        {loadingGroups ? (
          <LoadingState message="Carregando grupos configurados..." />
        ) : monitor.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {monitor.filter(g =>
              filter === 'all' ||
              (filter === 'channel' && g.kind === 'channel') ||
              (filter === 'group' && g.kind !== 'channel')
            ).map(g => {
              return (
              <li key={g.id} className="text-sm border border-gray-100 rounded-xl p-3">
                <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 break-words">
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{g.waJid}</span>
                    <span className="ml-2 inline-flex items-center gap-1">
                      <TypeBadge kind={g.kind} />
                      {!canUseChannels && g.kind === 'channel' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pro</span>}
                      {g.kind === 'channel' && g.role === 'monitor' && (
                        <FollowBadge status={followStatus[g.id] ?? 'unknown'} />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingGroupId === g.id && <span className="text-[11px] text-blue-600">Salvando...</span>}
                    {savedGroupId === g.id && <span className="text-[11px] text-green-600">Salvo</span>}
                    <button onClick={() => openTargetEditor(g.id)} className="text-blue-500 hover:text-blue-700 text-xs">
                      Configurar alvos
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
                      disabled={!canUseChannels}
                      checked={(g.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK'}
                      onChange={(e) => {
                        const enabled = e.target.checked
                        if (enabled && !canUseChannels) {
                          setActionError('O Módulo de Preservação Avançada está disponível no Trial ativo e no plano Pro.')
                          return
                        }
                        handleUpdateGroup(g.id, {
                          forwardMode: enabled ? 'ALLOW_NO_LINK' : 'LINK_ONLY',
                          noLinkScope: enabled ? (g.noLinkScope ?? 'TEXT_ONLY') : null,
                        })
                      }}
                    />
                    Incluir mensagens sem link {!canUseChannels && '(Pro)'}
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
                  <p className="mt-1 text-[11px] text-amber-600">Ativar pode aumentar o volume de mensagens encaminhadas. {!canUseChannels && 'No Basic, esse controle faz parte do Módulo de Preservação Avançada (Pro).'}</p>
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
          <p className="text-gray-400 text-sm">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {post.filter(g =>
              filter === 'all' ||
              (filter === 'channel' && g.kind === 'channel') ||
              (filter === 'group' && g.kind !== 'channel')
            ).map(g => (
              <li key={g.id} className="text-sm border border-gray-100 rounded-xl p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 break-words">
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{g.waJid}</span>
                    <span className="ml-2 inline-flex items-center gap-1">
                      <TypeBadge kind={g.kind} />
                      {!canUseChannels && g.kind === 'channel' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pro</span>}
                      {g.kind === 'channel' && g.role === 'post' && (
                        <>
                          <AdminBadge
                            status={adminStatus[g.id] ?? 'unknown'}
                            onRefresh={() => refreshAdmin(g)}
                            refreshing={refreshingAdminId === g.id}
                          />
                          {healthByGroup[g.id] && <HealthBadge status={healthByGroup[g.id].status} />}
                          <button
                            type="button"
                            onClick={() => setExpandedHealthId(expandedHealthId === g.id ? null : g.id)}
                            className="text-xs text-sky-600 hover:underline"
                            title="Saúde, snapshots e risco do canal"
                          >
                            {expandedHealthId === g.id ? 'Fechar painel' : 'Painel anti-ban'}
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  <button onClick={() => setDeleteTarget(g)} className="text-red-400 hover:text-red-600 text-xs">
                    Remover
                  </button>
                </div>
                {expandedHealthId === g.id && (
                  <ChannelHealthPanel
                    group={g}
                    initialHealth={healthByGroup[g.id]}
                    onHealthChange={(h) => setHealthByGroup(prev => ({ ...prev, [g.id]: h }))}
                  />
                )}
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

      <ConfirmDialog open={!!deleteTarget} title={deleteTarget ? `Remover "${deleteTarget.name}" de ${roleLabels[deleteTarget.role] ?? 'grupo'}?` : 'Remover grupo'} message="O grupo será removido apenas da configuração do bot. O grupo no WhatsApp não será excluído." confirmLabel="Remover" danger onCancel={() => setDeleteTarget(null)} onConfirm={async () => { const target = deleteTarget; setDeleteTarget(null); if (target?.id) await handleDelete(target.id) }} />

      <AddChannelModal
        open={showChannelModal}
        onClose={() => setShowChannelModal(false)}
        onCreated={handleChannelCreated}
      />
    </div>
  )
}
