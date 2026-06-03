'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobileRoutes } from '@/components/mobile/routes'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { derivePlanState } from '@/components/mobile/planState'
import { tint, tintBorder } from '@/components/mobile/mobileStyles'

const PLATFORM_LABEL = {
  shopee: 'Shopee', amazon: 'Amazon', mercadolivre: 'Mercado Livre',
  magazineluiza: 'Magalu', magalu: 'Magalu', aliexpress: 'AliExpress',
}

function relativeShort(date) {
  if (!date) return ''
  const diffMs = Date.now() - new Date(date).getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const homeStyles = {
  // Alerta inline (só quando há falhas/desconexões)
  alert: {
    margin:'14px 16px 0',
    padding:'12px 14px',
    background:tint('--danger', 12),
    border:tintBorder('--danger', 35),
    borderRadius: 14,
    display:'flex', alignItems:'center', gap: 12,
    width:'calc(100% - 32px)',
    textAlign:'left',
    fontFamily:'inherit',
    cursor:'pointer',
  },
  alertIcon: {
    width: 28, height: 28, borderRadius: 8,
    background:'var(--danger)', color:'white',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  alertText: { flex: 1, minWidth: 0 },
  alertTitle: { fontSize: 13, fontWeight: 600, color:'var(--ink)' },
  alertSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },

  // Balão de progresso do checklist (só quando onboarding incompleto) —
  // vermelho para chamar atenção: setup ainda não está completo.
  checklistBalloon: {
    margin:'14px 16px 0',
    padding:'12px 14px',
    background:tint('--danger', 12),
    border:tintBorder('--danger', 35),
    borderRadius: 14,
    display:'flex', alignItems:'center', gap: 12,
    cursor:'pointer',
  },
  checklistBalloonIcon: {
    width: 28, height: 28, borderRadius: 8,
    background:'var(--danger)', color:'white',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  checklistBalloonBar: {
    height: 3, background:tint('--danger', 20),
    borderRadius: 999, overflow:'hidden', marginTop: 5,
  },
  checklistBalloonBarFill: (pct) => ({
    height:'100%', borderRadius: 999,
    background:'var(--danger)',
    width:`${pct}%`,
  }),

  // Header da página (oi + factual)
  greet: { padding:'14px 20px 0' },
  greetHi: { fontSize: 13, color:'var(--ink-soft)' },
  greetHead: {
    fontSize: 22, lineHeight: 1.25, fontWeight: 500,
    color:'var(--ink)', letterSpacing:'-0.01em',
    marginTop: 4,
    textWrap:'pretty',
  },
  greetNum: { color:'var(--ink)', fontWeight: 700 },

  // Hero único — não 2 layers de stats
  hero: {
    margin:'16px 16px 0',
    background:'var(--ink)', color:'white',
    borderRadius: 22, padding:'18px 18px 14px',
    position:'relative', overflow:'hidden',
  },
  heroBlob: {
    position:'absolute', right:-50, top:-50, width: 200, height: 200,
    borderRadius:'50%', background:'var(--accent-strong)',
    filter:'blur(46px)', opacity:.5, pointerEvents:'none',
  },
  heroGrid: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 14, position:'relative' },
  heroStat: {},
  heroStatLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing:'0.08em',
    textTransform:'uppercase', color:'rgba(255,255,255,0.55)',
    marginBottom: 4,
  },
  heroStatNum: {
    fontSize: 26, lineHeight: 1, fontWeight: 600,
    letterSpacing:'-0.02em',
  },
  heroStatTrend: (good) => ({
    fontSize: 11, marginTop: 4,
    color: good ? 'var(--accent-2)' : 'rgba(255,255,255,0.55)',
  }),
  heroDivider: {
    background:'rgba(255,255,255,0.12)', width: 1, alignSelf:'stretch', margin:'2px 0',
  },
  heroFoot: {
    position:'relative', marginTop: 14, paddingTop: 12,
    borderTop:'1px solid rgba(255,255,255,0.12)',
    display:'flex', alignItems:'center', gap: 8,
    fontSize: 11, color:'rgba(255,255,255,0.6)',
  },
  heroLive: { width: 6, height: 6, borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 0 3px rgba(46,160,67,0.25)' },

  // Ação primária dominante
  primaryWrap: { padding:'18px 16px 0' },
  primaryBtn: {
    width:'100%', padding:'16px 18px',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 18,
    display:'flex', alignItems:'center', gap: 14,
    cursor:'pointer', fontFamily:'inherit',
  },
  primaryIcon: {
    width: 44, height: 44, borderRadius: 12,
    background:'linear-gradient(135deg, var(--accent-strong), var(--accent))',
    color:'white',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  primaryText: { flex: 1, minWidth: 0, textAlign:'left' },
  primaryTitleRow: { display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' },
  primaryTitle: { fontSize: 15, fontWeight: 600, color:'var(--ink)' },
  primaryFreeTag: {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    padding:'3px 7px 2px', borderRadius: 999,
    background:tint('--success', 18),
    border:tintBorder('--success', 42),
    color:'var(--success)',
    fontSize: 9.5, lineHeight: 1, fontWeight: 800, letterSpacing:'0.08em',
    textTransform:'uppercase',
    boxShadow:'0 3px 10px rgba(46, 160, 67, 0.12)',
  },
  primarySub: { fontSize: 12, color:'var(--ink-soft)', marginTop: 2 },

  // Atalhos secundários
  shortcutsRow: { display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, padding:'10px 16px 0' },
  shortcut: {
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 14, padding:'12px 14px',
    display:'flex', alignItems:'center', gap: 10,
    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
  },
  shortcutIcon: (bg, fg) => ({
    width: 30, height: 30, borderRadius: 9,
    background: bg, color: fg,
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  }),
  shortcutLabel: { fontSize: 12.5, fontWeight: 500, color:'var(--ink)' },

  // Seção
  sectionH: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'24px 20px 10px',
  },
  sectionTitle: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  sectionLink: { fontSize: 12, color:'var(--accent-strong)', fontWeight: 600, cursor:'pointer', border:'none', background:'transparent', padding:'8px 0', minHeight: 44, fontFamily:'inherit' },
  sectionHint: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: -2, padding:'0 20px', lineHeight: 1.4 },

  // Atividade — espelhamentos recentes
  activityCard: {
    margin:'0 16px',
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18,
    overflow:'hidden',
  },
  actRow: (last) => ({
    display:'flex', alignItems:'flex-start', gap: 12,
    padding:'13px 14px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
  }),
  actDot: (tone) => ({
    width: 8, height: 8, borderRadius:'50%',
    background: tone === 'ok' ? 'var(--success)' : tone === 'fail' ? 'var(--danger)' : 'var(--warn)',
    marginTop: 6, flexShrink: 0,
  }),
  actMain: { flex: 1, minWidth: 0 },
  actTitle: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)', lineHeight: 1.35 },
  actMeta: {
    fontSize: 11.5, color:'var(--ink-soft)', marginTop: 3,
    display:'flex', alignItems:'center', gap: 5, flexWrap:'wrap',
  },
  actTime: { fontSize: 11, color:'var(--ink-faint)', fontFamily:"'JetBrains Mono', monospace", flexShrink: 0 },

  // Card do guia rápido de credenciais
  guideCard: {
    margin:'18px 16px 0', width:'calc(100% - 32px)',
    background:tint('--accent-2', 35),
    border:tintBorder('--accent', 30),
    borderRadius: 18, padding:'14px 16px',
    display:'flex', alignItems:'center', gap: 14,
    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
  },
  guideIcon: {
    width: 40, height: 40, borderRadius: 11,
    background:'linear-gradient(135deg, var(--accent-strong), var(--accent))',
    color:'white',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  },
  guideText: { flex: 1, minWidth: 0 },
  guideTitle: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  guideSub: { fontSize: 12, color:'var(--ink-soft)', marginTop: 2, lineHeight: 1.4 },

  // ─── Banner de plano vencido ───
  planBanner: {
    margin:'14px 16px 0', width:'calc(100% - 32px)',
    padding:'13px 14px',
    background:tint('--warn', 14),
    border:tintBorder('--warn', 38),
    borderRadius: 14,
    display:'flex', alignItems:'center', gap: 12,
    textAlign:'left', fontFamily:'inherit', cursor:'pointer',
  },
  planBannerIcon: {
    width: 30, height: 30, borderRadius: 9,
    background:'var(--warn)', color:'white', flexShrink: 0,
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  planBannerMain: { flex: 1, minWidth: 0 },
  planBannerTitle: { fontSize: 13, fontWeight: 600, color:'var(--ink)' },
  planBannerSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2, lineHeight: 1.35 },
  planBannerBtn: {
    padding:'7px 13px', borderRadius: 999,
    background:'var(--warn)', color:'white', border:'none',
    fontSize: 12, fontWeight: 700,
    cursor:'pointer', fontFamily:'inherit', flexShrink: 0,
  },

  // ─── Bloco "grátis" protagonista (plano vencido) ───
  freeHero: {
    margin:'16px 16px 0', width:'calc(100% - 32px)',
    padding: 18,
    background:`linear-gradient(150deg, ${tint('--success', 16)}, var(--surface))`,
    border:tintBorder('--success', 42, { width: 1.5 }),
    borderRadius: 20,
    position:'relative', overflow:'hidden',
  },
  freeHeroTop: { display:'flex', alignItems:'center', gap: 8, marginBottom: 12 },
  freeHeroLabel: { fontSize: 12.5, fontWeight: 600, color:'var(--success)' },
  freeHeroBtn: {
    width:'100%', padding:'16px 18px',
    background:'var(--ink)', color:'white',
    border:'none', borderRadius: 16,
    display:'flex', alignItems:'center', gap: 14,
    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
  },
  freeHeroIcon: {
    width: 44, height: 44, borderRadius: 12,
    background:'linear-gradient(135deg, var(--accent-strong), var(--accent))',
    color:'white', flexShrink: 0,
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  freeHeroNote: {
    fontSize: 12, color:'var(--ink-soft)', marginTop: 12, lineHeight: 1.45,
    textAlign:'center',
  },

  // Selo "Grátis"
  freeBadge: {
    display:'inline-flex', alignItems:'center', gap: 4,
    fontSize: 11, fontWeight: 700, letterSpacing:'0.02em',
    padding:'3px 9px', borderRadius: 999,
    background:'var(--success)', color:'white', whiteSpace:'nowrap',
  },

  queueCard: {
    margin:'12px 16px 0',
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18,
    padding:'14px 14px', display:'grid', gap: 12,
  },
  queueHead: { display:'flex', alignItems:'center', justifyContent:'space-between', gap: 10 },
  queueTitle: { fontSize: 13.5, fontWeight: 700, color:'var(--ink)' },
  queueSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },
  queueGrid: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8 },
  queueMetric: { padding:'10px 8px', border:'1px solid var(--line)', borderRadius: 13, background:'var(--bg-soft)' },
  queueMetricLabel: { fontSize: 10.5, color:'var(--ink-soft)', marginBottom: 4, fontWeight: 650, textTransform:'uppercase', letterSpacing:'0.04em' },
  queueMetricValue: { fontSize: 16, fontWeight: 800, color:'var(--ink)', fontFamily:"'JetBrains Mono', monospace" },

  // dim wrapper para recursos PRO esmaecidos
  dimmed: { opacity: 0.5, filter:'saturate(0.6)' },
  dimLockRow: {
    display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
    fontSize: 11.5, color:'var(--ink-soft)', fontWeight: 500,
    padding:'8px 0 0',
  },
};

function LockGlyph({ size = 12, color = 'var(--ink-faint)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function FreeBadge() {
  return (
    <span style={homeStyles.freeBadge}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      Grátis · sempre
    </span>
  );
}

// Sparkline mini para o foot do hero
function HomeSparkline() {
  const data = [2, 4, 3, 6, 8, 5, 9, 12, 14, 10, 13, 16, 14, 18, 22, 19, 24, 21, 26, 28, 25, 30, 32, 28];
  const max = Math.max(...data);
  const w = 100, h = 14;
  const points = data.map((v, i) => `${(i * w) / (data.length - 1)},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h+2}`} width="100%" height={h+2} preserveAspectRatio="none" style={{flex:1, maxWidth: 120}}>
      <polyline points={points} fill="none" stroke="rgba(217,207,234,0.7)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export default function MobileHomePage() {
  useMobileRoutePerf('m/home')
  const router = useRouter()

  const [me, setMe] = useState(null)
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [creds, setCreds] = useState([])
  const [summary, setSummary] = useState(null)
  const [recent, setRecent] = useState([])
  const [dashboardStatus, setDashboardStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [m, s, g, cr, sum, lg, ds] = await Promise.all([
          api.me().catch(() => null),
          api.sessionStatus().catch(() => null),
          api.groups().catch(() => []),
          api.credentials().catch(() => []),
          api.logsSummary('today').catch(() => null),
          api.logs('all', 1, 4).catch(() => null),
          api.dashboardStatus().catch(() => null),
        ])
        if (!active) return
        setMe(m)
        setSession(s)
        setGroups(Array.isArray(g) ? g : [])
        setCreds(Array.isArray(cr) ? cr : [])
        setSummary(sum)
        setRecent(Array.isArray(lg?.logs) ? lg.logs : [])
        setDashboardStatus(ds)
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar a sua página.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  const firstName = (me?.name || '').trim().split(' ')[0]
  const whatsappConnected = Boolean(dashboardStatus?.waConnected ?? session?.running)
  const hasCredentials = Boolean(dashboardStatus?.hasCredentials ?? (creds.length > 0))
  const hasSource = Boolean(dashboardStatus?.hasMonitorGroup ?? groups.some(g => g.role === 'monitor'))
  const hasDest = Boolean(dashboardStatus?.hasPostGroup ?? groups.some(g => g.role === 'post'))
  const hasSuccessfulLog = Boolean(dashboardStatus?.hasSuccessfulLog)
  const queue = dashboardStatus?.queue ?? dashboardStatus?.queueHealth ?? null

  const c = summary?.counts
  const postadosHoje = c?.success ?? 0
  const errosHoje = (c?.timeoutTotal ?? 0) + (c?.errorOther ?? 0)
  const vistosHoje = c
    ? (c.success + c.skippedDedup + c.skippedConfig + c.timeoutTotal + c.errorOther + c.inFlight)
    : 0

  const checklist = useMemo(() => {
    const steps = [
      { label: 'Suas afiliadas (Shopee, ML…)', done: hasCredentials, route: mobileRoutes.configCredentials },
      { label: 'Conectar WhatsApp',             done: whatsappConnected, route: mobileRoutes.configWhatsApp },
      { label: '1 grupo de origem',             done: hasSource, route: mobileRoutes.configGroups },
      { label: '1 grupo de destino',            done: hasDest, route: mobileRoutes.configGroups },
      { label: 'Primeiro envio validado',       done: hasSuccessfulLog, route: mobileRoutes.logs },
    ]
    const firstPending = steps.findIndex(s => !s.done)
    return steps.map((s, i) => ({ ...s, current: i === firstPending }))
  }, [hasCredentials, whatsappConnected, hasSource, hasDest, hasSuccessfulLog])

  const checklistDone = checklist.filter(s => s.done).length
  const checklistTotal = checklist.length
  const isOnboarding = checklistDone < checklistTotal
  const planState = derivePlanState(me)
  const isExpired = planState === 'expired'
  const hasAlert = errosHoje > 0 && !isExpired

  const recentItems = useMemo(() => recent.map(log => {
    const status = log.status
    const tone = status === 'success' ? 'ok' : status === 'error' ? 'fail' : 'warn'
    const firstLine = String(log.messageText || '').split('\n').find(l => l.trim()) || ''
    const dest = log.destGroup && log.destGroup.includes('@') ? (log.destGroupName || log.destGroup) : null
    return {
      t: (firstLine || log.convertedUrl || log.originalUrl || '(sem texto)').slice(0, 60),
      loja: PLATFORM_LABEL[String(log.platform || '').toLowerCase()] || log.platform || '—',
      dest: status === 'success' ? dest : null,
      erro: status === 'error' ? 'falhou' : null,
      when: relativeShort(log.sentAt),
      tone,
    }
  }), [recent])

  if (loading) {
    return (
      <MobileShell title="Conversor" active="inicio">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando sua página..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Conversor" active="inicio">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} onRetry={() => setReloadKey((k) => k + 1)} /></div>
      </MobileShell>
    )
  }

  // Bloco "Criar oferta" — protagonista verde quando o plano venceu,
  // ação primária discreta caso contrário. Criar segue grátis em qualquer plano.
  const criarBlock = isExpired ? (
    <div style={homeStyles.freeHero}>
      <div style={homeStyles.freeHeroTop}>
        <FreeBadge/>
        <span style={homeStyles.freeHeroLabel}>mesmo sem plano ativo</span>
      </div>
      <button type="button" style={homeStyles.freeHeroBtn} onClick={() => router.push(mobileRoutes.offer)}>
        <div style={homeStyles.freeHeroIcon}>
          <MobileIcon name="sparkles" size={20}/>
        </div>
        <div style={{ ...homeStyles.primaryText }}>
          <div style={{ ...homeStyles.primaryTitle, color:'white' }}>Criar oferta agora</div>
          <div style={{ ...homeStyles.primarySub, color:'rgba(255,255,255,0.7)' }}>cole um link e a gente faz o resto</div>
        </div>
        <MobileIcon name="arrow" size={16}/>
      </button>
      <div style={homeStyles.freeHeroNote}>
        Converter link e gerar oferta é <strong style={{color:'var(--success)'}}>grátis pra sempre</strong>, em qualquer plano.
      </div>
    </div>
  ) : (
    <div style={homeStyles.primaryWrap}>
      <button type="button" style={homeStyles.primaryBtn} onClick={() => router.push(mobileRoutes.offer)}>
        <div style={homeStyles.primaryIcon}>
          <MobileIcon name="sparkles" size={20}/>
        </div>
        <div style={homeStyles.primaryText}>
          <div style={homeStyles.primaryTitle}>Criar oferta agora</div>
          <div style={homeStyles.primarySub}>cole um link e a gente faz o resto</div>
        </div>
        <MobileIcon name="arrow" size={16}/>
      </button>
    </div>
  )

  return (
    <MobileShell title="Conversor" active="inicio" hasAlert={hasAlert && !isOnboarding} planExpired={isExpired}>
      {/* Banner de plano vencido — espelhamento pausado, criar segue grátis */}
      {isExpired && (
        <button type="button" style={homeStyles.planBanner} onClick={() => router.push(mobileRoutes.accountSubscription)}>
          <div style={homeStyles.planBannerIcon}>
            <LockGlyph size={15} color="white"/>
          </div>
          <div style={homeStyles.planBannerMain}>
            <div style={homeStyles.planBannerTitle}>Seu plano venceu</div>
            <div style={homeStyles.planBannerSub}>O espelhamento automático está pausado.</div>
          </div>
          <span style={homeStyles.planBannerBtn}>Reativar</span>
        </button>
      )}

      {/* Balão de progresso do checklist — só quando setup incompleto */}
      {isOnboarding && (
        <div style={homeStyles.checklistBalloon} onClick={() => router.push(mobileRoutes.checklistEspelhamento)}>
          <div style={homeStyles.checklistBalloonIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div style={homeStyles.alertText}>
            <div style={homeStyles.alertTitle}>{checklistDone} de {checklistTotal} passos executados</div>
            <div style={homeStyles.alertSub}>Complete o checklist para espelhar seus grupos</div>
            <div style={homeStyles.checklistBalloonBar}>
              <div style={homeStyles.checklistBalloonBarFill((checklistDone / checklistTotal) * 100)}/>
            </div>
          </div>
          <MobileIcon name="arrow" size={14}/>
        </div>
      )}

      {/* Alerta inline — só quando há problemas reais e setup completo */}
      {hasAlert && !isOnboarding && (
        <button type="button" style={homeStyles.alert} onClick={() => router.push(mobileRoutes.logs)}>
          <div style={homeStyles.alertIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.5"/>
            </svg>
          </div>
          <div style={homeStyles.alertText}>
            <div style={homeStyles.alertTitle}>{errosHoje} {errosHoje === 1 ? 'envio falhou' : 'envios falharam'} hoje</div>
            <div style={homeStyles.alertSub}>toque para ver o que aconteceu</div>
          </div>
          <MobileIcon name="arrow" size={14}/>
        </button>
      )}

      {/* Saudação + manchete factual */}
      <div style={homeStyles.greet}>
        <div style={homeStyles.greetHi}>Oi{firstName ? `, ${firstName}` : ''} 👋</div>
        {isOnboarding ? (
          <div style={homeStyles.greetHead}>
            Falta um passo<br/>pra começar.
          </div>
        ) : isExpired ? (
          <div style={homeStyles.greetHead}>
            Bom te ver de novo.<br/>O que vamos postar hoje?
          </div>
        ) : (
          <div style={homeStyles.greetHead}>
            {postadosHoje > 0 ? (
              <>
                Hoje você postou{' '}
                <span style={homeStyles.greetNum}>{postadosHoje} {postadosHoje === 1 ? 'promoção' : 'promoções'}</span>{' '}
                nos seus grupos.
              </>
            ) : (
              <>Tudo pronto. Aguardando as próximas promoções.</>
            )}
          </div>
        )}
      </div>

      {/* No VENCIDO: Criar é protagonista e vem antes do PRO esmaecido */}
      {isExpired && criarBlock}

      {/* Hero — só números factuais. Esmaecido + cadeado quando o plano venceu */}
      {!isOnboarding && (
        <div style={isExpired ? homeStyles.dimmed : undefined}>
          <div style={homeStyles.hero}>
            <div style={homeStyles.heroBlob}/>
            <div style={homeStyles.heroGrid}>
              <div style={homeStyles.heroStat}>
                <div style={homeStyles.heroStatLabel}>Detectados</div>
                <div style={homeStyles.heroStatNum}>{vistosHoje}</div>
                <div style={homeStyles.heroStatTrend()}>nos grupos monitorados</div>
              </div>
              <div style={homeStyles.heroDivider}/>
              <div style={homeStyles.heroStat}>
                <div style={homeStyles.heroStatLabel}>Postados</div>
                <div style={homeStyles.heroStatNum}>{postadosHoje}</div>
                <div style={homeStyles.heroStatTrend(!isExpired)}>{isExpired ? 'espelhamento pausado' : 'hoje'}</div>
              </div>
            </div>
            <div style={homeStyles.heroFoot}>
              {isExpired ? (
                <span>sem atividade — plano vencido</span>
              ) : (
                <>
                  <span style={homeStyles.heroLive}/>
                  <span>{summary?.lastSendAt ? `último envio há ${relativeShort(summary.lastSendAt)}` : 'sem envios ainda hoje'}</span>
                  <span style={{flex:1}}/>
                  <HomeSparkline/>
                </>
              )}
            </div>
          </div>
          {isExpired && (
            <div style={homeStyles.dimLockRow}>
              <LockGlyph size={11}/> reative o plano pra voltar a espelhar
            </div>
          )}
        </div>
      )}

      {/* AÇÃO PRIMÁRIA — no plano ativo aparece aqui (no vencido já apareceu no topo) */}
      {!isExpired && criarBlock}

      {/* Atalhos — só 2, não 4. Esmaecidos + cadeado no vencido */}
      <div style={isExpired ? homeStyles.dimmed : undefined}>
        <div style={homeStyles.shortcutsRow}>
          <button type="button" style={homeStyles.shortcut} onClick={() => router.push(mobileRoutes.espelhar)}>
            <div style={homeStyles.shortcutIcon(tint('--accent-2', 60), 'var(--ink)')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
                <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
              </svg>
            </div>
            <div style={homeStyles.shortcutLabel}>Espelhamento</div>
            {isExpired && <span style={{marginLeft:'auto'}}><LockGlyph size={12}/></span>}
          </button>
          <button type="button" style={homeStyles.shortcut} onClick={() => router.push(mobileRoutes.logs)}>
            <div style={homeStyles.shortcutIcon('var(--bg-soft)', 'var(--ink-soft)')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </div>
            <div style={homeStyles.shortcutLabel}>Ver envios</div>
            {isExpired && <span style={{marginLeft:'auto'}}><LockGlyph size={12}/></span>}
          </button>
        </div>

        {!isExpired && (
          <div style={homeStyles.shortcutsRow}>
            <button type="button" style={homeStyles.shortcut} onClick={() => router.push(mobileRoutes.broadcast)}>
              <div style={homeStyles.shortcutIcon(tint('--success', 18), 'var(--success)')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              </div>
              <div style={homeStyles.shortcutLabel}>Broadcast</div>
            </button>
            <button type="button" style={homeStyles.shortcut} onClick={() => router.push(mobileRoutes.automations)}>
              <div style={homeStyles.shortcutIcon(tint('--accent', 18), 'var(--accent-strong)')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4"/><path d="m16.2 7.8 2.8-2.8"/><path d="M18 12h4"/><path d="m16.2 16.2 2.8 2.8"/><path d="M12 18v4"/><path d="m7.8 16.2-2.8 2.8"/><path d="M6 12H2"/><path d="m7.8 7.8-2.8-2.8"/>
                </svg>
              </div>
              <div style={homeStyles.shortcutLabel}>Automações</div>
            </button>
          </div>
        )}
      </div>

      {!isExpired && queue && (
        <div style={homeStyles.queueCard}>
          <div style={homeStyles.queueHead}>
            <div>
              <div style={homeStyles.queueTitle}>Saúde da fila</div>
              <div style={homeStyles.queueSub}>{queue.lastError ? `último erro: ${String(queue.lastError).slice(0, 80)}` : 'sem erro recente registrado'}</div>
            </div>
            <button type="button" style={homeStyles.sectionLink} onClick={() => router.push(mobileRoutes.logs)}>Logs →</button>
          </div>
          <div style={homeStyles.queueGrid}>
            <div style={homeStyles.queueMetric}>
              <div style={homeStyles.queueMetricLabel}>Fila</div>
              <div style={homeStyles.queueMetricValue}>{queue.queueSize ?? 0}/{queue.maxSize ?? '∞'}</div>
            </div>
            <div style={homeStyles.queueMetric}>
              <div style={homeStyles.queueMetricLabel}>Latência</div>
              <div style={homeStyles.queueMetricValue}>{queue.avgLatencyMs != null ? `${Math.round(queue.avgLatencyMs)}ms` : '—'}</div>
            </div>
            <div style={homeStyles.queueMetric}>
              <div style={homeStyles.queueMetricLabel}>OK/erro</div>
              <div style={homeStyles.queueMetricValue}>{queue.successTotal ?? 0}/{queue.errorTotal ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Atividade recente — oculta no vencido (espelhamento pausado, sem novos envios) */}
      {!isExpired && (
      <>
          <div style={homeStyles.sectionH}>
            <div style={homeStyles.sectionTitle}>Últimos envios</div>
            <button type="button" style={homeStyles.sectionLink} onClick={() => router.push(mobileRoutes.logs)}>Ver tudo →</button>
          </div>
          <div style={homeStyles.activityCard}>
            {recentItems.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: 12.5, color: 'var(--ink-soft)', textAlign: 'center' }}>
                {isOnboarding
                  ? 'Nenhum envio ainda. Termine o checklist para começar a espelhar seus grupos.'
                  : 'Nenhum envio ainda. Quando o bot postar, aparece aqui.'}
              </div>
            ) : recentItems.map((a, i, arr) => (
              <div key={i} style={homeStyles.actRow(i === arr.length - 1)}>
                <div style={homeStyles.actDot(a.tone)}/>
                <div style={homeStyles.actMain}>
                  <div style={homeStyles.actTitle}>{a.t}</div>
                  <div style={homeStyles.actMeta}>
                    <span>{a.loja}</span>
                    <span style={{color:'var(--ink-faint)'}}>→</span>
                    {a.dest
                      ? <span style={{color:'var(--ink)', fontWeight: 500}}>{a.dest}</span>
                      : <span style={{color:'var(--danger)', fontWeight: 500}}>{a.erro || '—'}</span>}
                  </div>
                </div>
                <div style={homeStyles.actTime}>{a.when}</div>
              </div>
            ))}
          </div>
      </>
      )}

      {/* Guia rápido — como pegar as credenciais das afiliadas */}
      <button type="button" style={homeStyles.guideCard} onClick={() => router.push(mobileRoutes.tutorial)}>
        <div style={homeStyles.guideIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <div style={homeStyles.guideText}>
          <div style={homeStyles.guideTitle}>Guia rápido de credenciais</div>
          <div style={homeStyles.guideSub}>Aprenda a pegar suas credenciais de afiliada (Shopee, Amazon, ML)</div>
        </div>
        <MobileIcon name="arrow" size={16}/>
      </button>

      <div style={{height: 20}}/>
    </MobileShell>
  )
}
