'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobileRoutes } from '@/components/mobile/routes'
import { cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

export default function TutorialPage() {
  useMobileRoutePerf('m/help/tutorial')
  const router = useRouter()

  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [session, groups, creds, config, summary] = await Promise.all([
          api.sessionStatus().catch(() => null),
          api.groups().catch(() => []),
          api.credentials().catch(() => []),
          api.getConfig().catch(() => null),
          api.logsSummary('30d').catch(() => null),
        ])
        if (!active) return
        setState({ session, groups: Array.isArray(groups) ? groups : [], creds: Array.isArray(creds) ? creds : [], config, summary })
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar o tutorial.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  // Os passos são copy fixa; o que é real é o progresso, derivado do estado da conta.
  const passos = useMemo(() => {
    const s = state || {}
    const groups = s.groups || []
    const counts = s.summary?.counts
    const totalLogs = counts ? Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0) : 0
    const cfg = s.config || {}
    const steps = [
      { n: '01', t: 'Como conectar seu WhatsApp', m: '2 min · vídeo', done: Boolean(s.session?.running), route: mobileRoutes.configWhatsApp },
      { n: '02', t: 'Adicionar grupos para monitorar', m: '1 min · vídeo', done: groups.some(g => g.role === 'monitor'), route: mobileRoutes.configGroups },
      { n: '03', t: 'Cadastrar IDs de afiliada', m: '3 min · texto', done: (s.creds || []).length > 0, route: mobileRoutes.configCredentials },
      { n: '04', t: 'Adicionar destino de publicação', m: '2 min · texto', done: groups.some(g => g.role === 'post'), route: mobileRoutes.configGroups },
      { n: '05', t: 'Criar a primeira oferta mobile', m: '3 min · prática', done: totalLogs > 0, route: mobileRoutes.offer },
      { n: '06', t: 'Personalizar mensagens promocionais', m: '3 min · texto', done: Boolean(String(cfg.welcomeMsg || '').trim() || String(cfg.brandingGroupLink || '').trim()), route: mobileRoutes.configPreferences },
      { n: '07', t: 'Entender o painel de logs', m: '2 min · vídeo', done: totalLogs > 0, route: mobileRoutes.logs },
    ]
    const firstPending = steps.findIndex(st => !st.done)
    return steps.map((st, i) => ({ ...st, current: i === firstPending }))
  }, [state])

  const doneCount = passos.filter(p => p.done).length

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando tutorial..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Tutorial</div>
      </div>

      <div style={{ padding: '12px 20px 0', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        7 passos para conectar, configurar, criar uma oferta e acompanhar logs pelo mobile.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.card, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Seu progresso</div>
            <div style={{ fontSize: 12, color: 'var(--accent-strong)', fontWeight: 600 }}>{doneCount}/{passos.length}</div>
          </div>
          <div style={{ height: 6, background: 'var(--bg-soft)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(doneCount / passos.length) * 100}%`, height: '100%', background: 'var(--accent-strong)' }} />
          </div>
        </div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.card, overflow: 'hidden' }}>
          {passos.map((p, i, a) => (
            <button
              key={p.n}
              type="button"
              onClick={() => router.push(p.route)}
              style={cfgStyles.rowButton(i === a.length - 1, p.current)}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: p.done ? 'var(--success)' : p.current ? 'var(--ink)' : 'var(--bg-soft)',
                  color: p.done || p.current ? 'white' : 'var(--ink-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 12,
                  fontFamily: p.done || p.current ? 'inherit' : "'JetBrains Mono', monospace",
                  flexShrink: 0,
                }}
              >
                {p.done ? <MobileIcon name="check" size={15} stroke={3} /> : p.n}
              </div>
              <div style={cfgStyles.rowMain}>
                <div
                  style={{
                    ...cfgStyles.rowTitle,
                    textDecoration: p.done ? 'line-through' : 'none',
                    color: p.done ? 'var(--ink-soft)' : 'var(--ink)',
                  }}
                >
                  {p.t}
                </div>
                <div style={cfgStyles.rowSub}>{p.m}</div>
              </div>
              {p.current && <span style={cfgStyles.pill('success')}>continuar</span>}
              <MobileIcon name="arrow" size={14} />
            </button>
          ))}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Precisa de ajuda?</div>
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ ...cfgStyles.card, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'color-mix(in oklab, var(--success) 18%, var(--surface))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)',
              flexShrink: 0,
            }}
          >
            <MobileIcon name="whatsapp" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Falar com a gente</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>resposta em minutos · seg–sex 8h–20h</div>
          </div>
          <MobileIcon name="arrow" size={14} />
        </div>
      </div>
    </MobileShell>
  )
}
