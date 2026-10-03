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
    <div className="rounded-xl bg-ds-bg p-3">
      <p className="text-xs text-ds-ink-faint">{label}</p>
      <p className="text-lg font-black text-ds-ink">{value}</p>
      {helper && <p className="text-xs text-ds-ink-soft">{helper}</p>}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ds-line py-2 last:border-0">
      <span className="text-sm text-ds-ink-soft">{label}</span>
      <span className="text-right text-sm font-semibold text-ds-ink">{value ?? '—'}</span>
    </div>
  )
}

function ExpandableList({ items, render, emptyLabel }) {
  const [expanded, setExpanded] = useState(false)
  const list = asArray(items)
  if (!list.length) return <p className="py-3 text-sm text-ds-ink-faint">{emptyLabel}</p>
  const shown = expanded ? list : list.slice(0, VISIBLE_ROWS)
  return (
    <>
      <div className="space-y-2">{shown.map(render)}</div>
      {list.length > VISIBLE_ROWS && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-xs font-bold text-ds-accent-strong hover:underline">
          {expanded ? 'Mostrar menos' : `Ver tudo (${list.length})`}
        </button>
      )}
    </>
  )
}

function Row({ children }) {
  return <div className="rounded-xl border border-ds-line px-3 py-2 text-sm text-ds-ink-soft">{children}</div>
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

// Cobranças recorrentes DESTA cliente (mesma fonte do Financeiro > Cobranças
// recorrentes, filtrada pelo e-mail e depois pelo id). Carrega ao abrir a aba.
function CobrancasDaCliente({ userId, email }) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let active = true
    Promise.resolve().then(() => api.adminSubscriptionCharges({ q: email || '', days: 365, limit: 100 }))
      .then(data => { if (active) setState({ rows: asArray(data?.charges).filter(c => c.userId === userId), error: '' }) })
      .catch(err => { if (active) setState({ rows: [], error: err?.message || 'Não consegui carregar as cobranças.' }) })
    return () => { active = false }
  }, [userId, email])
  const rows = state?.rows ?? []
  const aprovadas = rows.filter(r => r.outcome === 'aprovada')
  const recusadas = rows.filter(r => r.outcome === 'recusada')
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-ds-ink">Cobranças da assinatura (últimos 12 meses)</h3>
      {!state && <p className="text-sm text-ds-ink-soft">Carregando…</p>}
      {state?.error && <Alert type="error" title="Cobranças" message={state.error} />}
      {state && !state.error && (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Card label="Tentativas" value={formatNumber(rows.length)} />
            <Card label="Cobrou" value={formatNumber(aprovadas.length)} helper={formatCurrency(aprovadas.reduce((t, r) => t + Number(r.amount ?? 0), 0))} />
            <Card label="Recusadas" value={formatNumber(recusadas.length)} />
          </div>
          {rows.length === 0 ? <p className="text-sm text-ds-ink-soft">Nenhuma cobrança de assinatura registrada.</p> : (
            <ExpandableList
              items={rows}
              emptyLabel="Nenhuma."
              render={(c) => (
                <Row key={c.id}>
                  <span className="font-bold text-ds-ink">{c.amount == null ? '—' : formatCurrency(c.amount)}</span> · {c.statusLabel}
                  <span className="block text-xs text-ds-ink-soft">{formatDate(c.attemptedAt)}{c.returnMessage ? ` · ${c.returnMessage}` : ''}{c.returnCode ? ` (${c.returnCode})` : ''}</span>
                </Row>
              )}
            />
          )}
        </>
      )}
    </div>
  )
}

const ACAO_LABELS = {
  update: 'Vai mudar',
  none: 'Já bate com o Mercado Pago',
  unreachable: 'Não consegui consultar o Mercado Pago',
}

// Sincronizar com o Mercado Pago em duas etapas: 1) "Ver diferença" só lê;
// 2) "Aplicar" pede confirmação e manda de volta o diff que está na tela.
function SincronizarMP({ userId, onApplied }) {
  const [diff, setDiff] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function ver() {
    setBusy(true); setMsg('')
    try { setDiff(await api.adminAssinaturaDiff(userId)) }
    catch (err) { setMsg(err?.message || 'Não consegui consultar o Mercado Pago.') }
    finally { setBusy(false) }
  }

  async function aplicar() {
    if (!diff) return
    if (!window.confirm(`Gravar aqui o que o Mercado Pago respondeu (${diff.pending} assinatura(s) vão mudar)? A cliente não precisa fazer nada. Fica registrado na auditoria.`)) return
    setBusy(true); setMsg('')
    try {
      const r = await api.adminAssinaturaSincronizar(userId, diff)
      setMsg(r.stale > 0 ? `Gravado: ${r.applied}. ${r.stale} mudou(aram) no meio do caminho e não foi/foram gravada(s) — veja a diferença de novo.` : `Gravado: ${r.applied}.`)
      setDiff(null)
      await onApplied?.()
    } catch (err) { setMsg(err?.message || 'Não consegui gravar.') }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-ds-line p-4">
      <h3 className="mb-1 text-sm font-bold text-ds-ink">Sincronizar com o Mercado Pago</h3>
      <p className="mb-3 text-xs text-ds-ink-soft">Primeiro mostra o que mudaria; só grava depois que você confirmar.</p>
      <button type="button" disabled={busy} onClick={ver} className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink hover:bg-ds-bg disabled:opacity-50">
        {busy && !diff ? 'Consultando…' : 'Ver diferença'}
      </button>
      {msg && <p className="mt-3 text-sm text-ds-ink">{msg}</p>}
      {diff && (
        <div className="mt-3 space-y-2">
          {!diff.hasSubscriptions && <p className="text-sm text-ds-ink-soft">Nenhuma assinatura recorrente (só pagamento avulso).</p>}
          {asArray(diff.items).map(item => (
            <Row key={item.subscriptionId}>
              <span className="font-bold text-ds-ink">{item.plan}</span> · {ACAO_LABELS[item.action] ?? item.action}
              <span className="block text-xs text-ds-ink-soft">Aqui: {item.storedStatus} · próxima {formatDate(item.storedNextChargeAt)}</span>
              {item.action === 'unreachable'
                ? <span className="block text-xs text-ds-ink-soft">{item.reason}</span>
                : <span className="block text-xs text-ds-ink-soft">Mercado Pago: {item.mpStatus || '?'} · próxima {formatDate(item.mpNextChargeAt)}</span>}
              {item.action === 'update' && <span className="block text-xs font-bold text-ds-warn-ink">Depois: {item.newStatus} · próxima {formatDate(item.newNextChargeAt)}</span>}
            </Row>
          ))}
          {diff.pending > 0 && (
            <button type="button" disabled={busy} onClick={aplicar} className="rounded-xl bg-ds-accent-strong px-3 py-2 text-sm font-bold text-ds-surface hover:bg-ds-accent-strong/85 disabled:opacity-50">
              {busy ? 'Gravando…' : `Aplicar ${diff.pending} mudança(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// "Testar renovação": os 6 elos da cobrança automática, só leitura.
function TestarRenovacao({ userId }) {
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  async function testar() {
    setBusy(true); setErro('')
    try { setRes(await api.adminAssinaturaTestarRenovacao(userId)) }
    catch (err) { setErro(err?.message || 'Não consegui testar agora.') }
    finally { setBusy(false) }
  }
  const marca = (ok) => (ok === true ? '✓' : ok === false ? '✗' : '?')
  return (
    <div className="rounded-xl border border-ds-line p-4">
      <h3 className="mb-1 text-sm font-bold text-ds-ink">Testar renovação</h3>
      <p className="mb-3 text-xs text-ds-ink-soft">Confere os 6 passos da cobrança automática. Só lê, não altera nada.</p>
      <button type="button" disabled={busy} onClick={testar} className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink hover:bg-ds-bg disabled:opacity-50">
        {busy ? 'Testando…' : 'Testar renovação'}
      </button>
      {erro && <p className="mt-3 text-sm text-ds-danger">{erro}</p>}
      {res && (
        <div className="mt-3 space-y-2">
          {asArray(res.elos).map((elo, i) => (
            <Row key={elo.id}>
              <span className="font-bold text-ds-ink">{marca(elo.ok)} {i + 1}. {elo.title}</span>
              {asArray(elo.lines).map(l => <span key={l} className="block text-xs text-ds-ink-soft">{l}</span>)}
            </Row>
          ))}
          <p className={`text-sm font-bold ${res.verdict?.armed ? 'text-ds-accent-strong' : 'text-ds-warn-ink'}`}>{res.verdict?.text}</p>
        </div>
      )}
    </div>
  )
}

function FinanceiroTab({ financeiro, userId, email, onChanged }) {
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
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Assinaturas</h3>
          <ExpandableList
            items={financeiro?.subscriptions}
            emptyLabel="Nunca assinou."
            render={(sub) => (
              <Row key={sub.id ?? sub.startedAt}>
                <span className="font-bold text-ds-ink">{sub.planLabel}</span> · {sub.status}
                <span className="block text-xs text-ds-ink-soft">
                  Assinou {formatDate(sub.startedAt)}
                  {sub.nextChargeAt ? ` · próxima cobrança ${formatDate(sub.nextChargeAt)}` : ''}
                  {sub.cancelledAt ? ` · cancelou ${formatDate(sub.cancelledAt)}` : ''}
                </span>
              </Row>
            )}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Pagamentos</h3>
          <ExpandableList
            items={financeiro?.payments}
            emptyLabel="Sem pagamentos."
            render={(payment) => (
              <Row key={payment.id ?? payment.createdAt}>
                <span className="font-bold text-ds-ink">{formatCurrency(payment.amount)}</span> · {payment.planLabel} · {payment.status}
                <span className="block text-xs text-ds-ink-soft">{formatDate(payment.createdAt)}{payment.expiresAt ? ` · acesso até ${formatDate(payment.expiresAt)}` : ''}</span>
              </Row>
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SincronizarMP userId={userId} onApplied={onChanged} />
        <TestarRenovacao userId={userId} />
      </div>

      <CobrancasDaCliente userId={userId} email={email} />

      {asArray(financeiro?.manualGrants).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Acessos liberados na mão</h3>
          <ExpandableList
            items={financeiro?.manualGrants}
            emptyLabel="Nenhum."
            render={(grant) => (
              <Row key={grant.at}>
                {formatDateTime(grant.at)}
                {grant.reason && <span className="block text-xs text-ds-ink-soft">{grant.reason}</span>}
              </Row>
            )}
          />
        </div>
      )}
    </div>
  )
}

const CHAVE_STATUS_VISUAL = {
  ok: { texto: 'Funcionando', classe: 'bg-ds-accent/20 text-ds-accent-strong' },
  vencida: { texto: 'Vencida', classe: 'bg-ds-danger/20 text-ds-danger' },
  recusada: { texto: 'Recusada pela loja', classe: 'bg-ds-danger/20 text-ds-danger' },
  'sem-medicao': { texto: 'Sem medição', classe: 'bg-ds-bg-soft text-ds-ink-soft' },
}

function haQuanto(ms) {
  if (!Number.isFinite(ms)) return ''
  const dias = Math.floor(ms / 86_400_000)
  if (dias >= 1) return `aviso há ${dias} d`
  return `aviso há ${Math.max(1, Math.floor(ms / 3_600_000))} h`
}

// Chaves das lojas (M6): status vindo do último aviso da sondagem diária, e o
// botão "Testar chave" que sonda UMA loja agora (só leitura, não grava nada).
function ChavesLojas({ userId, chaves }) {
  const [testes, setTestes] = useState({})
  const [ocupada, setOcupada] = useState('')
  const lista = asArray(chaves)
  if (!lista.length) return null

  async function testar(platform) {
    if (!window.confirm('Testar a chave desta loja agora? É uma consulta de leitura à loja; não muda nada na conta da cliente.')) return
    setOcupada(platform)
    try {
      const r = await api.adminTestarChaveLoja(userId, platform)
      setTestes(t => ({ ...t, [platform]: r }))
    } catch (err) {
      setTestes(t => ({ ...t, [platform]: { erro: err?.message || 'Não consegui testar.' } }))
    } finally {
      setOcupada('')
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-ds-ink">Chaves das lojas</h3>
      <ul className="space-y-2">
        {lista.map(chave => {
          const teste = testes[chave.platform]
          const efetivo = teste && !teste.erro ? teste.status : chave.status
          const visual = CHAVE_STATUS_VISUAL[efetivo] ?? CHAVE_STATUS_VISUAL['sem-medicao']
          return (
            <li key={chave.platform} className="flex flex-wrap items-center gap-3 rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm">
              <span className="font-bold text-ds-ink">{chave.label}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${visual.classe}`}>{visual.texto}</span>
              <span className="text-xs text-ds-ink-soft">
                {teste?.erro ? teste.erro
                  : teste ? (teste.alive === null ? 'Teste sem resposta da loja (não conta como vencida).' : `testada agora (${formatDateTime(teste.checkedAt)})`)
                    : (haQuanto(chave.sinceMs) || 'a sondagem diária não achou problema registrado')}
              </span>
              <button
                type="button"
                disabled={ocupada === chave.platform}
                onClick={() => testar(chave.platform)}
                className="ml-auto rounded-xl border border-ds-line px-3 py-1 text-xs font-bold text-ds-ink hover:bg-ds-bg disabled:opacity-50"
              >
                {ocupada === chave.platform ? 'Testando...' : 'Testar chave'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TecnicoTab({ tecnico, userId, chavesLojas }) {
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
        <h3 className="mb-2 text-sm font-bold text-ds-ink">Números de WhatsApp já ligados</h3>
        {asArray(tecnico?.waPhones).length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {asArray(tecnico.waPhones).map(phone => (
              <li key={phone} className="rounded-lg border border-ds-line bg-ds-surface px-3 py-1 text-sm font-semibold text-ds-ink">
                {phone}
                {phone === tecnico?.waPhone && <span className="ml-2 text-xs font-normal text-ds-accent-strong">atual</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ds-ink-faint">Nenhuma conexão registrada ainda.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Por que caiu (30 dias)</h3>
          <ExpandableList
            items={quedas.topCodes}
            emptyLabel="Nenhuma queda registrada."
            render={(item) => (
              <Row key={item.code}>
                <span className="font-bold text-ds-ink">{item.count}×</span> código {item.code}
              </Row>
            )}
          />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Erros de envio (30 dias)</h3>
          <ExpandableList
            items={tecnico?.errorsByCategory30d}
            emptyLabel="Nenhum erro registrado."
            render={(item) => (
              <Row key={item.category}>
                <span className="font-bold text-ds-ink">{item.count}×</span> {item.label}
              </Row>
            )}
          />
        </div>
      </div>

      <ChavesLojas userId={userId} chaves={chavesLojas} />

      {asArray(tecnico?.credentialHealth).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Lojas cadastradas</h3>
          <div className="flex flex-wrap gap-2">
            {asArray(tecnico.credentialHealth).map(health => (
              <span
                key={health.platform}
                className={`rounded-full px-3 py-1 text-xs font-bold ${health.configured ? 'bg-ds-accent/20 text-ds-accent-strong' : 'bg-ds-warn/20 text-ds-warn-ink'}`}
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
            className="flex-1 rounded-t bg-ds-accent"
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
    <div className="rounded-2xl border border-ds-line bg-ds-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ds-ink">Limite de automações</h3>
          <p className="mt-1 text-xs text-ds-ink-soft">Quantas automações de oferta esta cliente pode manter. Hoje ela tem {formatNumber(ativas)} ligada(s).</p>
        </div>
        {!editando && (
          <div className="flex items-center gap-3">
            <span className="text-[28px] font-black tabular-nums text-ds-ink">{valorAtual ?? '—'}</span>
            <button type="button" onClick={() => { setValor(String(valorAtual ?? '')); setEditando(true) }} className="rounded-lg bg-ds-accent/10 px-3 py-2 text-xs font-bold text-ds-accent-strong hover:bg-ds-accent/20">Alterar</button>
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
            className="w-28 rounded-xl border border-ds-line px-3 py-2 text-sm"
            aria-label="Novo limite de automações"
          />
          <button type="submit" disabled={salvando} className="rounded-xl bg-ds-accent-strong px-4 py-2 text-sm font-bold text-ds-surface disabled:opacity-60">{salvando ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" onClick={() => { setEditando(false); setErro('') }} className="rounded-xl border border-ds-line px-4 py-2 text-sm font-semibold text-ds-ink-soft">Cancelar</button>
        </form>
      )}
      {erro && <p className="mt-2 text-xs font-semibold text-ds-danger">{erro}</p>}
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

      <div className="rounded-2xl border border-ds-line p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ds-ink">Envios por dia (30 dias)</h3>
          <span className="text-xs text-ds-ink-soft">{formatNumber(uso?.error30d)} com erro · {formatNumber(uso?.dedupBlocked30d)} repetições bloqueadas</span>
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
  if (status === 'connected') return { label: 'Conectado', cls: 'bg-ds-accent/20 text-ds-accent-strong' }
  if (status === 'connecting' || lifecycle === 'reconnecting') return { label: lifecycle === 'reconnecting' ? 'Reconectando' : 'Conectando', cls: 'bg-ds-warn/20 text-ds-warn-ink' }
  return { label: 'Desconectado', cls: 'bg-ds-danger/20 text-ds-danger' }
}

// Nomes leigos dos eventos de conexão (o `type` cru continua sendo o fallback).
const ROTULO_EVENTO = {
  manual_stop_requested: 'Robô parado de propósito',
  admin_reconnect_requested: 'Admin pediu reconexão',
  manual_reconnect_requested: 'Cliente pediu reconexão',
  manual_pairing_requested: 'Cliente pediu novo pareamento',
  connected: 'Conectou',
  reconnect_attempt: 'Tentando reconectar',
  reconnect_success: 'Reconectou',
}

const TOM_MOTIVO = {
  red: 'bg-ds-danger/20 text-ds-danger',
  amber: 'bg-ds-warn/20 text-ds-warn-ink',
  purple: 'bg-ds-pro-soft text-ds-pro-ink',
  sky: 'bg-ds-bg-soft text-ds-ink-soft',
  emerald: 'bg-ds-accent/20 text-ds-accent-strong',
  slate: 'bg-ds-bg-soft text-ds-ink',
}

// Seção "Robô" (G2 fecha o corte do Início): o que era o drawer "Drill-down
// online" e o botão Tentar reconectar das telas Online/Início. Carrega só
// quando a aba abre (GET /online/:id), para a ficha não pagar essa consulta
// em quem só quer ver o cadastro.
function RoboTab({ userId }) {
  const [result, setResult] = useState(null)
  const [reconectando, setReconectando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [parando, setParando] = useState(false)
  const [diag, setDiag] = useState(null)
  const [diagCarregando, setDiagCarregando] = useState(false)
  const [diagCx, setDiagCx] = useState(null)
  const [diagCxCarregando, setDiagCxCarregando] = useState(false)

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
    const motivoReconexao = (window.prompt('Motivo (fica registrado na auditoria, mín. 5 letras):') || '').trim()
    if (motivoReconexao.length < 5) { setAviso('Reconexão cancelada: o motivo precisa ter pelo menos 5 letras.'); return }
    setReconectando(true)
    setAviso('')
    try {
      const resposta = await api.adminOnlineReconnect(id, motivoReconexao)
      setAviso(resposta?.message || 'Robô iniciado.')
      const detail = await api.adminOnlineUser(id)
      setResult({ id, detail, error: '' })
    } catch (err) {
      setAviso(err?.message || 'Não consegui subir o robô.')
    } finally {
      setReconectando(false)
    }
  }

  async function parar(id) {
    // Parar é escolha, não falha: a cliente não recebe aviso de "robô caiu" e o
    // supervisor não religa sozinho. Nunca sem confirmar e sem motivo.
    if (!window.confirm('Parar o robô desta cliente? Ele só volta quando ela conectar de novo (ou você usar "Tentar reconectar"). Ela não recebe aviso de queda.')) return
    const motivoParada = (window.prompt('Motivo (fica registrado na auditoria, mín. 5 letras):') || '').trim()
    if (motivoParada.length < 5) { setAviso('Parada cancelada: o motivo precisa ter pelo menos 5 letras.'); return }
    setParando(true)
    setAviso('')
    try {
      const resposta = await api.adminSessionStop(id, motivoParada)
      setAviso(resposta?.message || 'Robô parado.')
      const detail = await api.adminOnlineUser(id)
      setResult({ id, detail, error: '' })
    } catch (err) {
      setAviso(err?.message || 'Não consegui parar o robô.')
    } finally {
      setParando(false)
    }
  }

  async function diagnosticarConexao(id) {
    setDiagCxCarregando(true)
    try {
      setDiagCx({ data: await api.adminDiagnosticoConexao(id), error: '' })
    } catch (err) {
      setDiagCx({ data: null, error: err?.message || 'Não consegui fazer o diagnóstico.' })
    } finally {
      setDiagCxCarregando(false)
    }
  }

  async function diagnosticar(id) {
    setDiagCarregando(true)
    try {
      setDiag({ data: await api.adminDiagnosticoEnvios(id), error: '' })
    } catch (err) {
      setDiag({ data: null, error: err?.message || 'Não consegui fazer o diagnóstico.' })
    } finally {
      setDiagCarregando(false)
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
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ds-line bg-ds-bg p-4">
        <span className={`rounded-full px-3 py-1 text-xs font-black ${meta.cls}`}>{meta.label}</span>
        <span className="rounded-full bg-ds-surface px-3 py-1 text-xs font-bold text-ds-ink-soft ring-1 ring-ds-line">Sinal: {formatRelative(session?.lastHeartbeatAt)}</span>
        <span className="rounded-full bg-ds-surface px-3 py-1 text-xs font-bold text-ds-ink-soft ring-1 ring-ds-line">Código: {session?.lastDisconnectCode || '—'}</span>
        {detail?.canAdminRetry && (
          <button
            type="button"
            onClick={() => reconnect(userId)}
            disabled={reconectando}
            className="ml-auto rounded-lg bg-ds-accent-strong px-3 py-2 text-xs font-black text-ds-surface hover:bg-ds-accent-strong/85 disabled:opacity-60"
          >
            {reconectando ? 'Subindo…' : 'Tentar reconectar'}
          </button>
        )}
        {session?.lifecycle !== 'stopped_by_user' && (
          <button
            type="button"
            onClick={() => parar(userId)}
            disabled={parando}
            className={`${detail?.canAdminRetry ? '' : 'ml-auto '}rounded-lg border border-ds-danger/60 bg-ds-surface px-3 py-2 text-xs font-black text-ds-danger hover:bg-ds-danger/10 disabled:opacity-60`}
          >
            {parando ? 'Parando…' : 'Parar robô'}
          </button>
        )}
      </div>
      {aviso && <p className="rounded-xl bg-ds-bg-soft px-3 py-2 text-sm text-ds-ink">{aviso}</p>}

      {motivo && meta.label !== 'Conectado' && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-ds-ink">Por que caiu</h3>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${TOM_MOTIVO[motivo.tone] || TOM_MOTIVO.slate}`}>{motivo.label}</span>
          <p className="mt-1 text-xs text-ds-ink-soft">{motivo.detail}</p>
        </div>
      )}

      <section className="rounded-2xl border border-ds-line bg-ds-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink">Por que não envia?</h3>
          <button
            type="button"
            onClick={() => diagnosticar(userId)}
            disabled={diagCarregando}
            className="rounded-lg bg-ds-ink px-3 py-2 text-xs font-black text-ds-surface hover:bg-ds-ink-soft disabled:opacity-60"
          >
            {diagCarregando ? 'Verificando…' : 'Verificar agora'}
          </button>
        </div>
        <p className="mt-1 text-[10.5px] text-ds-ink-soft">Confere, nesta ordem: conta, robô, WhatsApp, grupos e envios das últimas 6 horas. A primeira que falhar é a causa.</p>
        {diag?.error && <p className="mt-3 text-sm text-ds-danger">{diag.error}</p>}
        {diag?.data && (
          <div className="mt-3 space-y-2">
            <p className={`rounded-xl px-3 py-2 text-sm font-bold ${diag.data.veredito.ok ? 'bg-ds-accent/10 text-ds-accent-strong' : 'bg-ds-warn/10 text-ds-ink'}`}>{diag.data.veredito.frase}</p>
            <ul className="divide-y divide-ds-line">
              {asArray(diag.data.elos).map((elo) => (
                <li key={elo.id} className="py-2 text-sm">
                  <p className="font-bold text-ds-ink">{elo.ok ? '✔' : '✗'} {elo.titulo}</p>
                  {asArray(elo.frases).map((frase) => <p key={frase} className="mt-0.5 text-xs text-ds-ink-soft">{frase}</p>)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-ds-line bg-ds-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink">Por que não conecta?</h3>
          <button
            type="button"
            onClick={() => diagnosticarConexao(userId)}
            disabled={diagCxCarregando}
            className="rounded-lg bg-ds-ink px-3 py-2 text-xs font-black text-ds-surface hover:bg-ds-ink-soft disabled:opacity-60"
          >
            {diagCxCarregando ? 'Verificando…' : 'Verificar agora'}
          </button>
        </div>
        <p className="mt-1 text-[10.5px] text-ds-ink-soft">Confere, nesta ordem: conta, vaga no servidor, o que ela fez na tela, WhatsApp e credencial dos últimos 3 dias. A primeira que falhar é a causa.</p>
        {diagCx?.error && <p className="mt-3 text-sm text-ds-danger">{diagCx.error}</p>}
        {diagCx?.data && (
          <div className="mt-3 space-y-2">
            <p className={`rounded-xl px-3 py-2 text-sm font-bold ${diagCx.data.veredito.ok ? 'bg-ds-accent/10 text-ds-accent-strong' : 'bg-ds-warn/10 text-ds-ink'}`}>
              {diagCx.data.veredito.frase}
              {diagCx.data.veredito.acao && <span className="mt-1 block text-xs font-medium">O que fazer: {diagCx.data.veredito.acao}</span>}
            </p>
            <ul className="divide-y divide-ds-line">
              {asArray(diagCx.data.elos).map((elo) => (
                <li key={elo.id} className="py-2 text-sm">
                  <p className="font-bold text-ds-ink">{elo.ok ? '✔' : '✗'} {elo.titulo}</p>
                  {asArray(elo.frases).map((frase, i) => (
                    <p key={frase} className="mt-0.5 text-xs text-ds-ink-soft">{frase}{asArray(elo.acoes)[i] ? ` → ${asArray(elo.acoes)[i]}` : ''}</p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card label="Quedas 24h" value={formatNumber(cm.disconnects24h)} />
        <Card label="Reconexões manuais 24h" value={formatNumber(cm.manualReconnects24h)} helper="start/pareamento pedido pela cliente" />
        <Card label="Offline auto 24h" value={formatDurationMs((cm.automaticOfflineMs24h || 0) + (cm.ongoingOfflineMs24h || 0))} helper="tempo até recuperar sozinho" />
        <Card label="Quedas 7d" value={formatNumber(cm.disconnects7d)} />
        <Card label="Reconexões manuais 7d" value={formatNumber(cm.manualReconnects7d)} helper="trabalho real da cliente" />
        <Card label="Parado até a cliente agir 7d" value={formatDurationMs(cm.manualOfflineMs7d)} helper={`${formatNumber(cm.manualRecoveries7d)} episódio(s) que só voltaram com ação dela`} />
      </section>

      <section className="rounded-2xl border border-ds-line bg-ds-surface p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink">Linha do tempo das quedas (7 dias)</h3>
        <p className="mt-1 text-[10.5px] text-ds-ink-soft">Cada linha é um episódio fora do ar: quando começou, quanto durou e se o robô voltou sozinho ou só voltou depois que o cliente agiu.</p>
        <div className="mt-3 divide-y divide-ds-line">
          {asArray(detail?.offlineEpisodes).map((ep) => {
            const cls = ep.open ? 'bg-ds-warn/10 text-ds-warn-ink' : ep.endedBy === 'sozinho' ? 'bg-ds-accent/10 text-ds-accent-strong' : 'bg-ds-danger/10 text-ds-danger'
            const rotulo = ep.open ? 'em aberto' : ep.endedBy === 'sozinho' ? 'voltou sozinho' : ep.endedBy === 'cliente' ? 'o cliente teve que agir' : 'interrompido'
            return (
              <div key={`${ep.startedAt}-${ep.endedAt || 'aberto'}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 text-sm">
                <div>
                  <p className="font-bold text-ds-ink">{formatDateTime(ep.startedAt)} → {ep.endedAt ? formatDateTime(ep.endedAt) : 'agora'}</p>
                  <p className="text-[10.5px] text-ds-ink-soft">
                    {formatDurationMs(ep.durationMs)} fora
                    {ep.code ? ` · código ${ep.code}` : ''}
                    {ep.stuckMsg ? ' · mensagem travada' : ''}
                    {ep.terminal ? ' · sessão deslogada' : ''}
                  </p>
                </div>
                <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[10.5px] font-black ${cls}`}>{rotulo}</span>
              </div>
            )
          })}
          {!asArray(detail?.offlineEpisodes).length && <p className="py-3 text-sm text-ds-ink-soft">Nenhuma queda registrada nos últimos 7 dias.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-ds-line bg-ds-surface p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink">Erros agrupados por tipo (7d)</h3>
        <div className="mt-3 divide-y divide-ds-line">
          {asArray(detail?.errorsByType).map((item) => (
            <div key={item.errorMsg} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
              <div>
                <p className="break-words text-xs font-bold text-ds-ink">{item.errorMsg}</p>
                <p className="mt-1 text-xs text-ds-ink-soft">{item.category || 'UNKNOWN'} · último {formatDateTime(item.lastSeenAt)}</p>
              </div>
              <span className="self-start rounded-full bg-ds-danger/10 px-3 py-1 text-xs font-black text-ds-danger">{formatNumber(item.count)}x</span>
            </div>
          ))}
          {!asArray(detail?.errorsByType).length && <p className="py-4 text-sm text-ds-ink-soft">Sem erros recentes nos últimos 7 dias.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-ds-line bg-ds-surface p-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-ds-ink">Linha do tempo de conexão</h3>
        <div className="mt-3 space-y-2">
          <ExpandableList
            items={detail?.recentEvents}
            emptyLabel="Sem eventos de conexão nos últimos 7 dias."
            render={(event) => (
              <div key={event.id} className="rounded-xl bg-ds-bg p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-ds-ink">{ROTULO_EVENTO[event.type] || event.type}</p>
                  <span className="text-xs font-bold text-ds-ink-soft">{formatDateTime(event.occurredAt)}</span>
                </div>
                <p className="mt-1 text-xs text-ds-ink-soft">Código {event.code || '—'} · lifecycle {event.lifecycle || '—'}{event.metadata?.source === 'admin' ? ' · feito pelo admin' : ''}</p>
                {event.metadata?.reason && <p className="mt-1 text-xs text-ds-ink">Motivo: {event.metadata.reason}</p>}
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
    <form onSubmit={submit} className="rounded-xl border border-ds-line bg-ds-bg p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ds-ink">Ajuste manual de plano/acesso</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} className="rounded-lg border border-ds-line bg-ds-surface px-2 py-2 text-xs">
          <option value="">Sem alterar plano</option>
          <option value="trial">trial</option>
          <option value="basic">basic</option>
          <option value="pro">pro</option>
          <option value="premium">premium (Instagram Stories)</option>
        </select>
        <input value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} type="number" min="-365" max="365" placeholder="Dias (+/-)" className="rounded-lg border border-ds-line bg-ds-surface px-2 py-2 text-xs" />
        <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Motivo (obrigatório)" className="rounded-lg border border-ds-line bg-ds-surface px-2 py-2 text-xs" required minLength={5} />
      </div>
      <div className="mt-2">
        <input value={form.partnerCode} onChange={(e) => setForm((f) => ({ ...f, partnerCode: e.target.value }))} placeholder="Código do parceiro influenciador (opcional — só para cortesia de parceria)" className="w-full rounded-lg border border-ds-line bg-ds-surface px-2 py-2 text-xs" maxLength={32} />
        <p className="mt-1 text-[10.5px] text-ds-ink-soft">Preenchendo aqui, o motivo é gravado como <code>parceiro-influenciador:&lt;código&gt;</code>, o que permite auditar depois quantas cortesias de parceria estão de pé. Cada cortesia ativa é uma sessão WhatsApp a mais no servidor.</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10.5px] text-ds-ink-soft">Altera plano e/ou expiração imediatamente.</p>
        <button disabled={saving} className="rounded-lg bg-ds-accent-strong px-3 py-2 text-xs font-bold text-ds-surface disabled:opacity-50">{saving ? 'Aplicando...' : 'Aplicar acesso'}</button>
      </div>
      {message && <p className="mt-2 text-xs text-ds-ink">{message}</p>}
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
    <div className="rounded-xl border border-ds-line bg-ds-bg p-3">
      <form onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-wide text-ds-ink">Registrar contato</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Resumo do que foi conversado" className="mt-2 w-full rounded-lg border border-ds-line bg-ds-surface px-2 py-2 text-xs" />
        <div className="mt-2 flex items-center justify-between gap-2">
          {message ? <p className="text-xs text-ds-ink">{message}</p> : <span />}
          <button disabled={saving || !notes.trim()} className="rounded-lg bg-ds-accent-strong px-3 py-2 text-xs font-bold text-ds-surface disabled:opacity-50">{saving ? 'Salvando…' : 'Registrar contato'}</button>
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
  cadastro: ['bg-ds-bg-soft text-ds-ink', 'Cadastro'],
  financeiro: ['bg-ds-accent/20 text-ds-accent-strong', 'Financeiro'],
  tecnico: ['bg-ds-danger/20 text-ds-danger', 'Técnico'],
  uso: ['bg-ds-bg-soft text-ds-ink-soft', 'Uso'],
  suporte: ['bg-ds-pro-soft text-ds-pro-ink', 'Suporte'],
}

function Timeline({ events }) {
  const list = asArray(events)
  if (!list.length) return <p className="text-sm text-ds-ink-faint">Sem histórico ainda.</p>
  return (
    <ol className="space-y-3">
      {list.map((event, index) => {
        const [tone, label] = KIND_STYLES[event.kind] ?? ['bg-ds-bg-soft text-ds-ink', event.kind]
        return (
          <li key={`${event.at}-${index}`} className="border-l-2 border-ds-line pl-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${tone}`}>{label}</span>
              <span className="text-xs text-ds-ink-faint">{formatDate(event.at)}</span>
            </div>
            <p className="text-sm font-semibold text-ds-ink">{event.title}</p>
            {event.detail && <p className="text-xs text-ds-ink-soft">{event.detail}</p>}
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
      <button type="button" onClick={() => setAberto(true)} className="rounded-xl border border-ds-danger/40 bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-danger hover:bg-ds-danger/10">
        {bloqueada ? 'Desbloquear conta' : 'Bloquear / banir conta'}
      </button>
    )
  }

  return (
    <form onSubmit={confirmar} className="w-full max-w-md space-y-2 rounded-2xl border border-ds-danger/40 bg-ds-surface p-4">
      <h3 className="text-sm font-bold text-ds-ink">{bloqueada ? 'Desbloquear conta' : 'Bloquear ou banir conta'}</h3>
      {!bloqueada && (
        <select value={alvo} onChange={e => setAlvo(e.target.value)} className="w-full rounded-xl border border-ds-line px-3 py-2 text-sm">
          <option value="suspended">Suspender (pode ser desfeito)</option>
          <option value="banned">Banir</option>
        </select>
      )}
      <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} maxLength={400} placeholder="Motivo (mínimo 10 letras)" className="w-full rounded-xl border border-ds-line px-3 py-2 text-sm" />
      <input value={emailDigitado} onChange={e => setEmailDigitado(e.target.value)} placeholder={`Digite ${email ?? 'o e-mail da conta'} para confirmar`} className="w-full rounded-xl border border-ds-line px-3 py-2 text-sm" />
      {erro && <p className="text-xs font-semibold text-ds-danger">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="rounded-xl bg-ds-danger px-3 py-2 text-sm font-bold text-ds-surface disabled:opacity-50">{salvando ? 'Salvando...' : 'Confirmar'}</button>
        <button type="button" onClick={() => { setAberto(false); setErro('') }} className="rounded-xl border border-ds-line px-3 py-2 text-sm font-semibold text-ds-ink">Cancelar</button>
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

  if (loading) return <main className="min-h-screen bg-ds-bg px-5 py-8"><LoadingState /></main>
  if (error) return <main className="min-h-screen bg-ds-bg px-5 py-8"><div className="mx-auto max-w-3xl"><Alert type="error" title="Histórico do cliente" message={error} /></div></main>
  if (!history) return null

  const headline = history.headline ?? {}

  return (
    <main className="min-h-screen bg-ds-bg px-5 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ds-accent-strong">Histórico do cliente</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[19px] font-black text-ds-ink">{history.cadastro?.name || history.cadastro?.email}</h1>
              <PayingTag status={history.paying?.status} />
            </div>
            <p className="text-sm text-ds-ink-soft">{history.cadastro?.email} · {history.cadastro?.contactPhone || 'sem celular'}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <BloquearConta userId={history.id} email={history.cadastro?.email} status={history.cadastro?.status} podeBloquear={history.podeBloquear === true} onSaved={reload} />
            <Link href="/admin/clientes" className="rounded-xl border border-ds-line bg-ds-surface px-3 py-2 text-sm font-semibold text-ds-ink hover:bg-ds-bg">Voltar à lista</Link>
          </div>
        </div>

        <section className="grid gap-3 rounded-2xl border border-ds-line bg-ds-surface p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Situação" value={SITUACAO_LABELS[headline.situacao] ?? headline.situacao ?? '—'} />
          <Card label="Plano" value={headline.plano} />
          <Card label="Vence em" value={formatDate(headline.vencimento)} />
          <Card label="Total pago" value={formatCurrency(headline.ltv)} />
          <Card label="Envios 30d" value={formatNumber(headline.envios30d)} />
          <Card label="Quedas 7d" value={formatNumber(headline.quedas7d)} />
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-ds-line bg-ds-surface p-5 shadow-sm lg:col-span-2">
            <nav className="mb-4 flex flex-wrap gap-1">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === key ? 'bg-ds-accent-strong text-ds-surface' : 'text-ds-ink-soft hover:bg-ds-line-strong'}`}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'cadastro' && <CadastroTab cadastro={history.cadastro} />}
            {tab === 'financeiro' && <FinanceiroTab financeiro={history.financeiro} userId={history.id} email={history.cadastro?.email} onChanged={reload} />}
            {tab === 'tecnico' && <TecnicoTab tecnico={history.tecnico} userId={history.id} chavesLojas={history.chavesLojas} />}
            {tab === 'uso' && <UsoTab uso={history.uso} userId={history.id} onSaved={reload} />}
            {tab === 'robo' && <RoboTab userId={history.id} />}
            {tab === 'atendimento' && <AtendimentoTab history={history} onChanged={reload} />}
          </section>

          <section className="rounded-2xl border border-ds-line bg-ds-surface p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-ds-ink">Linha do tempo</h2>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <Timeline events={history.timeline} />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
