'use client'

/* Grupos — reskin Menta do corpo. Mesma lógica da tela de dashboard original
 * (app/dashboard/grupos/page.js): api.groups / addGroup / updateGroup /
 * deleteGroup / groupTargets / updateGroupTargets / sessionWAGroups +
 * canais (follow/admin/health). Reusa todos os componentes existentes
 * (Alert, ConfirmDialog, HelpLink, AddChannelModal, badges, ChannelHealthPanel).
 * Nenhuma mudança no back end — só o visual de listas/forms. */

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { AddChannelModal } from '@/components/AddChannelModal'
import { TypeBadge, FollowBadge, AdminBadge, HealthBadge } from '@/components/ChannelStatusBadges'
import { ChannelHealthPanel } from '@/components/ChannelHealthPanel'
import { usePainelHeader } from '../PainelShell'

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
  usePainelHeader({ title: 'Grupos', subtitle: 'Defina quais grupos o bot escuta e onde ele publica' })

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
  const autoFixingImageModeRef = useRef(new Set())
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [filter, setFilter] = useState('all')
  const [followStatus, setFollowStatus] = useState({})
  const [adminStatus, setAdminStatus] = useState({})
  const [refreshingAdminId, setRefreshingAdminId] = useState(null)
  const [healthByGroup, setHealthByGroup] = useState({})
  const [expandedHealthId, setExpandedHealthId] = useState(null)
  const [planSubject, setPlanSubject] = useState({ plan: 'trial', accessExpiresAt: null })

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

  useEffect(() => {
    let active = true
    const postChannels = groups.filter((g) => g.kind === 'channel' && g.role === 'post')
    if (postChannels.length === 0) return
    Promise.all(postChannels.map(async (g) => {
      try {
        const h = await api.channelHealth(g.id)
        return [g.id, h]
      } catch { return [g.id, null] }
    })).then((entries) => {
      if (!active) return
      setHealthByGroup((prev) => {
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
      setAdminStatus((prev) => ({ ...prev, [group.id]: data.isViewerOwner ? 'owner' : 'not-owner' }))
    } catch {
      setAdminStatus((prev) => ({ ...prev, [group.id]: 'error' }))
    } finally {
      setRefreshingAdminId(null)
    }
  }

  async function handleChannelCreated(group) {
    setGroups((prev) => [...prev, group])
    if (group.kind === 'channel' && group.role === 'monitor') {
      setFollowStatus((prev) => ({ ...prev, [group.id]: 'pending' }))
      try {
        await api.followChannelNow(group.id)
        setFollowStatus((prev) => ({ ...prev, [group.id]: 'followed' }))
      } catch {
        setFollowStatus((prev) => ({ ...prev, [group.id]: 'error' }))
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
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...data } : g))
    setSavingGroupId(id)
    setSavedGroupId(null)
    setGroupErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      await api.updateGroup(id, data)
      setSavedGroupId(id)
      window.setTimeout(() => setSavedGroupId((current) => current === id ? null : current), 1500)
      return true
    } catch (err) {
      setGroupErrors((prev) => ({ ...prev, [id]: err.message }))
      setActionError(err.message)
      await load()
      return false
    } finally {
      setSavingGroupId((current) => current === id ? null : current)
    }
  }

  async function ensureHiddenImageDefaults(list) {
    const monitorGroups = list.filter((g) => g.role === 'monitor')
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
      : ALL_PLATFORMS.map((p) => p.id)
    const next = current.includes(platformId)
      ? current.filter((p) => p !== platformId)
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
    setTargetPostIds((current) => current.includes(postId)
      ? current.filter((id) => id !== postId)
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

  const monitor = groups.filter((g) => g.role === 'monitor')
  const post = groups.filter((g) => g.role === 'post')
  const existingJidRoles = new Set(groups.map((g) => `${g.waJid}::${g.role}`))

  const canUseChannels = (() => {
    if (planSubject.plan === 'pro') return true
    if (planSubject.plan !== 'trial' || !planSubject.accessExpiresAt) return false
    const expiresAt = new Date(planSubject.accessExpiresAt)
    return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
  })()

  const matchesFilter = (g) => filter === 'all'
    || (filter === 'channel' && g.kind === 'channel')
    || (filter === 'group' && g.kind !== 'channel')

  return (
    <div className="pnl-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="pnl-toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="pnl-chips">
          {['all', 'group', 'channel'].map((f) => (
            <button key={f} type="button" className={`pnl-chip${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todos' : f === 'group' ? 'Grupos' : 'Canais'}
              <span className="pnl-chip-count">
                {f === 'all' ? groups.length : f === 'group' ? groups.filter((g) => g.kind !== 'channel').length : groups.filter((g) => g.kind === 'channel').length}
              </span>
            </button>
          ))}
        </div>
        <div className="pnl-toolbar">
          <HelpLink topic="como-cadastrar-grupos">Ajuda</HelpLink>
          <button
            type="button"
            className={`pnl-btn ${canUseChannels ? 'is-primary' : ''}`}
            onClick={() => canUseChannels ? setShowChannelModal(true) : setActionError('Canais estão disponíveis no Trial ativo e no plano Pro.')}
          >
            + Adicionar canal {!canUseChannels && '(Pro)'}
          </button>
        </div>
      </div>

      {actionError && <div className="pnl-note-box is-error" role="alert"><strong style={{ fontWeight: 600 }}>Falha ao atualizar grupos</strong><p style={{ marginTop: 4 }}>{actionError}</p></div>}
      {!canUseChannels && (
        <div className="pnl-note-box"><strong style={{ fontWeight: 600 }}>Canais bloqueados no Basic</strong><p style={{ marginTop: 4 }}>Canais já cadastrados ficam preservados. Faça upgrade para o Pro para reativar monitoramento e envio em canais.</p></div>
      )}

      {/* Carregar grupos do WhatsApp */}
      <section className="pnl-card">
        <div className="pnl-card-head">
          <div className="pnl-card-title">Carregar grupos existentes</div>
          <button type="button" className="pnl-btn is-primary" onClick={handleLoadWA} disabled={loadingWA}>
            {loadingWA ? 'Carregando…' : 'Carregar do WhatsApp'}
          </button>
        </div>
        <p className="pnl-card-note">O bot precisa estar conectado para listar os grupos.</p>

        {waError && <div className="pnl-note-box is-error" style={{ marginTop: 12 }} role="alert"><strong style={{ fontWeight: 600 }}>Falha ao carregar grupos do WhatsApp</strong><p style={{ marginTop: 4 }}>{waError} Confirme se o bot está conectado ao WhatsApp e tente novamente.</p></div>}

        {waGroups && waGroups.length === 0 && <p className="pnl-empty">Nenhum grupo encontrado.</p>}

        {waGroups && waGroups.length > 0 && (
          <ul className="pnl-grid" style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
            {waGroups.map((g) => {
              const monitorAlready = existingJidRoles.has(`${g.waJid}::monitor`)
              const postAlready = existingJidRoles.has(`${g.waJid}::post`)
              const bothAlready = monitorAlready && postAlready
              return (
                <li key={g.waJid} className="pnl-subcard" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ minWidth: 0, wordBreak: 'break-word', fontWeight: 500, color: bothAlready ? 'var(--ink-faint)' : 'var(--ink)' }}>
                    {g.name}
                    {bothAlready && <span className="pnl-hint" style={{ marginLeft: 8 }}>(já cadastrado)</span>}
                  </span>
                  {!bothAlready && (
                    <div className="pnl-toolbar" style={{ flexWrap: 'wrap' }}>
                      {!monitorAlready && (
                        <button type="button" className="pnl-btn" onClick={() => handleAddFromWA(g, 'monitor')} disabled={addingKey === `${g.waJid}::monitor`}>
                          👀 {addingKey === `${g.waJid}::monitor` ? 'Adicionando…' : 'Monitorar'}
                        </button>
                      )}
                      {!postAlready && (
                        <button type="button" className="pnl-btn" onClick={() => handleAddFromWA(g, 'post')} disabled={addingKey === `${g.waJid}::post`}>
                          📢 {addingKey === `${g.waJid}::post` ? 'Adicionando…' : 'Postar'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Monitorar */}
      <section className="pnl-card">
        <div className="pnl-card-title">👀 Monitorar (origem)</div>
        <p className="pnl-card-note">O bot lê mensagens desses grupos e procura links para converter.</p>
        {loadingGroups ? (
          <p className="pnl-empty">Carregando grupos configurados…</p>
        ) : monitor.length === 0 ? (
          <p className="pnl-empty">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="pnl-grid" style={{ marginTop: 12 }}>
            {monitor.filter(matchesFilter).map((g) => (
              <li key={g.id} className="pnl-subcard">
                <div className="pnl-card-head" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{g.name}</span>
                    <span className="pnl-hint" style={{ marginLeft: 8 }}>{g.waJid}</span>
                    <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <TypeBadge kind={g.kind} />
                      {!canUseChannels && g.kind === 'channel' && <span className="pnl-tag is-flight">Pro</span>}
                      {g.kind === 'channel' && g.role === 'monitor' && <FollowBadge status={followStatus[g.id] ?? 'unknown'} />}
                    </span>
                  </div>
                  <div className="pnl-toolbar">
                    {savingGroupId === g.id && <span className="pnl-hint" style={{ color: 'var(--accent-strong)' }}>Salvando…</span>}
                    {savedGroupId === g.id && <span className="pnl-hint" style={{ color: 'var(--accent-strong)' }}>Salvo</span>}
                    <button type="button" className="pnl-link-btn" onClick={() => openTargetEditor(g.id)}>Configurar alvos</button>
                    <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(g)}>Remover</button>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
                  <p className="pnl-label" style={{ marginBottom: 8 }}>Filtros deste grupo (opcional):</p>
                  <input
                    className="pnl-input"
                    value={g.blockedKeywords ?? ''}
                    onChange={(e) => handleUpdateGroup(g.id, { blockedKeywords: e.target.value })}
                    placeholder="Palavras bloqueadas só neste grupo"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 10 }}>
                    {ALL_PLATFORMS.map((platform) => {
                      const selected = new Set((g.allowedPlatforms || '').split(',').filter(Boolean))
                      const checked = g.allowedPlatforms ? selected.has(platform.id) : true
                      return (
                        <label key={platform.id} className="pnl-check" style={{ fontWeight: 400, fontSize: 12.5 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleGroupPlatform(g, platform.id)} />
                          {platform.label}
                        </label>
                      )
                    })}
                  </div>
                  <p className="pnl-hint" style={{ marginTop: 6 }}>Sem seleção manual, usa as plataformas globais.</p>
                </div>
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
                  <p className="pnl-label" style={{ marginBottom: 8 }}>Mensagens sem link:</p>
                  <label className="pnl-check" style={{ fontWeight: 400, fontSize: 12.5 }}>
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
                      className="pnl-input"
                      style={{ marginTop: 8 }}
                      value={g.noLinkScope ?? 'TEXT_ONLY'}
                      onChange={(e) => handleUpdateGroup(g.id, { forwardMode: 'ALLOW_NO_LINK', noLinkScope: e.target.value })}
                    >
                      {NO_LINK_SCOPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  )}
                  <p className="pnl-hint" style={{ marginTop: 6, color: '#b5742a' }}>Ativar pode aumentar o volume de mensagens encaminhadas. {!canUseChannels && 'No Basic, esse controle faz parte do Módulo de Preservação Avançada (Pro).'}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Postar */}
      <section className="pnl-card">
        <div className="pnl-card-title">📢 Postar (destino)</div>
        <p className="pnl-card-note">O bot publica os links convertidos nesses grupos.</p>
        {loadingGroups ? (
          <p className="pnl-empty">Carregando grupos configurados…</p>
        ) : post.length === 0 ? (
          <p className="pnl-empty">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="pnl-grid" style={{ marginTop: 12 }}>
            {post.filter(matchesFilter).map((g) => (
              <li key={g.id} className="pnl-subcard">
                <div className="pnl-card-head" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{g.name}</span>
                    <span className="pnl-hint" style={{ marginLeft: 8 }}>{g.waJid}</span>
                    <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <TypeBadge kind={g.kind} />
                      {!canUseChannels && g.kind === 'channel' && <span className="pnl-tag is-flight">Pro</span>}
                      {g.kind === 'channel' && g.role === 'post' && (
                        <>
                          <AdminBadge status={adminStatus[g.id] ?? 'unknown'} onRefresh={() => refreshAdmin(g)} refreshing={refreshingAdminId === g.id} />
                          {healthByGroup[g.id] && <HealthBadge status={healthByGroup[g.id].status} />}
                          <button type="button" className="pnl-link-btn" onClick={() => setExpandedHealthId(expandedHealthId === g.id ? null : g.id)} title="Saúde, snapshots e risco do canal">
                            {expandedHealthId === g.id ? 'Fechar painel' : 'Painel anti-ban'}
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                  <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(g)}>Remover</button>
                </div>
                {expandedHealthId === g.id && (
                  <ChannelHealthPanel group={g} initialHealth={healthByGroup[g.id]} onHealthChange={(h) => setHealthByGroup((prev) => ({ ...prev, [g.id]: h }))} />
                )}
                <textarea
                  className="pnl-input"
                  style={{ marginTop: 12, fontFamily: 'inherit', fontSize: 13, minHeight: 60 }}
                  rows={2}
                  value={g.welcomeMsg ?? ''}
                  onChange={(e) => handleUpdateGroup(g.id, { welcomeMsg: e.target.value })}
                  placeholder="Mensagem de boas-vindas específica deste grupo (opcional)"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modo avançado (JID manual) */}
      <section className="pnl-card">
        <button type="button" className="pnl-link-btn" style={{ color: 'var(--ink-soft)', textDecoration: 'underline' }} onClick={() => setShowManual((v) => !v)}>
          {showManual ? 'Ocultar modo avançado' : 'Mostrar modo avançado (JID manual)'}
        </button>

        {showManual && (
          <>
            <p className="pnl-hint" style={{ color: '#b5742a', marginTop: 12, marginBottom: 8 }}>
              Prefira carregar os grupos pelo WhatsApp. Use o JID manual apenas para casos de suporte ou migração quando você já tiver o identificador técnico do grupo.
            </p>
            <form onSubmit={handleManualAdd} className="pnl-grid">
              <div>
                <label htmlFor="manual-name" className="pnl-label">Nome do grupo</label>
                <input id="manual-name" className="pnl-input" placeholder="Ex: Grupo Ofertas" value={manualForm.name} onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label htmlFor="manual-jid" className="pnl-label">JID do grupo</label>
                <input id="manual-jid" className="pnl-input" placeholder="Ex: 120363421377996844@g.us" value={manualForm.waJid} onChange={(e) => setManualForm((f) => ({ ...f, waJid: e.target.value }))} required aria-describedby="manual-jid-help" />
                <p id="manual-jid-help" className="pnl-hint" style={{ marginTop: 4 }}>O JID de grupo normalmente termina em @g.us.</p>
              </div>
              <div>
                <label htmlFor="manual-role" className="pnl-label">Papel do grupo</label>
                <select id="manual-role" className="pnl-input" value={manualForm.role} onChange={(e) => setManualForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="monitor">Monitorar (origem)</option>
                  <option value="post">Postar (destino)</option>
                </select>
              </div>
              {manualError && <div className="pnl-note-box is-error" role="alert"><strong style={{ fontWeight: 600 }}>Não foi possível adicionar manualmente</strong><p style={{ marginTop: 4 }}>{manualError}</p></div>}
              <button type="submit" className="pnl-btn is-primary" disabled={manualLoading}>{manualLoading ? 'Salvando…' : 'Adicionar manualmente'}</button>
            </form>
          </>
        )}
      </section>

      {/* Editor de alvos */}
      {targetEditorId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div className="pnl-card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="pnl-card-title">Configurar alvos</div>
            <p className="pnl-card-note" style={{ marginTop: 4, marginBottom: 12 }}>Escolha quais grupos de destino recebem mensagens deste grupo monitorado. Se nenhum for selecionado, o bot envia para todos.</p>
            {post.length === 0 ? (
              <p className="pnl-hint" style={{ color: '#b5742a', marginBottom: 12 }}>Cadastre ao menos um grupo de postagem para configurar alvos.</p>
            ) : (
              <div className="pnl-grid" style={{ maxHeight: 256, overflowY: 'auto', marginBottom: 12 }}>
                {post.map((group) => (
                  <label key={group.id} className="pnl-check" style={{ fontWeight: 400, fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--pnl-radius-sm)', padding: 8 }}>
                    <input type="checkbox" checked={targetPostIds.includes(group.id)} onChange={() => toggleTargetPost(group.id)} />
                    <span>{group.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="pnl-toolbar" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="pnl-btn" onClick={() => setTargetEditorId(null)}>Cancelar</button>
              <button type="button" className="pnl-btn is-primary" onClick={saveTargetPosts} disabled={targetLoading}>{targetLoading ? 'Salvando…' : 'Salvar alvos'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Remover "${deleteTarget.name}" de ${roleLabels[deleteTarget.role] ?? 'grupo'}?` : 'Remover grupo'}
        message="O grupo será removido apenas da configuração do bot. O grupo no WhatsApp não será excluído."
        confirmLabel="Remover"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => { const target = deleteTarget; setDeleteTarget(null); if (target?.id) await handleDelete(target.id) }}
      />

      <AddChannelModal open={showChannelModal} onClose={() => setShowChannelModal(false)} onCreated={handleChannelCreated} />
    </div>
  )
}
