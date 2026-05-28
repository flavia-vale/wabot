'use client'

import { useEffect, useMemo, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'
import {
  buildExistingJidRoleSet,
  getMobileGroupPickerItem,
  getRoleForMobileGroupTab,
  sortWhatsAppGroupsForMobilePicker,
} from '@/lib/mobileGroupPicker'

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
  const [groups, setGroups] = useState([])
  const [waGroups, setWaGroups] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [manualForm, setManualForm] = useState({ waJid: '', name: '', kind: 'group' })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

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
        const list = await api.groups()
        if (active) setGroups(Array.isArray(list) ? list : [])
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar os grupos.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

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
    } catch (err) {
      setFeedback(err.message || 'Não foi possível listar grupos do WhatsApp. Use o cadastro manual.')
      setShowAdd(true)
    } finally {
      setActionLoading('')
    }
  }

  async function addGroupFromData(data) {
    const waJid = data.waJid || data.jid || data.id
    setActionLoading(`add-${waJid}::${role}`)
    setFeedback('')
    try {
      await api.addGroup(waJid, data.name || data.subject || waJid, role, data.kind || 'group')
      setFeedback(role === 'monitor' ? 'Grupo adicionado para monitorar.' : 'Grupo adicionado para publicar.')
      setManualForm({ waJid: '', name: '', kind: 'group' })
      await loadGroups()
    } catch (err) {
      setFeedback(err.message || 'Não foi possível adicionar o grupo.')
    } finally {
      setActionLoading('')
    }
  }

  async function toggleGroup(group) {
    const nextActive = group.active === false
    setGroups((current) => current.map((item) => item.id === group.id ? { ...item, active: nextActive } : item))
    setFeedback('')
    try {
      await api.updateGroup(group.id, { active: nextActive })
      setFeedback(nextActive ? 'Grupo ativado.' : 'Grupo pausado.')
    } catch (err) {
      setGroups((current) => current.map((item) => item.id === group.id ? group : item))
      setFeedback(err.message || 'Não foi possível atualizar o grupo.')
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

      {feedback && <div style={{margin:'12px 16px 0', fontSize: 12, color: feedback.includes('Não') ? 'var(--danger)' : 'var(--success)'}}>{feedback}</div>}

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {currentGroups.length === 0 ? (
            <div style={{padding:'24px 16px', textAlign:'center', color:'var(--ink-soft)', fontSize: 13}}>
              Nenhum grupo {tab === 'origem' ? 'para monitorar' : 'para publicar'} configurado.
            </div>
          ) : currentGroups.map((group, index) => {
            const name = group.subject || group.name || 'Sem nome'
            const active = group.active !== false
            return (
              <div key={group.id} style={{...cfgStyles.row(index === currentGroups.length - 1), opacity: active ? 1 : 0.55}}>
                <div style={{width: 40, height: 40, borderRadius:'50%', background: avatarColor(name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight: 700, fontSize: 12, flexShrink: 0}}>{initials(name)}</div>
                <div style={cfgStyles.rowMain}>
                  <div style={cfgStyles.rowTitle}>{name}</div>
                  <div style={cfgStyles.rowSub}>{group.kind === 'channel' ? 'canal' : 'grupo'} · {group.waJid || group.jid || 'sem JID'}</div>
                </div>
                <button type="button" onClick={() => toggleGroup(group)} aria-label={active ? 'Pausar grupo' : 'Ativar grupo'} style={{border:'none', background:'transparent', padding: 0}}>
                  <div style={cfgStyles.toggle(active)}><div style={cfgStyles.toggleKnob(active)}/></div>
                </button>
                <button type="button" onClick={() => deleteGroup(group)} disabled={actionLoading === `delete-${group.id}`} style={{border:'1px solid var(--line)', background:'transparent', borderRadius: 999, color:'var(--danger)', padding:'6px 9px', fontSize: 11, fontWeight: 700}}>
                  Remover
                </button>
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
            <div style={cfgStyles.rowTitle}>{role === 'monitor' ? 'Escolha um grupo para monitorar' : 'Escolha um grupo para publicar'}</div>
            <p style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45}}>
              A lista vem do WhatsApp conectado. Como a aba {role === 'monitor' ? 'Monitorar' : 'Publicar'} está marcada, tocar em um grupo já adiciona nessa lista.
            </p>
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
          </div>
        </div>
      )}

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
