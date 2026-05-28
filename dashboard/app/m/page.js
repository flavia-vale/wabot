'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobileRoutes } from '@/components/mobile/routes'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

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
    background:'color-mix(in oklab, var(--danger) 12%, var(--surface))',
    border:'1px solid color-mix(in oklab, var(--danger) 35%, var(--line))',
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
  primaryTitle: { fontSize: 15, fontWeight: 600, color:'var(--ink)' },
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

  // Checklist do empty-state / setup
  setup: {
    margin:'16px 16px 0',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 18, padding: 18,
  },
  setupHead: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    marginBottom: 14,
  },
  setupTitle: { fontSize: 15, fontWeight: 600, color:'var(--ink)' },
  setupProgress: {
    fontSize: 11, fontWeight: 600, color:'var(--ink-soft)',
    fontFamily:"'JetBrains Mono', monospace",
  },
  setupBar: {
    height: 4, background:'var(--bg-soft)', borderRadius: 999, overflow:'hidden',
    marginBottom: 14,
  },
  setupBarFill: { height:'100%', background:'var(--accent-strong)', borderRadius: 999 },
  setupItem: (done, current) => ({
    display:'flex', alignItems:'center', gap: 12,
    padding:'10px 0',
    borderBottom: '1px solid var(--line)',
  }),
  setupCheck: (done) => ({
    width: 22, height: 22, borderRadius:'50%',
    background: done ? 'var(--success)' : 'var(--surface)',
    border:'1.5px solid ' + (done ? 'var(--success)' : 'var(--line-strong)'),
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', flexShrink: 0,
  }),
  setupItemLabel: (done) => ({
    flex: 1, fontSize: 13.5,
    color: done ? 'var(--ink-soft)' : 'var(--ink)',
    fontWeight: done ? 400 : 500,
    textDecoration: done ? 'line-through' : 'none',
  }),
  setupItemAction: {
    fontSize: 12, fontWeight: 600,
    color:'var(--accent-strong)',
    padding:'4px 10px',
    border:'1px solid var(--line)', borderRadius: 999,
    background:'var(--surface)',
    cursor:'pointer', fontFamily:'inherit',
  },
};

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [m, s, g, cr, sum, lg] = await Promise.all([
          api.me().catch(() => null),
          api.sessionStatus().catch(() => null),
          api.groups().catch(() => []),
          api.credentials().catch(() => []),
          api.logsSummary('today').catch(() => null),
          api.logs('all', 1, 4).catch(() => null),
        ])
        if (!active) return
        setMe(m)
        setSession(s)
        setGroups(Array.isArray(g) ? g : [])
        setCreds(Array.isArray(cr) ? cr : [])
        setSummary(sum)
        setRecent(Array.isArray(lg?.logs) ? lg.logs : [])
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar a sua página.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const firstName = (me?.name || '').trim().split(' ')[0]
  const whatsappConnected = Boolean(session?.running)
  const hasCredentials = creds.length > 0
  const hasSource = groups.some(g => g.role === 'monitor')
  const hasDest = groups.some(g => g.role === 'post')

  const c = summary?.counts
  const postadosHoje = c?.success ?? 0
  const errosHoje = (c?.timeoutTotal ?? 0) + (c?.errorOther ?? 0)
  const vistosHoje = c
    ? (c.success + c.skippedDedup + c.skippedConfig + c.timeoutTotal + c.errorOther + c.inFlight)
    : 0

  // Checklist de onboarding derivada do estado real da conta.
  const checklist = useMemo(() => {
    const steps = [
      { label: 'Suas afiliadas (Shopee, ML…)', done: hasCredentials, route: mobileRoutes.configCredentials },
      { label: 'Conectar WhatsApp',             done: whatsappConnected, route: mobileRoutes.configWhatsApp },
      { label: '1 grupo de origem',             done: hasSource, route: mobileRoutes.configGroups },
      { label: '1 grupo de destino',            done: hasDest, route: mobileRoutes.configGroups },
      { label: 'Ligar o espelhamento',          done: whatsappConnected && hasSource && hasDest, route: mobileRoutes.espelhar },
    ]
    const firstPending = steps.findIndex(s => !s.done)
    return steps.map((s, i) => ({ ...s, current: i === firstPending }))
  }, [hasCredentials, whatsappConnected, hasSource, hasDest])

  const checklistDone = checklist.filter(s => s.done).length
  const isOnboarding = checklistDone < 5
  const hasAlert = errosHoje > 0

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
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Conversor" active="inicio" hasAlert={hasAlert}>
      {/* Alerta inline — só quando há problemas reais */}
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

      {/* Hero — só números factuais, sem rótulos vagos */}
      {!isOnboarding && (
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
              <div style={homeStyles.heroStatTrend(true)}>hoje</div>
            </div>
          </div>
          <div style={homeStyles.heroFoot}>
            <span style={homeStyles.heroLive}/>
            <span>{summary?.lastSendAt ? `último envio há ${relativeShort(summary.lastSendAt)}` : 'sem envios ainda hoje'}</span>
            <span style={{flex:1}}/>
            <HomeSparkline/>
          </div>
        </div>
      )}

      {/* Setup checklist (só no onboarding) */}
      {isOnboarding && (
        <div style={homeStyles.setup}>
          <div style={homeStyles.setupHead}>
            <div style={homeStyles.setupTitle}>Configurar bot</div>
            <span style={homeStyles.setupProgress}>{checklistDone}/5</span>
          </div>
          <div style={homeStyles.setupBar}>
            <div style={{...homeStyles.setupBarFill, width: `${(checklistDone/5)*100}%`}}/>
          </div>
          <div>
            {checklist.map((c, i, a) => (
              <div key={i} style={{
                ...homeStyles.setupItem(),
                borderBottom: i === a.length-1 ? 'none' : '1px solid var(--line)',
              }}>
                <div style={homeStyles.setupCheck(c.done)}>
                  {c.done && <MobileIcon name="check" size={11} stroke={3}/>}
                </div>
                <span style={homeStyles.setupItemLabel(c.done)}>{c.label}</span>
                {c.current && <button type="button" style={homeStyles.setupItemAction} onClick={() => router.push(c.route)}>Fazer</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AÇÃO PRIMÁRIA — única, dominante */}
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

      {/* Atalhos — só 2, não 4. Nada de "status disfarçado de ação" */}
      <div style={homeStyles.shortcutsRow}>
        <button type="button" style={homeStyles.shortcut} onClick={() => router.push(mobileRoutes.espelhar)}>
          <div style={homeStyles.shortcutIcon('color-mix(in oklab, var(--accent-2) 60%, var(--surface))', 'var(--ink)')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
              <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
            </svg>
          </div>
          <div style={homeStyles.shortcutLabel}>Espelhamento</div>
        </button>
        <button type="button" style={homeStyles.shortcut} onClick={() => router.push(mobileRoutes.logs)}>
          <div style={homeStyles.shortcutIcon('var(--bg-soft)', 'var(--ink-soft)')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </div>
          <div style={homeStyles.shortcutLabel}>Ver envios</div>
        </button>
      </div>

      {/* Atividade recente — só quando já tem operação rodando */}
      {!isOnboarding && (
        <>
          <div style={homeStyles.sectionH}>
            <div style={homeStyles.sectionTitle}>Últimos envios</div>
            <button type="button" style={homeStyles.sectionLink} onClick={() => router.push(mobileRoutes.logs)}>Ver tudo →</button>
          </div>
          <div style={homeStyles.activityCard}>
        {recentItems.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: 12.5, color: 'var(--ink-soft)', textAlign: 'center' }}>
            Nenhum envio ainda. Quando o bot postar, aparece aqui.
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

      <div style={{height: 20}}/>
    </MobileShell>
  )
}
