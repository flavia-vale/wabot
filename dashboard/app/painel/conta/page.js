'use client'

/* Minha conta (protótipo Basic/PRO, 2026-09-23).
 *
 * Só campos que o produto de fato tem: nome (editável), e-mail e senha (mesmo
 * bloco de /painel/configuracoes) e o plano. O celular de cadastro aparece só
 * para leitura — ele é a trava contra teste grátis repetido, e trocá-lo pela
 * tela liberaria o número para uma conta nova. Foto e fuso horário do
 * protótipo NÃO existem no produto e ficaram de fora (nada inventado). */

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from '../PainelShell'
import AccountAccessForms from '@/components/AccountAccessForms'

function initialsOf(name, email) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function planLabel(user, isPro) {
  if (user?.plan === 'trial') return isPro ? 'Teste grátis (tudo do PRO)' : 'Teste grátis vencido'
  if (user?.plan === 'basic') return 'Plano Basic'
  if (user?.plan === 'pro' || user?.plan === 'premium') return 'Plano PRO'
  return 'Sem plano'
}

function maskPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return '—'
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}

export default function MinhaContaPage() {
  usePainelHeader({ title: 'Minha conta', subtitle: 'Seus dados, senha e plano' })
  const { user, isPro } = usePainel()
  const [name, setName] = useState(user?.name ?? '')
  const [savedName, setSavedName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const changed = name.trim().replace(/\s+/g, ' ') !== (savedName ?? '')

  async function saveName(event) {
    event.preventDefault()
    setFeedback(null)
    if (!name.trim()) return setFeedback({ type: 'error', message: 'Escreva o seu nome.' })
    setSaving(true)
    try {
      const updated = await api.updateAccountName(name)
      setSavedName(updated?.name ?? name.trim())
      setName(updated?.name ?? name.trim())
      setFeedback({ type: 'success', message: 'Nome atualizado.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível salvar o nome.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="pnl-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 18, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span className="pnl-avatar" style={{ width: 60, height: 60, fontSize: 20 }} aria-hidden="true">{initialsOf(savedName, user?.email)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{savedName || 'Sem nome'}</div>
            <div className="pnl-hint" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{user?.email}</span> · <span>{planLabel(user, isPro)}</span>
            </div>
          </div>
          <Link href="/painel/plano" className={`pnl-btn${isPro ? '' : ' is-pro'} is-sm`}>{isPro ? 'Ver plano' : 'Ver planos'}</Link>
        </div>

        <form onSubmit={saveName} style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          <div className="pnl-field">
            <label className="pnl-label" htmlFor="accountName">Nome</label>
            <input id="accountName" className="pnl-input" value={name} maxLength={100} autoComplete="name" onChange={(e) => { setName(e.target.value); setFeedback(null) }} disabled={saving} />
          </div>
          <div className="pnl-field">
            <span className="pnl-label">Celular de cadastro</span>
            <div className="pnl-input" style={{ background: 'var(--bg-soft)' }}>{maskPhone(user?.contactPhone)}</div>
            <p className="pnl-hint" style={{ marginTop: 4 }}>Usado para suporte e para recuperar a conta. Para trocar, fale com o suporte.</p>
          </div>
          <div>
            <button type="submit" className="pnl-btn is-primary" disabled={saving || !changed}>{saving ? 'Salvando…' : 'Salvar nome'}</button>
          </div>
          {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status">{feedback.message}</div>}
        </form>
      </section>

      <AccountAccessForms embedded />
    </div>
  )
}
