'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { PayingTag } from '@/components/PayingTag'

const asArray = (value) => (Array.isArray(value) ? value : [])

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
}

const SITUACAO_LABELS = {
  active: 'Ativo',
  banned: 'Banido',
  suspended: 'Suspenso',
}

// Cada aba mostra no máximo 8 linhas; o resto fica atrás de "ver tudo". É o que
// impede a página de virar parede de detalhe.
const VISIBLE_ROWS = 8

function Card({ label, value, helper }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-black text-slate-900">{value}</p>
      {helper && <p className="text-xs text-slate-500">{helper}</p>}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-800">{value ?? '—'}</span>
    </div>
  )
}

function ExpandableList({ items, render, emptyLabel }) {
  const [expanded, setExpanded] = useState(false)
  const list = asArray(items)
  if (!list.length) return <p className="py-3 text-sm text-slate-400">{emptyLabel}</p>
  const shown = expanded ? list : list.slice(0, VISIBLE_ROWS)
  return (
    <>
      <div className="space-y-2">{shown.map(render)}</div>
      {list.length > VISIBLE_ROWS && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-xs font-bold text-emerald-700 hover:underline">
          {expanded ? 'Mostrar menos' : `Ver tudo (${list.length})`}
        </button>
      )}
    </>
  )
}

function Row({ children }) {
  return <div className="rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-600">{children}</div>
}

function CadastroTab({ cadastro }) {
  const origem = cadastro?.origin
  const origemTexto = origem
    ? origem.type === 'affiliate'
      ? `Afiliado · ${origem.affiliateName || origem.affiliateEmail || origem.affiliateCode || '—'}`
      : origem.type === 'referral'
        ? `Indicação de ${origem.referrerName || origem.referrerEmail}`
        : [origem.label, origem.detail].filter(Boolean).join(' · ')
    : '—'

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <Field label="Nome" value={cadastro?.name} />
        <Field label="E-mail" value={cadastro?.email} />
        <Field label="Celular" value={cadastro?.contactPhone} />
        <Field label="Celular confirmado" value={formatDateTime(cadastro?.phoneVerifiedAt)} />
        <Field label="Situação da conta" value={SITUACAO_LABELS[cadastro?.status] ?? cadastro?.status} />
      </div>
      <div>
        <Field label="Criou a conta" value={`${formatDate(cadastro?.createdAt)}${cadastro?.ageDays != null ? ` (há ${cadastro.ageDays} dias)` : ''}`} />
        <Field label="Veio por" value={origemTexto} />
        <Field label="Último acesso" value={formatDateTime(cadastro?.lastLoginAt)} />
        <Field label="Aceitou os termos" value={cadastro?.termsAcceptedAt ? `${formatDate(cadastro.termsAcceptedAt)} (versão ${cadastro.termsVersion || '—'})` : '—'} />
        <Field label="Código de indicação" value={cadastro?.referralCode} />
      </div>
    </div>
  )
}

function FinanceiroTab({ financeiro }) {
  const trial = financeiro?.trial ?? {}
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Teste grátis" value={trial.converted ? 'Converteu' : trial.expired ? 'Venceu sem assinar' : 'Em andamento'} helper={trial.converted ? `em ${trial.daysToConvert} dias` : trial.endsAt ? `vence ${formatDate(trial.endsAt)}` : null} />
        <Card label="Plano atual" value={financeiro?.planLabel} helper={financeiro?.accessExpiresAt ? `vence ${formatDate(financeiro.accessExpiresAt)}` : 'sem vencimento'} />
        <Card label="Total pago" value={formatCurrency(financeiro?.ltv)} helper={`${financeiro?.paidCount ?? 0} pagamento(s)`} />
        <Card label="Primeiro pagamento" value={formatDate(financeiro?.firstPaymentAt)} helper={financeiro?.lastPaymentAt ? `último: ${formatDate(financeiro.lastPaymentAt)}` : null} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Assinaturas</h3>
          <ExpandableList
            items={financeiro?.subscriptions}
            emptyLabel="Nunca assinou."
            render={(sub) => (
              <Row key={sub.id ?? sub.startedAt}>
                <span className="font-bold text-slate-900">{sub.planLabel}</span> · {sub.status}
                <span className="block text-xs text-slate-500">
                  Assinou {formatDate(sub.startedAt)}
                  {sub.nextChargeAt ? ` · próxima cobrança ${formatDate(sub.nextChargeAt)}` : ''}
                  {sub.cancelledAt ? ` · cancelou ${formatDate(sub.cancelledAt)}` : ''}
                </span>
              </Row>
            )}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Pagamentos</h3>
          <ExpandableList
            items={financeiro?.payments}
            emptyLabel="Sem pagamentos."
            render={(payment) => (
              <Row key={payment.id ?? payment.createdAt}>
                <span className="font-bold text-slate-900">{formatCurrency(payment.amount)}</span> · {payment.planLabel} · {payment.status}
                <span className="block text-xs text-slate-500">{formatDate(payment.createdAt)}{payment.expiresAt ? ` · acesso até ${formatDate(payment.expiresAt)}` : ''}</span>
              </Row>
            )}
          />
        </div>
      </div>

      {asArray(financeiro?.manualGrants).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Acessos liberados na mão</h3>
          <ExpandableList
            items={financeiro?.manualGrants}
            emptyLabel="Nenhum."
            render={(grant) => (
              <Row key={grant.at}>
                {formatDateTime(grant.at)}
                {grant.reason && <span className="block text-xs text-slate-500">{grant.reason}</span>}
              </Row>
            )}
          />
        </div>
      )}
    </div>
  )
}

function TecnicoTab({ tecnico }) {
  const quedas = tecnico?.disconnects ?? {}
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="WhatsApp" value={tecnico?.waStatus === 'connected' ? 'Conectado' : 'Fora do ar'} helper={tecnico?.waLifecycle === 'reconnecting' ? 'tentando reconectar sozinho' : null} />
        <Card label="Robô" value={tecnico?.botRunning ? 'Rodando' : 'Parado'} helper={tecnico?.lastHeartbeatAt ? `sinal ${formatDateTime(tecnico.lastHeartbeatAt)}` : null} />
        <Card label="Quedas 7 dias" value={formatNumber(quedas.last7d)} helper={`24h: ${formatNumber(quedas.last24h)} · 30d: ${formatNumber(quedas.last30d)}`} />
        <Card label="Última queda" value={tecnico?.lastDisconnectCode || '—'} helper="código informado pelo WhatsApp" />
      </div>

      {/* Todos os números que esta conta já ligou. O card de cima mostra só o
          atual; a lista é o que permite ver troca de chip e cruzar com outras
          contas. Mais de um número não é defeito por si só. */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-800">Números de WhatsApp já ligados</h3>
        {asArray(tecnico?.waPhones).length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {asArray(tecnico.waPhones).map(phone => (
              <li key={phone} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                {phone}
                {phone === tecnico?.waPhone && <span className="ml-2 text-xs font-normal text-emerald-700">atual</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">Nenhuma conexão registrada ainda.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Por que caiu (30 dias)</h3>
          <ExpandableList
            items={quedas.topCodes}
            emptyLabel="Nenhuma queda registrada."
            render={(item) => (
              <Row key={item.code}>
                <span className="font-bold text-slate-900">{item.count}×</span> código {item.code}
              </Row>
            )}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Erros de envio (30 dias)</h3>
          <ExpandableList
            items={tecnico?.errorsByCategory30d}
            emptyLabel="Nenhum erro registrado."
            render={(item) => (
              <Row key={item.category}>
                <span className="font-bold text-slate-900">{item.count}×</span> {item.label}
              </Row>
            )}
          />
        </div>
      </div>

      {asArray(tecnico?.credentialHealth).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Lojas cadastradas</h3>
          <div className="flex flex-wrap gap-2">
            {asArray(tecnico.credentialHealth).map(health => (
              <span
                key={health.platform}
                className={`rounded-full px-3 py-1 text-xs font-bold ${health.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}
              >
                {health.label || health.platform}{health.configured ? '' : ' · falta preencher'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Sparkline({ series }) {
  const data = asArray(series)
  const max = Math.max(1, ...data.map(day => day.success + day.error))
  return (
    <div className="flex h-16 items-end gap-[3px]">
      {data.map(day => {
        const total = day.success + day.error
        return (
          <div
            key={day.date}
            title={`${formatDate(day.date)}: ${day.success} enviadas${day.error ? `, ${day.error} com erro` : ''}`}
            className="flex-1 rounded-t bg-emerald-400"
            style={{ height: `${Math.max(2, (total / max) * 100)}%`, opacity: day.error ? 0.6 : 1 }}
          />
        )
      })}
    </div>
  )
}

// Limite de automações da conta, editável aqui.
//
// A página /admin/automacoes existia só para isto: uma tabela de todas as
// clientes com um campo numérico. Foi removida a pedido da dona do produto
// (2026-09-05) — a pergunta "quantas automações ela pode ter?" nasce olhando
// UMA cliente, não varrendo a base.
function LimiteAutomacoes({ userId, valorAtual, ativas, onSaved }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(valorAtual ?? ''))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar(event) {
    event.preventDefault()
    const numero = Number(valor)
    if (!Number.isInteger(numero) || numero < 1 || numero > 200) {
      setErro('O limite precisa ser um número inteiro entre 1 e 200.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      await api.adminAutomationQuotaUpdate(userId, numero)
      setEditando(false)
      await onSaved?.()
    } catch (err) {
      setErro(err?.message || 'Não consegui salvar o limite.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Limite de automações</h3>
          <p className="mt-1 text-xs text-slate-500">Quantas automações de oferta esta cliente pode manter. Hoje ela tem {formatNumber(ativas)} ligada(s).</p>
        </div>
        {!editando && (
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tabular-nums text-slate-900">{valorAtual ?? '—'}</span>
            <button type="button" onClick={() => { setValor(String(valorAtual ?? '')); setEditando(true) }} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">Alterar</button>
          </div>
        )}
      </div>
      {editando && (
        <form onSubmit={salvar} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            max="200"
            step="1"
            value={valor}
            onChange={(event) => setValor(event.target.value)}
            className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            aria-label="Novo limite de automações"
          />
          <button type="submit" disabled={salvando} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{salvando ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" onClick={() => { setEditando(false); setErro('') }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button>
        </form>
      )}
      {erro && <p className="mt-2 text-xs font-semibold text-red-700">{erro}</p>}
    </div>
  )
}

function UsoTab({ uso, userId, onSaved }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Grupos monitorados" value={formatNumber(uso?.groupCounts?.monitor)} helper={`${formatNumber(uso?.groupCounts?.post)} de destino`} />
        <Card label="Enviadas em 30 dias" value={formatNumber(uso?.success30d)} helper={`7 dias: ${formatNumber(uso?.success7d)} · 24h: ${formatNumber(uso?.success24h)}`} />
        <Card label="Enviadas desde sempre" value={formatNumber(uso?.sendCountTotal)} helper={uso?.lastMessageAt ? `última ${formatDateTime(uso.lastMessageAt)}` : 'nunca enviou'} />
        <Card label="Automações" value={formatNumber(uso?.automations?.enabled)} helper={`${formatNumber(uso?.automations?.total)} cadastradas de um limite de ${uso?.maxAutomations ?? '—'}`} />
      </div>

      <LimiteAutomacoes userId={userId} valorAtual={uso?.maxAutomations} ativas={uso?.automations?.enabled} onSaved={onSaved} />

      <div className="rounded-2xl border border-slate-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Envios por dia (30 dias)</h3>
          <span className="text-xs text-slate-500">{formatNumber(uso?.error30d)} com erro · {formatNumber(uso?.dedupBlocked30d)} repetições bloqueadas</span>
        </div>
        <Sparkline series={uso?.byDay} />
      </div>
    </div>
  )
}

function formatRelative(value) {
  if (!value) return 'sem atividade'
  const ms = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ms)) return 'sem atividade'
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h atrás`
  return `${Math.round(hours / 24)}d atrás`
}

function formatDurationMs(value) {
  const ms = Math.max(0, Number(value ?? 0))
  if (!Number.isFinite(ms) || ms <= 0) return '0min'
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest ? `${hours}h ${rest}min` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours ? `${days}d ${remHours}h` : `${days}d`
}

function statusDoRobo(status, lifecycle) {
  if (status === 'connected') return { label: 'Conectado', cls: 'bg-emerald-100 text-emerald-700' }
  if (status === 'connecting' || lifecycle === 'reconnecting') return { label: lifecycle === 'reconnecting' ? 'Reconectando' : 'Conectando', cls: 'bg-amber-100 text-amber-800' }
  return { label: 'Desconectado', cls: 'bg-red-100 text-red-700' }
}

const TOM_MOTIVO = {
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  purple: 'bg-purple-100 text-purple-800',
  sky: 'bg-sky-100 text-sky-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  slate: 'bg-slate-100 text-slate-700',
}

// Seção "Robô" (G2 fecha o corte do Início): o que era o drawer "Drill-down
// online" e o botão Tentar reconectar das telas Online/Início. Carrega só
// quando a aba abre (GET /online/:id), para a ficha não pagar essa consulta
// em quem só quer ver o cadastro.
function RoboTab({ userId }) {
  const [result, setResult] = useState(null)
  const [reconectando, setReconectando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let cancelled = false
    api.adminOnlineUser(userId)
      .then(detail => { if (!cancelled) setResult({ id: userId, detail, error: '' }) })
      .catch(err => { if (!cancelled) setResult({ id: userId, detail: null, error: err?.message || 'Não consegui carregar a conexão.' }) })
    return () => { cancelled = true }
  }, [userId])

  async function reconnect(id) {
    // Ação sobre a conta de uma cliente: nunca sem confirmar (Q4 da auditoria).
    if (!window.confirm('Subir o robô desta cliente agora? Ela não precisa fazer nada. Se o WhatsApp exigir QR novo, a API recusa e avisa.')) return
    setReconectando(true)
    setAviso('')
    try {
      const resposta = await api.adminOnlineReconnect(id)
      setAviso(resposta?.message || 'Robô iniciado.')
      const detail = await api.adminOnlineUser(id)
      setResult({ id, detail, error: '' })
    } catch (err) {
      setAviso(err?.message || 'Não consegui subir o robô.')
    } finally {
      setReconectando(false)
    }
  }

  if (!result || result.id !== userId) return <LoadingState />
  if (result.error) return <Alert type="error" title="Robô" message={result.error} />
  const detail = result.detail
  const session = detail?.session
  const meta = statusDoRobo(session?.status, session?.lifecycle)
  const cm = detail?.connectionMetrics ?? {}
  const motivo = detail?.disconnectReason

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.cls}`}>{meta.label}</span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Sinal: {formatRelative(session?.lastHeartbeatAt)}</span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">Código: {session?.lastDisconnectCode || '—'}</span>
        {detail?.canAdminRetry && (
          <button
            type="button"
            onClick={() => reconnect(userId)}
            disabled={reconectando}
            className="ml-auto rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {reconectando ? 'Subindo…' : 'Tentar reconectar'}
          </button>
        )}
      </div>
      {aviso && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{aviso}</p>}

      {motivo && meta.label !== 'Conectado' && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Por que caiu</h3>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${TOM_MOTIVO[motivo.tone] || TOM_MOTIVO.slate}`}>{motivo.label}</span>
          <p className="mt-1 text-xs text-slate-500">{motivo.detail}</p>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Card label="Quedas 24h" value={formatNumber(cm.disconnects24h)} />
        <Card label="Reconexões manuais 24h" value={formatNumber(cm.manualReconnects24h)} helper="start/pareamento pedido pela cliente" />
        <Card label="Offline auto 24h" value={formatDurationMs((cm.automaticOfflineMs24h || 0) + (cm.ongoingOfflineMs24h || 0))} helper="tempo até recuperar sozinho" />
        <Card label="Quedas 7d" value={formatNumber(cm.disconnects7d)} />
        <Card label="Reconexões manuais 7d" value={formatNumber(cm.manualReconnects7d)} helper="trabalho real da cliente" />
        <Card label="Parado até a cliente agir 7d" value={formatDurationMs(cm.manualOfflineMs7d)} helper={`${formatNumber(cm.manualRecoveries7d)} episódio(s) que só voltaram com ação dela`} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Linha do tempo das quedas (7 dias)</h3>
        <p className="mt-1 text-[11px] text-slate-500">Cada linha é um episódio fora do ar: quando começou, quanto durou e se o robô voltou sozinho ou só voltou depois que o cliente agiu.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {asArray(detail?.offlineEpisodes).map((ep) => {
            const cls = ep.open ? 'bg-amber-50 text-amber-800' : ep.endedBy === 'sozinho' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            const rotulo = ep.open ? 'em aberto' : ep.endedBy === 'sozinho' ? 'voltou sozinho' : ep.endedBy === 'cliente' ? 'o cliente teve que agir' : 'interrompido'
            return (
              <div key={`${ep.startedAt}-${ep.endedAt || 'aberto'}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 text-sm">
                <div>
                  <p className="font-bold text-slate-900">{formatDateTime(ep.startedAt)} → {ep.endedAt ? formatDateTime(ep.endedAt) : 'agora'}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatDurationMs(ep.durationMs)} fora
                    {ep.code ? ` · código ${ep.code}` : ''}
                    {ep.stuckMsg ? ' · mensagem travada' : ''}
                    {ep.terminal ? ' · sessão deslogada' : ''}
                  </p>
                </div>
                <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black ${cls}`}>{rotulo}</span>
              </div>
            )
          })}
          {!asArray(detail?.offlineEpisodes).length && <p className="py-3 text-sm text-slate-500">Nenhuma queda registrada nos últimos 7 dias.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Erros agrupados por tipo (7d)</h3>
        <div className="mt-3 divide-y divide-slate-100">
          {asArray(detail?.errorsByType).map((item) => (
            <div key={item.errorMsg} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
              <div>
                <p className="break-words text-xs font-bold text-slate-900">{item.errorMsg}</p>
                <p className="mt-1 text-xs text-slate-500">{item.category || 'UNKNOWN'} · último {formatDateTime(item.lastSeenAt)}</p>
              </div>
              <span className="self-start rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{formatNumber(item.count)}x</span>
            </div>
          ))}
          {!asArray(detail?.errorsByType).length && <p className="py-4 text-sm text-slate-500">Sem erros recentes nos últimos 7 dias.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Linha do tempo de conexão</h3>
        <div className="mt-3 space-y-2">
          <ExpandableList
            items={detail?.recentEvents}
            emptyLabel="Sem eventos de conexão nos últimos 7 dias."
            render={(event) => (
              <div key={event.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-slate-900">{event.type}</p>
                  <span className="text-xs font-bold text-slate-500">{formatDateTime(event.occurredAt)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Código {event.code || '—'} · lifecycle {event.lifecycle || '—'}</p>
              </div>
            )}
          />
        </div>
      </section>
    </div>
  )
}

// Ajuste manual de plano/acesso (era o editor do "Drill-down" do Início).
function AjusteDeAcesso({ userId, planoAtual, onApplied }) {
  const [form, setForm] = useState({ plan: planoAtual ?? '', days: '', reason: '', partnerCode: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!window.confirm('Alterar o plano/acesso desta cliente agora? A mudança vale na hora.')) return
    setSaving(true)
    setMessage('')
    try {
      await api.adminUpdateAccess(userId, {
        plan: form.plan || undefined,
        days: form.days === '' ? undefined : Number(form.days),
        reason: form.reason,
        partnerCode: form.partnerCode.trim() || undefined,
      })
      setMessage('Acesso atualizado com sucesso.')
      setForm((current) => ({ ...current, days: '', reason: '', partnerCode: '' }))
      await onApplied?.()
    } catch (err) {
      setMessage(err.message || 'Falha ao atualizar acesso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Ajuste manual de plano/acesso</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
          <option value="">Sem alterar plano</option>
          <option value="trial">trial</option>
          <option value="basic">basic</option>
          <option value="pro">pro</option>
          <option value="premium">premium (Instagram Stories)</option>
        </select>
        <input value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} type="number" min="-365" max="365" placeholder="Dias (+/-)" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" />
        <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Motivo (obrigatório)" className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" required minLength={5} />
      </div>
      <div className="mt-2">
        <input value={form.partnerCode} onChange={(e) => setForm((f) => ({ ...f, partnerCode: e.target.value }))} placeholder="Código do parceiro influenciador (opcional — só para cortesia de parceria)" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" maxLength={32} />
        <p className="mt-1 text-[11px] text-slate-500">Preenchendo aqui, o motivo é gravado como <code>parceiro-influenciador:&lt;código&gt;</code>, o que permite auditar depois quantas cortesias de parceria estão de pé. Cada cortesia ativa é uma sessão WhatsApp a mais no servidor.</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">Altera plano e/ou expiração imediatamente.</p>
        <button disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Aplicando...' : 'Aplicar acesso'}</button>
      </div>
      {message && <p className="mt-2 text-xs text-slate-700">{message}</p>}
    </form>
  )
}

// Registrar contato (era o botão da fila de Sucesso do Cliente e da tabela de
// WhatsApp desconectado). Fica na ficha porque o contato nasce olhando UMA cliente.
function RegistrarContato({ userId, onSaved }) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!notes.trim()) return
    setSaving(true)
    setMessage('')
    try {
      await api.adminCreateContactLog(userId, { channel: 'whatsapp', reason: 'support', outcome: 'contacted', notes: notes.trim() })
      setNotes('')
      setMessage('Contato registrado.')
      await onSaved?.()
    } catch (err) {
      setMessage(err.message || 'Falha ao registrar contato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <form onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Registrar contato</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Resumo do que foi conversado" className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs" />
        <div className="mt-2 flex items-center justify-between gap-2">
          {message ? <p className="text-xs text-slate-700">{message}</p> : <span />}
          <button disabled={saving || !notes.trim()} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Registrar contato'}</button>
        </div>
      </form>
    </div>
  )
}

function AtendimentoTab({ history, onChanged }) {
  return (
    <div className="space-y-5">
      <RegistrarContato userId={history.id} onSaved={onChanged} />
      <AjusteDeAcesso key={`${history.id}-${history.financeiro?.plan}`} userId={history.id} planoAtual={history.financeiro?.plan} onApplied={onChanged} />
    </div>
  )
}

const KIND_STYLES = {
  cadastro: ['bg-slate-100 text-slate-700', 'Cadastro'],
  financeiro: ['bg-emerald-100 text-emerald-800', 'Financeiro'],
  tecnico: ['bg-red-100 text-red-700', 'Técnico'],
  uso: ['bg-sky-100 text-sky-800', 'Uso'],
  suporte: ['bg-violet-100 text-violet-800', 'Suporte'],
}

function Timeline({ events }) {
  const list = asArray(events)
  if (!list.length) return <p className="text-sm text-slate-400">Sem histórico ainda.</p>
  return (
    <ol className="space-y-3">
      {list.map((event, index) => {
        const [tone, label] = KIND_STYLES[event.kind] ?? ['bg-slate-100 text-slate-700', event.kind]
        return (
          <li key={`${event.at}-${index}`} className="border-l-2 border-slate-100 pl-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{label}</span>
              <span className="text-xs text-slate-400">{formatDate(event.at)}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">{event.title}</p>
            {event.detail && <p className="text-xs text-slate-500">{event.detail}</p>}
          </li>
        )
      })}
    </ol>
  )
}

const TABS = [
  ['cadastro', 'Cadastro'],
  ['financeiro', 'Financeiro'],
  ['tecnico', 'Técnico'],
  ['uso', 'Uso'],
  ['robo', 'Robô'],
  ['atendimento', 'Atendimento'],
]

// Bloquear / banir / desbloquear a conta. Ação pesada: só quem o servidor
// deixa (`podeBloquear`), motivo de 10+ letras e dupla confirmação — o
// window.confirm e depois digitar o e-mail da conta. O servidor confere tudo
// de novo (src/domain/admin/blockPolicy.js).
function BloquearConta({ userId, email, status, podeBloquear, onSaved }) {
  const [aberto, setAberto] = useState(false)
  const [alvo, setAlvo] = useState('suspended')
  const [motivo, setMotivo] = useState('')
  const [emailDigitado, setEmailDigitado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  if (!podeBloquear) return null
  const bloqueada = status === 'suspended' || status === 'banned'

  async function confirmar(event) {
    event.preventDefault()
    if (motivo.trim().length < 10) { setErro('Escreva o motivo com pelo menos 10 letras.'); return }
    if (emailDigitado.trim().toLowerCase() !== String(email ?? '').trim().toLowerCase()) { setErro('O e-mail digitado não é o da conta.'); return }
    const pergunta = bloqueada
      ? `Liberar o acesso de ${email}? A cliente volta a entrar no painel.`
      : `${alvo === 'banned' ? 'BANIR' : 'Suspender'} a conta de ${email}? Ela perde o acesso ao painel e o motivo aparece para ela.`
    if (!window.confirm(pergunta)) return
    setSalvando(true)
    setErro('')
    try {
      const corpo = { reason: motivo.trim(), confirmEmail: emailDigitado.trim() }
      if (bloqueada) await api.adminUserUnblock(userId, corpo)
      else await api.adminUserBlock(userId, { ...corpo, status: alvo })
      setAberto(false)
      setMotivo('')
      setEmailDigitado('')
      await onSaved?.()
    } catch (err) {
      setErro(err?.message || 'Não consegui concluir.')
    } finally {
      setSalvando(false)
    }
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
        {bloqueada ? 'Desbloquear conta' : 'Bloquear / banir conta'}
      </button>
    )
  }

  return (
    <form onSubmit={confirmar} className="w-full max-w-md space-y-2 rounded-2xl border border-red-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-800">{bloqueada ? 'Desbloquear conta' : 'Bloquear ou banir conta'}</h3>
      {!bloqueada && (
        <select value={alvo} onChange={e => setAlvo(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="suspended">Suspender (pode ser desfeito)</option>
          <option value="banned">Banir</option>
        </select>
      )}
      <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} maxLength={400} placeholder="Motivo (mínimo 10 letras)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      <input value={emailDigitado} onChange={e => setEmailDigitado(e.target.value)} placeholder={`Digite ${email ?? 'o e-mail da conta'} para confirmar`} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      {erro && <p className="text-xs font-semibold text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{salvando ? 'Salvando...' : 'Confirmar'}</button>
        <button type="button" onClick={() => { setAberto(false); setErro('') }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
      </div>
    </form>
  )
}

export default function AdminClienteHistoricoPage() {
  const params = useParams()
  const id = params?.id
  const [tab, setTab] = useState('cadastro')
  // Estado único carimbado com o cliente que o produziu. "Carregando" e "erro"
  // são DERIVADOS — flag de loading setada dentro do efeito dispara
  // renderização em cascata (react-hooks/set-state-in-effect) e ainda podia
  // mostrar o histórico de um cliente enquanto a URL já apontava para outro.
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    api.adminCustomerHistory(id)
      .then(history => { if (!cancelled) setResult({ id, history, error: '' }) })
      .catch(err => { if (!cancelled) setResult({ id, history: null, error: err?.message || 'Não foi possível carregar o histórico.' }) })
    return () => { cancelled = true }
  }, [id])

  // Recarrega o histórico depois de uma edição na própria tela (limite de
  // automações), sem piscar a página inteira.
  async function reload() {
    if (!id) return
    try {
      const history = await api.adminCustomerHistory(id)
      setResult({ id, history, error: '' })
    } catch (err) {
      setResult({ id, history: null, error: err?.message || 'Não foi possível recarregar o histórico.' })
    }
  }

  const isCurrent = result?.id === id
  const loading = !isCurrent
  const error = isCurrent ? result.error : ''
  const history = isCurrent ? result.history : null

  if (loading) return <main className="min-h-screen bg-slate-50 px-5 py-8"><LoadingState /></main>
  if (error) return <main className="min-h-screen bg-slate-50 px-5 py-8"><div className="mx-auto max-w-3xl"><Alert type="error" title="Histórico do cliente" message={error} /></div></main>
  if (!history) return null

  const headline = history.headline ?? {}

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Histórico do cliente</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900">{history.cadastro?.name || history.cadastro?.email}</h1>
              <PayingTag status={history.paying?.status} />
            </div>
            <p className="text-sm text-slate-500">{history.cadastro?.email} · {history.cadastro?.contactPhone || 'sem celular'}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <BloquearConta userId={history.id} email={history.cadastro?.email} status={history.cadastro?.status} podeBloquear={history.podeBloquear === true} onSaved={reload} />
            <Link href="/admin/clientes" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Voltar à lista</Link>
          </div>
        </div>

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Situação" value={SITUACAO_LABELS[headline.situacao] ?? headline.situacao ?? '—'} />
          <Card label="Plano" value={headline.plano} />
          <Card label="Vence em" value={formatDate(headline.vencimento)} />
          <Card label="Total pago" value={formatCurrency(headline.ltv)} />
          <Card label="Envios 30d" value={formatNumber(headline.envios30d)} />
          <Card label="Quedas 7d" value={formatNumber(headline.quedas7d)} />
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <nav className="mb-4 flex flex-wrap gap-1">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === key ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'cadastro' && <CadastroTab cadastro={history.cadastro} />}
            {tab === 'financeiro' && <FinanceiroTab financeiro={history.financeiro} />}
            {tab === 'tecnico' && <TecnicoTab tecnico={history.tecnico} />}
            {tab === 'uso' && <UsoTab uso={history.uso} userId={history.id} onSaved={reload} />}
            {tab === 'robo' && <RoboTab userId={history.id} />}
            {tab === 'atendimento' && <AtendimentoTab history={history} onChanged={reload} />}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-800">Linha do tempo</h2>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <Timeline events={history.timeline} />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
