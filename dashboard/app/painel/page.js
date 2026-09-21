'use client'

/* Tela inicial do painel — desenho "Painel v2".
 *
 * Ordem fixa e deliberada: (1) checklist de ativação, (2) quatro números, (3)
 * funções mais usadas. É a ordem da decisão de quem abre o painel: primeiro o
 * que falta fazer, depois como está, depois para onde ir. Os gráficos que
 * viviam aqui (funil, rosca, colunas de 7 dias, últimos envios) saíram para as
 * telas que já existem — Envios (/painel/envios) e Vendas (/painel/vendas) —
 * porque a tela inicial serve para decidir o próximo passo, não para analisar.
 *
 * Nenhum número é inventado na tela: os três primeiros vêm de
 * `GET /api/dashboard/status` (campo `counts`) e o de hoje vem de
 * `GET /api/logs/summary?period=today`, que já é cacheado no servidor.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from './PainelShell'
import { ActivationChecklist } from '@/components/ActivationChecklist'

function greeting(hour) {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function firstName(user) {
  const n = (user?.name || '').trim()
  return n ? n.split(/\s+/)[0] : 'por aqui'
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

function Icon({ name, size = 20, stroke = 1.7 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (name) {
    case 'store': return <svg {...p}><path d="M3 9.5 4.5 4h15L21 9.5" /><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 12v8h14v-8" /></svg>
    case 'mirror': return <svg {...p}><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
    case 'users': return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'send': return <svg {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
    case 'plus': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
    case 'spark': return <svg {...p}><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" /><circle cx="12" cy="12" r="3.5" /></svg>
    case 'tutorial': return <svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M9 8h6M9 12h7" /></svg>
    default: return null
  }
}

/* Os quatro números do painel. `href` existe porque número sem caminho para
 * mexer nele vira parede — cada card abre a tela que o altera. */
const STATS = [
  {
    key: 'stores',
    label: 'Lojas conectadas',
    icon: 'store',
    href: '/painel/ids-afiliada',
    foot: (v) => (v === 0 ? 'cadastre para a comissão ser sua' : v === 1 ? '1 loja pronta para converter' : `${v} lojas prontas para converter`),
  },
  {
    key: 'monitorGroups',
    label: 'Grupos monitorados',
    icon: 'mirror',
    href: '/painel/grupos',
    foot: () => 'de onde o robô lê as ofertas',
  },
  {
    key: 'postGroups',
    label: 'Grupos de destino',
    icon: 'users',
    href: '/painel/grupos',
    foot: () => 'onde o robô publica',
  },
  {
    key: 'offersToday',
    label: 'Ofertas enviadas hoje',
    icon: 'send',
    href: '/painel/envios',
    foot: (v) => (v === 0 ? 'nada publicado ainda hoje' : 'publicadas nos seus grupos'),
  },
]

/* Funções mais usadas — as quatro ações do dia a dia, nesta ordem.
 *
 * Cada uma diz em que plano está, para a cliente saber o que já tem e o que
 * é upgrade sem precisar abrir a tela e levar o "não". O nome do plano vem
 * escrito por extenso ("Plano PRO", "Plano Basic") porque "PRO" sozinho é
 * lido como enfeite, não como nome de plano. */
const ACTIONS = [
  { label: 'Criar oferta', href: '/painel/criar-oferta', icon: 'plus', tag: 'Plano Basic' },
  { label: 'Espelhamento', href: '/painel/espelhamento', icon: 'mirror', tag: 'Plano Basic' },
  { label: 'Ofertas automáticas', href: '/painel/ofertas-automaticas', icon: 'spark', pro: true, tag: 'Plano PRO' },
  { label: 'Tutorial', href: '/painel/tutorial', icon: 'tutorial', tag: 'Plano Basic' },
]

export default function PainelPage() {
  const { user } = usePainel()

  const [counts, setCounts] = useState(null)
  const [offersToday, setOffersToday] = useState(null)

  const now = new Date()
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  usePainelHeader({ title: 'Painel', subtitle: `${greeting(now.getHours())}, ${firstName(user)} — ${dateLabel}` })

  useEffect(() => {
    let active = true
    const load = () => {
      api.dashboardStatus()
        .then((d) => { if (active) setCounts(d?.counts ?? {}) })
        .catch(() => { if (active) setCounts({}) })
      api.logsSummary('today')
        .then((s) => { if (active) setOffersToday(num(s?.counts?.success)) })
        .catch(() => { if (active) setOffersToday(null) })
    }
    load()
    // Recarrega ao voltar para a aba — quem sai para cadastrar um grupo volta
    // esperando ver o número novo, sem precisar recarregar a página.
    window.addEventListener('focus', load)
    return () => { active = false; window.removeEventListener('focus', load) }
  }, [])

  const values = {
    stores: counts?.stores,
    monitorGroups: counts?.monitorGroups,
    postGroups: counts?.postGroups,
    offersToday,
  }

  return (
    <div className="pv-page">
      {/* 1. Checklist — o que ainda falta para o robô trabalhar. */}
      <ActivationChecklist userId={user?.id} />

      {/* 2. Os quatro números. */}
      <section className="pv-stats">
        {STATS.map((s) => {
          const raw = values[s.key]
          const loading = raw === null || raw === undefined
          const v = num(raw)
          return (
            <Link key={s.key} href={s.href} className="pv-stat">
              <span style={{ minWidth: 0 }}>
                <span className="pv-stat-label">{s.label}</span>
                {loading
                  ? <span className="pv-skel" style={{ width: 52, height: 30, marginTop: 8 }} />
                  : <span className="pv-stat-num">{v}</span>}
                <span className="pv-stat-foot">{loading ? 'carregando…' : s.foot(v)}</span>
              </span>
              <span className="pv-stat-ico" aria-hidden="true"><Icon name={s.icon} size={21} /></span>
            </Link>
          )
        })}
      </section>

      {/* 3. Funções mais usadas. */}
      <section className="pnl-card">
        <h2 className="pv-section-title">Funções mais usadas</h2>
        <p className="pv-section-note">O que você faz com mais frequência, a um clique.</p>
        <div className="pv-actions">
          {ACTIONS.map((a) => (
            <Link key={a.label} href={a.href} className={`pv-action${a.pro ? ' is-pro' : ''}`}>
              <span className="pv-action-ico" aria-hidden="true"><Icon name={a.icon} size={24} stroke={1.8} /></span>
              {a.label}
              {a.tag && <span className="pv-action-tag">{a.tag}</span>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
