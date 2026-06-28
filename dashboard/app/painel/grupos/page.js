'use client'

/* Grupos — interface responsiva Menta para configuração de grupos:
 * abas 👁 Monitorar / ⚡ Publicar com contagem + config por grupo recolhível
 * (em vez de duas seções longas sempre expandidas). Mesma lógica/back end de
 * sempre: api.groups / addGroup / updateGroup / deleteGroup / groupTargets /
 * updateGroupTargets / sessionWAGroups + canais (follow/admin/health). Reusa os
 * componentes existentes (ConfirmDialog, HelpLink, AddChannelModal, badges,
 * ChannelHealthPanel). Nenhuma mudança no back end — só o layout. */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { AddChannelModal } from '@/components/AddChannelModal'
import { SelectChannelModal } from '@/components/SelectChannelModal'
import { TypeBadge, FollowBadge, AdminBadge, HealthBadge } from '@/components/ChannelStatusBadges'
import { ChannelHealthPanel } from '@/components/ChannelHealthPanel'
import { usePainelHeader, PainelContentActions } from '../PainelShell'

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

const GRADIENTS = [
  'linear-gradient(135deg,#94A3B8,#475569)',
  'linear-gradient(135deg,#F4D9E0,#E8A488)',
  'linear-gradient(135deg,#C8E6D8,#3E9C7A)',
  'linear-gradient(135deg,#D9CFEA,#7C5CF5)',
]

function groupInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  const raw = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2))
  return raw.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 2) || '#'
}

function GroupAvatar({ name, index }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
        background: GRADIENTS[index % GRADIENTS.length],
      }}
    >{groupInitials(name)}</span>
  )
}

export default function GruposPage() {
  usePainelHeader({ title: 'Grupos e canais', subtitle: 'Defina quais grupos o bot escuta e onde ele publica' })

  const [groups, setGroups] = useState([])
  const [actionError, setActionError] = useState('')
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [waGroups, setWaGroups] = useState(null)
  const [loadingWA, setLoadingWA] = useState(false)
  const [waError, setWaError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addingKey, setAddingKey] = useState('')
  const [savingGroupId, setSavingGroupId] = useState(null)
  const [savedGroupId, setSavedGroupId] = useState(null)
  const [groupErrors, setGroupErrors] = useState({})
  const [targetEditorId, setTargetEditorId] = useState(null)
  const [targetPostIds, setTargetPostIds] = useState([])
  const [targetLoading, setTargetLoading] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [channelButtonGroupId, setChannelButtonGroupId] = useState(null)
  const [tab, setTab] = useState('monitor')
  const [expandedConfigId, setExpandedConfigId] = useState(null)
  const [followStatus, setFollowStatus] = useState({})
  const [adminStatus, setAdminStatus] = useState({})
  const [refreshingAdminId, setRefreshingAdminId] = useState(null)
  const [healthByGroup, setHealthByGroup] = useState({})
  const [expandedHealthId, setExpandedHealthId] = useState(null)
  const [planSubject, setPlanSubject] = useState({ plan: 'trial', accessExpiresAt: null })
  const [templates, setTemplates] = useState([])

  async function load() {
    setLoadingGroups(true)
    setActionError('')
    try {
      const list = await api.groups()
      setGroups(list)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setLoadingGroups(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoadingGroups(true)
    Promise.all([api.groups(), api.me(), loadTemplateStore().catch(() => ({}))])
      .then(async ([data, me, templateStore]) => {
        setTemplates(composeTemplates(templateStore))
        setPlanSubject({ plan: me?.plan ?? 'trial', accessExpiresAt: me?.accessExpiresAt ?? null })
        if (!active) return
        setGroups(data)
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
    setTab(group.role === 'post' ? 'post' : 'monitor')
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

  const monitor = groups.filter((g) => g.role === 'monitor')
  const post = groups.filter((g) => g.role === 'post')
  const current = tab === 'monitor' ? monitor : post
  const existingJidRoles = new Set(groups.map((g) => `${g.waJid}::${g.role}`))

  const canUseChannels = (() => {
    if (planSubject.plan === 'pro') return true
    if (planSubject.plan !== 'trial' || !planSubject.accessExpiresAt) return false
    const expiresAt = new Date(planSubject.accessExpiresAt)
    return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
  })()

  function renderMonitorConfig(g) {
    return (
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 14, display: 'grid', gap: 16 }}>
        <div>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Palavras bloqueadas só neste grupo</p>
          <input
            className="pnl-input"
            value={g.blockedKeywords ?? ''}
            onChange={(e) => handleUpdateGroup(g.id, { blockedKeywords: e.target.value })}
            placeholder="ex: usado, recondicionado"
          />
          <p className="pnl-hint" style={{ marginTop: 6 }}>Soma à lista global. Separe por vírgula.</p>
        </div>
        <div>
          <p className="pnl-label" style={{ marginBottom: 8 }}>Lojas que esse grupo aceita</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
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
          <p className="pnl-hint" style={{ marginTop: 6 }}>Sem seleção, usa as plataformas globais.</p>
        </div>
        <div>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Imagem das ofertas espelhadas</p>
          <select
            className="pnl-input"
            value={g.imageMode ?? 'original'}
            onChange={(e) => handleUpdateGroup(g.id, { imageMode: e.target.value })}
          >
            <option value="fetch">Imagem oficial da loja</option>
            <option value="original">Imagem que veio na mensagem</option>
            <option value="none">Sem imagem (só o link com prévia)</option>
          </select>
          <p className="pnl-hint" style={{ marginTop: 6 }}>
            <strong>Imagem oficial da loja</strong>: busca a foto direto no site do produto, sem marca d’água de outros grupos (se o site não retornar, usa a imagem da mensagem). <strong>Imagem que veio na mensagem</strong>: reaproveita a foto do grupo de origem. <strong>Sem imagem</strong>: envia só o link com a prévia automática do WhatsApp.
          </p>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              role="switch"
              aria-checked={(g.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK'}
              disabled={!canUseChannels}
              className={`pnl-switch${(g.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK' ? ' is-on' : ''}`}
              onClick={() => {
                const enabled = (g.forwardMode ?? 'LINK_ONLY') !== 'ALLOW_NO_LINK'
                if (enabled && !canUseChannels) {
                  setActionError('O Módulo de Preservação Avançada está disponível no Trial ativo e no plano Pro.')
                  return
                }
                handleUpdateGroup(g.id, {
                  forwardMode: enabled ? 'ALLOW_NO_LINK' : 'LINK_ONLY',
                  noLinkScope: enabled ? (g.noLinkScope ?? 'TEXT_ONLY') : null,
                })
              }}
            >
              <span />
            </button>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>Encaminhar mensagens sem link {!canUseChannels && '(Pro)'}</span>
          </div>
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
          <p className="pnl-hint" style={{ marginTop: 6, color: '#b5742a' }}>Ativar pode aumentar o volume de mensagens encaminhadas.</p>
        </div>
        <div>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Template das mensagens espelhadas</p>
          <select
            className="pnl-input"
            value={g.templateKey == null ? '__inherit__' : (g.templateKey === '' ? '__relay__' : g.templateKey)}
            onChange={(e) => {
              const v = e.target.value
              const templateKey = v === '__inherit__' ? null : v === '__relay__' ? '' : v
              handleUpdateGroup(g.id, { templateKey })
            }}
          >
            <option value="__inherit__">Usar padrão global (Configurações)</option>
            <option value="__relay__">Manter texto original convertido</option>
            {templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
          </select>
          <p className="pnl-hint" style={{ marginTop: 6 }}>Ideal para mensagens de um produto. Aplica um template do Gerar oferta depois de converter o link. Com vários produtos, só o link escolhido abaixo vira oferta. Templates sem preço deixam placeholders quando o preço não aparece no texto original.</p>
        </div>
        <div>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Link a converter quando há vários</p>
          <select
            className="pnl-input"
            value={g.primaryLinkTarget ?? ''}
            onChange={(e) => handleUpdateGroup(g.id, { primaryLinkTarget: e.target.value })}
          >
            <option value="">Usar padrão global (Configurações)</option>
            <option value="first">Primeiro link da mensagem</option>
            <option value="last">Último link da mensagem</option>
          </select>
          <p className="pnl-hint" style={{ marginTop: 6 }}>Quando a mensagem espelhada tem mais de um link de loja, escolhe qual deles é convertido e usado na oferta.</p>
        </div>
        <div>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Para onde esse grupo envia</p>
          <button type="button" className="pnl-btn" onClick={() => openTargetEditor(g.id)}>Escolher destinos</button>
          <p className="pnl-hint" style={{ marginTop: 6 }}>Sem escolha, envia para todos os grupos de destino.</p>
        </div>
      </div>
    )
  }

  function renderPostConfig(g) {
    return (
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 14, display: 'grid', gap: 14 }}>
        <div>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Mensagem de boas-vindas</p>
          <textarea
            className="pnl-input"
            style={{ fontFamily: 'inherit', fontSize: 13, minHeight: 64 }}
            rows={2}
            value={g.welcomeMsg ?? ''}
            onChange={(e) => handleUpdateGroup(g.id, { welcomeMsg: e.target.value })}
            placeholder="Mensagem enviada quando alguém entra no grupo (opcional)"
          />
        </div>
        {g.kind !== 'channel' && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <p className="pnl-label" style={{ marginBottom: 6 }}>Botão “Ver canal” ao final das mensagens</p>
            <p className="pnl-hint" style={{ marginTop: 0, marginBottom: 8 }}>
              Toda mensagem enviada para este grupo (espelhada, oferta automática ou agendada) sai com um botão “Ver canal” apontando para o canal escolhido. Deixe sem canal para não inserir botão.
            </p>
            {g.channelButtonJid ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--pnl-radius-sm)', padding: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.channelButtonName || 'Canal sem nome'}</div>
                  <div className="pnl-hint" style={{ fontFamily: 'monospace', marginTop: 2 }}>{g.channelButtonJid}</div>
                </div>
                <div className="pnl-toolbar">
                  <button type="button" className="pnl-btn" onClick={() => setChannelButtonGroupId(g.id)}>Trocar canal</button>
                  <button type="button" className="pnl-btn" onClick={() => handleUpdateGroup(g.id, { channelButtonJid: '', channelButtonName: '' })}>Remover botão</button>
                </div>
              </div>
            ) : (
              <button type="button" className="pnl-btn is-primary" onClick={() => setChannelButtonGroupId(g.id)}>
                Escolher canal do botão
              </button>
            )}
          </div>
        )}
        {g.kind === 'channel' && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <AdminBadge status={adminStatus[g.id] ?? 'unknown'} onRefresh={() => refreshAdmin(g)} refreshing={refreshingAdminId === g.id} />
              {healthByGroup[g.id] && <HealthBadge status={healthByGroup[g.id].status} />}
              <button type="button" className="pnl-link-btn" onClick={() => setExpandedHealthId(expandedHealthId === g.id ? null : g.id)}>
                {expandedHealthId === g.id ? 'Fechar painel anti-ban' : 'Painel anti-ban'}
              </button>
            </div>
            {expandedHealthId === g.id && (
              <ChannelHealthPanel group={g} initialHealth={healthByGroup[g.id]} onHealthChange={(h) => setHealthByGroup((prev) => ({ ...prev, [g.id]: h }))} />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 820, margin: '0 auto' }}>
      <PainelContentActions>
        <div className="pnl-toolbar">
          <HelpLink topic="como-cadastrar-grupos">Ajuda</HelpLink>
        </div>
      </PainelContentActions>

      <div style={{ display: 'grid', gap: 4, color: 'var(--ink)', fontSize: 14, lineHeight: 1.55 }}>
        <p><strong>Monitorar:</strong> Grupos de promoção que você participa. O bot só lê os links.</p>
        <p><strong>Publicar:</strong> Seus grupos de clientes. O bot posta o link já com o seu código.</p>
      </div>

      {/* Abas Monitorar / Publicar */}
      <div className="pnl-seg pnl-groups-role-toggle" role="tablist" aria-label="Escolher entre monitorar e publicar">
        {[
          { key: 'monitor', icon: '👁', label: 'Monitorar', n: monitor.length },
          { key: 'post', icon: '⚡', label: 'Publicar', n: post.length },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'is-active' : ''}
            onClick={() => { setTab(t.key); setExpandedConfigId(null) }}
          >
            <span className="pnl-groups-role-icon" aria-hidden="true">{t.icon}</span>
            <span className="pnl-groups-role-label">{t.label}</span>
            <span className="pnl-groups-role-count" aria-label={`${t.n} cadastrados`}>{t.n}</span>
          </button>
        ))}
      </div>

      <p className="pnl-card-note" style={{ marginTop: -4 }}>
        {tab === 'monitor'
          ? 'Grupos onde o bot lê mensagens e procura links para converter.'
          : 'Grupos onde o bot publica os links já convertidos.'}
      </p>

      {actionError && <div className="pnl-note-box is-error" role="alert"><strong style={{ fontWeight: 600 }}>Falha ao atualizar grupos</strong><p style={{ marginTop: 4 }}>{actionError}</p></div>}
      {!canUseChannels && (
        <div className="pnl-note-box"><strong style={{ fontWeight: 600 }}>Canais bloqueados no Basic</strong><p style={{ marginTop: 4 }}>Canais já cadastrados ficam preservados. Faça upgrade para o Pro para reativar monitoramento e envio em canais.</p></div>
      )}

      {/* Lista de grupos da aba ativa */}
      <section className="pnl-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loadingGroups ? (
          <p className="pnl-empty" style={{ padding: 24 }}>Carregando grupos configurados…</p>
        ) : current.length === 0 ? (
          <p className="pnl-empty" style={{ padding: 24 }}>
            Nenhum grupo {tab === 'monitor' ? 'para monitorar' : 'para publicar'} configurado.
          </p>
        ) : (
          <ul>
            {current.map((g, i) => {
              const configOpen = expandedConfigId === g.id
              return (
                <li key={g.id} style={{ borderBottom: i === current.length - 1 ? 'none' : '1px solid var(--line)', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <GroupAvatar name={g.name} index={i} />
                    <div style={{ minWidth: 0, flex: 1, wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{g.name}</span>
                        <TypeBadge kind={g.kind} />
                        {!canUseChannels && g.kind === 'channel' && <span className="pnl-tag is-flight">Pro</span>}
                        {g.kind === 'channel' && g.role === 'monitor' && <FollowBadge status={followStatus[g.id] ?? 'unknown'} />}
                        {g.kind === 'channel' && g.role === 'post' && healthByGroup[g.id] && <HealthBadge status={healthByGroup[g.id].status} />}
                      </div>
                      <div className="pnl-hint" style={{ marginTop: 2 }}>{g.kind === 'channel' ? 'canal' : 'grupo'} · {g.waJid}</div>
                    </div>
                    <div className="pnl-toolbar" style={{ flexShrink: 0 }}>
                      {savingGroupId === g.id && <span className="pnl-hint" style={{ color: 'var(--accent-strong)' }}>salvando…</span>}
                      {savedGroupId === g.id && <span className="pnl-hint" style={{ color: 'var(--success)' }}>salvo</span>}
                      <button type="button" className="pnl-link-btn" aria-expanded={configOpen} onClick={() => setExpandedConfigId(configOpen ? null : g.id)}>
                        {configOpen ? 'Fechar' : (tab === 'monitor' ? 'Filtros' : 'Config')}
                      </button>
                      <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(g)}>Remover</button>
                    </div>
                  </div>
                  {groupErrors[g.id] && <p className="pnl-hint" style={{ color: 'var(--danger)', marginTop: 6 }}>{groupErrors[g.id]}</p>}
                  {configOpen && (tab === 'monitor' ? renderMonitorConfig(g) : renderPostConfig(g))}
                </li>
              )
            })}
          </ul>
        )}
      </section>

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

      {/* Adicionar canal existente */}
      <section className="pnl-card">
        <div className="pnl-card-head">
          <div>
            <div className="pnl-card-title">Adicionar canal existente</div>
            <p className="pnl-card-note">Cadastre um canal por link ou escolha um canal que você já segue no WhatsApp.</p>
          </div>
          <button
            type="button"
            className={`pnl-btn ${canUseChannels ? 'is-primary' : ''}`}
            onClick={() => canUseChannels ? setShowChannelModal(true) : setActionError('Canais estão disponíveis no Trial ativo e no plano Pro.')}
          >
            + Adicionar canal {!canUseChannels && '(Pro)'}
          </button>
        </div>
      </section>

      {/* Editor de alvos */}
      {targetEditorId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div className="pnl-card" style={{ width: '100%', maxWidth: 420 }}>
            <div className="pnl-card-title">Configurar destinos</div>
            <p className="pnl-card-note" style={{ marginTop: 4, marginBottom: 12 }}>Escolha quais grupos de destino recebem mensagens deste grupo monitorado. Se nenhum for selecionado, o bot envia para todos.</p>
            {post.length === 0 ? (
              <p className="pnl-hint" style={{ color: '#b5742a', marginBottom: 12 }}>Cadastre ao menos um grupo de postagem para configurar destinos.</p>
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
              <button type="button" className="pnl-btn is-primary" onClick={saveTargetPosts} disabled={targetLoading}>{targetLoading ? 'Salvando…' : 'Salvar destinos'}</button>
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

      <SelectChannelModal
        open={channelButtonGroupId !== null}
        onClose={() => setChannelButtonGroupId(null)}
        onSelect={({ jid, name }) => {
          if (channelButtonGroupId) handleUpdateGroup(channelButtonGroupId, { channelButtonJid: jid, channelButtonName: name })
        }}
      />
    </div>
  )
}
