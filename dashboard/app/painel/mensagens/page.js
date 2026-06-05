'use client'

/* Mensagens (antes "Ganchos e CTAs" / variações de texto) — reskin Menta do
 * corpo. Mesma lógica da página de dashboard original: api.variationsGet +
 * loadTemplateStore + api.offerAutomations para carregar; api.variationsUpdate
 * para salvar. Reusa os helpers de mobileTemplateStore/offerTemplatePreview e
 * embute o CopyVariationPoolEditor existente. Sem mudança no back end. */

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { CopyVariationPoolEditor } from '@/components/preservacao/CopyVariationPoolEditor'
import {
  composeTemplates,
  readLocalTemplateStore,
  loadTemplateStore,
  withPresetBody,
  withoutPresetBody,
  withNewCustomTemplate,
  withUpdatedCustomTemplate,
  withoutCustomTemplate,
} from '@/lib/mobileTemplateStore'
import { OFFER_TEMPLATE_VARIABLE_GROUPS } from '@/lib/mobileOfferComposer'
import { buildRenderedOfferTemplatePreview, summarizeAutomationTemplateUsage } from '@/lib/offerTemplatePreview'
import { usePainelHeader, PainelTopbarAction } from '../PainelShell'

export default function MensagensPage() {
  usePainelHeader({ title: 'Mensagens', subtitle: 'Ganchos, CTAs, variáveis e modelos das suas ofertas' })

  const [value, setValue] = useState({ copyVariationPoolJson: '{}', brandingGroupLink: '', couponLink: '' })
  const [templateStore, setTemplateStore] = useState(() => readLocalTemplateStore())
  const [automations, setAutomations] = useState([])
  const [templateMode, setTemplateMode] = useState('list')
  const [editingTemplateKey, setEditingTemplateKey] = useState(null)
  const [editTemplateName, setEditTemplateName] = useState('')
  const [editTemplateBody, setEditTemplateBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const templateBodyRef = useRef(null)

  const templates = composeTemplates(templateStore)
  const templateUsage = summarizeAutomationTemplateUsage(automations)
  const editingTemplate = templates.find((t) => t.key === editingTemplateKey) || null

  useEffect(() => {
    let active = true
    Promise.all([api.variationsGet(), loadTemplateStore(), api.offerAutomations().catch(() => [])])
      .then(([cfg, store, automationList]) => {
        if (!active) return
        setValue({
          copyVariationPoolJson: cfg.copyVariationPoolJson ?? '{}',
          brandingGroupLink: cfg.brandingGroupLink ?? '',
          couponLink: cfg.couponLink ?? '',
        })
        setTemplateStore(store)
        setAutomations(Array.isArray(automationList) ? automationList : [])
      })
      .catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.variationsUpdate({
        copyVariationPoolJson: value.copyVariationPoolJson,
        brandingGroupLink: value.brandingGroupLink,
        couponLink: value.couponLink,
        mobileTemplatesJson: JSON.stringify(templateStore),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function copyVariable(token) {
    try { navigator.clipboard?.writeText(token) } catch {}
  }

  function insertTemplateToken(token) {
    const textarea = templateBodyRef.current
    if (!textarea) { copyVariable(token); return }
    const start = textarea.selectionStart ?? editTemplateBody.length
    const end = textarea.selectionEnd ?? editTemplateBody.length
    const nextBody = `${editTemplateBody.slice(0, start)}${token}${editTemplateBody.slice(end)}`
    setEditTemplateBody(nextBody)
    window.setTimeout(() => {
      textarea.focus()
      const cursor = start + token.length
      textarea.setSelectionRange(cursor, cursor)
    }, 0)
  }

  function startCreateTemplate() {
    setTemplateMode('create')
    setEditingTemplateKey(null)
    setEditTemplateName('')
    setEditTemplateBody('')
  }

  function startEditTemplate(template) {
    setTemplateMode('edit')
    setEditingTemplateKey(template.key)
    setEditTemplateName(template.name)
    setEditTemplateBody(template.body || '')
  }

  function saveTemplateDraft() {
    if (templateMode === 'create') {
      if (!editTemplateName.trim() || !editTemplateBody.trim()) return
      const { store } = withNewCustomTemplate(templateStore, { name: editTemplateName.trim(), body: editTemplateBody })
      setTemplateStore(store)
      setTemplateMode('list')
      return
    }
    if (!editingTemplate || !editTemplateBody.trim()) return
    const nextStore = editingTemplate.isCustom
      ? withUpdatedCustomTemplate(templateStore, editingTemplateKey, { name: editTemplateName.trim(), body: editTemplateBody })
      : withPresetBody(templateStore, editingTemplateKey, editTemplateBody)
    setTemplateStore(nextStore)
    setTemplateMode('list')
  }

  function resetPresetTemplate() {
    if (!editingTemplateKey) return
    setTemplateStore(withoutPresetBody(templateStore, editingTemplateKey))
    setTemplateMode('list')
  }

  function deleteCustomTemplate() {
    if (!editingTemplateKey) return
    setTemplateStore(withoutCustomTemplate(templateStore, editingTemplateKey))
    setTemplateMode('list')
  }

  if (loading) {
    return <div className="pnl-card" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', color: 'var(--ink-soft)' }}>Carregando…</div>
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
      {templateMode === 'list' && (
        <PainelTopbarAction>
          <button type="button" className="pnl-btn is-primary" onClick={startCreateTemplate}>+ Novo modelo</button>
        </PainelTopbarAction>
      )}

      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}

      {/* Links */}
      <section className="pnl-card">
        <div className="pnl-card-title">Links</div>
        <p className="pnl-card-note" style={{ marginBottom: 12 }}>
          Use <code className="pnl-token" style={{ cursor: 'default' }}>{'{{grupoLink}}'}</code> e{' '}
          <code className="pnl-token" style={{ cursor: 'default' }}>{'{{cupomLink}}'}</code> nos seus ganchos e CTAs.
        </p>
        <label className="pnl-label">Link de convite do grupo</label>
        <input
          type="url"
          className="pnl-input"
          value={value.brandingGroupLink}
          onChange={(e) => setValue((v) => ({ ...v, brandingGroupLink: e.target.value }))}
          placeholder="https://chat.whatsapp.com/..."
          disabled={saving}
        />
        <label className="pnl-label" style={{ marginTop: 12 }}>Link de cupom</label>
        <input
          type="url"
          className="pnl-input"
          value={value.couponLink}
          onChange={(e) => setValue((v) => ({ ...v, couponLink: e.target.value }))}
          placeholder="https://..."
          disabled={saving}
        />
      </section>

      {/* Pool de variações (componente reusado) */}
      <section className="pnl-card">
        <CopyVariationPoolEditor
          value={value}
          onChange={(next) => setValue((v) => ({ ...v, ...next }))}
          disabled={saving}
          showPresets={false}
        />
      </section>

      {/* Variáveis dos modelos */}
      <section className="pnl-card">
        <div className="pnl-card-title">Variáveis dos modelos de oferta</div>
        <p className="pnl-card-note" style={{ marginBottom: 12 }}>
          Clique em uma variável para copiar e cole no corpo do modelo. O bot substitui no envio automático e no Gerar oferta.
        </p>
        <div className="pnl-grid">
          {OFFER_TEMPLATE_VARIABLE_GROUPS.map((group) => (
            <div key={group.key} className="pnl-subcard">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{group.title}</div>
              <p className="pnl-card-note" style={{ marginTop: 2 }}>{group.helper}</p>
              <div className="pnl-presets" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 8 }}>
                {group.variables.map((variable) => (
                  <button key={variable.token} type="button" className="pnl-token-card" onClick={() => copyVariable(variable.token)}>
                    <code>{variable.token}</code>
                    <div>{variable.label} · Ex: {variable.example}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modelos de oferta */}
      <section className="pnl-card">
        <div className="pnl-card-head">
          <div>
            <div className="pnl-card-title">Modelos de oferta</div>
            <p className="pnl-card-note" style={{ marginTop: 2 }}>Os mesmos modelos do Gerar oferta e das ofertas automáticas.</p>
          </div>
        </div>

        {templateMode === 'list' && (
          <div className="pnl-grid" style={{ marginTop: 12 }}>
            {templates.map((template) => {
              const usage = templateUsage.get(template.key)
              const isInUse = !!usage?.enabled
              const isPausedOnly = !isInUse && !!usage?.paused
              const renderedPreview = buildRenderedOfferTemplatePreview({
                template,
                copyVariationPoolJson: value.copyVariationPoolJson,
                groupInviteLink: value.brandingGroupLink,
                couponLink: value.couponLink,
              })
              return (
                <div key={template.key} className="pnl-subcard" style={isInUse ? { borderColor: 'var(--accent-strong)' } : undefined}>
                  <div className="pnl-card-head" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                        <span>{template.name}</span>
                        {isInUse && <span className="pnl-tag is-success">ativo</span>}
                        {isPausedOnly && <span className="pnl-tag is-flight">automação pausada</span>}
                        {template.key === 'automatico_classico' && <span className="pnl-tag">padrão de novas automações</span>}
                        {template.isOverridden && <span className="pnl-tag is-skip">editado</span>}
                        {template.isCustom && <span className="pnl-tag is-skip">personalizado</span>}
                      </div>
                      {usage ? (
                        <p className="pnl-card-note" style={{ marginTop: 4 }}>
                          {usage.enabled ? `Em uso em ${usage.enabled} automação${usage.enabled === 1 ? '' : 'ões'} ativa${usage.enabled === 1 ? '' : 's'}` : 'Nenhuma automação ativa usando este modelo'}
                          {usage.paused ? ` · ${usage.paused} pausada${usage.paused === 1 ? '' : 's'}` : ''}
                          {usage.groups.length ? ` · ${usage.groups.join(', ')}` : ''}
                        </p>
                      ) : (
                        <p className="pnl-card-note" style={{ marginTop: 4 }}>Ainda não foi selecionado em nenhuma automação salva.</p>
                      )}
                    </div>
                    <button type="button" className="pnl-link-btn" onClick={() => startEditTemplate(template)}>Editar</button>
                  </div>

                  <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 12 }}>
                    <div className="pnl-subcard">
                      <p className="pnl-eyebrow">Corpo salvo do modelo</p>
                      <pre className="pnl-pre">{template.body || ''}</pre>
                    </div>
                    <div className="pnl-subcard" style={{ borderColor: 'var(--accent-strong)' }}>
                      <p className="pnl-eyebrow" style={{ color: 'var(--accent-strong)' }}>Prévia real enviada pelo bot</p>
                      <p className="pnl-card-note" style={{ marginTop: 2 }}>Inclui gancho, CTA, aviso final e links variáveis quando configurados.</p>
                      <pre className="pnl-pre" style={{ color: 'var(--ink)', maxHeight: 260 }}>{renderedPreview}</pre>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {(templateMode === 'edit' || templateMode === 'create') && (
          <div className="pnl-subcard" style={{ marginTop: 12, borderColor: 'var(--accent-strong)' }}>
            <label className="pnl-label">Nome do modelo</label>
            <input
              className="pnl-input"
              value={editTemplateName}
              onChange={(e) => setEditTemplateName(e.target.value)}
              disabled={templateMode === 'edit' && editingTemplate && !editingTemplate.isCustom}
              placeholder="Ex: Oferta especial"
            />
            <label className="pnl-label" style={{ marginTop: 12 }}>Corpo da mensagem</label>
            <p className="pnl-card-note" style={{ marginBottom: 6 }}>
              Posicione <code className="pnl-token" style={{ cursor: 'default' }}>{'{{gancho}}'}</code>, <code className="pnl-token" style={{ cursor: 'default' }}>{'{{cta}}'}</code> e <code className="pnl-token" style={{ cursor: 'default' }}>{'{{convitegrupo}}'}</code> onde quiser. Se apagar um deles, o bot não envia aquele bloco.
            </p>
            <textarea
              ref={templateBodyRef}
              className="pnl-input"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.5 }}
              value={editTemplateBody}
              onChange={(e) => setEditTemplateBody(e.target.value)}
              rows={9}
            />
            <div className="pnl-subcard" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Inserir variáveis no ponto do cursor</div>
              <p className="pnl-card-note" style={{ marginTop: 2, marginBottom: 8 }}>
                Para remover gancho, CTA ou fechamento da mensagem, apague o respectivo token do corpo do modelo.
              </p>
              {OFFER_TEMPLATE_VARIABLE_GROUPS.map((group) => (
                <div key={group.key} style={{ marginBottom: 8 }}>
                  <div className="pnl-eyebrow" style={{ marginBottom: 4 }}>{group.title}</div>
                  <div className="pnl-tokens">
                    {group.variables.map((variable) => (
                      <button key={variable.token} type="button" className="pnl-token" onClick={() => insertTemplateToken(variable.token)}>+ {variable.token}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pnl-toolbar" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="pnl-btn is-primary" onClick={saveTemplateDraft} disabled={!editTemplateBody.trim() || (templateMode === 'create' && !editTemplateName.trim())}>Salvar modelo</button>
              <button type="button" className="pnl-btn" onClick={() => setTemplateMode('list')}>Cancelar</button>
              {templateMode === 'edit' && editingTemplate?.isCustom && (
                <button type="button" className="pnl-btn is-danger" onClick={deleteCustomTemplate}>Excluir modelo</button>
              )}
              {templateMode === 'edit' && !editingTemplate?.isCustom && editingTemplate?.isOverridden && (
                <button type="button" className="pnl-btn" onClick={resetPresetTemplate}>Restaurar padrão</button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Salvar */}
      <div className="pnl-toolbar">
        <button type="button" className="pnl-btn is-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar variações e modelos'}
        </button>
        {saved && <span className="pnl-tag is-success">✓ Salvo!</span>}
      </div>
    </div>
  )
}
