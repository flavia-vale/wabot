'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

const GROUPS = [
  { key: 'greetings', label: 'Saudações', helper: 'Aparecem antes da oferta.', placeholder: '🔥 ' },
  { key: 'ctas', label: 'Chamadas pra ação', helper: 'Chamam a pessoa para clicar.', placeholder: 'Pega já:' },
  { key: 'trailers', label: 'Fechamentos', helper: 'Aparecem depois da mensagem.', placeholder: ' 👀' },
]

function parsePool(json) {
  try {
    const data = JSON.parse(json || '{}')
    return {
      greetings: Array.isArray(data.greetings) ? data.greetings : [''],
      ctas: Array.isArray(data.ctas) ? data.ctas : [''],
      trailers: Array.isArray(data.trailers) ? data.trailers : [''],
    }
  } catch {
    return { greetings: [''], ctas: [''], trailers: [''] }
  }
}

function serializePool(pool) {
  return JSON.stringify({
    greetings: Array.isArray(pool.greetings) ? pool.greetings : [''],
    ctas: Array.isArray(pool.ctas) ? pool.ctas : [''],
    trailers: Array.isArray(pool.trailers) ? pool.trailers : [''],
  })
}

export default function MobileVariationsPage() {
  useMobileRoutePerf('m/account/variations')
  const router = useRouter()
  const [pool, setPool] = useState({ greetings: [''], ctas: [''], trailers: [''] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    api.variationsGet()
      .then((cfg) => { if (active) setPool(parsePool(cfg?.copyVariationPoolJson)) })
      .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar variações.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function setItem(groupKey, index, value) {
    setPool((current) => ({ ...current, [groupKey]: current[groupKey].map((item, itemIndex) => itemIndex === index ? value : item) }))
  }

  function addItem(groupKey) {
    setPool((current) => ({ ...current, [groupKey]: [...(current[groupKey] || []), ''] }))
  }

  function removeItem(groupKey, index) {
    setPool((current) => {
      const next = (current[groupKey] || []).filter((_, itemIndex) => itemIndex !== index)
      return { ...current, [groupKey]: next.length ? next : [''] }
    })
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await api.variationsUpdate(serializePool(pool))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } catch (err) {
      setError(err.message || 'Não foi possível salvar variações.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <MobileShell title="Ganchos e CTAs" active="conta" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando variações..." /></div></MobileShell>
  if (error && !pool) return <MobileShell title="Ganchos e CTAs" active="conta" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div></MobileShell>

  return (
    <MobileShell title="Ganchos e CTAs" active="conta" showBack onBack={() => router.back()}>
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Persistido no backend</div>
        <div style={cfgStyles.pageTitle}>Ganchos e CTAs</div>
      </div>

      {GROUPS.map((group) => (
        <div key={group.key}>
          <div style={cfgStyles.sectionLabel}>{group.label}</div>
          <div style={cfgStyles.cardWrap}>
            <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{group.helper} Deixe uma linha vazia quando quiser que às vezes nada seja adicionado.</div>
              {(pool[group.key] || ['']).map((value, index) => (
                <div key={`${group.key}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                  <input style={cfgStyles.field} value={value} onChange={(event) => setItem(group.key, index, event.target.value)} placeholder={index === 0 ? '(vazio)' : group.placeholder} />
                  <button type="button" onClick={() => removeItem(group.key, index)} style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 12, minWidth: 44, minHeight: 44, fontWeight: 800 }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => addItem(group.key)} style={mobi.btn('ghost', true)}>+ Adicionar variação</button>
            </div>
          </div>
        </div>
      ))}

      <div style={{ padding: '18px 16px 24px', display: 'grid', gap: 8 }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...mobi.btn('accent', true), opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar variações'}</button>
        {saved && <div style={{ fontSize: 12, color: 'var(--success)' }}>Variações salvas.</div>}
        {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      </div>
    </MobileShell>
  )
}
