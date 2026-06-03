'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'
import { tint, tintBorder } from '@/components/mobile/mobileStyles'

const pageStyles = {
  container: { padding: '16px 16px 32px' },

  progressWrap: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 18,
    padding: '18px 18px 14px',
    marginBottom: 16,
  },
  progressHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressTitle: { fontSize: 15, fontWeight: 600, color: 'var(--ink)' },
  progressCount: {
    fontSize: 11, fontWeight: 700, color: 'var(--accent-strong)',
    fontFamily: "'JetBrains Mono', monospace",
    background: tint('--accent-strong', 12),
    padding: '3px 8px', borderRadius: 999,
  },
  progressBar: {
    height: 5, background: 'var(--bg-soft)', borderRadius: 999, overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: (pct) => ({
    height: '100%', borderRadius: 999,
    background: 'var(--accent-strong)',
    width: `${pct}%`,
    transition: 'width 0.3s ease',
  }),
  progressSub: { fontSize: 11.5, color: 'var(--ink-soft)' },

  stepsList: {
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  step: (done) => ({
    background: done
      ? tint('--success', 6)
      : 'var(--surface)',
    border: '1px solid ' + (done
      ? tint('--success', 25, '--line')
      : 'var(--line)'),
    borderRadius: 14,
    padding: '14px 14px',
    display: 'flex', alignItems: 'center', gap: 12,
    cursor: done ? 'default' : 'pointer',
  }),
  stepCheck: (done) => ({
    width: 26, height: 26, borderRadius: '50%',
    background: done ? 'var(--success)' : 'var(--surface)',
    border: '1.5px solid ' + (done ? 'var(--success)' : 'var(--line-strong)'),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', flexShrink: 0,
  }),
  stepNum: (done) => ({
    fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)',
    fontFamily: "'JetBrains Mono', monospace",
    display: done ? 'none' : 'block',
  }),
  stepText: { flex: 1, minWidth: 0 },
  stepLabel: (done) => ({
    fontSize: 14, fontWeight: done ? 400 : 600,
    color: done ? 'var(--ink-soft)' : 'var(--ink)',
    textDecoration: done ? 'line-through' : 'none',
  }),
  stepDesc: { fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 },
  stepAction: {
    fontSize: 12, fontWeight: 700,
    color: 'white',
    padding: '6px 12px',
    background: 'var(--accent-strong)',
    border: 'none', borderRadius: 999,
    cursor: 'pointer', fontFamily: 'inherit',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  stepDoneTag: {
    fontSize: 11, fontWeight: 600,
    color: 'var(--success)',
    padding: '4px 10px',
    border: tintBorder('--success', 30),
    borderRadius: 999,
    background: tint('--success', 8),
    flexShrink: 0,
  },

  completeBanner: {
    background: tint('--success', 10),
    border: tintBorder('--success', 30),
    borderRadius: 14, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 16,
  },
  completeBannerIcon: {
    width: 30, height: 30, borderRadius: '50%',
    background: 'var(--success)', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  completeBannerText: { flex: 1 },
  completeBannerTitle: { fontSize: 14, fontWeight: 600, color: 'var(--ink)' },
  completeBannerSub: { fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 },
}

export default function ChecklistEspelhamentoPage() {
  useMobileRoutePerf('m/checklistespelhamento')
  const router = useRouter()

  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [creds, setCreds] = useState([])
  const [dashboardStatus, setDashboardStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [s, g, cr, ds] = await Promise.all([
          api.sessionStatus().catch(() => null),
          api.groups().catch(() => []),
          api.credentials().catch(() => []),
          api.dashboardStatus().catch(() => null),
        ])
        if (!active) return
        setSession(s)
        setGroups(Array.isArray(g) ? g : [])
        setCreds(Array.isArray(cr) ? cr : [])
        setDashboardStatus(ds)
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar o checklist.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const hasCredentials = Boolean(dashboardStatus?.hasCredentials ?? (creds.length > 0))
  const whatsappConnected = Boolean(dashboardStatus?.waConnected ?? session?.running)
  const hasSource = Boolean(dashboardStatus?.hasMonitorGroup ?? groups.some(g => g.role === 'monitor'))
  const hasDest = Boolean(dashboardStatus?.hasPostGroup ?? groups.some(g => g.role === 'post'))
  const hasSuccessfulLog = Boolean(dashboardStatus?.hasSuccessfulLog)

  // Mesmos 5 passos do balão da home (/m) — mantém o "X de 5" coerente entre as telas.
  const STEPS = useMemo(() => [
    {
      label: 'Suas afiliadas (Shopee, ML…)',
      desc: 'Conecte suas contas de afiliada para converter links automaticamente',
      route: 'configCredentials',
      done: hasCredentials,
    },
    {
      label: 'Conectar WhatsApp',
      desc: 'Escaneie o QR Code para vincular seu número ao bot',
      route: 'configWhatsApp',
      done: whatsappConnected,
    },
    {
      label: '1 grupo de origem',
      desc: 'Escolha de qual grupo o bot vai monitorar as promoções',
      route: 'configGroups',
      done: hasSource,
    },
    {
      label: '1 grupo de destino',
      desc: 'Defina para qual grupo as promoções serão encaminhadas',
      route: 'configGroups',
      done: hasDest,
    },
    {
      label: 'Primeiro envio validado',
      desc: 'Faça um envio real ou teste manual e confirme que apareceu como sucesso nos logs',
      route: 'logs',
      done: hasSuccessfulLog,
    },
  ], [hasCredentials, whatsappConnected, hasSource, hasDest, hasSuccessfulLog])

  const done = STEPS.filter(s => s.done).length
  const total = STEPS.length
  const isComplete = done === total

  if (loading) {
    return (
      <MobileShell title="Checklist de espelhamento" active="inicio" showBack onBack={() => router.push(mobileRoutes.home)}>
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando checklist..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Checklist de espelhamento" active="inicio" showBack onBack={() => router.push(mobileRoutes.home)}>
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Checklist de espelhamento" active="inicio" showBack onBack={() => router.push(mobileRoutes.home)}>
      <div style={pageStyles.container}>
        {isComplete && (
          <div style={pageStyles.completeBanner}>
            <div style={pageStyles.completeBannerIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={pageStyles.completeBannerText}>
              <div style={pageStyles.completeBannerTitle}>Tudo pronto!</div>
              <div style={pageStyles.completeBannerSub}>Seu espelhamento já teve pelo menos um envio real validado.</div>
            </div>
          </div>
        )}

        <div style={pageStyles.progressWrap}>
          <div style={pageStyles.progressHead}>
            <div style={pageStyles.progressTitle}>Configurar espelhamento</div>
            <span style={pageStyles.progressCount}>{done}/{total}</span>
          </div>
          <div style={pageStyles.progressBar}>
            <div style={pageStyles.progressBarFill((done / total) * 100)}/>
          </div>
          <div style={pageStyles.progressSub}>
            {isComplete
              ? 'Checklist completo — seu bot já validou um envio real.'
              : `Falta${total - done === 1 ? '' : 'm'} ${total - done} passo${total - done === 1 ? '' : 's'} para começar a espelhar.`}
          </div>
        </div>

        <div style={pageStyles.stepsList}>
          {STEPS.map((step, i) => (
            <div
              key={i}
              style={pageStyles.step(step.done)}
              onClick={!step.done ? () => router.push(mobileRoutes[step.route]) : undefined}
            >
              <div style={pageStyles.stepCheck(step.done)}>
                {step.done
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span style={pageStyles.stepNum(step.done)}>{i + 1}</span>}
              </div>
              <div style={pageStyles.stepText}>
                <div style={pageStyles.stepLabel(step.done)}>{step.label}</div>
                {!step.done && <div style={pageStyles.stepDesc}>{step.desc}</div>}
              </div>
              {step.done
                ? <span style={pageStyles.stepDoneTag}>Feito</span>
                : <button
                    style={pageStyles.stepAction}
                    onClick={(e) => { e.stopPropagation(); router.push(mobileRoutes[step.route]) }}
                  >Fazer</button>}
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  )
}
