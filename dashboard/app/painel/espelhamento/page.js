'use client'

/* Espelhamento — versão Menta desktop do recurso PRO. Mesma lógica e fontes de
 * dados da tela mobile canônica (app/m/op/espelhar/page.js):
 *   - api.groups()       → origem (role:'monitor') e destino (role:'post')
 *   - api.logsSummary('today') → métricas factuais do dia
 *   - api.getConfig()    → cadência de envio (delayMin/delayMax)
 *   - estado "ligado"    → reflete a sessão WhatsApp conectada (usePainel.online);
 *     NÃO há flag própria no backend — o bot espelha enquanto a sessão roda.
 *
 * É a visão de ESPELHO (origem → destino), distinta de /grupos (cadastro dos
 * grupos). Editar/Adicionar levam ao /painel/grupos; o controle leva à conexão
 * WhatsApp. Nenhuma lógica de backend nova — só leitura derivada do que existe. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader, PainelTopbarAction } from '../PainelShell'

const GRADIENTS = [
  'linear-gradient(135deg,#94A3B8,#475569)',
  'linear-gradient(135deg,#F4D9E0,#E8A488)',
  'linear-gradient(135deg,#C8E6D8,#3E9C7A)',
  'linear-gradient(135deg,#D9CFEA,#7C5CF5)',
]

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)
  return raw.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 2) || '#'
}

function Avatar({ name, gradient }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff', background: gradient,
      }}
    >{initials(name)}</span>
  )
}

function GroupList({ title, hint, eyebrow, groups, emptyLabel }) {
  return (
    <section className="pnl-card">
      <div className="pnl-eyebrow" style={eyebrow.style}>{eyebrow.label}</div>
      <div className="pnl-card-title" style={{ marginTop: 6 }}>{title}</div>
      <p className="pnl-card-note">{hint}</p>
      {groups.length === 0 ? (
        <p className="pnl-empty">{emptyLabel}</p>
      ) : (
        <ul className="pnl-grid" style={{ marginTop: 12 }}>
          {groups.map((g, i) => (
            <li key={g.id} className="pnl-subcard" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={g.name} gradient={GRADIENTS[i % GRADIENTS.length]} />
              <div style={{ minWidth: 0, flex: 1, wordBreak: 'break-word' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{g.name}</div>
                <div className="pnl-hint" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} aria-hidden="true" />
                  {g.kind === 'channel' ? 'Canal WhatsApp' : 'Grupo WhatsApp'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/painel/grupos" className="pnl-link-btn" style={{ display: 'inline-block', marginTop: 12 }}>
        + Adicionar grupo
      </Link>
    </section>
  )
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

export default function EspelhamentoPage() {
  usePainelHeader({ title: 'Espelhamento', subtitle: 'Monitora grupos de promoção e reposta com o seu link' })
  const { online } = usePainel()

  const [groups, setGroups] = useState([])
  const [summary, setSummary] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([api.groups(), api.logsSummary('today'), api.getConfig()]).then(([g, s, c]) => {
      if (!active) return
      if (g.status === 'fulfilled' && Array.isArray(g.value)) setGroups(g.value)
      else setLoadError('Não foi possível carregar os grupos do espelhamento.')
      if (s.status === 'fulfilled') setSummary(s.value)
      if (c.status === 'fulfilled') setConfig(c.value)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const origens = groups.filter((g) => g.role === 'monitor')
  const destinos = groups.filter((g) => g.role === 'post')

  const c = summary?.counts
  const postadosHoje = num(c?.success)
  const errosHoje = num(c?.timeoutTotal) + num(c?.errorOther)
  const vistosHoje = c
    ? num(c.success) + num(c.skippedDedup) + num(c.skippedConfig) + num(c.timeoutTotal) + num(c.errorOther) + num(c.inFlight)
    : 0

  const lastSendLabel = summary?.lastSendAt
    ? new Date(summary.lastSendAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  const ritmo = config && (config.delayMin != null || config.delayMax != null)
    ? `1 envio a cada ${num(config.delayMin)}–${num(config.delayMax)} s`
    : 'Cadência configurada nas Configurações'

  return (
    <div className="pnl-grid" style={{ maxWidth: 1120, margin: '0 auto' }}>
      <PainelTopbarAction>
        <div className="pnl-toolbar">
          <Link href="/painel/grupos" className="pnl-btn is-primary">+ Novo espelho</Link>
        </div>
      </PainelTopbarAction>

      {loadError && (
        <div className="pnl-note-box is-error" role="alert">
          <strong style={{ fontWeight: 600 }}>Falha ao carregar</strong>
          <p style={{ marginTop: 4 }}>{loadError}</p>
        </div>
      )}

      {/* Controle mestre — reflete a conexão WhatsApp (não há flag própria) */}
      <Link href="/painel/whatsapp" className="pnl-master" style={{ textDecoration: 'none' }}>
        <div className="pnl-master-ico">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a5 5 0 0 1 5-5h4" /><path d="M7 12l-4-5 5-2" />
            <path d="M21 17a5 5 0 0 1-5 5h-4" /><path d="M17 12l4 5-5 2" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="pnl-master-title">{online ? 'Espelhamento ligado' : 'Espelhamento pausado'}</span>
            <span className="pnl-master-status">
              <span className={`pnl-dot ${online ? 'is-on' : 'is-idle'}`} aria-hidden="true" />
              {online
                ? `monitorando ${origens.length} ${origens.length === 1 ? 'grupo' : 'grupos'}`
                : 'bot desconectado'}
            </span>
          </div>
          <div className="pnl-master-sub">
            {online
              ? (lastSendLabel ? `${postadosHoje} repostados hoje · último envio ${lastSendLabel}` : `${postadosHoje} repostados hoje`)
              : 'conecte o WhatsApp para o bot voltar a monitorar e repostar'}
          </div>
        </div>
      </Link>

      {/* Stats factuais do dia */}
      <div className="pnl-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="pnl-kpi">
          <div className="pnl-kpi-label">Repostados hoje</div>
          <div className="pnl-kpi-num">{loading ? '…' : postadosHoje}</div>
          <div className="pnl-kpi-foot">nos seus grupos de destino</div>
        </div>
        <div className="pnl-kpi">
          <div className="pnl-kpi-label">Vistos hoje</div>
          <div className="pnl-kpi-num">{loading ? '…' : vistosHoje}</div>
          <div className="pnl-kpi-foot">links detectados nas origens</div>
        </div>
        <div className="pnl-kpi">
          <div className="pnl-kpi-label">Erros hoje</div>
          <div className="pnl-kpi-num" style={{ color: errosHoje > 0 ? 'var(--danger)' : undefined }}>{loading ? '…' : errosHoje}</div>
          <div className="pnl-kpi-foot">{errosHoje > 0 ? 'ver em Envios' : 'tudo certo'}</div>
        </div>
      </div>

      {/* Origem → Destino (duas listas reais) */}
      <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <GroupList
          eyebrow={{ label: '👁 Origem · monitora', style: {} }}
          title="Grupos que monitoro"
          hint="De onde o bot captura as promoções. Ele só lê os links."
          groups={origens}
          emptyLabel="Nenhum grupo de origem cadastrado."
        />
        <GroupList
          eyebrow={{ label: '⚡ Destino · publica', style: { color: 'var(--accent-strong)' } }}
          title="Meus grupos de promoção"
          hint="Para onde o bot posta o link já com o seu código de afiliada."
          groups={destinos}
          emptyLabel="Nenhum grupo de destino cadastrado."
        />
      </div>

      {/* Ritmo de envio */}
      <section className="pnl-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="pnl-icon-tile" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pnl-card-title" style={{ marginBottom: 2 }}>{ritmo}</div>
          <p className="pnl-card-note" style={{ margin: 0 }}>Evita parecer spam · ajustável em Configurações</p>
        </div>
        <Link href="/painel/configuracoes" className="pnl-link-btn">Ajustar</Link>
      </section>
    </div>
  )
}
