'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
}

export default function ConfiguracoesPage() {
  usePainelHeader({ title: 'Configurações', subtitle: 'Acesso da conta' })

  const [account, setAccount] = useState(null)
  const [email, setEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    let active = true
    api.me()
      .then((user) => {
        if (!active) return
        setAccount(user)
        setEmail(user?.email || '')
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'Não foi possível carregar sua conta.') })
    return () => { active = false }
  }, [])

  const emailChanged = useMemo(() => email.trim().toLowerCase() !== String(account?.email || '').trim().toLowerCase(), [account?.email, email])

  function updatePasswordField(field, value) {
    setPasswordForm((current) => ({ ...current, [field]: value }))
    setFeedback(null)
  }

  async function saveEmail(event) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    setFeedback(null)
    if (!cleanEmail) return setFeedback({ type: 'error', message: 'Informe o novo e-mail.' })
    if (!isValidEmail(cleanEmail)) return setFeedback({ type: 'error', message: 'Confira o formato do e-mail.' })
    if (cleanEmail.endsWith('@sistema.com')) return setFeedback({ type: 'error', message: 'Use um e-mail real para sua conta.' })
    if (!emailChanged) return setFeedback({ type: 'success', message: 'Este e-mail já está salvo na sua conta.' })

    setEmailSaving(true)
    try {
      const updated = await api.updateAccountEmail(cleanEmail)
      setAccount(updated)
      setEmail(updated?.email || cleanEmail)
      setFeedback({ type: 'success', message: 'E-mail atualizado com sucesso.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível atualizar o e-mail.' })
    } finally {
      setEmailSaving(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    setFeedback(null)
    const currentPassword = passwordForm.currentPassword
    const newPassword = passwordForm.newPassword
    const confirmPassword = passwordForm.confirmPassword

    if (!currentPassword) return setFeedback({ type: 'error', message: 'Informe sua senha atual.' })
    if (!newPassword) return setFeedback({ type: 'error', message: 'Informe a nova senha.' })
    if (newPassword.length < 8) return setFeedback({ type: 'error', message: 'A nova senha precisa ter pelo menos 8 caracteres.' })
    if (newPassword.length > 200) return setFeedback({ type: 'error', message: 'A nova senha está longa demais.' })
    if (newPassword !== confirmPassword) return setFeedback({ type: 'error', message: 'A confirmação da nova senha não confere.' })
    if (newPassword === currentPassword) return setFeedback({ type: 'error', message: 'Escolha uma senha diferente da atual.' })

    setPasswordSaving(true)
    try {
      await api.updateAccountPassword(currentPassword, newPassword, confirmPassword)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setFeedback({ type: 'success', message: 'Senha atualizada com sucesso. Sua sessão foi renovada.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível atualizar a senha.' })
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="pnl-grid" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}>
          <p className="pnl-card-title" style={{ color: 'var(--danger)' }}>Falha ao carregar a conta</p>
          <p className="pnl-card-note">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!account) {
    return <div className="pnl-grid" style={{ maxWidth: 760, margin: '0 auto' }}><div className="pnl-skel" style={{ height: 360 }} /></div>
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 760, margin: '0 auto' }}>
      <section className="pnl-card">
        <div className="pnl-card-title">E-mail de acesso</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Este e-mail é usado para entrar no painel, receber suporte e criar cobranças de assinatura.</p>
        <form onSubmit={saveEmail}>
          <div className="pnl-field">
            <label className="pnl-label" htmlFor="accountEmail">E-mail</label>
            <input id="accountEmail" className="pnl-input" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setFeedback(null) }} disabled={emailSaving} />
          </div>
          <button type="submit" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} disabled={emailSaving || !emailChanged}>
            {emailSaving ? 'Salvando…' : 'Salvar e-mail'}
          </button>
        </form>
      </section>

      <section className="pnl-card">
        <div className="pnl-card-title">Alterar senha</div>
        <p className="pnl-card-note" style={{ marginBottom: 14 }}>Use pelo menos 8 caracteres. Após salvar, renovamos sua sessão atual automaticamente.</p>
        <form onSubmit={savePassword}>
          <div className="pnl-field">
            <label className="pnl-label" htmlFor="currentPassword">Senha atual</label>
            <input id="currentPassword" className="pnl-input" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(e) => updatePasswordField('currentPassword', e.target.value)} disabled={passwordSaving} />
          </div>
          <div className="pnl-field" style={{ marginTop: 12 }}>
            <label className="pnl-label" htmlFor="newPassword">Nova senha</label>
            <input id="newPassword" className="pnl-input" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(e) => updatePasswordField('newPassword', e.target.value)} disabled={passwordSaving} />
          </div>
          <div className="pnl-field" style={{ marginTop: 12 }}>
            <label className="pnl-label" htmlFor="confirmPassword">Confirmar nova senha</label>
            <input id="confirmPassword" className="pnl-input" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(e) => updatePasswordField('confirmPassword', e.target.value)} disabled={passwordSaving} />
          </div>
          <button type="submit" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} disabled={passwordSaving}>
            {passwordSaving ? 'Salvando…' : 'Alterar senha'}
          </button>
        </form>
      </section>

      {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status">{feedback.message}</div>}
    </div>
  )
}
