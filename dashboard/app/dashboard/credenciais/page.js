'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ErrorState, LoadingState } from '@/components/States'
import { HelpLink } from '@/components/HelpLink'
import { useToast } from '@/components/ToastProvider'

const PLATFORMS = [
  {
    id: 'shopee',
    label: 'Shopee',
    instructions: 'Onde obter: affiliate.shopee.com.br → Ferramentas → API de Afiliados → Gerar credenciais. Mantenha o Secret Key privado.',
    fields: [
      { key: 'appId', label: 'App ID', hint: 'Identificador do seu app na Shopee.' },
      { key: 'secretKey', label: 'Secret Key', hint: 'Chave secreta do app (não compartilhe).', sensitive: true },
    ]
  },
  {
    id: 'amazon',
    label: 'Amazon',
    instructions: 'Onde obter: affiliate-program.amazon.com.br. A Tag vem do painel. Os cookies ubid-acbbr, at-acbbr e x-acbbr precisam ser copiados da sessão ativa logada na Amazon Brasil.',
    platformWarning: 'Para gerar link curto (amzn.to), preencha Tag e os 3 cookies da sua sessão Amazon.',
    fields: [
      { key: 'tag', label: 'Tag de afiliado', hint: 'Ex.: suatag-20' },
      { key: 'ubid-acbbr', label: 'Cookie ubid-acbbr', hint: 'Cookie de sessão da Amazon Brasil.', sensitive: true, help: 'Acesse amazon.com.br logado, abra o DevTools → Application → Cookies → amazon.com.br e copie o valor do cookie ubid-acbbr.' },
      { key: 'at-acbbr', label: 'Cookie at-acbbr', hint: 'Cookie de autenticação da Amazon Brasil.', sensitive: true, help: 'Mesmo painel do DevTools: copie o valor do cookie at-acbbr.' },
      { key: 'x-acbbr', label: 'Cookie x-acbbr', hint: 'Cookie de identificação da Amazon Brasil.', sensitive: true, help: 'Mesmo painel do DevTools: copie o valor do cookie x-acbbr.' },
    ]
  },
  {
    id: 'mercadolivre',
    label: 'Mercado Livre',
    instructions: 'Onde obter: afiliados.mercadolivre.com.br. A Tag vem do painel; SSID é o cookie da sessão ativa e deve ser tratado como dado sensível.',
    platformWarning: 'Para gerar link curto (meli.la), preencha Tag e SSID.',
    fields: [
      { key: 'tag', label: 'Tag numérica', hint: 'Somente números da sua afiliação.', help: 'Copie a tag exibida no painel de afiliados do Mercado Livre.' },
      { key: 'ssid', label: 'SSID (cookie)', hint: 'Cookie da sessão ativa do Mercado Livre.', sensitive: true, help: 'No navegador, acesse os cookies do Mercado Livre na sua sessão ativa e copie apenas o valor do cookie ssid. Não compartilhe esse valor fora do painel.' },
    ]
  },
  {
    id: 'magazineluiza',
    label: 'Magazine Luiza',
    instructions: 'Onde obter: painel de afiliados do Magazine Luiza. Copie a tag usada nos seus links de afiliado.',
    fields: [{ key: 'tag', label: 'Tag de afiliado', hint: 'Ex.: parceiro123' }]
  },
]

const STATUS_META = {
  configured: { label: 'Configurado', className: 'bg-green-100 text-green-700' },
  incomplete: { label: 'Incompleto', className: 'bg-amber-100 text-amber-700' },
  pending: { label: 'Pendente', className: 'bg-gray-100 text-gray-600' },
}

function getPlatformStatus(platform, values) {
  const required = platform.fields.filter((field) => field.required !== false)
  const filled = required.filter((field) => String(values[field.key] ?? '').trim())
  if (filled.length === 0) return 'pending'
  if (filled.length < required.length) return 'incomplete'
  return 'configured'
}

function PlatformCard({ platform, initialData, onSave, disabled }) {
  const [draftValues, setDraftValues] = useState({})
  const [visibleFields, setVisibleFields] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const [fieldErrors, setFieldErrors] = useState({})

  const values = dirty ? draftValues : (initialData ?? {})
  const status = getPlatformStatus(platform, values)
  const statusMeta = STATUS_META[status]
  const isDisabled = disabled || saving

  function updateValue(key, value) {
    setSaved(false)
    setFieldErrors((current) => ({ ...current, [key]: '' }))
    setDraftValues((current) => ({ ...(dirty ? current : (initialData ?? {})), [key]: value }))
    setDirty(true)
  }

  function validate() {
    const missing = platform.fields.filter((field) => field.required !== false && !String(values[field.key] ?? '').trim())
    if (!missing.length) return true

    const nextErrors = Object.fromEntries(missing.map((field) => [field.key, `${field.label} é obrigatório.`]))
    setFieldErrors(nextErrors)
    const msg = `Preencha os campos obrigatórios de ${platform.label} e tente novamente.`
    setError(msg)
    toast.warning(msg, 'Campos obrigatórios')
    return false
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaved(false)

    if (!validate()) return

    setSaving(true)
    try {
      await onSave(platform.id, values)
      setDraftValues({})
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const msg = `${err.message || 'Não foi possível salvar.'} Verifique os campos e tente novamente.`
      setError(msg)
      toast.error(msg, `Falha ao salvar ${platform.label}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-700">{platform.label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
      </div>
      {platform.instructions && (
        <p className="text-xs text-gray-500 mb-3">{platform.instructions}</p>
      )}
      {platform.platformWarning && (
        <div className="mb-3">
          <Alert type="warning" title="Atenção" message={platform.platformWarning} />
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {platform.fields.map(f => {
          const isSensitiveHidden = f.sensitive && !visibleFields[f.key]
          const inputId = `${platform.id}-${f.key}`
          return (
            <div key={f.key} className="flex flex-col gap-1">
              <label htmlFor={inputId} className="text-xs font-medium text-gray-600">{f.label}</label>
              <div className="flex gap-2">
                <input
                  id={inputId}
                  type={isSensitiveHidden ? 'password' : 'text'}
                  placeholder={f.placeholder ? `ex: ${f.placeholder}` : ''}
                  value={values[f.key] ?? ''}
                  onChange={e => updateValue(f.key, e.target.value)}
                  disabled={isDisabled}
                  aria-invalid={!!fieldErrors[f.key]}
                  className="min-w-0 flex-1 border rounded-lg px-3 py-2.5 min-h-11 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
                />
                {f.sensitive && (
                  <button
                    type="button"
                    onClick={() => setVisibleFields((current) => ({ ...current, [f.key]: !current[f.key] }))}
                    disabled={isDisabled}
                    aria-label={`${visibleFields[f.key] ? 'Ocultar' : 'Mostrar'} ${f.label}`}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                  >
                    {visibleFields[f.key] ? 'Ocultar' : 'Mostrar'}
                  </button>
                )}
              </div>
              {f.hint && <p className="text-[11px] text-gray-400">{f.hint}</p>}
              {f.help && (
                <details className="text-[11px] text-gray-500">
                  <summary className="cursor-pointer font-medium text-blue-700">Como encontrar?</summary>
                  <p className="mt-1">{f.help}</p>
                </details>
              )}
              {fieldErrors[f.key] && <p className="text-xs font-medium text-red-600" role="alert">{fieldErrors[f.key]}</p>}
            </div>
          )
        })}
        {error && <Alert type="error" title={`Falha ao salvar ${platform.label}`} message={error} />}
        {saved && <Alert type="success" title={`${platform.label} salvo`} message="Credenciais atualizadas com sucesso." />}
        <button
          type="submit"
          disabled={saving || disabled}
          className="bg-green-600 text-white rounded-lg py-3 min-h-11 font-semibold hover:bg-green-700 disabled:opacity-50 transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}

export default function CredenciaisPage() {
  const [credMap, setCredMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  async function loadCredentials() {
    setLoading(true)
    setLoadError('')
    try {
      const list = await api.credentials()
      const map = {}
      for (const c of list) map[c.platform] = c.data
      setCredMap(map)
    } catch (err) {
      setLoadError(err.message || 'Falha ao carregar credenciais.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api.credentials()
      .then((list) => {
        if (!active) return
        const map = {}
        for (const c of list) map[c.platform] = c.data
        setCredMap(map)
      })
      .catch((err) => { if (active) setLoadError(err.message || 'Falha ao carregar credenciais.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleSave(platform, data) {
    await api.saveCredential(platform, data)
    setCredMap(m => ({ ...m, [platform]: data }))
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Credenciais</h2>
        <HelpLink topic="como-configurar-credenciais">Ajuda</HelpLink>
      </div>
      <p className="text-gray-500 text-sm mb-3">Adicione suas credenciais para que o bot converta links usando suas tags de afiliado.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/dashboard/tutorial" className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">📘 Ver tutorial de credenciais</Link>
      </div>
      <div className="mb-4">
        <Alert
          type="info"
          title="Uso das credenciais"
          message="Esses dados são usados apenas para gerar seus links de afiliado. Não compartilhe suas credenciais fora do painel."
        />
      </div>

      {loading && <div className="mb-4"><LoadingState message="Carregando credenciais..." /></div>}
      {loadError && <div className="mb-4"><ErrorState title="Falha ao carregar credenciais" message={loadError} actionLabel="Recarregar" onAction={loadCredentials} /></div>}

      {PLATFORMS.map(p => (
        <PlatformCard
          key={p.id}
          platform={p}
          initialData={credMap[p.id]}
          onSave={handleSave}
          disabled={loading || !!loadError}
        />
      ))}
    </div>
  )
}
