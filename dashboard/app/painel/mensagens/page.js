'use client'

/* Mensagens — redesenho com acordeões (fiel ao screen-templates.jsx editado).
 * Mantém TODA a lógica/contrato reais: api.variationsGet + loadTemplateStore +
 * api.offerAutomations para carregar; api.variationsUpdate para salvar. As
 * variações vivem em copyVariationPoolJson { greetings, ctas, trailers } — os
 * mesmos campos do CopyVariationPoolEditor, aqui reescritos como acordeões.
 * As variáveis e os templates usam os helpers/tokens reais
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
import { usePainelHeader } from '../PainelShell'
import { WhatsAppBubble, TokenText } from '../WhatsAppBubble'
import { copyTextToClipboard } from '@/lib/clipboard'
import styles from './mensagens.module.css'

const MAX_VARIATIONS = 20

// Acordeões de variação → mapeiam direto para as chaves reais do pool.
const VARIATION_GROUPS = [
  { key: 'greetings', emoji: '🎯', nome: 'Ganchos', pos: 'vão antes da mensagem', desc: 'A primeira linha que chama atenção. Variável canônica: {{gancho}}.', placeholder: 'Ex: 🚨 COOOOOORRE QUE TÁ ACABANDO!' },
  { key: 'ctas', emoji: '📣', nome: 'CTAs', pos: 'complementam a oferta', desc: 'O texto de CTA que aparece junto da oferta. Variável canônica: {{cta}}.', placeholder: 'Ex: ⚠️ Preços e estoque podem mudar.' },
  { key: 'trailers', emoji: '🔗', nome: 'Convite do grupo', pos: 'vai depois da mensagem', desc: 'O convite do grupo usado pela variável canônica {{convitegrupo}}.', placeholder: 'Ex: 📲 Entre no nosso grupo oficial:' },
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
  usePainelHeader({ title: 'Templates de mensagens', subtitle: 'Crie templates e personalize os textos das suas ofertas' })

  const [value, setValue] = useState({ copyVariationPoolJson: '{}', copyVariationEnabled: false, brandingGroupLink: '', couponLink: '' })
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
          copyVariationEnabled: cfg.copyVariationEnabled ?? false,
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

  // storeOverride existe porque setTemplateStore é assíncrono: quem acabou de
  // aplicar um rascunho precisa gravar o store NOVO, não o que ainda está no state.
  async function handleSave(storeOverride) {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.variationsUpdate({
        copyVariationPoolJson: value.copyVariationPoolJson,
        copyVariationEnabled: value.copyVariationEnabled,
        brandingGroupLink: value.brandingGroupLink,
        couponLink: value.couponLink,
        mobileTemplatesJson: JSON.stringify(storeOverride || templateStore),
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

  // Aplica o rascunho no store E grava no mesmo clique. Antes eram dois botões
  // em sequência e o primeiro já parecia ter salvado — quem saía da tela ali
  // perdia a edição sem nenhum aviso.
  async function applyAndPersist(nextStore) {
    setTemplateStore(nextStore)
    setTemplateMode('list')
    setEditingTemplateKey(null)
    await handleSave(nextStore)
  }

  async function saveTemplate() {
    if (templateMode === 'create') {
      if (!editTemplateName.trim() || !editTemplateBody.trim()) return
      const { store } = withNewCustomTemplate(templateStore, { name: editTemplateName.trim(), body: editTemplateBody })
      await applyAndPersist(store)
      return
    }
    if (!editingTemplate || !editTemplateBody.trim()) return
    const nextStore = editingTemplate.isCustom
      ? withUpdatedCustomTemplate(templateStore, editingTemplateKey, { name: editTemplateName.trim(), body: editTemplateBody })
      : withPresetBody(templateStore, editingTemplateKey, editTemplateBody)
    await applyAndPersist(nextStore)
  }

  async function resetPresetTemplate() {
    if (!editingTemplateKey) return
    await applyAndPersist(withoutPresetBody(templateStore, editingTemplateKey))
  }

  async function deleteCustomTemplate() {
    if (!editingTemplateKey) return
    await applyAndPersist(withoutCustomTemplate(templateStore, editingTemplateKey))
  }

  if (loading) {
    return <div className="pnl-card" style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', color: 'var(--ink-soft)' }}>Carregando…</div>
  }


  const renderEditor = () => (
    <div className={styles.editor}>
      <div className={styles.editorFields}>
        <label className={styles.field}>
          <span>Nome do modelo</span>
          <input className="pnl-input" value={editTemplateName} onChange={(e) => setEditTemplateName(e.target.value)} disabled={templateMode === 'edit' && editingTemplate && !editingTemplate.isCustom} placeholder="Ex: Achadinho do dia" />
        </label>
        <label className={styles.field}>
          <span>Mensagem</span>
          <textarea ref={templateBodyRef} className={`pnl-input ${styles.templateTextarea}`} value={editTemplateBody} onChange={(e) => setEditTemplateBody(e.target.value)} rows={10} />
        </label>
        <div>
          <span className={styles.fieldLabel}>Inserir campo automático</span>
          <div className={styles.tokenRow}>
            {OFFER_TEMPLATE_VARIABLE_GROUPS.flatMap((group) => group.variables).map((variable) => (
              <button key={variable.token} type="button" className={styles.token} onClick={() => insertTemplateToken(variable.token)}>+ {variable.token}</button>
            ))}
          </div>
          <p className={styles.microcopy}>O campo entra onde estiver o cursor e é preenchido pelo robô na hora do envio.</p>
        </div>
      </div>
      <div className={styles.livePreview}>
        <span className={styles.eyebrow}>Prévia no WhatsApp</span>
        {editTemplateBody.trim() ? <WhatsAppBubble text={editTemplateBody} highlight /> : <p>Comece a escrever para ver sua mensagem.</p>}
      </div>
      <div className={styles.editorActions}>
        <button type="button" className="pnl-btn is-primary" onClick={saveTemplate} disabled={saving || !editTemplateBody.trim() || (templateMode === 'create' && !editTemplateName.trim())}>{saving ? 'Salvando…' : 'Salvar modelo'}</button>
        <button type="button" className="pnl-btn" onClick={cancelEdit}>Cancelar</button>
        {templateMode === 'edit' && editingTemplate?.isCustom && <button type="button" className="pnl-btn is-danger" onClick={deleteCustomTemplate}>Excluir</button>}
        {templateMode === 'edit' && !editingTemplate?.isCustom && editingTemplate?.isOverridden && <button type="button" className="pnl-btn" onClick={resetPresetTemplate}>Restaurar padrão</button>}
      </div>
    </div>
  )

  return (
    <main className={styles.page}>
      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}

      <header className={styles.intro}>
        <div>
          <span className={styles.kicker}>Configuração de mensagens</span>
          <h1>Seus modelos, sem complicação.</h1>
          <p>Escolha como suas ofertas chegam no WhatsApp. O robô preenche produto, preço e link para você.</p>
        </div>
        {templateMode === 'list' && <button type="button" className={`pnl-btn is-primary ${styles.newButton}`} onClick={startCreateTemplate}>+ Novo modelo</button>}
      </header>

      {templateMode === 'create' && (
        <section className={styles.editorCard}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Novo modelo</span><h2>Monte sua mensagem</h2></div></div>
          {renderEditor()}
        </section>
      )}

      <section aria-labelledby="modelos-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="modelos-title">Modelos de mensagem</h2><p>Abra um modelo para conferir a mensagem completa ou editar.</p></div>
          <span className={styles.count}>{templates.length} {templates.length === 1 ? 'modelo' : 'modelos'}</span>
        </div>
        <div className={styles.templateGrid}>
          {templates.map((template) => {
            const usage = templateUsage.get(template.key)
            const isInUse = !!usage?.enabled
            const isPausedOnly = !isInUse && !!usage?.paused
            const open = openModelo === template.key
            const isEditing = templateMode === 'edit' && editingTemplateKey === template.key
            const renderedPreview = buildRenderedOfferTemplatePreview({ template, copyVariationPoolJson: value.copyVariationPoolJson, groupInviteLink: value.brandingGroupLink, couponLink: value.couponLink })
            return (
              <article key={template.key} className={`${styles.templateCard} ${open ? styles.openCard : ''}`}>
                <button type="button" className={styles.templateSummary} aria-expanded={open} onClick={() => { if (!isEditing) setOpenModelo((current) => current === template.key ? null : template.key) }}>
                  <span className={styles.templateIcon} aria-hidden="true">✦</span>
                  <span className={styles.templateMeta}>
                    <span className={styles.templateTitle}>{template.name}</span>
                    <span className={styles.badges}>
                      {isInUse && <span className={styles.activeBadge}>Em uso</span>}
                      {isPausedOnly && <span className={styles.neutralBadge}>Pausado</span>}
                      {template.key === 'automatico_classico' && <span className={styles.neutralBadge}>Padrão</span>}
                      {template.isCustom && <span className={styles.neutralBadge}>Seu modelo</span>}
                      {template.isOverridden && <span className={styles.neutralBadge}>Editado</span>}
                    </span>
                  </span>
                  <Chevron open={open} />
                </button>
                {!open && <div className={styles.messageExcerpt}><TokenText text={template.body || ''} /></div>}
                {open && <div className={styles.templateDetails}>
                  {isEditing ? renderEditor() : <>
                    <div className={styles.previewGrid}>
                      <div><span className={styles.eyebrow}>Estrutura do modelo</span><pre className={styles.savedBody}><TokenText text={template.body || ''} /></pre></div>
                      <div className={styles.realPreview}><span className={styles.eyebrow}>Como chega para o cliente</span><WhatsAppBubble text={renderedPreview} format /></div>
                    </div>
                    <div className={styles.cardActions}>
                      <button type="button" className="pnl-btn" onClick={() => startEditTemplate(template)}>Editar modelo</button>
                      <span>{usage?.enabled ? `Usado em ${usage.enabled} automação${usage.enabled === 1 ? '' : 'ões'}` : 'Ainda não está em uma automação ativa'}</span>
                    </div>
                  </>}
                </div>}
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.automaticSection} aria-labelledby="campos-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="campos-title">Campos automáticos</h2><p>O robô troca estes atalhos pelos dados certos em cada oferta.</p></div>
        </div>
        <div className={styles.tokenRow}>
          {OFFER_TEMPLATE_VARIABLE_GROUPS.flatMap((group) => group.variables).map((variable) => (
            <button key={variable.token} type="button" className={styles.token} onClick={() => copyVar(variable.token)}><strong>{variable.token}</strong><span>{copied === variable.token ? 'copiado!' : variable.label}</span></button>
          ))}
        </div>
      </section>

      <section aria-labelledby="variacoes-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="variacoes-title">Frases que variam sozinhas</h2><p>O robô alterna entre elas para as mensagens não ficarem repetidas.</p></div>
          <label className={styles.switchLabel}>
            <span>Variar nos canais monitorados</span>
            <button type="button" role="switch" aria-checked={!!value.copyVariationEnabled} aria-label="Variar texto nos canais monitorados" disabled={saving} onClick={() => setValue((v) => ({ ...v, copyVariationEnabled: !v.copyVariationEnabled }))} className={`${styles.switch} ${value.copyVariationEnabled ? styles.switchOn : ''}`}><span /></button>
          </label>
        </div>
        <div className={styles.accordions}>
          {VARIATION_GROUPS.map((group) => {
            const items = pool[group.key]
            const open = openGrupo === group.key
            return <article key={group.key} className={styles.accordion}>
              <button type="button" className={styles.accordionSummary} aria-expanded={open} onClick={() => setOpenGrupo((current) => current === group.key ? null : group.key)}>
                <span className={styles.variationIcon}>{group.emoji}</span>
                <span><strong>{group.nome}</strong><small>{group.pos}</small></span>
                <span className={styles.count}>{items.filter(Boolean).length}</span><Chevron open={open} />
              </button>
              {open && <div className={styles.phraseEditor}>
                <p>{group.desc}</p>
                <div className={styles.phraseList}>{items.map((text, index) => <div key={index} className={styles.phraseRow}><input className="pnl-input" value={text} onChange={(e) => setItem(group.key, index, e.target.value)} placeholder={group.placeholder} disabled={saving} /><button type="button" onClick={() => removeItem(group.key, index)} aria-label="Remover frase">×</button></div>)}</div>
                <button type="button" className="pnl-btn" onClick={() => addItem(group.key)} disabled={items.length >= MAX_VARIATIONS}>+ Adicionar frase</button>
              </div>}
            </article>
          })}
        </div>
      </section>

      <details className={styles.linksCard}>
        <summary><span><strong>Links opcionais</strong><small>Convite do grupo e página de cupom</small></span><Chevron /></summary>
        <div className={styles.linksGrid}>
          <label className={styles.field}><span>Link de convite do grupo</span><input type="url" className="pnl-input" value={value.brandingGroupLink} onChange={(e) => setValue((v) => ({ ...v, brandingGroupLink: e.target.value }))} placeholder="https://chat.whatsapp.com/..." disabled={saving} /></label>
          <label className={styles.field}><span>Link de cupom</span><input type="url" className="pnl-input" value={value.couponLink} onChange={(e) => setValue((v) => ({ ...v, couponLink: e.target.value }))} placeholder="https://..." disabled={saving} /></label>
        </div>
      </details>

      <div className={styles.saveBar}>
        <div><strong>Terminou de configurar?</strong><span>Salve para aplicar nas próximas ofertas.</span></div>
        {saved && <span className={styles.saved}>✓ Tudo salvo</span>}
        <button type="button" className="pnl-btn is-primary" onClick={() => handleSave()} disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
      </div>
    </main>
  )
}
