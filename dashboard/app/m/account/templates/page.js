'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'

const presetTemplates = [
  {
    key: 'achadinho',
    name: 'Achadinho ✨',
    body: '✨ Achadinho do dia\n\n{produto}\n\nPor *{preço}*\n\n👉 {link}',
  },
  {
    key: 'relampago',
    name: 'Relâmpago ⚡',
    body: '⚡ Oferta relâmpago\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  },
  {
    key: 'tech',
    name: 'Tech 🔌',
    body: '🔌 Achado tech\n\n{produto}\n\nPreço: *{preço}*\n\n👉 {link}',
  },
  {
    key: 'beleza',
    name: 'Beleza 💄',
    body: '💄 Oferta de beleza\n\n{produto}\n\nHoje por *{preço}*\n\n👉 {link}',
  },
]

function normalizeTemplates(config = {}) {
  const messageTemplates = Array.isArray(config.messageTemplates) ? config.messageTemplates : []
  if (messageTemplates.length > 0) return messageTemplates
  return presetTemplates
}

export default function TemplatesPage() {
  useMobileRoutePerf('m/account/templates')
  const router = useRouter()
  const [config, setConfig] = useState(null)
  const [messageTemplates, setMessageTemplates] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const loadedConfig = await api.getConfig()
        if (!active) return
        const templates = normalizeTemplates(loadedConfig || {})
        setConfig(loadedConfig || {})
        setMessageTemplates(templates)
        setSelectedKey(templates[0]?.key || '')
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar modelos.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  function updateTemplate(key, field, value) {
    setFeedback('')
    setMessageTemplates((current) => current.map((template) => template.key === key ? { ...template, [field]: value } : template))
  }

  function addTemplate() {
    const key = `modelo-${Date.now()}`
    setMessageTemplates((current) => [...current, { key, name: 'Novo modelo', body: '✨ {produto}\n\n👉 {link}' }])
    setSelectedKey(key)
  }

  async function saveTemplates() {
    setSaving(true)
    setError('')
    setFeedback('')
    try {
      const nextConfig = { ...(config || {}), messageTemplates }
      const saved = await api.saveConfig(nextConfig)
      setConfig(saved || nextConfig)
      setFeedback('Modelos salvos no backoffice.')
    } catch (e) {
      setError(e.message || 'Não foi possível salvar modelos.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando modelos..." /></div>
      </MobileShell>
    )
  }
  if (error && !config) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  const selected = messageTemplates.find((template) => template.key === selectedKey) || messageTemplates[0]

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Conta</div>
        <div style={cfgStyles.pageTitle}>Modelos</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        Edite os modelos usados na criação de ofertas. Eles são salvos em <code>messageTemplates</code> na configuração da conta.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {messageTemplates.map((template, index) => (
            <button key={template.key} type="button" onClick={() => setSelectedKey(template.key)} style={cfgStyles.rowButton(index === messageTemplates.length - 1, selectedKey === template.key)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{template.name}</div>
                <div style={cfgStyles.rowSub}>{String(template.body || '').slice(0, 72)}</div>
              </div>
              <MobileIcon name="arrow" size={14}/>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div style={cfgStyles.cardWrap}>
          <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
            <label style={{display:'grid', gap: 6}}>
              <span style={cfgStyles.label}>Nome do modelo</span>
              <input style={cfgStyles.field} value={selected.name || ''} onChange={(event) => updateTemplate(selected.key, 'name', event.target.value)} />
            </label>
            <label style={{display:'grid', gap: 6}}>
              <span style={cfgStyles.label}>Mensagem</span>
              <textarea style={{...cfgStyles.field, minHeight: 180, fontFamily:"'JetBrains Mono', monospace", fontSize: 12}} value={selected.body || ''} onChange={(event) => updateTemplate(selected.key, 'body', event.target.value)} />
            </label>
            <div style={{display:'flex', gap: 6, flexWrap:'wrap'}}>
              {['{produto}', '{preço}', '{preço_de}', '{link}', '{loja}'].map((variable) => <span key={variable} style={cfgStyles.pill('neutral')}>{variable}</span>)}
            </div>
          </div>
        </div>
      )}

      <div style={{padding:'18px 16px 24px', display:'grid', gap: 8}}>
        <button type="button" onClick={addTemplate} style={{...mobi.btn('ghost', true)}}><MobileIcon name="plus" size={14}/> Criar novo modelo</button>
        <button type="button" onClick={saveTemplates} disabled={saving} style={{...mobi.btn('primary', true), opacity: saving ? 0.65 : 1}}>{saving ? 'Salvando...' : 'Salvar modelos'}</button>
        <button type="button" onClick={() => router.push(mobileRoutes.offer)} style={{...mobi.btn('accent', true)}}>Usar em uma oferta</button>
        {feedback && <div style={{fontSize: 12, color:'var(--success)'}}>{feedback}</div>}
        {error && <div style={{fontSize: 12, color:'var(--danger)'}}>{error}</div>}
      </div>
    </MobileShell>
  )
}
