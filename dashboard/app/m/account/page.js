'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { MobileConfirmDialog } from '@/components/mobile/MobileModal'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'
import { DEFAULT_LANDING_PLANS } from '@/lib/marketing-content'
import { derivePlanState, daysSinceExpiry } from '@/components/mobile/planState'
import { tint, tintBorder } from '@/components/mobile/mobileStyles'

const contaStyles = {
  // Perfil — discreto, sem blob
  profile: {
    margin:'16px 16px 0',
    padding: 16,
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 18,
    display:'flex', alignItems:'center', gap: 14,
  },
  avatar: {
    width: 52, height: 52, borderRadius:'50%',
    background:'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight: 600, fontSize: 18,
    flexShrink: 0,
  },
  profileMain: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: 600, color:'var(--ink)' },
  email: { fontSize: 12, color:'var(--ink-soft)', marginTop: 2 },
  planRow: {
    display:'inline-flex', alignItems:'center', gap: 6, marginTop: 6,
    padding:'2px 8px', borderRadius: 999,
    background:'var(--ink)', color:'white',
    fontSize: 10, fontWeight: 700, letterSpacing:'0.06em',
  },

  // Card de plano PRO (separado do perfil, mais discreto que v1)
  plan: {
    margin:'10px 16px 0',
    padding: 14,
    background:tint('--accent-2', 50),
    border:'1px solid var(--line)', borderRadius: 14,
    display:'flex', alignItems:'center', gap: 12,
  },
  planMain: { flex: 1, minWidth: 0 },
  planTitle: { fontSize: 13, fontWeight: 600, color:'var(--ink)' },
  planSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },
  planBtn: {
    padding:'7px 14px', borderRadius: 999,
    background:'var(--surface)', border:'1px solid var(--line)',
    color:'var(--ink)', fontSize: 11.5, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
  },

  // Sections
  section: { padding:'24px 20px 8px' },
  sectionLabel: {
    fontSize: 11, fontWeight: 600, color:'var(--ink-faint)',
    textTransform:'uppercase', letterSpacing:'0.08em',
  },

  // Lista de itens
  card: { margin:'0 16px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 16, overflow:'hidden' },
  row: (last) => ({
    display:'flex', alignItems:'center', gap: 12,
    padding:'13px 14px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
    cursor:'pointer',
  }),
  rowIcon: (tone) => ({
    width: 32, height: 32, borderRadius: 9,
    background: tone === 'success' ? tint('--success', 16)
              : tone === 'warn'    ? tint('--warn', 18)
              : tone === 'danger'  ? tint('--danger', 16)
              : tone === 'accent'  ? tint('--accent', 22)
              : 'var(--bg-soft)',
    border:'1px solid var(--line)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color: tone === 'success' ? 'var(--success)'
         : tone === 'warn' ? 'var(--warn)'
         : tone === 'danger' ? 'var(--danger)'
         : tone === 'accent' ? 'var(--accent-strong)'
         : 'var(--ink-soft)',
    flexShrink: 0,
  }),
  rowMain: { flex: 1, minWidth: 0 },
  rowTitleLine: { display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' },
  rowTitle: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)' },
  rowTag: {
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    padding:'2px 7px', borderRadius: 999,
    background:tint('--accent', 16),
    border:tintBorder('--accent', 28),
    color:'var(--accent-strong)',
    fontSize: 9.5, fontWeight: 800, letterSpacing:'0.06em', textTransform:'uppercase',
    lineHeight: 1.35, whiteSpace:'nowrap',
  },
  rowSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },

  statusDot: (tone) => ({
    width: 8, height: 8, borderRadius:'50%',
    background: tone === 'success' ? 'var(--success)'
              : tone === 'danger'  ? 'var(--danger)'
              : tone === 'warn'    ? 'var(--warn)'
              : 'var(--ink-faint)',
    flexShrink: 0,
  }),

  rowValue: { fontSize: 12.5, color:'var(--ink-soft)', fontWeight: 500 },

  signout: {
    margin:'24px 16px',
    padding:'14px',
    background:'transparent', border:'1px solid var(--line)', borderRadius: 14,
    color:'var(--danger)', fontSize: 13, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
    width:'calc(100% - 32px)',
    display:'flex', alignItems:'center', justifyContent:'center', gap: 8,
  },

  footer: {
    padding:'4px 20px 28px',
    fontSize: 10.5, color:'var(--ink-faint)',
    textAlign:'center',
  },
};

// Linha de configuração
const ContaRow = ({ icon, tone, title, sub, tag, statusTone, value, last, onClick }) => (
  <button type="button" onClick={onClick} style={{...contaStyles.row(last), width:'100%', border:'none', background:'transparent', textAlign:'left', fontFamily:'inherit'}}>
    <div style={contaStyles.rowIcon(tone)}>
      <MobileIcon name={icon} size={15} stroke={1.8}/>
    </div>
    <div style={contaStyles.rowMain}>
      <div style={contaStyles.rowTitleLine}>
        <div style={contaStyles.rowTitle}>{title}</div>
        {tag && <span style={contaStyles.rowTag}>{tag}</span>}
      </div>
      {sub && <div style={contaStyles.rowSub}>{sub}</div>}
    </div>
    {statusTone && <div style={contaStyles.statusDot(statusTone)}/>}
    {value && <span style={contaStyles.rowValue}>{value}</span>}
    <MobileIcon name="arrow" size={13}/>
  </button>
);

export default function AccountPage() {
  useMobileRoutePerf('m/account')
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [u, s] = await Promise.all([
          api.me().catch(() => null),
          api.sessionStatus().catch(() => null),
        ])
        if (!active) return
        setUser(u || {})
        setSession(s || {})
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar os dados.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])


  function openWhatsApp(message) {
    const phone = '5532999844020'
    const url = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await api.logout()
    } finally {
      router.replace('/login')
    }
  }

  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando conta..." /></div>
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

  const name = user?.name || 'Usuário'
  const email = user?.email || ''
  const firstName = name.split(' ')[0]
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const planState = derivePlanState(user)
  const isExpired = planState === 'expired'
  const expiredDays = daysSinceExpiry(user)
  const plan = isExpired ? 'PLANO VENCIDO' : (user?.plan?.toUpperCase() || 'FREE')
  const isPro = user?.plan === 'pro'
  const planDef = DEFAULT_LANDING_PLANS.find(p => p.id === user?.plan)
  const planPrice = planDef?.priceValue > 0 ? `${planDef.price}/mês` : 'Grátis'
  const reactivatePrice = planDef?.priceValue > 0 ? planDef.price : 'R$ 19'
  const accessDate = user?.accessExpiresAt ? new Date(user.accessExpiresAt).toLocaleDateString('pt-BR') : ''
  const renewLabel = isPro ? 'renova em' : 'válido até'
  const connectedLabel = session?.connectedAt ? `desde ${new Date(session.connectedAt).toLocaleDateString('pt-BR')}` : 'conectado'

  return (
    <MobileShell title="Conversor" active="conta" planExpired={isExpired}>
      {/* Perfil */}
      <div style={contaStyles.profile}>
        <div style={contaStyles.avatar}>{initials}</div>
        <div style={contaStyles.profileMain}>
          <div style={contaStyles.name}>{name}</div>
          <div style={contaStyles.email}>{email}</div>
          <div style={{...contaStyles.planRow, ...(isExpired ? { background:'var(--warn)' } : null)}}>{plan}</div>
        </div>
      </div>

      {/* Plano — banner de reativação quando vencido, card discreto caso contrário */}
      {isExpired ? (
        <div style={{
          margin:'10px 16px 0', padding:'16px',
          background:tint('--warn', 14),
          border:tintBorder('--warn', 40, { width: 1.5 }),
          borderRadius: 16,
        }}>
          <div style={{display:'flex', alignItems:'center', gap: 8, marginBottom: 8}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style={{fontSize: 13, fontWeight: 700, color:'var(--warn)'}}>
              {expiredDays != null && expiredDays > 0
                ? `Plano vencido há ${expiredDays} ${expiredDays === 1 ? 'dia' : 'dias'}`
                : 'Plano vencido'}
            </span>
          </div>
          <div style={{fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.45, marginBottom: 12}}>
            O espelhamento está pausado. Criar ofertas continua grátis. Reative pra voltar a automatizar.
          </div>
          <button type="button" onClick={() => router.push(mobileRoutes.accountSubscription)} style={{width:'100%', padding:'13px', background:'var(--warn)', color:'white', border:'none', borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor:'pointer', fontFamily:'inherit'}}>
            Reativar por {reactivatePrice}/mês
          </button>
        </div>
      ) : user?.plan && (
        <div style={contaStyles.plan}>
          <div style={contaStyles.planMain}>
            <div style={contaStyles.planTitle}>{planPrice}{accessDate ? ` · ${renewLabel} ${accessDate}` : ''}</div>
            <div style={contaStyles.planSub}>incluído: espelhamento</div>
          </div>
          <button type="button" onClick={() => router.push(mobileRoutes.accountSubscription)} style={contaStyles.planBtn}>Gerenciar</button>
        </div>
      )}

      {/* ── CONEXÕES ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Onde você está conectado</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="whatsapp" tone="success" title="WhatsApp"
          sub={session?.phone ? `${session.phone} · ${connectedLabel}` : 'não conectado'}
          statusTone={session?.running ? "success" : "danger"} onClick={() => router.push(mobileRoutes.configWhatsApp)} last={false}/>
        <ContaRow icon="link" tone="accent" title="Suas afiliadas"
          sub="Shopee · ML · Amazon · Magalu" value="editar" onClick={() => router.push(mobileRoutes.configCredentials)} last/>
      </div>

      {/* ── ENVIOS — atalhos, não duplicação ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Como o bot posta</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="chat" tone="accent" title="Enviar mensagem livre"
          sub="broadcast com segmentação de destinos" value="abrir" onClick={() => router.push(mobileRoutes.broadcast)}/>
        <ContaRow icon="link" tone="success" title="Converter links"
          sub="transforme links originais em links de afiliado" value="abrir" onClick={() => router.push(mobileRoutes.converter)}/>
        <ContaRow icon="bolt" tone="success" title="Ofertas automáticas"
          sub="buscas recorrentes, ligar/desligar e teste" value="abrir" onClick={() => router.push(mobileRoutes.automations)}/>
        <ContaRow icon="sparkles" tone="accent" title="Ganchos e CTAs"
          sub="variações persistidas no backend" value="editar" onClick={() => router.push(mobileRoutes.accountVariations)}/>
        <ContaRow icon="plus" title="Modelos de oferta"
          sub="modelos locais para criar oferta manual" value="editar" onClick={() => router.push(mobileRoutes.accountTemplates)}/>
        <ContaRow icon="shield" title="Ritmo de envio"
          sub="ajuste em grupos e preservação" onClick={() => router.push(mobileRoutes.espelhar)}/>
        <ContaRow icon="link" title="Preferências do bot"
          sub="delay, marca e palavras bloqueadas" onClick={() => router.push(mobileRoutes.configPreferences)} last/>
      </div>

      {/* ── ANTI-BANIMENTO (era "Preservação avançada") ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Proteção da conta</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="shield" tone="success" title="Anti-banimento" tag="Recurso PRO"
          sub="throttle, horário silencioso e saúde dos canais" statusTone="success" onClick={() => router.push(mobileRoutes.preservacao)} last/>
      </div>


      {/* ── CONTA + AJUDA ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Conta e ajuda</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="star" title="Assinatura e cobrança"
          sub="histórico · forma de pagamento · renovar" onClick={() => router.push(mobileRoutes.accountSubscription)}/>
        <ContaRow icon="chat" title="Guia rápido"
          sub="passo a passo de ativação" onClick={() => router.push(mobileRoutes.helpTutorial)}/>
        <ContaRow icon="link" title="Guia de credenciais"
          sub="Shopee, Amazon e Mercado Livre" onClick={() => router.push(mobileRoutes.tutorial)}/>
        <ContaRow icon="whatsapp" tone="success" title="Suporte"
          sub="fale com a gente pelo WhatsApp" onClick={() => openWhatsApp('Olá! Preciso de suporte.')}/>
        <ContaRow icon="sparkles" tone="accent" title="Contato"
          sub="sugestões e melhorias" onClick={() => openWhatsApp('Olá! Tenho uma sugestão de melhoria.')}/>
        <ContaRow icon="shield" title="Privacidade e dados"
          sub="termos e privacidade no site" onClick={() => router.push('/privacidade')} last/>
      </div>

      {/* ── SAIR ── */}
      <button type="button" onClick={() => setLogoutOpen(true)} style={contaStyles.signout}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sair da conta
      </button>

      <div style={contaStyles.footer}>
        Conversor Bot v 2.4
      </div>

      <MobileConfirmDialog
        open={logoutOpen}
        title="Sair da conta?"
        message="Você precisará entrar de novo para acessar o painel. A conexão do WhatsApp continua ativa."
        confirmLabel="Sair"
        cancelLabel="Continuar conectado"
        danger
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </MobileShell>
  )
}
