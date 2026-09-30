'use client'

// Seção "Rakuten" de Minhas credenciais (docs/rca/afiliados-rakuten.md).
// Espelho do card da Awin. Várias contas por cliente. Client ID e Client
// Secret são só de escrita: depois de salvos aparecem como ••••1234 e nunca
// voltam ao navegador; campo vazio na edição mantém o atual. Todo texto
// visível vem de @/lib/painel/rakutenCopy.

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { RAKUTEN_COPY, RAKUTEN_PAGE_URL, RAKUTEN_RUN_STATUS, rakutenStatusOf, relativeWhen } from '@/lib/painel/rakutenCopy'

const IconChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const EMPTY_FORM = { label: '', sid: '', clientId: '', clientSecret: '' }

function SecretField({ id, label, value, hint, onChange, disabled }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pnl-cred-field">
      <label className="pnl-cred-label" htmlFor={id}>{label}</label>
      <div className="pnl-cred-input-wrap">
        <input
          id={id}
          className="pnl-input pnl-cred-secret"
          type={show ? 'text' : 'password'}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <button type="button" className="pnl-cred-eye" onClick={() => setShow((v) => !v)} disabled={disabled}>
          {show ? RAKUTEN_COPY.hide : RAKUTEN_COPY.show}
        </button>
      </div>
      <p className="pnl-hint">{hint}</p>
    </div>
  )
}

function AccountForm({ account, onSaved, onCancel }) {
  const [form, setForm] = useState(account ? { label: account.label, sid: account.sid, clientId: '', clientSecret: '' } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const prefix = account ? `rakuten-${account.id}` : 'rakuten-new'

  function update(key, value) {
    setError('')
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    if (!/^\d{1,12}$/.test(form.sid.trim())) { setError(RAKUTEN_COPY.sidHint); return }
    if (!account && (!form.clientId.trim() || !form.clientSecret.trim())) { setError(RAKUTEN_COPY.secretHintNew); return }
    setSaving(true)
    try {
      const payload = { label: form.label, sid: form.sid.trim(), clientId: form.clientId.trim(), clientSecret: form.clientSecret.trim() }
      const result = account ? await api.rakutenAccountUpdate(account.id, payload) : await api.rakutenAccountCreate(payload)
      onSaved(result)
    } catch (err) {
      setError(err?.message || RAKUTEN_COPY.loadError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="pnl-awin-form" onSubmit={submit}>
      <div className="pnl-cred-field">
        <label className="pnl-cred-label" htmlFor={`${prefix}-label`}>{RAKUTEN_COPY.labelField}</label>
        <input id={`${prefix}-label`} className="pnl-input" value={form.label} maxLength={60} onChange={(e) => update('label', e.target.value)} disabled={saving} />
        <p className="pnl-hint">{RAKUTEN_COPY.labelHint}</p>
      </div>
      <div className="pnl-cred-field">
        <label className="pnl-cred-label" htmlFor={`${prefix}-sid`}>{RAKUTEN_COPY.sidField}</label>
        <input id={`${prefix}-sid`} className="pnl-input" inputMode="numeric" value={form.sid} maxLength={12} onChange={(e) => update('sid', e.target.value.replace(/\D/g, ''))} disabled={saving} />
        <p className="pnl-hint">{RAKUTEN_COPY.sidHint}</p>
      </div>
      <SecretField
        id={`${prefix}-client-id`}
        label={RAKUTEN_COPY.clientIdField}
        value={form.clientId}
        hint={account ? RAKUTEN_COPY.secretHintEdit(account.clientIdMasked) : RAKUTEN_COPY.secretHintNew}
        onChange={(value) => update('clientId', value)}
        disabled={saving}
      />
      <SecretField
        id={`${prefix}-client-secret`}
        label={RAKUTEN_COPY.clientSecretField}
        value={form.clientSecret}
        hint={account ? RAKUTEN_COPY.secretHintEdit(account.clientSecretMasked) : RAKUTEN_COPY.secretHintNew}
        onChange={(value) => update('clientSecret', value)}
        disabled={saving}
      />
      {error && <div className="pnl-note-box is-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="pnl-toolbar">
        <button type="submit" className="pnl-btn is-primary" disabled={saving}>{saving ? RAKUTEN_COPY.saving : RAKUTEN_COPY.save}</button>
        {onCancel && <button type="button" className="pnl-btn" onClick={onCancel} disabled={saving}>{RAKUTEN_COPY.cancel}</button>}
      </div>
    </form>
  )
}

function RunHistory({ accountId }) {
  const [runs, setRuns] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.rakutenAccountRuns(accountId)
      .then((list) => { if (active) setRuns(list) })
      .catch((err) => { if (active) setError(err?.message || RAKUTEN_COPY.loadError) })
    return () => { active = false }
  }, [accountId])

  if (error) return <p className="pnl-field-error">{error}</p>
  if (!runs) return <div className="pnl-skel" style={{ height: 40 }} />
  if (!runs.length) return <p className="pnl-hint">{RAKUTEN_COPY.historyEmpty}</p>
  return (
    <ul className="pnl-awin-runs">
      {runs.map((run) => (
        <li key={run.id}>
          <strong>{RAKUTEN_RUN_STATUS[run.status] ?? run.status}</strong>
          <span className="pnl-hint"> · {relativeWhen(run.startedAt)} · {RAKUTEN_COPY.syncDone(run)}</span>
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
  const status = rakutenStatusOf(account)

  async function run(kind, action) {
    if (busy) return
    setBusy(kind)
    setFeedback(null)
    try {
      await action()
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || RAKUTEN_COPY.loadError })
    } finally {
      setBusy('')
    }
  }

  const test = () => run('test', async () => {
    const result = await api.rakutenAccountTest(account.id)
    onChanged(result.account)
    setFeedback({ type: result.ok ? 'success' : 'error', message: result.message })
  })

  const sync = () => run('sync', async () => {
    const { result, account: fresh } = await api.rakutenAccountSync(account.id)
    if (fresh) onChanged(fresh)
    const failed = result?.errors?.[0]?.message
    setFeedback(result?.status === 'success' || result?.status === 'partial'
      ? { type: 'success', message: RAKUTEN_COPY.syncDone(result) }
      : { type: 'error', message: failed || RAKUTEN_COPY.loadError })
    setHistoryKey((k) => k + 1)
  })

  const remove = () => {
    if (!window.confirm(RAKUTEN_COPY.confirmRemove(account.label))) return
    run('remove', async () => {
      await api.rakutenAccountDelete(account.id)
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
            setFeedback(result.test && !result.test.ok ? { type: 'warn', message: RAKUTEN_COPY.savedWarn } : result.test ? { type: 'success', message: RAKUTEN_COPY.savedOk } : null)
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
          <p className="pnl-hint">{RAKUTEN_COPY.accountNumber(account.sid)} · {RAKUTEN_COPY.secretLabel(account.clientSecretMasked)}</p>
        </div>
        <span className={`pnl-tag is-${status.tag}`}>{status.label}</span>
      </div>
      {account.statusDetail && account.status !== 'ok' && (
        <div className={`pnl-note-box is-${status.tone === 'error' ? 'error' : 'warn'}`} role="alert" style={{ margin: '8px 0' }}>{account.statusDetail}</div>
      )}
      <p className="pnl-hint">
        {account.lastSyncAt ? RAKUTEN_COPY.lastSync(relativeWhen(account.lastSyncAt)) : RAKUTEN_COPY.neverSynced}
        {' · '}{RAKUTEN_COPY.activePromotions(account.activePromotions || 0)}
        {' · '}{RAKUTEN_COPY.autoSync}
      </p>
      {feedback && <div className={`pnl-note-box is-${feedback.type}`} role="status" style={{ margin: '8px 0' }}>{feedback.message}</div>}
      <div className="pnl-toolbar" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="pnl-link-btn" onClick={test} disabled={!!busy}>{busy === 'test' ? RAKUTEN_COPY.testing : RAKUTEN_COPY.test}</button>
        <button type="button" className="pnl-link-btn" onClick={sync} disabled={!!busy || account.status === 'invalid_credential'}>{busy === 'sync' ? RAKUTEN_COPY.syncing : RAKUTEN_COPY.sync}</button>
        <button type="button" className="pnl-link-btn" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>{showHistory ? RAKUTEN_COPY.hideHistory : RAKUTEN_COPY.history}</button>
        <button type="button" className="pnl-link-btn" style={{ color: 'var(--ink-soft)' }} onClick={() => setMode('edit')} disabled={!!busy}>{RAKUTEN_COPY.edit}</button>
        <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={remove} disabled={!!busy}>{busy === 'remove' ? RAKUTEN_COPY.removing : RAKUTEN_COPY.remove}</button>
      </div>
      {showHistory && <RunHistory key={historyKey} accountId={account.id} />}
    </div>
  )
}

export default function RakutenCredentialsCard({ open, onToggleOpen }) {
  const [accounts, setAccounts] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let active = true
    api.rakutenAccounts()
      .then((list) => { if (active) setAccounts(list) })
      .catch((err) => { if (active) setLoadError(err?.message || RAKUTEN_COPY.loadError) })
    return () => { active = false }
  }, [])

  const list = accounts ?? []
  // Sem nenhuma conta, o formulário já vem aberto; o botão é só para a 2ª em diante.
  const firstAccount = accounts !== null && !loadError && list.length === 0
  const hasProblem = list.some((account) => account.status === 'invalid_credential')
  // O problema já aparece na etiqueta ao lado do nome; aqui vão as contas.
  const subtitle = list.length ? list.map((account) => account.label).join(' · ') : RAKUTEN_COPY.subtitleEmpty

  function replaceAccount(fresh) {
    if (!fresh) return
    setAccounts((current) => (current ?? []).map((item) => (item.id === fresh.id ? { ...item, ...fresh } : item)))
  }

  return (
    <div className={`pnl-cred-card ${hasProblem ? 'is-attention' : ''}`}>
      <button type="button" className="pnl-cred-head" onClick={onToggleOpen} aria-expanded={open} aria-controls="rakuten-body">
        <span className="pnl-cred-badge" style={{ background: 'var(--ink)', color: 'var(--surface)' }} aria-hidden="true">RK</span>
        <span className="pnl-cred-head-main">
          <span className="pnl-cred-name">
            {RAKUTEN_COPY.title}
            {hasProblem && <span className="pnl-tag is-flight">{rakutenStatusOf({ status: 'invalid_credential' }).label}</span>}
          </span>
          <span className={`pnl-cred-status is-${list.length ? (hasProblem ? 'incomplete' : 'configured') : 'pending'}`}>
            <span className="pnl-cred-dot" aria-hidden="true" />
            {subtitle}
          </span>
        </span>
        <span className={`pnl-cred-chev ${open ? 'is-open' : ''}`} aria-hidden="true"><IconChevron /></span>
      </button>

      <div id="rakuten-body" className={`pnl-cred-body ${open ? 'is-open' : ''}`}>
        <p className="pnl-cred-onde">{RAKUTEN_COPY.lede}</p>
        <ol className="pnl-awin-steps">
          {RAKUTEN_COPY.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="pnl-cred-ctas">
          <a className="pnl-btn is-primary" href={RAKUTEN_PAGE_URL} target="_blank" rel="noopener noreferrer">{RAKUTEN_COPY.openRakuten}</a>
        </div>
        <div className="pnl-note-box is-info" style={{ marginBottom: 12 }}>{RAKUTEN_COPY.storesHint}</div>

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

        {adding || firstAccount ? (
          <div className="pnl-awin-account">
            <AccountForm
              onCancel={firstAccount ? null : () => setAdding(false)}
              onSaved={(result) => {
                setAccounts((current) => [...(current ?? []), result.account])
                setAdding(false)
                setNotice(result.test?.ok ? { type: 'success', message: RAKUTEN_COPY.savedOk } : { type: 'warn', message: RAKUTEN_COPY.savedWarn })
              }}
            />
          </div>
        ) : (
          accounts !== null && (
            <button type="button" className="pnl-btn" onClick={() => { setNotice(null); setAdding(true) }}>{RAKUTEN_COPY.add}</button>
          )
        )}
      </div>
    </div>
  )
}
