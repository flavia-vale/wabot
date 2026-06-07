'use client'

/* Mensagens — redesenho com acordeões (fiel ao screen-templates.jsx editado).
 * Mantém TODA a lógica/contrato reais: api.variationsGet + loadTemplateStore +
 * api.offerAutomations para carregar; api.variationsUpdate para salvar. As
 * variações vivem em copyVariationPoolJson { greetings, ctas, trailers } — os
 * mesmos campos do CopyVariationPoolEditor, aqui reescritos como acordeões.
 * As variáveis e os modelos usam os helpers/tokens reais
 * (mobileOfferComposer / mobileTemplateStore / offerTemplatePreview).
 * Sem mudança no back end. */

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
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
import { WhatsAppBubble, TokenText } from '../WhatsAppBubble'
import { copyTextToClipboard } from '@/lib/clipboard'

const MAX_VARIATIONS = 20

// Acordeões de variação → mapeiam direto para as chaves reais do pool.
const VARIATION_GROUPS = [
  { key: 'greetings', emoji: '🎯', nome: 'Ganchos', pos: 'vão antes da mensagem', desc: 'A primeira linha que chama atenção. Variável canônica: {{gancho}}.', placeholder: 'Ex: 🚨 COOOOOORRE QUE TÁ ACABANDO!' },
  { key: 'ctas', emoji: '📣', nome: 'CTAs', pos: 'convidam pro grupo', desc: 'A chamada para ação que aparece junto da oferta. Variável canônica: {{cta}}.', placeholder: 'Ex: 📲 Entre no nosso grupo oficial:' },
  { key: 'trailers', emoji: '🔗', nome: 'Convite do grupo', pos: 'vai depois da mensagem', desc: 'O convite ou aviso final usado pela variável canônica {{convitegrupo}}.', placeholder: 'Ex: ⚠️ Preços e estoque podem mudar.' },
]

function parsePool(json) {
  try {
    const p = JSON.parse(json || '{}')
    return {
      greetings: Array.isArray(p.greetings) ? p.greetings : [''],
      ctas: Array.isArray(p.ctas) ? p.ctas : [''],
      trailers: Array.isArray(p.trailers) ? p.trailers : [''],
    }
  } catch {
    return { greetings: [''], ctas: [''], trailers: [''] }
  }
}

function Chevron({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s', color: 'var(--ink-soft)', flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function MensagensPage() {
  usePainelHeader({ title: 'Templates, ganchos e CTA', subtitle: 'Templates, ganchos, CTAs e variáveis das suas ofertas' })

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

  const [openGrupo, setOpenGrupo] = useState('greetings')
  const [openModelo, setOpenModelo] = useState(null)
  const [copied, setCopied] = useState(null)

  const templates = composeTemplates(templateStore)
  const templateUsage = summarizeAutomationTemplateUsage(automations)
  const editingTemplate = templates.find((t) => t.key === editingTemplateKey) || null
  const pool = parsePool(value.copyVariationPoolJson)

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

  function writePool(next) {
    setValue((v) => ({ ...v, copyVariationPoolJson: JSON.stringify(next) }))
  }
  function setItem(key, idx, text) {
    writePool({ ...pool, [key]: pool[key].map((t, i) => (i === idx ? text : t)) })
  }
  function addItem(key) {
    if (pool[key].length >= MAX_VARIATIONS) return
    writePool({ ...pool, [key]: [...pool[key], ''] })
  }
  function removeItem(key, idx) {
    const next = pool[key].filter((_, i) => i !== idx)
    writePool({ ...pool, [key]: next.length ? next : [''] })
  }

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

  async function copyVar(token) {
    setError('')
    try {
      const ok = await copyTextToClipboard(token)
      if (!ok) throw new Error('clipboard indisponível')
      setCopied(token)
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1100)
    } catch {
      setCopied(null)
      setError('Não foi possível copiar automaticamente. Selecione a variável e copie manualmente.')
    }
  }

  function insertTemplateToken(token) {
    const textarea = templateBodyRef.current
    if (!textarea) { copyVar(token); return }
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
    setOpenModelo(template.key)
  }

  function cancelEdit() {
    setTemplateMode('list')
    setEditingTemplateKey(null)
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
    return <div className="pnl-card" style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', color: 'var(--ink-soft)' }}>Carregando…</div>
  }

  const [dadosGroup, blocosGroup] = OFFER_TEMPLATE_VARIABLE_GROUPS

  // Editor de modelo reutilizado (create + edit dentro do acordeão)
  const renderEditor = () => (
    <div className="pnl-grid">
      <div>
        <label className="pnl-label">Nome do modelo</label>
        <input
          className="pnl-input"
          value={editTemplateName}
          onChange={(e) => setEditTemplateName(e.target.value)}
          disabled={templateMode === 'edit' && editingTemplate && !editingTemplate.isCustom}
          placeholder="Ex: Oferta especial"
        />
      </div>
      <div>
        <label className="pnl-label">Corpo da mensagem</label>
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
      </div>
      {editTemplateBody.trim() && (
        <div>
          <p className="pnl-eyebrow" style={{ color: 'var(--accent-strong)', marginBottom: 6 }}>Prévia ao vivo</p>
          <WhatsAppBubble text={editTemplateBody} highlight />
        </div>
      )}
      <div className="pnl-subcard">
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Inserir variáveis no ponto do cursor</div>
        <p className="pnl-card-note" style={{ marginTop: 2, marginBottom: 8 }}>Para remover gancho, CTA ou convite do grupo, apague o token do corpo.</p>
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
      <div className="pnl-toolbar" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="pnl-btn is-primary" onClick={saveTemplateDraft} disabled={!editTemplateBody.trim() || (templateMode === 'create' && !editTemplateName.trim())}>Salvar modelo</button>
        <button type="button" className="pnl-btn" onClick={cancelEdit}>Cancelar</button>
        {templateMode === 'edit' && editingTemplate?.isCustom && (
          <button type="button" className="pnl-btn is-danger" onClick={deleteCustomTemplate}>Excluir modelo</button>
        )}
        {templateMode === 'edit' && !editingTemplate?.isCustom && editingTemplate?.isOverridden && (
          <button type="button" className="pnl-btn" onClick={resetPresetTemplate}>Restaurar padrão</button>
        )}
      </div>
    </div>
  )

  return (
    <div className="pnl-grid" style={{ maxWidth: 860, margin: '0 auto' }}>
      {templateMode === 'list' && (
        <PainelTopbarAction>
          <button type="button" className="pnl-btn is-primary" onClick={startCreateTemplate}>+ Novo modelo</button>
        </PainelTopbarAction>
      )}

      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}

      {/* Anatomia — como o bot monta a mensagem */}
      <section className="pnl-card" style={{ background: 'color-mix(in oklab, var(--accent) 11%, var(--surface))', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginRight: 4 }}>Como o bot monta cada envio:</span>
        {['Gancho', 'Corpo do modelo', 'CTA + grupo', 'Fechamento'].map((t, i, a) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 11px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', color: i === 1 ? 'var(--ink)' : 'var(--accent-strong)' }}>{t}</span>
            {i < a.length - 1 && <span style={{ color: 'var(--ink-faint)' }}>→</span>}
          </span>
        ))}
        <span style={{ fontSize: 12, color: 'var(--ink-soft)', flexBasis: '100%', marginTop: 2 }}>
          O modelo é o esqueleto; as variações entram nos blocos <b style={{ fontWeight: 600 }}>{'{{gancho}}'}</b>, <b style={{ fontWeight: 600 }}>{'{{cta}}'}</b> e <b style={{ fontWeight: 600 }}>{'{{convitegrupo}}'}</b> — sorteadas a cada envio pra nunca repetir.
        </span>
      </section>

      {/* 1 · Variações de texto */}
      <section>
        <div className="pnl-card-title" style={{ fontSize: 15 }}>🎲 Variações de texto</div>
        <p className="pnl-card-note" style={{ marginBottom: 12 }}>Pedacinhos que o bot intercala em cada envio, pra nenhuma mensagem sair 100% igual. Quanto mais variações, mais natural.</p>
        <div className="pnl-grid">
          {VARIATION_GROUPS.map((g) => {
            const items = pool[g.key]
            const open = openGrupo === g.key
            return (
              <div key={g.key} className="pnl-card" style={{ padding: 0, overflow: 'hidden' }}>
                <button type="button" onClick={() => setOpenGrupo((o) => (o === g.key ? null : g.key))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{g.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{g.nome}</span>
                      <span className="pnl-hint">{g.pos}</span>
                    </span>
                    {!open && (
                      <span className="pnl-card-note" style={{ display: 'block', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>
                        {items.filter(Boolean).slice(0, 3).join('  ·  ') || 'sem variações ainda'}{items.filter(Boolean).length > 3 ? ' …' : ''}
                      </span>
                    )}
                  </span>
                  <span className="pnl-tag is-skip" style={{ fontVariantNumeric: 'tabular-nums' }}>{items.length} / {MAX_VARIATIONS}</span>
                  <Chevron open={open} />
                </button>
                {open && (
                  <div style={{ padding: '4px 18px 18px' }}>
                    <p className="pnl-card-note" style={{ marginBottom: 12 }}>{g.desc} Deixar uma em branco é proposital — às vezes sai sem complemento.</p>
                    <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                      {items.map((text, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input className="pnl-input" value={text} onChange={(e) => setItem(g.key, idx, e.target.value)} placeholder={g.placeholder} disabled={saving} style={{ fontSize: 13 }} />
                          <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)', flexShrink: 0 }} onClick={() => removeItem(g.key, idx)} aria-label="Remover variação" title="Remover">✕</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="pnl-btn" style={{ marginTop: 12, borderStyle: 'dashed', color: 'var(--accent-strong)' }} onClick={() => addItem(g.key)} disabled={items.length >= MAX_VARIATIONS}>
                      + Adicionar variação
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 2 · Links */}
      <section className="pnl-card">
        <div className="pnl-card-title">Links</div>
        <p className="pnl-card-note" style={{ marginBottom: 12 }}>
          Use <code className="pnl-token" style={{ cursor: 'default' }}>{'{{grupoLink}}'}</code> e{' '}
          <code className="pnl-token" style={{ cursor: 'default' }}>{'{{cupomLink}}'}</code> nos seus ganchos e CTAs.
        </p>
        <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <div>
            <label className="pnl-label">Link de convite do grupo</label>
            <input type="url" className="pnl-input" value={value.brandingGroupLink} onChange={(e) => setValue((v) => ({ ...v, brandingGroupLink: e.target.value }))} placeholder="https://chat.whatsapp.com/..." disabled={saving} />
          </div>
          <div>
            <label className="pnl-label">Link de cupom</label>
            <input type="url" className="pnl-input" value={value.couponLink} onChange={(e) => setValue((v) => ({ ...v, couponLink: e.target.value }))} placeholder="https://..." disabled={saving} />
          </div>
        </div>
      </section>

      {/* 3 · Variáveis */}
      <section className="pnl-card">
        <div className="pnl-card-title">Variáveis dos modelos</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Clique para copiar e cole no corpo do modelo. O bot substitui no envio automático e no Criar oferta.</p>
        <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {[
            { group: dadosGroup, dot: 'var(--accent-strong)', note: 'preenchidas com o produto' },
            { group: blocosGroup, dot: 'var(--success)', note: 'sorteadas das variações' },
          ].filter((c) => c.group).map(({ group, dot, note }) => (
            <div key={group.key}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: dot, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: dot }} /> {group.title}
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-faint)' }}>— {note}</span>
              </div>
              <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {group.variables.map((variable) => {
                  const isCopied = copied === variable.token
                  return (
                    <button key={variable.token} type="button" className="pnl-token-card" onClick={() => copyVar(variable.token)} style={isCopied ? { borderColor: 'var(--accent-strong)', background: 'color-mix(in oklab, var(--success) 12%, var(--surface))' } : undefined}>
                      <code>{variable.token}</code>
                      <div>{isCopied ? '✓ copiado' : variable.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · Modelos de oferta */}
      <section>
        <div className="pnl-card-title" style={{ fontSize: 15 }}>Modelos de oferta</div>
        <p className="pnl-card-note" style={{ marginBottom: 12 }}>Os mesmos modelos do Criar oferta e das ofertas automáticas.</p>

        {templateMode === 'create' && (
          <div className="pnl-card" style={{ borderColor: 'var(--accent-strong)', marginBottom: 14 }}>
            <div className="pnl-card-title" style={{ marginBottom: 12 }}>Novo modelo</div>
            {renderEditor()}
          </div>
        )}

        <div className="pnl-grid">
          {templates.map((template) => {
            const usage = templateUsage.get(template.key)
            const isInUse = !!usage?.enabled
            const isPausedOnly = !isInUse && !!usage?.paused
            const open = openModelo === template.key
            const isEditing = templateMode === 'edit' && editingTemplateKey === template.key
            const renderedPreview = buildRenderedOfferTemplatePreview({
              template,
              copyVariationPoolJson: value.copyVariationPoolJson,
              groupInviteLink: value.brandingGroupLink,
              couponLink: value.couponLink,
            })
            return (
              <div key={template.key} className="pnl-card" style={{ padding: 0, overflow: 'hidden', borderColor: open ? 'var(--accent-strong)' : 'var(--line)' }}>
                <button type="button" onClick={() => { if (isEditing) return; setOpenModelo((o) => (o === template.key ? null : template.key)) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: isInUse ? 'color-mix(in oklab, var(--accent) 20%, var(--surface))' : 'var(--bg-soft)', color: 'var(--accent-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{template.name}</span>
                      {isInUse && <span className="pnl-tag is-success">● ativo</span>}
                      {isPausedOnly && <span className="pnl-tag is-flight">automação pausada</span>}
                      {template.key === 'automatico_classico' && <span className="pnl-tag is-skip">padrão</span>}
                      {template.isOverridden && <span className="pnl-tag is-skip">editado</span>}
                      {template.isCustom && <span className="pnl-tag is-skip">personalizado</span>}
                    </span>
                    <span className="pnl-card-note" style={{ display: 'block', marginTop: 3 }}>
                      {usage?.enabled ? `Em uso em ${usage.enabled} automação${usage.enabled === 1 ? '' : 'ões'} ativa${usage.enabled === 1 ? '' : 's'}` : 'Nenhuma automação ativa usando este modelo'}
                      {usage?.paused ? ` · ${usage.paused} pausada${usage.paused === 1 ? '' : 's'}` : ''}
                    </span>
                  </span>
                  {!isEditing && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-strong)' }}>{open ? 'Fechar' : 'Abrir'}</span>}
                  {!isEditing && <Chevron open={open} />}
                </button>

                {open && (
                  <div style={{ padding: '0 18px 18px' }}>
                    {isEditing ? (
                      renderEditor()
                    ) : (
                      <>
                        <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                          <div className="pnl-subcard">
                            <p className="pnl-eyebrow">Corpo salvo do modelo</p>
                            <pre className="pnl-pre"><TokenText text={template.body || ''} /></pre>
                          </div>
                          <div className="pnl-subcard" style={{ borderColor: 'var(--accent-strong)' }}>
                            <p className="pnl-eyebrow" style={{ color: 'var(--accent-strong)' }}>Prévia real enviada pelo bot</p>
                            <p className="pnl-card-note" style={{ marginTop: 2, marginBottom: 8 }}>com gancho, CTA e convite do grupo já sorteados</p>
                            <WhatsAppBubble text={renderedPreview} format />
                          </div>
                        </div>
                        <button type="button" className="pnl-btn is-primary" style={{ marginTop: 12 }} onClick={() => startEditTemplate(template)}>Editar modelo</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
