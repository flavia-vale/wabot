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
import { OFFER_TEMPLATE_VARIABLES } from '@/lib/mobileOfferComposer'

export default function VariacoesDeTextoPage() {
  const [value, setValue] = useState({
    copyVariationPoolJson: '{}',
    brandingGroupLink: '',
    couponLink: '',
  })
  const [templateStore, setTemplateStore] = useState(() => readLocalTemplateStore())
  const [templateMode, setTemplateMode] = useState('list')
  const [editingTemplateKey, setEditingTemplateKey] = useState(null)
  const [editTemplateName, setEditTemplateName] = useState('')
  const [editTemplateBody, setEditTemplateBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const templates = composeTemplates(templateStore)
  const editingTemplate = templates.find(t => t.key === editingTemplateKey) || null

  useEffect(() => {
    let active = true
    Promise.all([
      api.variationsGet(),
      loadTemplateStore(),
    ])
      .then(([cfg, store]) => {
        if (!active) return
        setValue({
          copyVariationPoolJson: cfg.copyVariationPoolJson ?? '{}',
          brandingGroupLink: cfg.brandingGroupLink ?? '',
          couponLink: cfg.couponLink ?? '',
        })
        setTemplateStore(store)
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
        <div className="grid sm:grid-cols-2 gap-2">
          {OFFER_TEMPLATE_VARIABLES.map(variable => (
            <button
              key={variable.token}
              type="button"
              onClick={() => copyVariable(variable.token)}
              className="text-left rounded-lg border px-3 py-2 hover:bg-gray-50"
            >
              <code className="text-green-700 font-semibold">{variable.token}</code>
              <div className="text-xs text-gray-500">{variable.label} · Ex: {variable.example}</div>
            </button>
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

        {templateMode === 'list' && templates.map(template => (
          <div key={template.key} className="rounded-lg border px-3 py-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span>{template.name}</span>
                {template.isOverridden && <span className="text-[10px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">editado</span>}
                {template.isCustom && <span className="text-[10px] rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">personalizado</span>}
              </div>
              <div className="text-xs text-gray-500 truncate">{(template.body || '').replace(/\n/g, ' · ')}</div>
            </div>
            <button type="button" onClick={() => startEditTemplate(template)} className="text-xs text-green-700 font-semibold hover:underline">
              Editar
            </button>
          </div>
        ))}

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
            <div className="flex flex-wrap gap-1.5">
              {OFFER_TEMPLATE_VARIABLES.map(variable => (
                <button key={variable.token} type="button" onClick={() => copyVariable(variable.token)} className="rounded-full bg-white border px-2 py-1 text-xs font-semibold text-green-700">
                  {variable.token}
                </button>
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
