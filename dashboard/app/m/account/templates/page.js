'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { OFFER_TEMPLATE_VARIABLE_GROUPS } from '@/lib/mobileOfferComposer'
import {
  composeTemplates,
  readLocalTemplateStore,
  loadTemplateStore,
  persistTemplateStore,
  withPresetBody,
  withoutPresetBody,
  withNewCustomTemplate,
  withUpdatedCustomTemplate,
  withoutCustomTemplate,
} from '@/lib/mobileTemplateStore'

export default function TemplatesPage() {
  useMobileRoutePerf('m/account/templates')
  const router = useRouter()
  const [store, setStore] = useState(() => readLocalTemplateStore())
  const [mode, setMode] = useState('list')
  const [editingKey, setEditingKey] = useState(null)
  const [editName, setEditName] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const templates = composeTemplates(store)
  const editingTemplate = templates.find((t) => t.key === editingKey) || null

  // Reconcilia com o servidor após o render inicial (que usa o cache local).
  useEffect(() => {
    let active = true
    loadTemplateStore()
      .then((serverStore) => { if (active) setStore(serverStore) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Aplica a mutação de forma otimista e persiste no servidor em seguida.
  async function commit(nextStore) {
    const previous = store
    setStore(nextStore)
    setMode('list')
    setSaving(true)
    setSaveError('')
    try {
      await persistTemplateStore(nextStore)
    } catch {
      setStore(previous)
      setSaveError('Não foi possível salvar no servidor. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(template) {
    setEditingKey(template.key)
    setEditName(template.name)
    setEditBody(template.body || '')
    setSaveError('')
    setMode('edit')
  }

  function startCreate() {
    setEditingKey(null)
    setEditName('')
    setEditBody('')
    setSaveError('')
    setMode('create')
  }

  function handleSave() {
    if (mode === 'create') {
      if (!editName.trim() || !editBody.trim()) return
      const { store: nextStore } = withNewCustomTemplate(store, { name: editName.trim(), body: editBody })
      commit(nextStore)
    } else if (editingKey && editingTemplate) {
      const nextStore = editingTemplate.isCustom
        ? withUpdatedCustomTemplate(store, editingKey, { name: editName.trim(), body: editBody })
        : withPresetBody(store, editingKey, editBody)
      commit(nextStore)
    }
  }

  function handleReset() {
    if (editingKey) commit(withoutPresetBody(store, editingKey))
  }

  function handleDelete() {
    if (editingKey && editingTemplate?.isCustom) commit(withoutCustomTemplate(store, editingKey))
  }

  const canSave = mode === 'create' ? editName.trim() && editBody.trim() : editBody.trim()

  if (mode === 'edit' || mode === 'create') {
    const isPreset = editingTemplate && !editingTemplate.isCustom
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={cfgStyles.pageH}>
          <button type="button" onClick={() => setMode('list')} style={{ background: 'none', border: 'none', padding: '0 0 6px', fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ← Voltar
          </button>
          <div style={cfgStyles.pageTitle}>{mode === 'create' ? 'Novo modelo' : 'Editar modelo'}</div>
        </div>

        <div style={cfgStyles.cardWrap}>
          <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 14 }}>
            <label>
              <div style={cfgStyles.label}>Nome do modelo</div>
              <input
                style={{ ...cfgStyles.field, opacity: isPreset ? 0.6 : 1 }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Oferta especial..."
                disabled={!!isPreset}
              />
            </label>
            <label>
              <div style={cfgStyles.label}>Corpo da mensagem</div>
              <textarea
                style={{ ...cfgStyles.field, minHeight: 200, resize: 'none', whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.6 }}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
            </label>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Variáveis disponíveis</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {OFFER_TEMPLATE_VARIABLE_GROUPS.map((group) => (
                  <div key={group.key}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>{group.title}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {group.variables.map((v) => (
                        <span key={v.token} style={cfgStyles.pill('neutral')}>{v.token}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px 24px', display: 'grid', gap: 8 }}>
          <button type="button" onClick={handleSave} disabled={!canSave || saving} style={{ ...mobi.btn('accent', true), opacity: (canSave && !saving) ? 1 : 0.5 }}>{saving ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" onClick={() => setMode('list')} style={mobi.btn('ghost', true)}>Cancelar</button>
          {editingTemplate?.isCustom && (
            <button type="button" onClick={handleDelete} style={{ ...mobi.btn('ghost', true), color: 'var(--danger)', borderColor: 'transparent' }}>Excluir modelo</button>
          )}
          {isPreset && editingTemplate?.isOverridden && (
            <button type="button" onClick={handleReset} style={{ ...mobi.btn('ghost', true), color: 'var(--ink-soft)', borderColor: 'transparent' }}>Restaurar padrão</button>
          )}
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Conta</div>
        <div style={cfgStyles.pageTitle}>Modelos</div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <button type="button" onClick={startCreate} style={mobi.btn('accent', true)}>+ Criar novo modelo</button>
      </div>

      {saveError && (
        <div style={{ margin: '10px 16px 0', padding: '10px 12px', borderRadius: 12, background: 'color-mix(in oklab, var(--danger) 10%, var(--surface))', border: '1px solid color-mix(in oklab, var(--danger) 25%, var(--line))', fontSize: 12.5, color: 'var(--danger)' }}>
          {saveError}
        </div>
      )}

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.card, overflow: 'hidden' }}>
          {templates.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-soft)' }}>Carregando modelos...</div>
          )}
          {templates.map((template, index) => (
            <div key={template.key} style={{ ...cfgStyles.row(index === templates.length - 1), gap: 10 }}>
              <div style={cfgStyles.rowMain}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={cfgStyles.rowTitle}>{template.name}</div>
                  {template.isOverridden && <span style={cfgStyles.pill('neutral')}>editado</span>}
                  {template.isCustom && <span style={cfgStyles.pill('neutral')}>personalizado</span>}
                </div>
                <div style={cfgStyles.rowSub}>{(template.body || '').replace(/\n/g, ' · ').slice(0, 70)}</div>
              </div>
              <button type="button" onClick={() => startEdit(template)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Editar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px 0', fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        Os modelos padrão podem ser editados. Seus modelos ficam salvos na sua conta e sincronizam entre celular e computador.
      </div>

      <div style={{ padding: '18px 16px 24px', display: 'grid', gap: 8 }}>
        <button type="button" onClick={() => router.push(mobileRoutes.offer)} style={mobi.btn('accent', true)}>Usar em uma oferta</button>
        <button type="button" onClick={() => router.push(mobileRoutes.accountVariations)} style={mobi.btn('ghost', true)}>Editar ganchos/CTAs globais</button>
      </div>
    </MobileShell>
  )
}
