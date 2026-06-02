'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
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

export default function VariacoesDeTextoPage() {
  const [value, setValue] = useState({
    copyVariationPoolJson: '{}',
    brandingGroupLink: '',
    couponLink: '',
  })
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

  const templates = composeTemplates(templateStore)
  const templateUsage = summarizeAutomationTemplateUsage(automations)
  const editingTemplate = templates.find(t => t.key === editingTemplateKey) || null

  useEffect(() => {
    let active = true
    Promise.all([
      api.variationsGet(),
      loadTemplateStore(),
      api.offerAutomations().catch(() => []),
    ])
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
      .catch(err => { if (active) setError(err.message) })
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

  if (loading) return <LoadingState />

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ganchos e CTAs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure variações de texto, modelos e variáveis para suas ofertas automáticas e para o Gerar oferta.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Links</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Use <code className="bg-gray-100 px-1 rounded">{'{{grupoLink}}'}</code> e{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{cupomLink}}'}</code> nos seus ganchos e CTAs.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link de convite do grupo</label>
          <input
            type="url"
            value={value.brandingGroupLink}
            onChange={e => setValue(v => ({ ...v, brandingGroupLink: e.target.value }))}
            placeholder="https://chat.whatsapp.com/..."
            disabled={saving}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link de cupom</label>
          <input
            type="url"
            value={value.couponLink}
            onChange={e => setValue(v => ({ ...v, couponLink: e.target.value }))}
            placeholder="https://..."
            disabled={saving}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
        </div>
      </div>

      <CopyVariationPoolEditor
        value={value}
        onChange={next => setValue(v => ({ ...v, ...next }))}
        disabled={saving}
        showPresets={false}
      />

      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Variáveis dos modelos de oferta</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Clique em uma variável para copiar e cole no corpo do modelo. O bot substitui no envio automático e no Gerar oferta.
          </p>
        </div>
        <div className="space-y-3">
          {OFFER_TEMPLATE_VARIABLE_GROUPS.map(group => (
            <div key={group.key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <div className="text-xs font-semibold text-gray-700">{group.title}</div>
              <p className="text-[11px] text-gray-500 mt-0.5">{group.helper}</p>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                {group.variables.map(variable => (
                  <button
                    key={variable.token}
                    type="button"
                    onClick={() => copyVariable(variable.token)}
                    className="text-left rounded-lg border bg-white px-3 py-2 hover:bg-gray-50"
                  >
                    <code className="text-green-700 font-semibold">{variable.token}</code>
                    <div className="text-xs text-gray-500">{variable.label} · Ex: {variable.example}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Modelos de oferta</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Estes são os mesmos modelos do Gerar oferta e agora também das ofertas automáticas.
            </p>
          </div>
          {templateMode === 'list' && (
            <button type="button" onClick={startCreateTemplate} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold">
              + Novo modelo
            </button>
          )}
        </div>

        {templateMode === 'list' && templates.map(template => {
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
            <div
              key={template.key}
              className={`rounded-xl border px-3 py-3 ${isInUse ? 'border-green-200 bg-green-50/50 shadow-sm' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-semibold text-gray-800 flex flex-wrap items-center gap-2">
                    <span>{template.name}</span>
                    {isInUse && <span className="text-[10px] rounded-full bg-green-600 px-2 py-0.5 font-bold uppercase tracking-wide text-white">ativo</span>}
                    {isPausedOnly && <span className="text-[10px] rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">usado em automação pausada</span>}
                    {template.key === 'automatico_classico' && <span className="text-[10px] rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">padrão de novas automações</span>}
                    {template.isOverridden && <span className="text-[10px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">editado</span>}
                    {template.isCustom && <span className="text-[10px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">personalizado</span>}
                  </div>
                  {usage ? (
                    <p className="text-xs text-gray-600">
                      {usage.enabled ? `Em uso em ${usage.enabled} automação${usage.enabled === 1 ? '' : 'ões'} ativa${usage.enabled === 1 ? '' : 's'}` : 'Nenhuma automação ativa usando este modelo'}
                      {usage.paused ? ` · ${usage.paused} pausada${usage.paused === 1 ? '' : 's'}` : ''}
                      {usage.groups.length ? ` · ${usage.groups.join(', ')}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Ainda não foi selecionado em nenhuma automação salva.</p>
                  )}
                </div>
                <button type="button" onClick={() => startEditTemplate(template)} className="shrink-0 text-xs text-green-700 font-semibold hover:underline">
                  Editar
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Corpo salvo do modelo</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-gray-600">{template.body || ''}</pre>
                </div>
                <div className="rounded-lg border border-green-100 bg-white p-3 ring-1 ring-green-50">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-green-700">Prévia real enviada pelo bot</p>
                  <p className="mt-1 text-[11px] text-gray-500">Inclui gancho, CTA, aviso final e links variáveis quando configurados.</p>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-gray-800">{renderedPreview}</pre>
                </div>
              </div>
            </div>
          )
        })}

        {(templateMode === 'edit' || templateMode === 'create') && (
          <div className="space-y-3 rounded-lg border border-green-100 bg-green-50/40 p-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do modelo</label>
              <input
                value={editTemplateName}
                onChange={e => setEditTemplateName(e.target.value)}
                disabled={templateMode === 'edit' && editingTemplate && !editingTemplate.isCustom}
                placeholder="Ex: Oferta especial"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Corpo da mensagem</label>
              <textarea
                value={editTemplateBody}
                onChange={e => setEditTemplateBody(e.target.value)}
                rows={9}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono leading-5 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="space-y-2">
              {OFFER_TEMPLATE_VARIABLE_GROUPS.map(group => (
                <div key={group.key}>
                  <div className="text-[11px] font-semibold text-gray-500 mb-1">{group.title}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.variables.map(variable => (
                      <button key={variable.token} type="button" onClick={() => copyVariable(variable.token)} className="rounded-full bg-white border px-2 py-1 text-xs font-semibold text-green-700">
                        {variable.token}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveTemplateDraft} disabled={!editTemplateBody.trim() || (templateMode === 'create' && !editTemplateName.trim())} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold disabled:opacity-50">
                Salvar modelo
              </button>
              <button type="button" onClick={() => setTemplateMode('list')} className="px-3 py-2 rounded-lg border bg-white text-xs font-semibold text-gray-600">
                Cancelar
              </button>
              {templateMode === 'edit' && editingTemplate?.isCustom && (
                <button type="button" onClick={deleteCustomTemplate} className="px-3 py-2 rounded-lg border bg-white text-xs font-semibold text-red-600">
                  Excluir modelo
                </button>
              )}
              {templateMode === 'edit' && !editingTemplate?.isCustom && editingTemplate?.isOverridden && (
                <button type="button" onClick={resetPresetTemplate} className="px-3 py-2 rounded-lg border bg-white text-xs font-semibold text-gray-600">
                  Restaurar padrão
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar variações e modelos'}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Salvo!</span>}
      </div>

      <p className="text-xs text-gray-400">
        ← <Link href="/dashboard/ofertas-automaticas" className="hover:underline">Voltar para Ofertas automáticas</Link>
      </p>
    </div>
  )
}
