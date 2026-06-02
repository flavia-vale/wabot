'use client'

import { useEffect, useMemo, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileModal } from '@/components/mobile/MobileModal'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'
import { canAccessAdvancedPreservation } from '@/lib/plan'
import { getHealthChipStyle } from '@/lib/mobileChannelHealth'
import {
  MOBILE_GROUP_PLATFORMS,
  buildExistingJidRoleSet,
  getMobileGroupPickerItem,
  getRoleForMobileGroupTab,
  isMobilePlatformSelected,
  prepareMobileGroupAddPayload,
  sortWhatsAppGroupsForMobilePicker,
  toggleMobilePlatform,
  toggleMobileTargetPostId,
} from '@/lib/mobileGroupPicker'

const NO_LINK_SCOPE_OPTIONS = [
  { id: 'TEXT_ONLY', label: 'Só texto' },
  { id: 'TEXT_IMAGE_WITH_CAPTION', label: 'Texto e imagem com legenda' },
  { id: 'ALL', label: 'Tudo (inclusive sem link)' },
]

const avatarColor = (name = '') => {
  const hues = [210, 145, 280, 50, 180, 0]
  const hash = name.split('').reduce((h, c) => h + c.charCodeAt(0), 0)
  const hue = hues[hash % hues.length]
  return `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue + 20}, 70%, 60%))`
}

function initials(name = '') {
  return name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase().slice(0, 2) || 'WA'
}

export default function GroupsPage() {
  useMobileRoutePerf('m/config/groups')

  const [tab, setTab] = useState('origem')
  const [me, setMe] = useState(null)
  const [groups, setGroups] = useState([])
  const [waGroups, setWaGroups] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [manualForm, setManualForm] = useState({ waJid: '', name: '', kind: 'group' })
  const [addMode, setAddMode] = useState('groups')
  const [channelUrl, setChannelUrl] = useState('')
  const [channelJid, setChannelJid] = useState('')
  const [channelPreview, setChannelPreview] = useState(null)
  const [channelName, setChannelName] = useState('')
  const [channelConfirmNonAdmin, setChannelConfirmNonAdmin] = useState(false)
  const [followedChannels, setFollowedChannels] = useState(null)
  const [lintWarnings, setLintWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [expandedConfigId, setExpandedConfigId] = useState(null)
  const [savingGroupId, setSavingGroupId] = useState(null)
  const [savedGroupId, setSavedGroupId] = useState(null)
  const [targetEditorId, setTargetEditorId] = useState(null)
  const [targetPostIds, setTargetPostIds] = useState([])
  const [targetLoading, setTargetLoading] = useState(false)
  const [followStatus, setFollowStatus] = useState({})
  const [adminStatus, setAdminStatus] = useState({})
  const [healthMap, setHealthMap] = useState({})
  const [snapshotMap, setSnapshotMap] = useState({})
  const [channelAction, setChannelAction] = useState('')
  const [channelErrors, setChannelErrors] = useState({})
  const [recreateDrafts, setRecreateDrafts] = useState({})

  async function loadGroups() {
    setLoading(true)
    setError('')
    try {
      const list = await api.groups()
      setGroups(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os grupos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [list, meData] = await Promise.all([api.groups(), api.me().catch(() => null)])
        if (active) {
          setGroups(Array.isArray(list) ? list : [])
          setMe(meData)
        }
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar os grupos.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const channelDestGroups = groups.filter((group) => group.role === 'post' && group.kind === 'channel')
    const unfetched = channelDestGroups.filter((group) => !(group.id in healthMap))
    if (unfetched.length === 0) return undefined
    let cancelled = false
    Promise.allSettled(unfetched.map((group) => api.channelHealth(group.id).then((result) => ({ id: group.id, result }))))
      .then((outcomes) => {
        if (cancelled) return
        const updates = {}
        for (const outcome of outcomes) {
          if (outcome.status === 'fulfilled') {
            updates[outcome.value.id] = outcome.value.result
          }
        }
        if (Object.keys(updates).length > 0) {
          setHealthMap((current) => ({ ...current, ...updates }))
        }
      })
    return () => { cancelled = true }
  }, [groups, healthMap])

  const role = getRoleForMobileGroupTab(tab)
  const currentGroups = useMemo(() => groups.filter((group) => group.role === role), [groups, role])
  const existingJidRoles = useMemo(() => buildExistingJidRoleSet(groups), [groups])

  async function loadWhatsAppGroups() {
    setActionLoading('wa-groups')
    setFeedback('')
    try {
      const list = await api.sessionWAGroups()
      setWaGroups(Array.isArray(list) ? sortWhatsAppGroupsForMobilePicker(list) : [])
      setShowAdd(true)
      setAddMode('groups')
    } catch (err) {
      setFeedback(err.message || 'Não foi possível listar grupos do WhatsApp. Use o cadastro manual.')
      setShowAdd(true)
      setAddMode('groups')
    } finally {
      setActionLoading('')
    }
  }

  function applyChannelPreview(data) {
    const normalized = data || null
    setChannelPreview(normalized)
    setChannelName(normalized?.name || (normalized?.jid ? `Canal ${String(normalized.jid).split('@')[0].slice(-6)}` : ''))
    setLintWarnings([])
    setChannelConfirmNonAdmin(false)
  }

  async function resolveChannelByInvite() {
    const url = channelUrl.trim()
    if (!url) {
      setFeedback('Cole o link do convite do canal.')
      return
    }
    setActionLoading('resolve-channel-link')
    setFeedback('')
    applyChannelPreview(null)
    try {
      const data = await api.resolveChannelInvite(url)
      applyChannelPreview(data)
    } catch (err) {
      setFeedback(err.message || 'Não foi possível buscar o canal pelo convite.')
    } finally {
      setActionLoading('')
    }
  }

  async function resolveChannelByJid() {
    const jid = channelJid.trim()
    if (!jid.endsWith('@newsletter')) {
      setFeedback('JID de canal precisa terminar com @newsletter.')
      return
    }
    setActionLoading('resolve-channel-jid')
    setFeedback('')
    applyChannelPreview(null)
    try {
      const data = await api.resolveChannelJid(jid)
      applyChannelPreview(data)
    } catch (err) {
      setFeedback(err.message || 'Não foi possível buscar o canal pelo JID.')
    } finally {
      setActionLoading('')
    }
  }

  async function loadFollowedChannels() {
    setActionLoading('followed-channels')
    setFeedback('')
    try {
      const list = await api.waChannels()
      setFollowedChannels(Array.isArray(list) ? list : [])
      setAddMode('followed')
      setShowAdd(true)
    } catch (err) {
      setFollowedChannels([])
      setFeedback(err.message || 'Não foi possível carregar canais seguidos.')
      setShowAdd(true)
      setAddMode('followed')
    } finally {
      setActionLoading('')
    }
  }

  async function addResolvedChannel() {
    if (!channelPreview?.jid) {
      setFeedback('Busque um canal antes de salvar.')
      return
    }
    const finalName = channelName.trim()
    if (!finalName) {
      setFeedback('Dê um nome para este canal antes de salvar.')
      return
    }
    if (role === 'post' && channelPreview.isViewerOwner === false && !channelConfirmNonAdmin) {
      setFeedback('Confirme que você é admin desse canal antes de cadastrar como destino.')
      return
    }

    setActionLoading(`add-${channelPreview.jid}::${role}`)
    setFeedback('')
    setLintWarnings([])
    try {
      try {
        const lint = await api.lintChannelCopy({ title: finalName })
        setLintWarnings(lint?.warnings ?? [])
      } catch {
        setLintWarnings([])
      }
      await addGroupFromData({ waJid: channelPreview.jid, name: finalName, kind: 'channel' })
      applyChannelPreview(null)
      setChannelUrl('')
      setChannelJid('')
    } finally {
      setActionLoading('')
    }
  }

  async function addGroupFromData(data) {
    const result = prepareMobileGroupAddPayload(data, role, existingJidRoles)
    if (!result.ok) {
      setFeedback(result.feedback)
      return
    }

    const { waJid, name, kind } = result.payload
    setActionLoading(`add-${waJid}::${role}`)
    setFeedback('')
    try {
      const addedGroup = await api.addGroup(waJid, name, role, kind)
      setFeedback(role === 'monitor' ? 'Grupo adicionado para monitorar.' : 'Grupo adicionado para publicar.')
      setManualForm({ waJid: '', name: '', kind: 'group' })
      await loadGroups()
      if (kind === 'channel' && role === 'monitor' && addedGroup?.id) {
        const newId = addedGroup.id
        setFollowStatus((current) => ({ ...current, [newId]: 'loading' }))
        api.followChannelNow(newId)
          .then(() => setFollowStatus((current) => ({ ...current, [newId]: 'done' })))
          .catch(() => setFollowStatus((current) => ({ ...current, [newId]: 'error' })))
      }
    } catch (err) {
      setFeedback(err.message || 'Não foi possível adicionar o grupo.')
    } finally {
      setActionLoading('')
    }
  }


  async function deleteGroup(group) {
    setActionLoading(`delete-${group.id}`)
    setFeedback('')
    try {
      await api.deleteGroup(group.id)
      setGroups((current) => current.filter((item) => item.id !== group.id))
      setFeedback('Grupo removido.')
    } catch (err) {
      setFeedback(err.message || 'Não foi possível remover o grupo.')
    } finally {
      setActionLoading('')
    }
  }

  async function handleUpdateGroup(id, data) {
    // Otimista: reflete na UI antes da resposta para o toggle parecer instantâneo.
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...data } : group)))
    setSavingGroupId(id)
    setSavedGroupId(null)
    setFeedback('')
    try {
      await api.updateGroup(id, data)
      setSavedGroupId(id)
      window.setTimeout(() => setSavedGroupId((value) => (value === id ? null : value)), 1500)
    } catch (err) {
      setFeedback(err.message || 'Não foi possível salvar o filtro do grupo.')
      await loadGroups()
    } finally {
      setSavingGroupId((value) => (value === id ? null : value))
    }
  }

  function toggleGroupPlatform(group, platformId) {
    handleUpdateGroup(group.id, { allowedPlatforms: toggleMobilePlatform(group.allowedPlatforms, platformId) })
  }

  async function openTargetEditor(groupId) {
    setFeedback('')
    setTargetLoading(true)
    setTargetEditorId(groupId)
    try {
      const data = await api.groupTargets(groupId)
      setTargetPostIds(Array.isArray(data?.postIds) ? data.postIds : [])
    } catch (err) {
      setFeedback(err.message || 'Não foi possível carregar os destinos deste grupo.')
      setTargetEditorId(null)
    } finally {
      setTargetLoading(false)
    }
  }

  function toggleTargetPost(postId) {
    setTargetPostIds((current) => toggleMobileTargetPostId(current, postId))
  }

  async function saveTargetPosts() {
    if (!targetEditorId) return
    setTargetLoading(true)
    setFeedback('')
    try {
      await api.updateGroupTargets(targetEditorId, targetPostIds)
      setTargetEditorId(null)
      setFeedback('Destinos atualizados.')
    } catch (err) {
      setFeedback(err.message || 'Não foi possível salvar os destinos.')
    } finally {
      setTargetLoading(false)
    }
  }

  function setChannelError(groupId, message = '') {
    setChannelErrors((current) => ({ ...current, [groupId]: message }))
  }

  async function refreshSingleChannelHealth(groupId) {
    setChannelAction(`health-${groupId}`)
    setChannelError(groupId)
    try {
      const result = await api.channelHealth(groupId)
      setHealthMap((current) => ({ ...current, [groupId]: result }))
    } catch (err) {
      setChannelError(groupId, err.message || 'Não foi possível atualizar a saúde do canal.')
    } finally {
      setChannelAction('')
    }
  }

  async function recomputeChannelRisk(groupId) {
    setChannelAction(`risk-${groupId}`)
    setChannelError(groupId)
    try {
      const result = await api.channelRiskScore(groupId, 7)
      setHealthMap((current) => ({ ...current, [groupId]: { ...(current[groupId] || {}), reportRiskScore: result?.score ?? result?.riskScore ?? result?.reportRiskScore ?? current[groupId]?.reportRiskScore } }))
      setFeedback('Score de risco recalculado.')
    } catch (err) {
      setChannelError(groupId, err.message || 'Não foi possível recalcular o risco.')
    } finally {
      setChannelAction('')
    }
  }

  async function snapshotChannelNow(groupId) {
    setChannelAction(`snapshot-${groupId}`)
    setChannelError(groupId)
    try {
      const result = await api.channelSnapshotNow(groupId)
      const nextSnapshot = result?.snapshot ?? result
      setSnapshotMap((current) => ({
        ...current,
        [groupId]: [nextSnapshot, ...(current[groupId] || [])].filter(Boolean).slice(0, 5),
      }))
      setFeedback('Snapshot do canal criado.')
    } catch (err) {
      setChannelError(groupId, err.message || 'Não foi possível tirar snapshot agora.')
    } finally {
      setChannelAction('')
    }
  }

  async function loadChannelSnapshots(groupId) {
    setChannelAction(`snapshots-${groupId}`)
    setChannelError(groupId)
    try {
      const result = await api.channelSnapshots(groupId)
      const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : []
      setSnapshotMap((current) => ({ ...current, [groupId]: items.slice(0, 5) }))
    } catch (err) {
      setChannelError(groupId, err.message || 'Não foi possível carregar snapshots.')
    } finally {
      setChannelAction('')
    }
  }

  async function recreateChannel(groupId) {
    const newJid = (recreateDrafts[groupId] || '').trim()
    if (!newJid.endsWith('@newsletter')) {
      setChannelError(groupId, 'Informe um JID de canal terminando com @newsletter.')
      return
    }
    setChannelAction(`recreate-${groupId}`)
    setChannelError(groupId)
    try {
      await api.channelRecreate(groupId, newJid)
      setRecreateDrafts((current) => ({ ...current, [groupId]: '' }))
      setFeedback('Canal recriado. Lista atualizada.')
      await loadGroups()
    } catch (err) {
      setChannelError(groupId, err.message || 'Não foi possível recriar o canal.')
    } finally {
      setChannelAction('')
    }
  }


  const postGroups = useMemo(() => groups.filter((group) => group.role === 'post'), [groups])

  const canUseChannels = canAccessAdvancedPreservation(me)

  const feedbackIsError = feedback && (feedback.includes('Não') || feedback === 'Este grupo já está cadastrado para monitorar/publicar.')

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando grupos..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Grupos e canais</div>
      </div>

      <div style={{padding:'14px 16px 0'}}>
        <div style={{display:'flex', gap: 4, padding: 4, background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 14}}>
          {[
            {key:'origem', label:'👁 Monitorar', n: groups.filter((g) => g.role === 'monitor').length},
            {key:'destino', label:'⚡ Publicar', n: groups.filter((g) => g.role === 'post').length},
          ].map((item) => (
            <button key={item.key} type="button" onClick={() => setTab(item.key)} style={{flex: 1, padding:'10px 8px', borderRadius: 10, border:'none', cursor:'pointer', fontSize: 12.5, fontWeight: 600, fontFamily:'inherit', background: tab === item.key ? 'var(--ink)' : 'transparent', color: tab === item.key ? 'white' : 'var(--ink-soft)'}}>
              {item.label} <span style={{opacity:.7}}>({item.n})</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        {tab === 'origem' ? 'Grupos onde o bot lê links de promoção.' : 'Destinos onde o bot publica os links convertidos.'}
      </div>

      {feedback && <div style={{margin:'12px 16px 0', fontSize: 12, color: feedbackIsError ? 'var(--danger)' : 'var(--success)'}}>{feedback}</div>}

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {currentGroups.length === 0 ? (
            <div style={{padding:'24px 16px', textAlign:'center', color:'var(--ink-soft)', fontSize: 13}}>
              Nenhum grupo {tab === 'origem' ? 'para monitorar' : 'para publicar'} configurado.
            </div>
          ) : currentGroups.map((group, index) => {
            const name = group.subject || group.name || 'Sem nome'
            const isLast = index === currentGroups.length - 1
            const isMonitor = role === 'monitor'
            const configOpen = expandedConfigId === group.id
            return (
              <div key={group.id} style={{ borderBottom: isLast && !configOpen ? 'none' : '1px solid var(--line)' }}>
                <div style={{ ...cfgStyles.row(true), borderBottom: 'none' }}>
                  <div style={{width: 40, height: 40, borderRadius:'50%', background: avatarColor(name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight: 700, fontSize: 12, flexShrink: 0}}>{initials(name)}</div>
                  <div style={cfgStyles.rowMain}>
                    <div style={cfgStyles.rowTitle}>{name}</div>
                    <div style={cfgStyles.rowSub}>{group.kind === 'channel' ? 'canal' : 'grupo'} · {group.waJid || group.jid || 'sem JID'}</div>
                    {!isMonitor && group.kind === 'channel' && (() => {
                      const healthData = healthMap[group.id]
                      const healthStatus = typeof healthData === 'string' ? healthData : healthData?.status ?? null
                      const chip = getHealthChipStyle(healthStatus)
                      const warnStyle = chip.tone === 'warn'
                        ? { background:'color-mix(in oklab, var(--warn) 18%, var(--surface))', color:'var(--warn)', border:'1px solid color-mix(in oklab, var(--warn) 35%, var(--line))' }
                        : {}
                      return (
                        <div style={{display:'flex', alignItems:'center', gap: 6, marginTop: 5, flexWrap:'wrap'}}>
                          <span style={{...cfgStyles.pill(chip.tone), ...warnStyle}}>{chip.label}</span>
                          <button
                            type="button"
                            disabled={adminStatus[group.id] === 'loading'}
                            onClick={async () => {
                              setAdminStatus((current) => ({ ...current, [group.id]: 'loading' }))
                              try {
                                const result = await api.refreshChannelAdmin(group.id)
                                setAdminStatus((current) => ({ ...current, [group.id]: result?.isViewerOwner ? 'admin ok' : 'não é admin' }))
                              } catch {
                                setAdminStatus((current) => ({ ...current, [group.id]: 'erro' }))
                              }
                            }}
                            style={{border:'1px solid var(--line)', background:'transparent', borderRadius: 999, color:'var(--ink)', padding:'3px 8px', fontSize: 10.5, fontWeight: 600, cursor:'pointer'}}
                          >
                            {adminStatus[group.id] === 'loading' ? 'verificando...' : adminStatus[group.id] || 'Verificar admin'}
                          </button>
                        </div>
                      )
                    })()}
                    {isMonitor && group.kind === 'channel' && followStatus[group.id] && (
                      <div style={{marginTop: 4}}>
                        <span style={cfgStyles.pill(followStatus[group.id] === 'done' ? 'success' : followStatus[group.id] === 'error' ? 'danger' : 'neutral')}>
                          {followStatus[group.id] === 'loading' ? 'seguindo…' : followStatus[group.id] === 'done' ? 'seguindo' : 'falha ao seguir'}
                        </span>
                      </div>
                    )}
                  </div>
                  {savingGroupId === group.id && <span style={{fontSize: 10.5, color:'var(--accent-strong)', fontWeight: 600}}>salvando…</span>}
                  {savedGroupId === group.id && <span style={{fontSize: 10.5, color:'var(--success)', fontWeight: 600}}>salvo</span>}
                  {isMonitor && (
                    <button type="button" onClick={() => setExpandedConfigId(configOpen ? null : group.id)} aria-expanded={configOpen} style={{border:'1px solid var(--line)', background:'transparent', borderRadius: 999, color:'var(--ink)', padding:'6px 9px', fontSize: 11, fontWeight: 700}}>
                      {configOpen ? 'Fechar' : 'Filtros'}
                    </button>
                  )}
                  {!isMonitor && (
                    <button type="button" onClick={() => setExpandedConfigId(configOpen ? null : group.id)} aria-expanded={configOpen} style={{border:'1px solid var(--line)', background:'transparent', borderRadius: 999, color:'var(--ink)', padding:'6px 9px', fontSize: 11, fontWeight: 700}}>
                      {configOpen ? 'Fechar' : 'Config'}
                    </button>
                  )}
                  <button type="button" onClick={() => deleteGroup(group)} disabled={actionLoading === `delete-${group.id}`} style={{border:'1px solid var(--line)', background:'transparent', borderRadius: 999, color:'var(--danger)', padding:'6px 9px', fontSize: 11, fontWeight: 700}}>
                    Remover
                  </button>
                </div>

                {isMonitor && configOpen && (
                  <div style={{padding:'4px 16px 16px', display:'grid', gap: 14}}>
                    <div>
                      <div style={{...cfgStyles.label, marginBottom: 6}}>Palavras bloqueadas só neste grupo</div>
                      <input
                        style={cfgStyles.field}
                        placeholder="ex: usado, recondicionado"
                        defaultValue={group.blockedKeywords ?? ''}
                        onBlur={(event) => {
                          const value = event.target.value
                          if (value !== (group.blockedKeywords ?? '')) handleUpdateGroup(group.id, { blockedKeywords: value })
                        }}
                      />
                      <div style={{fontSize: 11, color:'var(--ink-faint)', marginTop: 6, lineHeight: 1.4}}>Some além da lista global de Preferências. Separe por vírgula.</div>
                    </div>

                    <div>
                      <div style={{...cfgStyles.label, marginBottom: 8}}>Lojas que esse grupo aceita</div>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8}}>
                        {MOBILE_GROUP_PLATFORMS.map((platform) => {
                          const checked = isMobilePlatformSelected(group.allowedPlatforms, platform.id)
                          return (
                            <label key={platform.id} style={{display:'flex', alignItems:'center', gap: 8, fontSize: 13, color:'var(--ink)', cursor:'pointer'}}>
                              <input type="checkbox" checked={checked} onChange={() => toggleGroupPlatform(group, platform.id)} style={{width: 17, height: 17}} />
                              {platform.label}
                            </label>
                          )
                        })}
                      </div>
                      <div style={{fontSize: 11, color:'var(--ink-faint)', marginTop: 6, lineHeight: 1.4}}>Sem marcar nada específico, usa as lojas globais.</div>
                    </div>

                    <div>
                      <div style={{...cfgStyles.label, marginBottom: 6}}>Mensagens sem link</div>
                      <label style={{display:'flex', alignItems:'center', gap: 10, cursor: canUseChannels ? 'pointer' : 'not-allowed'}}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={(group.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK'}
                          disabled={!canUseChannels}
                          onClick={() => {
                            const isCurrentlyAllowing = (group.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK'
                            if (isCurrentlyAllowing) {
                              handleUpdateGroup(group.id, { forwardMode: 'LINK_ONLY', noLinkScope: null })
                            } else {
                              handleUpdateGroup(group.id, { forwardMode: 'ALLOW_NO_LINK', noLinkScope: group.noLinkScope ?? 'TEXT_ONLY' })
                            }
                          }}
                          style={cfgStyles.toggle((group.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK')}
                          aria-label="Permitir mensagens sem link"
                        >
                          <div style={cfgStyles.toggleKnob((group.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK')} />
                        </button>
                        <span style={{fontSize: 12.5, color:'var(--ink)'}}>Encaminhar mensagens sem link</span>
                      </label>
                      {!canUseChannels && (
                        <div style={{fontSize: 11, color:'var(--ink-soft)', marginTop: 5}}>(disponível no Pro / Trial ativo)</div>
                      )}
                      {canUseChannels && (group.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK' && (
                        <select
                          style={{...cfgStyles.field, marginTop: 8}}
                          value={group.noLinkScope ?? 'TEXT_ONLY'}
                          onChange={(e) => handleUpdateGroup(group.id, { forwardMode: 'ALLOW_NO_LINK', noLinkScope: e.target.value })}
                        >
                          {NO_LINK_SCOPE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                      <div style={{fontSize: 11, color:'var(--ink-faint)', marginTop: 6, lineHeight: 1.4}}>Ativar pode aumentar o volume de mensagens no grupo de destino.</div>
                    </div>

                    <div>
                      <div style={{...cfgStyles.label, marginBottom: 6}}>Para onde esse grupo envia</div>
                      <button type="button" onClick={() => openTargetEditor(group.id)} style={{...mobi.btn('ghost', true)}}>
                        Escolher destinos
                      </button>
                      <div style={{fontSize: 11, color:'var(--ink-faint)', marginTop: 6, lineHeight: 1.4}}>Sem escolha, envia para todos os grupos de publicação.</div>
                    </div>
                  </div>
                )}

                {!isMonitor && configOpen && (
                  <div style={{padding:'4px 16px 16px', display:'grid', gap: 14}}>
                    <div>
                      <div style={{...cfgStyles.label, marginBottom: 6}}>Mensagem de boas-vindas</div>
                      <textarea
                        style={{...cfgStyles.field, minHeight: 80, resize:'vertical'}}
                        placeholder="Mensagem enviada quando alguém entra no grupo (opcional)"
                        defaultValue={group.welcomeMsg ?? ''}
                        onBlur={(event) => {
                          const value = event.target.value.trim() || null
                          const current = group.welcomeMsg ?? null
                          if (value !== current) handleUpdateGroup(group.id, { welcomeMsg: value })
                        }}
                      />
                      <div style={{fontSize: 11, color:'var(--ink-faint)', marginTop: 6, lineHeight: 1.4}}>Texto enviado automaticamente para novos membros deste grupo de publicação.</div>
                    </div>

                    {group.kind === 'channel' && (() => {
                      const healthData = healthMap[group.id] || {}
                      const snapshots = snapshotMap[group.id] || []
                      const riskValue = healthData?.reportRiskScore ?? healthData?.riskScore ?? healthData?.score ?? '—'
                      return (
                        <div style={{borderTop:'1px solid var(--line)', paddingTop: 14, display:'grid', gap: 10}}>
                          <div>
                            <div style={{...cfgStyles.label, marginBottom: 4}}>Painel anti-ban do canal</div>
                            <div style={{fontSize: 11.5, color:'var(--ink-soft)', lineHeight: 1.45}}>Atualize saúde, recalcule risco, faça snapshot manual ou recrie o destino quando o canal mudar.</div>
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8}}>
                            <div style={{...cfgStyles.field, background:'var(--bg-soft)'}}>
                              <div style={{fontSize: 10.5, color:'var(--ink-faint)', textTransform:'uppercase', fontWeight: 800}}>Status</div>
                              <div style={{fontSize: 13, fontWeight: 700, color:'var(--ink)', marginTop: 3}}>{healthData?.status ?? 'sem dados'}</div>
                            </div>
                            <div style={{...cfgStyles.field, background:'var(--bg-soft)'}}>
                              <div style={{fontSize: 10.5, color:'var(--ink-faint)', textTransform:'uppercase', fontWeight: 800}}>Risco</div>
                              <div style={{fontSize: 13, fontWeight: 700, color:'var(--ink)', marginTop: 3}}>{riskValue}</div>
                            </div>
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8}}>
                            <button type="button" onClick={() => refreshSingleChannelHealth(group.id)} disabled={channelAction === `health-${group.id}`} style={mobi.btn('ghost', true)}>{channelAction === `health-${group.id}` ? 'Atualizando...' : 'Atualizar saúde'}</button>
                            <button type="button" onClick={() => recomputeChannelRisk(group.id)} disabled={channelAction === `risk-${group.id}`} style={mobi.btn('ghost', true)}>{channelAction === `risk-${group.id}` ? 'Calculando...' : 'Recalcular risco'}</button>
                            <button type="button" onClick={() => snapshotChannelNow(group.id)} disabled={channelAction === `snapshot-${group.id}`} style={mobi.btn('ghost', true)}>{channelAction === `snapshot-${group.id}` ? 'Criando...' : 'Snapshot agora'}</button>
                            <button type="button" onClick={() => loadChannelSnapshots(group.id)} disabled={channelAction === `snapshots-${group.id}`} style={mobi.btn('ghost', true)}>{channelAction === `snapshots-${group.id}` ? 'Carregando...' : 'Ver snapshots'}</button>
                          </div>
                          {snapshots.length > 0 && (
                            <div style={{display:'grid', gap: 6}}>
                              {snapshots.map((snapshot, snapIndex) => (
                                <div key={snapshot.id || snapIndex} style={{fontSize: 11.5, color:'var(--ink-soft)', borderTop:'1px solid var(--line)', paddingTop: 6}}>
                                  {(snapshot.snapshotedAt || snapshot.createdAt) ? new Date(snapshot.snapshotedAt || snapshot.createdAt).toLocaleString('pt-BR') : 'snapshot'} · {snapshot.status ?? snapshot.healthStatus ?? snapshot.subscribersCount ?? 'sem status'}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{display:'grid', gap: 8}}>
                            <input
                              style={cfgStyles.field}
                              placeholder="novo JID @newsletter"
                              value={recreateDrafts[group.id] || ''}
                              onChange={(event) => setRecreateDrafts((current) => ({ ...current, [group.id]: event.target.value }))}
                            />
                            <button type="button" onClick={() => recreateChannel(group.id)} disabled={channelAction === `recreate-${group.id}`} style={{...mobi.btn('ghost', true), color:'var(--danger)'}}>{channelAction === `recreate-${group.id}` ? 'Recriando...' : 'Recriar canal'}</button>
                          </div>
                          {channelErrors[group.id] && <div style={{fontSize: 12, color:'var(--danger)'}}>{channelErrors[group.id]}</div>}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{padding:'18px 16px 0', display:'grid', gap: 10}}>
        <button type="button" onClick={loadWhatsAppGroups} disabled={actionLoading === 'wa-groups'} style={{...mobi.btn('primary', true)}}>
          <MobileIcon name="plus" size={14}/> {actionLoading === 'wa-groups' ? 'Buscando...' : `Adicionar grupo para ${role === 'monitor' ? 'monitorar' : 'publicar'}`}
        </button>
      </div>

      {showAdd && (
        <div style={cfgStyles.cardWrap}>
          <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
            <div style={cfgStyles.rowTitle}>{role === 'monitor' ? 'Adicionar origem' : 'Adicionar destino'}</div>
            <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>
              Use grupos carregados do WhatsApp ou cadastre canais por link, lista de canais seguidos ou JID resolvido.
            </p>

            <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 6}}>
              {[
                ['groups', 'Grupos'],
                ['link', 'Link'],
                ['followed', 'Seguidos'],
                ['jid', 'JID'],
              ].map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => setAddMode(mode)} style={{padding:'8px 4px', borderRadius: 10, border: addMode === mode ? '1.5px solid var(--ink)' : '1px solid var(--line)', background: addMode === mode ? 'var(--ink)' : 'var(--surface)', color: addMode === mode ? 'white' : 'var(--ink)', fontSize: 11.5, fontWeight: 800, fontFamily:'inherit'}}>
                  {label}
                </button>
              ))}
            </div>

            {addMode === 'groups' && (
              <>
                {waGroups.length === 0 ? (
                  <div style={{fontSize: 12, color:'var(--ink-soft)'}}>Nenhum grupo carregado do WhatsApp. Confirme se o bot está conectado ou use o cadastro manual.</div>
                ) : waGroups.map((group) => {
                  const pickerItem = getMobileGroupPickerItem(group, role, existingJidRoles)
                  const loadingThisGroup = actionLoading === `add-${pickerItem.waJid}::${role}`
                  return (
                    <button
                      key={pickerItem.waJid}
                      type="button"
                      onClick={() => !pickerItem.disabled && addGroupFromData({ waJid: pickerItem.waJid, name: pickerItem.name, kind: pickerItem.kind })}
                      disabled={pickerItem.disabled || loadingThisGroup}
                      style={{
                        ...cfgStyles.field,
                        background: pickerItem.disabled ? 'var(--bg-soft)' : 'var(--surface)',
                        display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12,
                        textAlign:'left', cursor: pickerItem.disabled ? 'not-allowed' : 'pointer',
                        opacity: pickerItem.disabled ? 0.7 : 1,
                      }}
                    >
                      <span style={{minWidth: 0}}>
                        <span style={{display:'block', fontSize: 13, fontWeight: 700, color:'var(--ink)', lineHeight: 1.35}}>{pickerItem.name}</span>
                        <span style={{display:'block', fontSize: 11, color:'var(--ink-faint)', wordBreak:'break-all', marginTop: 3}}>{pickerItem.waJid}</span>
                      </span>
                      <span style={cfgStyles.pill(pickerItem.disabled ? 'neutral' : 'success')}>
                        {loadingThisGroup ? 'adicionando...' : pickerItem.pill}
                      </span>
                    </button>
                  )
                })}
                <div style={cfgStyles.rowTitle}>Ou cadastrar manualmente</div>
                <input style={cfgStyles.field} placeholder="JID do grupo/canal" value={manualForm.waJid} onChange={(event) => setManualForm((current) => ({...current, waJid: event.target.value}))}/>
                <input style={cfgStyles.field} placeholder="Nome" value={manualForm.name} onChange={(event) => setManualForm((current) => ({...current, name: event.target.value}))}/>
                <select style={cfgStyles.field} value={manualForm.kind} onChange={(event) => setManualForm((current) => ({...current, kind: event.target.value}))}>
                  <option value="group">Grupo</option>
                  <option value="channel">Canal</option>
                </select>
                <button type="button" onClick={() => addGroupFromData(manualForm)} disabled={!manualForm.waJid.trim() || actionLoading.startsWith('add-')} style={{...mobi.btn('accent', true), opacity: !manualForm.waJid.trim() ? 0.6 : 1}}>
                  Salvar {tab === 'origem' ? 'origem' : 'destino'}
                </button>
              </>
            )}

            {addMode === 'link' && (
              <div style={{display:'grid', gap: 10}}>
                <input style={cfgStyles.field} value={channelUrl} onChange={(event) => setChannelUrl(event.target.value)} placeholder="https://whatsapp.com/channel/..." />
                <button type="button" onClick={resolveChannelByInvite} disabled={actionLoading === 'resolve-channel-link'} style={mobi.btn('accent', true)}>{actionLoading === 'resolve-channel-link' ? 'Buscando…' : 'Buscar canal pelo link'}</button>
              </div>
            )}

            {addMode === 'followed' && (
              <div style={{display:'grid', gap: 10}}>
                <button type="button" onClick={loadFollowedChannels} disabled={actionLoading === 'followed-channels'} style={mobi.btn('accent', true)}>{actionLoading === 'followed-channels' ? 'Carregando…' : 'Carregar canais que sigo'}</button>
                {followedChannels === null ? (
                  <div style={{fontSize: 12, color:'var(--ink-soft)'}}>Toque em carregar para listar os canais seguidos pelo WhatsApp conectado.</div>
                ) : followedChannels.length === 0 ? (
                  <div style={{fontSize: 12, color:'var(--ink-soft)'}}>Nenhum canal seguido retornado pela sessão.</div>
                ) : followedChannels.map((channel) => {
                  const jid = channel.jid || channel.waJid || channel.id
                  const name = channel.name || channel.subject || `Canal ${String(jid || '').slice(-6)}`
                  return (
                    <button key={jid} type="button" onClick={() => applyChannelPreview({ ...channel, jid, name })} style={{...cfgStyles.field, background:'var(--surface)', textAlign:'left', display:'flex', justifyContent:'space-between', gap: 10}}>
                      <span style={{minWidth:0}}>
                        <span style={{display:'block', fontSize: 13, fontWeight: 700, color:'var(--ink)'}}>{name}</span>
                        <span style={{display:'block', fontSize: 11, color:'var(--ink-faint)', wordBreak:'break-all'}}>{jid}</span>
                      </span>
                      <span style={cfgStyles.pill('success')}>usar</span>
                    </button>
                  )
                })}
              </div>
            )}

            {addMode === 'jid' && (
              <div style={{display:'grid', gap: 10}}>
                <input style={cfgStyles.field} value={channelJid} onChange={(event) => setChannelJid(event.target.value)} placeholder="xxxxxxxx@newsletter" />
                <button type="button" onClick={resolveChannelByJid} disabled={actionLoading === 'resolve-channel-jid'} style={mobi.btn('accent', true)}>{actionLoading === 'resolve-channel-jid' ? 'Buscando…' : 'Resolver JID do canal'}</button>
              </div>
            )}

            {channelPreview?.jid && addMode !== 'groups' && (
              <div style={{border:'1px solid var(--line)', borderRadius: 14, padding: 12, display:'grid', gap: 10, background:'var(--bg-soft)'}}>
                <div style={{fontSize: 11, fontWeight: 800, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--ink-faint)'}}>Canal encontrado</div>
                <input style={cfgStyles.field} value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="Nome do canal" />
                <div style={{fontSize: 11, color:'var(--ink-faint)', wordBreak:'break-all'}}>{channelPreview.jid}</div>
                {role === 'post' && channelPreview.isViewerOwner === false && (
                  <label style={{display:'flex', gap: 8, alignItems:'flex-start', fontSize: 12, color:'var(--warn)', lineHeight: 1.4}}>
                    <input type="checkbox" checked={channelConfirmNonAdmin} onChange={(event) => setChannelConfirmNonAdmin(event.target.checked)} />
                    Confirmo que sou admin desse canal antes de cadastrar como destino.
                  </label>
                )}
                {lintWarnings.length > 0 && (
                  <div style={{fontSize: 11.5, color:'var(--warn)', lineHeight: 1.45}}>
                    {lintWarnings.map((warning, index) => <div key={index}>⚠️ {warning}</div>)}
                  </div>
                )}
                <button type="button" onClick={addResolvedChannel} disabled={actionLoading.startsWith('add-')} style={mobi.btn('accent', true)}>
                  {actionLoading.startsWith('add-') ? 'Salvando…' : `Salvar canal como ${role === 'monitor' ? 'origem' : 'destino'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <MobileModal
        open={Boolean(targetEditorId)}
        onClose={() => !targetLoading && setTargetEditorId(null)}
        dismissible={!targetLoading}
        variant="sheet"
        ariaLabel="Escolher destinos do grupo"
      >
          <div style={{display:'grid', gap: 14}}>
            <div>
              <div style={cfgStyles.rowTitle}>Para onde esse grupo envia</div>
              <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45, marginTop: 4}}>
                Marque os grupos de publicação que recebem o que esse grupo capta. Sem nenhum marcado, envia para todos.
              </p>
            </div>
            {postGroups.length === 0 ? (
              <div style={{fontSize: 13, color:'var(--warn)', lineHeight: 1.45}}>
                Cadastre ao menos um grupo na aba Publicar para escolher destinos.
              </div>
            ) : postGroups.map((group) => {
              const name = group.subject || group.name || 'Sem nome'
              const checked = targetPostIds.includes(group.id)
              return (
                <label key={group.id} style={{display:'flex', alignItems:'center', gap: 10, padding:'12px 14px', border:'1px solid var(--line)', borderRadius: 12, fontSize: 13, color:'var(--ink)', cursor:'pointer'}}>
                  <input type="checkbox" checked={checked} onChange={() => toggleTargetPost(group.id)} style={{width: 17, height: 17}} />
                  <span style={{minWidth: 0}}>
                    <span style={{display:'block', fontWeight: 600}}>{name}</span>
                    <span style={{display:'block', fontSize: 11, color:'var(--ink-faint)', wordBreak:'break-all'}}>{group.kind === 'channel' ? 'canal' : 'grupo'}</span>
                  </span>
                </label>
              )
            })}
            <div style={{display:'flex', gap: 8}}>
              <button type="button" onClick={() => setTargetEditorId(null)} disabled={targetLoading} style={{...mobi.btn('ghost', true)}}>Cancelar</button>
              <button type="button" onClick={saveTargetPosts} disabled={targetLoading || postGroups.length === 0} style={{...mobi.btn('accent', true)}}>
                {targetLoading ? 'Salvando…' : 'Salvar destinos'}
              </button>
            </div>
          </div>
      </MobileModal>

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
