'use client'

// Seção "Awin" de Minhas credenciais (docs/rca/afiliados-awin.md).
// Várias contas por cliente. O código de acesso é só de escrita: depois de
// salvo aparece como ••••1234 e nunca volta ao navegador; campo vazio na
// edição mantém o atual. Todo texto visível vem de @/lib/painel/awinCopy.

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { AWIN_COPY, AWIN_PAGE_URL, AWIN_RUN_STATUS, awinStatusOf, relativeWhen } from '@/lib/painel/awinCopy'

const IconChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const EMPTY_FORM = { label: '', publisherId: '', token: '' }

function AccountForm({ account, onSaved, onCancel }) {
  const [form, setForm] = useState(account ? { label: account.label, publisherId: account.publisherId, token: '' } : EMPTY_FORM)
  const [showCode, setShowCode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const prefix = account ? `awin-${account.id}` : 'awin-new'

  function update(key, value) {
    setError('')
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    if (!/^\d{1,12}$/.test(form.publisherId.trim())) { setError(AWIN_COPY.publisherHint); return }
    if (!account && !form.token.trim()) { setError(AWIN_COPY.codeHintNew); return }
    setSaving(true)
    try {
      const payload = { label: form.label, publisherId: form.publisherId.trim(), token: form.token.trim() }
      const result = account ? await api.awinAccountUpdate(account.id, payload) : await api.awinAccountCreate(payload)
      onSaved(result)
    } catch (err) {
      setError(err?.message || AWIN_COPY.loadError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="pnl-awin-form" onSubmit={submit}>
      <div className="pnl-cred-field">
        <label className="pnl-cred-label" htmlFor={`${prefix}-label`}>{AWIN_COPY.labelField}</label>
        <input id={`${prefix}-label`} className="pnl-input" value={form.label} maxLength={60} onChange={(e) => update('label', e.target.value)} disabled={saving} />
        <p className="pnl-hint">{AWIN_COPY.labelHint}</p>
      </div>
      <div className="pnl-cred-field">
        <label className="pnl-cred-label" htmlFor={`${prefix}-publisher`}>{AWIN_COPY.publisherField}</label>
        <input id={`${prefix}-publisher`} className="pnl-input" inputMode="numeric" value={form.publisherId} maxLength={12} onChange={(e) => update('publisherId', e.target.value.replace(/\D/g, ''))} disabled={saving} />
        <p className="pnl-hint">{AWIN_COPY.publisherHint}</p>
      </div>
      <div className="pnl-cred-field">
        <label className="pnl-cred-label" htmlFor={`${prefix}-code`}>{AWIN_COPY.codeField}</label>
        <div className="pnl-cred-input-wrap">
          <input
            id={`${prefix}-code`}
            className="pnl-input pnl-cred-secret"
            type={showCode ? 'text' : 'password'}
            autoComplete="off"
            value={form.token}
            onChange={(e) => update('token', e.target.value)}
            disabled={saving}
          />
          <button type="button" className="pnl-cred-eye" onClick={() => setShowCode((v) => !v)} disabled={saving}>
            {showCode ? AWIN_COPY.hide : AWIN_COPY.show}
          </button>
        </div>
        <p className="pnl-hint">{account ? AWIN_COPY.codeHintEdit(account.tokenMasked) : AWIN_COPY.codeHintNew}</p>
      </div>
      {error && <div className="pnl-note-box is-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="pnl-toolbar">
        <button type="submit" className="pnl-btn is-primary" disabled={saving}>{saving ? AWIN_COPY.saving : AWIN_COPY.save}</button>
        <button type="button" className="pnl-btn" onClick={onCancel} disabled={saving}>{AWIN_COPY.cancel}</button>
      </div>
    </form>
  )
}

function RunHistory({ accountId }) {
  const [runs, setRuns] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.awinAccountRuns(accountId)
      .then((list) => { if (active) setRuns(list) })
      .catch((err) => { if (active) setError(err?.message || AWIN_COPY.loadError) })
    return () => { active = false }
  }, [accountId])

  if (error) return <p className="pnl-field-error">{error}</p>
  if (!runs) return <div className="pnl-skel" style={{ height: 40 }} />
  if (!runs.length) return <p className="pnl-hint">{AWIN_COPY.historyEmpty}</p>
  return (
    <ul className="pnl-awin-runs">
      {runs.map((run) => (
        <li key={run.id}>
          <strong>{AWIN_RUN_STATUS[run.status] ?? run.status}</strong>
          <span className="pnl-hint"> · {relativeWhen(run.startedAt)} · {AWIN_COPY.syncDone(run)}</span>
          {run.errors.map((item) => <p key={item.message} className="pnl-hint">{item.message}</p>)}
        </li>
      ))}
    </ul>
  )
}

function AccountRow({ account, onChanged, onRemoved }) {
  const [mode, setMode] = useState('view') // view | edit
  const [busy, setBusy] = useState('') // test | sync | remove
  const [feedback, setFeedback] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const status = awinStatusOf(account)

  async function run(kind, action) {
    if (busy) return
    setBusy(kind)
    setFeedback(null)
    try {
      await action()
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || AWIN_COPY.loadError })
    } finally {
      setBusy('')
    }
  }

  const test = () => run('test', async () => {
    const result = await api.awinAccountTest(account.id)
    onChanged(result.account)
    setFeedback({ type: result.ok ? 'success' : 'error', message: result.message })
  })

  const sync = () => run('sync', async () => {
    const { result, account: fresh } = await api.awinAccountSync(account.id)
    if (fresh) onChanged(fresh)
    const failed = result?.errors?.[0]?.message
    setFeedback(result?.status === 'success' || result?.status === 'partial'
      ? { type: 'success', message: AWIN_COPY.syncDone(result) }
      : { type: 'error', message: failed || AWIN_COPY.loadError })
    setHistoryKey((k) => k + 1)
  })

  const remove = () => {
    if (!window.confirm(AWIN_COPY.confirmRemove(account.label))) return
    run('remove', async () => {
      await api.awinAccountDelete(account.id)
      onRemoved(account.id)
    })
  }

  if (mode === 'edit') {
    return (
      <div className="pnl-awin-account">
        <AccountForm
          account={account}
          onCancel={() => setMode('view')}
          onSaved={(result) => {
            onChanged(result.account)
            setMode('view')
            setFeedback(result.test && !result.test.ok ? { type: 'warn', message: AWIN_COPY.savedWarn } : result.test ? { type: 'success', message: AWIN_COPY.savedOk } : null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="pnl-awin-account">
      <div className="pnl-awin-account-head">
        <div style={{ minWidth: 0 }}>
          <strong>{account.label}</strong>
          <p className="pnl-hint">{AWIN_COPY.accountNumber(account.publisherId)} · {AWIN_COPY.codeLabel(account.tokenMasked)}</p>
        </div>
        <span className={`pnl-tag is-${status.tag}`}>{status.label}</span>
      </div>
      {account.statusDetail && account.status !== 'ok' && (
        <div className={`pnl-note-box is-${status.tone === 'error' ? 'error' : 'warn'}`} role="alert" style={{ margin: '8px 0' }}>{account.statusDetail}</div>
      )}
      <p className="pnl-hint">
        {account.lastSyncAt ? AWIN_COPY.lastSync(relativeWhen(account.lastSyncAt)) : AWIN_COPY.neverSynced}
        {' · '}{AWIN_COPY.activePromotions(account.activePromotions || 0)}
        {' · '}{AWIN_COPY.autoSync}
      </p>
      {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status" style={{ margin: '8px 0' }}>{feedback.message}</div>}
      <div className="pnl-toolbar" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="pnl-link-btn" onClick={test} disabled={!!busy}>{busy === 'test' ? AWIN_COPY.testing : AWIN_COPY.test}</button>
        <button type="button" className="pnl-link-btn" onClick={sync} disabled={!!busy || account.status === 'invalid_credential'}>{busy === 'sync' ? AWIN_COPY.syncing : AWIN_COPY.sync}</button>
        <button type="button" className="pnl-link-btn" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>{showHistory ? AWIN_COPY.hideHistory : AWIN_COPY.history}</button>
        <button type="button" className="pnl-link-btn" style={{ color: 'var(--ink-soft)' }} onClick={() => setMode('edit')} disabled={!!busy}>{AWIN_COPY.edit}</button>
        <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={remove} disabled={!!busy}>{busy === 'remove' ? AWIN_COPY.removing : AWIN_COPY.remove}</button>
      </div>
      {showHistory && <RunHistory key={historyKey} accountId={account.id} />}
    </div>
  )
}

export default function AwinCredentialsCard({ open, onToggleOpen }) {
  const [accounts, setAccounts] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    api.awinAccounts()
      .then((list) => { if (active) setAccounts(list) })
      .catch((err) => { if (active) setLoadError(err?.message || AWIN_COPY.loadError) })
    return () => { active = false }
  }, [])

  const list = accounts ?? []
  const hasProblem = list.some((account) => account.status === 'invalid_credential')
  // O problema já aparece na etiqueta ao lado do nome; aqui vão as contas.
  const subtitle = list.length ? list.map((account) => account.label).join(' · ') : AWIN_COPY.subtitleEmpty

  function replaceAccount(fresh) {
    if (!fresh) return
    setAccounts((current) => (current ?? []).map((item) => (item.id === fresh.id ? { ...item, ...fresh } : item)))
  }

  return (
    <div className={`pnl-cred-card ${hasProblem ? 'is-attention' : ''}`}>
      <button type="button" className="pnl-cred-head" onClick={onToggleOpen} aria-expanded={open} aria-controls="awin-body">
        <span className="pnl-cred-badge" style={{ background: 'var(--ink)', color: 'var(--surface)' }} aria-hidden="true">AW</span>
        <span className="pnl-cred-head-main">
          <span className="pnl-cred-name">
            {AWIN_COPY.title}
            {hasProblem && <span className="pnl-tag is-flight">{awinStatusOf({ status: 'invalid_credential' }).label}</span>}
          </span>
          <span className={`pnl-cred-status is-${list.length ? (hasProblem ? 'incomplete' : 'configured') : 'pending'}`}>
            <span className="pnl-cred-dot" aria-hidden="true" />
            {subtitle}
          </span>
        </span>
        <span className={`pnl-cred-chev ${open ? 'is-open' : ''}`} aria-hidden="true"><IconChevron /></span>
      </button>

      <div id="awin-body" className={`pnl-cred-body ${open ? 'is-open' : ''}`}>
        <p className="pnl-cred-onde">{AWIN_COPY.lede}</p>
        <ol className="pnl-awin-steps">
          {AWIN_COPY.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="pnl-cred-ctas">
          <a className="pnl-btn is-primary" href={AWIN_PAGE_URL} target="_blank" rel="noopener noreferrer">{AWIN_COPY.openAwin}</a>
        </div>
        <div className="pnl-note-box" style={{ marginBottom: 10 }}>{AWIN_COPY.safety}</div>
        <div className="pnl-note-box is-info" style={{ marginBottom: 12 }}>{AWIN_COPY.storesHint}</div>

        {loadError && <div className="pnl-note-box is-error" role="alert">{loadError}</div>}
        {accounts === null && !loadError && <div className="pnl-skel" style={{ height: 64 }} />}
        {notice && <div className={`pnl-note-box is-${notice.type}`} role="status" style={{ marginBottom: 12 }}>{notice.message}</div>}

        {list.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onChanged={replaceAccount}
            onRemoved={(id) => setAccounts((current) => (current ?? []).filter((item) => item.id !== id))}
          />
        ))}

        {adding ? (
          <div className="pnl-awin-account">
            <AccountForm
              onCancel={() => setAdding(false)}
              onSaved={(result) => {
                setAccounts((current) => [...(current ?? []), result.account])
                setAdding(false)
                setNotice(result.test?.ok ? { type: 'success', message: AWIN_COPY.savedOk } : { type: 'warn', message: AWIN_COPY.savedWarn })
              }}
            />
          </div>
        ) : (
          accounts !== null && (
            <button type="button" className="pnl-btn" onClick={() => { setNotice(null); setAdding(true) }}>{AWIN_COPY.add}</button>
          )
        )}
      </div>
    </div>
  )
}
