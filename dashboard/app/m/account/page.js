'use client'

import { useEffect, useMemo, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

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
    background:'color-mix(in oklab, var(--accent-2) 50%, var(--surface))',
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
    background: tone === 'success' ? 'color-mix(in oklab, var(--success) 16%, var(--surface))'
              : tone === 'warn'    ? 'color-mix(in oklab, var(--warn) 18%, var(--surface))'
              : tone === 'danger'  ? 'color-mix(in oklab, var(--danger) 16%, var(--surface))'
              : tone === 'accent'  ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))'
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
  rowTitle: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)' },
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
const ContaRow = ({ icon, tone, title, sub, statusTone, value, last }) => (
  <div style={contaStyles.row(last)}>
    <div style={contaStyles.rowIcon(tone)}>
      <MobileIcon name={icon} size={15} stroke={1.8}/>
    </div>
    <div style={contaStyles.rowMain}>
      <div style={contaStyles.rowTitle}>{title}</div>
      {sub && <div style={contaStyles.rowSub}>{sub}</div>}
    </div>
    {statusTone && <div style={contaStyles.statusDot(statusTone)}/>}
    {value && <span style={contaStyles.rowValue}>{value}</span>}
    <MobileIcon name="arrow" size={13}/>
  </div>
);

export default function AccountPage() {
  useMobileRoutePerf('m/account')
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const daysSinceConnect = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    return !session?.connectedAt ? 0 : Math.floor((Date.now() - new Date(session.connectedAt).getTime()) / (1000 * 60 * 60 * 24))
  }, [session])

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
  const plan = user?.plan?.toUpperCase() || 'FREE'
  const planPrice = user?.plan === 'pro' ? 'R$ 39/mês' : 'Grátis'
  const renewDate = user?.subscriptionRenewalAt ? new Date(user.subscriptionRenewalAt).toLocaleDateString('pt-BR') : ''

  return (
    <MobileShell title="Conversor" active="conta">
      {/* Perfil */}
      <div style={contaStyles.profile}>
        <div style={contaStyles.avatar}>{initials}</div>
        <div style={contaStyles.profileMain}>
          <div style={contaStyles.name}>{name}</div>
          <div style={contaStyles.email}>{email}</div>
          <div style={contaStyles.planRow}>{plan}</div>
        </div>
      </div>

      {/* Plano */}
      {user?.plan && (
        <div style={contaStyles.plan}>
          <div style={contaStyles.planMain}>
            <div style={contaStyles.planTitle}>{planPrice}{renewDate ? ` · renova em ${renewDate}` : ''}</div>
            <div style={contaStyles.planSub}>incluído: espelhamento e reescrita por IA</div>
          </div>
          <button style={contaStyles.planBtn}>Gerenciar</button>
        </div>
      )}

      {/* ── CONEXÕES ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Onde você está conectado</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="whatsapp" tone="success" title="WhatsApp"
          sub={session?.phone ? `${session.phone} · ativo há ${daysSinceConnect} dias` : 'não conectado'}
          statusTone={session?.running ? "success" : "danger"} last={false}/>
        <ContaRow icon="link" tone="accent" title="Suas afiliadas"
          sub="Shopee · ML · Amazon · Magalu" value="4 de 5" last/>
      </div>

      {/* ── ENVIOS — atalhos, não duplicação ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Como o bot posta</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="plus" title="Modelos de mensagem"
          sub="achadinho · relâmpago · tech · beleza" value="4"/>
        <ContaRow icon="bolt" title="Ritmo de envio"
          sub="1 envio a cada 12 minutos"/>
        <ContaRow icon="sparkles" tone="accent" title="Reescrita por IA"
          sub="evita repetições · grátis no PRO" value="ativo" last/>
      </div>

      {/* ── ANTI-BANIMENTO (era "Preservação avançada") ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Proteção da conta</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="shield" tone="success" title="Anti-banimento"
          sub="ajusta o ritmo automaticamente quando o WhatsApp aperta" statusTone="success" last/>
      </div>

      {/* ── PREFERÊNCIAS ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Preferências</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="chat" title="Notificações"
          sub="quando avisar de falhas, novos envios e marcos"/>
        <ContaRow icon="star" title="Aparência"
          sub="tema · idioma" value="Menta · Claro" last/>
      </div>

      {/* ── CONTA + AJUDA ── */}
      <div style={contaStyles.section}>
        <div style={contaStyles.sectionLabel}>Conta e ajuda</div>
      </div>
      <div style={contaStyles.card}>
        <ContaRow icon="star" title="Assinatura e cobrança"
          sub="histórico · forma de pagamento · cancelar"/>
        <ContaRow icon="chat" title="Falar com a gente"
          sub="WhatsApp · responde em até 1h em horário comercial"/>
        <ContaRow icon="shield" title="Privacidade e dados"
          sub="o que coletamos e como excluir" last/>
      </div>

      {/* ── SAIR ── */}
      <button style={contaStyles.signout}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sair da conta
      </button>

      <div style={contaStyles.footer}>
        Conversor Bot v 2.4
      </div>
    </MobileShell>
  )
}
