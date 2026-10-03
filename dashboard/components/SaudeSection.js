'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

// Operação > Saúde (auditoria 5.2): o que sobrou útil da antiga
// /admin/observabilidade (apagada) — GO/NO-GO em 4 chips, alertas ativos e a
// fila de webhooks de pagamento (DLQ) com reprocessar + confirmação.

const TONS = {
  ok: 'border-ds-accent/40 bg-ds-accent/10 text-ds-accent-strong',
  warn: 'border-ds-warn/40 bg-ds-warn/10 text-ds-warn-ink',
  critical: 'border-ds-danger/40 bg-ds-danger/10 text-ds-danger',
  info: 'border-ds-line bg-ds-bg text-ds-ink',
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
      <p className="text-[10.5px] font-black uppercase tracking-wide opacity-70">{label}</p>
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
    if (!window.confirm(`Conferir de novo ${numberFmt(abertos)} pagamento(s) parado(s) agora? Isso confere com o Mercado Pago e pode liberar acesso de clientes. Continuar?`)) return
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
      setFeedbackError(err?.message || 'Falha ao conferir os pagamentos de novo.')
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
          <p className="text-[10.5px] font-black uppercase tracking-[0.08em] opacity-70">Pagamentos pendentes de conferência</p>
          <p className="mt-1 text-sm font-black">{numberFmt(open)} pagamento(s) esperando conferência · {numberFmt(health?.pendingLast24h ?? 0)} pagamento(s) pendentes (24h)</p>
          <p className="mt-1 text-xs opacity-80">Última limpeza da fila de envio: {lastPrune ? safeDate(lastPrune) : 'sem registro'}</p>
        </div>
        <button
          onClick={runReprocess}
          disabled={busy || open === 0}
          className="rounded-xl bg-ds-ink px-4 py-2 text-sm font-black text-ds-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Conferindo…' : 'Conferir pagamentos de novo'}
        </button>
      </div>

      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold ${TONS[mpConn.tone]}`}>
        Conexão Mercado Pago: {mpConn.text}
      </div>

      <p className="mt-3 text-xs leading-relaxed opacity-80">
        Antes de conferir de novo, veja acima se o Mercado Pago está respondendo (chave válida). A lista enche quando a
        conferência com o Mercado Pago falha — quase sempre por chave vencida ou revogada, ou por instabilidade
        do Mercado Pago. Conferir com a conexão ainda quebrada só devolve os itens para a lista.
      </p>

      <label className="mt-4 block text-xs font-bold opacity-80">
        Código de confirmação — necessário para conferir com o Mercado Pago
        <input
          type="password"
          value={mfaToken}
          onChange={(e) => setMfaToken(e.target.value)}
          placeholder="Código de confirmação"
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-xs text-ds-ink focus:outline-none focus:ring-2 focus:ring-ds-accent-strong"
        />
      </label>

      {feedbackError && <p className="mt-3 rounded-xl bg-ds-danger/20 p-3 text-xs font-bold text-ds-danger">{feedbackError}</p>}

      {result && (
        <div className="mt-3 space-y-1 rounded-xl bg-ds-surface/70 p-3 text-xs leading-relaxed">
          <p>Voltaram para a lista: <strong>{numberFmt(result.requeue?.resolved)}</strong> de {numberFmt(result.requeue?.picked)} selecionados.</p>
          {result.processed
            ? <p>Conferidos com o Mercado Pago: <strong>{numberFmt(result.processed?.processed)}</strong> processados · {numberFmt(result.processed?.failed)} falhas (lote de {numberFmt(result.processed?.total)}).</p>
            : result.mfaRequired
              ? <p className="text-ds-warn-ink">Os itens voltaram para a lista, mas a conferência exige o código de confirmação. Preencha o campo acima e confira de novo, ou aguarde a conferência automática.</p>
              : <p className="text-ds-warn-ink">A conferência não foi feita.</p>}
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
    <section id="saude" className="rounded-2xl bg-ds-surface p-5 shadow-sm ring-1 ring-ds-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-black uppercase tracking-[0.08em] text-ds-ink-faint">Saúde</p>
          <h2 className="text-lg font-black text-ds-ink">Pode subir para produção?</h2>
        </div>
        <span className={`rounded-full border px-4 py-1 text-xs font-black tracking-wide ${go ? TONS.ok : TONS.critical}`}>{gate ? (go ? 'Pode subir' : 'Não suba agora') : '—'}</span>
      </div>
      {erro && <p className="mt-3 rounded-xl bg-ds-danger/10 p-3 text-xs font-bold text-ds-danger">{erro}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Chip label="Banco" value={gate?.dbOk ? 'OK' : 'Falha'} tone={gate?.dbOk ? 'ok' : 'critical'} />
        <Chip label="Erros do servidor" value={numberFmt(obs?.api?.total5xx)} tone={(obs?.api?.total5xx ?? 0) > 0 ? 'warn' : 'ok'} />
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
