'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

// Operação > Saúde (auditoria 5.2): o que sobrou útil da antiga
// /admin/observabilidade (apagada) — GO/NO-GO em 4 chips, alertas ativos e a
// fila de webhooks de pagamento (DLQ) com reprocessar + confirmação.

const TONS = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-gray-200 bg-gray-50 text-gray-700',
}

function numberFmt(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0))
}

function minutes(value) {
  return `${Math.round(Number(value || 0) / 60)} min`
}

function safeDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function toneOf(severity) {
  const v = String(severity || '').toLowerCase()
  if (['p1', 'critical', 'fail', 'no-go'].includes(v)) return 'critical'
  if (['p2', 'p3', 'risk', 'error', 'warn', 'warning', 'degraded'].includes(v)) return 'warn'
  if (['ok', 'healthy', 'go', 'good'].includes(v)) return 'ok'
  return 'info'
}

function Chip({ label, value, tone }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${TONS[tone] || TONS.info}`}>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  )
}

function mpConnectionLabel(mpStatus) {
  if (!mpStatus) return { text: 'verificando conexão com o Mercado Pago…', tone: 'info' }
  if (!mpStatus.tokenConfigured) return { text: 'MP_ACCESS_TOKEN ausente — configure o token antes de reprocessar', tone: 'critical' }
  if (mpStatus.reachable) return { text: `token válido e Mercado Pago respondendo${mpStatus.accountId ? ` · conta ${mpStatus.accountId}` : ''}`, tone: 'ok' }
  if (mpStatus.tokenInvalid) return { text: 'token rejeitado pelo Mercado Pago (401/403) — atualize o MP_ACCESS_TOKEN', tone: 'critical' }
  return { text: `Mercado Pago indisponível agora${mpStatus.status ? ` (HTTP ${mpStatus.status})` : ''} — aguarde e reprocesse`, tone: 'warn' }
}

function PaymentDlqRunbook({ dlqOpen, lastPrune, onReprocessed }) {
  const [health, setHealth] = useState(null)
  const [mpStatus, setMpStatus] = useState(null)
  const [mfaToken, setMfaToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [feedbackError, setFeedbackError] = useState('')

  async function refreshStatus() {
    const [healthData, mpData] = await Promise.all([
      api.paymentsHealth().catch(() => null),
      api.adminPaymentMpStatus().catch(() => null),
    ])
    setHealth(healthData)
    setMpStatus(mpData)
    return { healthData, mpData }
  }

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => Promise.all([api.paymentsHealth().catch(() => null), api.adminPaymentMpStatus().catch(() => null)]))
      .then(([healthData, mpData]) => {
        if (!active) return
        setHealth(healthData)
        setMpStatus(mpData)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function runReprocess() {
    const abertos = Number(health?.dlqOpen ?? dlqOpen ?? 0)
    // Mexe em pagamento e pode liberar acesso: nunca sem confirmar (Q4 da auditoria).
    if (!window.confirm(`Reprocessar ${numberFmt(abertos)} webhook(s) de pagamento agora? Isso reconcilia com o Mercado Pago e pode liberar acesso de clientes. Continuar?`)) return
    setBusy(true)
    setResult(null)
    setFeedbackError('')
    try {
      // Passo 1: re-enfileirar os webhooks na DLQ como `received`.
      const requeue = await api.adminPaymentDlqReprocess()
      // Passo 2: reconciliar os pendentes contra o Mercado Pago (exige step-up MFA).
      let processed = null
      let mfaRequired = false
      try {
        processed = await api.adminPaymentProcessPending({ mfaToken: mfaToken || undefined })
      } catch (err) {
        if (err?.status === 401) mfaRequired = true
        else throw err
      }
      setResult({ requeue, processed, mfaRequired })
      await refreshStatus()
      await onReprocessed?.()
    } catch (err) {
      setFeedbackError(err?.message || 'Falha ao reprocessar webhooks pendentes.')
    } finally {
      setBusy(false)
    }
  }

  const open = Number(health?.dlqOpen ?? dlqOpen ?? 0)
  const tone = open > 0 ? 'warn' : 'ok'
  const mpConn = mpConnectionLabel(mpStatus)

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${TONS[tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70">Pagamentos pendentes de conferência</p>
          <p className="mt-1 text-sm font-black">{numberFmt(open)} webhook(s) parados · {numberFmt(health?.pendingLast24h ?? 0)} pagamento(s) pendentes (24h)</p>
          <p className="mt-1 text-xs opacity-80">Última limpeza da fila de envio: {lastPrune ? safeDate(lastPrune) : 'sem registro'}</p>
        </div>
        <button
          onClick={runReprocess}
          disabled={busy || open === 0}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Reprocessando…' : 'Reprocessar webhooks pendentes'}
        </button>
      </div>

      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${TONS[mpConn.tone]}`}>
        Conexão Mercado Pago: {mpConn.text}
      </div>

      <p className="mt-3 text-xs leading-relaxed opacity-80">
        Antes de reprocessar, confirme que o Mercado Pago está respondendo acima (token válido). A fila enche quando a
        reconciliação contra o MP falha — quase sempre por <code>MP_ACCESS_TOKEN</code> expirado/revogado ou instabilidade
        do provedor. Reprocessar com a conexão ainda quebrada só devolve os itens à fila.
      </p>

      <label className="mt-4 block text-xs font-bold opacity-80">
        Token MFA (x-admin-mfa-token) — necessário para reconciliar contra o Mercado Pago
        <input
          type="password"
          value={mfaToken}
          onChange={(e) => setMfaToken(e.target.value)}
          placeholder="ADMIN_MFA_TOKEN"
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </label>

      {feedbackError && <p className="mt-3 rounded-xl bg-red-100 p-3 text-xs font-bold text-red-700">{feedbackError}</p>}

      {result && (
        <div className="mt-3 space-y-1 rounded-xl bg-white/70 p-3 text-xs leading-relaxed">
          <p>Re-enfileirados: <strong>{numberFmt(result.requeue?.resolved)}</strong> de {numberFmt(result.requeue?.picked)} selecionados.</p>
          {result.processed
            ? <p>Reconciliados contra o Mercado Pago: <strong>{numberFmt(result.processed?.processed)}</strong> processados · {numberFmt(result.processed?.failed)} falhas (lote de {numberFmt(result.processed?.total)}).</p>
            : result.mfaRequired
              ? <p className="text-amber-800">Itens re-enfileirados, mas a reconciliação exige token MFA válido. Informe o <code>ADMIN_MFA_TOKEN</code> acima e reprocesse, ou aguarde o processador periódico.</p>
              : <p className="text-amber-800">Reconciliação não executada.</p>}
        </div>
      )}
    </div>
  )
}

export default function SaudeSection() {
  const [obs, setObs] = useState(null)
  const [erro, setErro] = useState('')

  async function carregar() {
    const data = await api.adminSystemObservability()
    setObs(data)
    setErro('')
  }

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => carregar()).catch((e) => { if (active) setErro(e?.message || 'Não consegui carregar a saúde do sistema.') })
    return () => { active = false }
  }, [])

  const gate = obs?.goNoGo
  const go = gate?.recommended === 'go'
  const alertas = obs?.alerts ?? []

  return (
    <section id="saude" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">Saúde</p>
          <h2 className="text-lg font-black text-gray-900">Pode subir para produção? (GO / NO-GO)</h2>
        </div>
        <span className={`rounded-full border px-4 py-1 text-xs font-black uppercase tracking-wide ${go ? TONS.ok : TONS.critical}`}>{gate ? (go ? 'go' : 'no-go') : '—'}</span>
      </div>
      {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{erro}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Chip label="Banco" value={gate?.dbOk ? 'OK' : 'Falha'} tone={gate?.dbOk ? 'ok' : 'critical'} />
        <Chip label="Erros 5xx" value={numberFmt(obs?.api?.total5xx)} tone={(obs?.api?.total5xx ?? 0) > 0 ? 'warn' : 'ok'} />
        <Chip label="Pagamentos parados" value={numberFmt(gate?.paymentDlqOpen)} tone={(gate?.paymentDlqOpen ?? 0) > 0 ? 'warn' : 'ok'} />
        <Chip label="No ar há" value={minutes(gate?.uptimeSeconds)} tone={(gate?.uptimeSeconds ?? 0) < 300 ? 'warn' : 'ok'} />
      </div>
      <div className="mt-4 space-y-2">
        {alertas.map((alert, index) => (
          <div key={`${alert.title}-${index}`} className={`rounded-xl border p-3 text-xs ${TONS[toneOf(alert.tone || alert.severity)]}`}>
            <p className="font-black">{alert.title || `Alerta ${index + 1}`}</p>
            <p className="mt-1 opacity-80">{String(alert.value ?? alert.message ?? 'Sem detalhe adicional')}</p>
            {alert.runbook && <p className="mt-1 opacity-80">O que fazer: {alert.runbook}</p>}
          </div>
        ))}
        {obs && alertas.length === 0 && <p className={`rounded-xl border p-3 text-xs font-bold ${TONS.ok}`}>Nenhum alerta ativo agora.</p>}
      </div>
      <PaymentDlqRunbook
        dlqOpen={obs?.queues?.paymentWebhookDlq?.open}
        lastPrune={obs?.queues?.sendDlq?.lastRunAt}
        onReprocessed={carregar}
      />
    </section>
  )
}
