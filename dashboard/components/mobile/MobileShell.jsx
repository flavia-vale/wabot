'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { mobileRoutes } from '@/components/mobile/routes'
import { MobileIcon } from '@/components/mobile/MobileIcons'

const shellStyles = {
  root: {
    position: 'relative',
    margin: '0 auto',
    minHeight: '100dvh',
    width: '100%',
    maxWidth: 480,
    background: 'var(--bg)',
    color: 'var(--ink)',
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px 10px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--line)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  topbarBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 32, height: 32, borderRadius: 9,
    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 14,
  },
  brandTxt: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' },
  iconBtn: {
    width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: 12,
    background: 'var(--bg-soft)', border: '1px solid var(--line)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink)', cursor: 'pointer',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--danger)',
    border: '2px solid var(--surface)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    background: 'var(--bg)',
    paddingBottom: 'calc(92px + env(safe-area-inset-bottom))',
    scrollPaddingBottom: 'calc(92px + env(safe-area-inset-bottom))',
  },
  bottomNav: {
    position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: 480,
    background: 'color-mix(in oklab, var(--surface) 95%, transparent)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid var(--line)',
    paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
    paddingTop: 6,
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
    zIndex: 9,
  },
  navItem: (active) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '8px 4px',
    minHeight: 44,
    color: active ? 'var(--accent-strong)' : 'var(--ink-soft)',
    fontSize: 10.5, fontWeight: 500,
    textDecoration: 'none',
  }),
  navIconWrap: (active) => ({
    width: 44, height: 28, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'color-mix(in oklab, var(--accent) 28%, var(--surface))' : 'transparent',
    transition: 'background .15s',
  }),
  navCenterBtn: {
    position: 'relative',
    width: 44, height: 44, borderRadius: 14,
    background: 'var(--ink)', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: -10, boxShadow: '0 6px 14px -4px rgba(0,0,0,0.25)',
  },
  // Botão central (Criar) realçado quando o plano venceu — é o que sempre funciona
  navCenterBtnFree: {
    background: 'var(--success)',
    boxShadow: '0 6px 16px -4px color-mix(in oklab, var(--success) 60%, transparent)',
  },
  navCenterFreeDot: {
    position: 'absolute', top: -3, right: -3,
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--success)', border: '2px solid var(--surface)',
  },
}

// Pequeno cadeado para tabs PRO quando o plano está vencido
function NavLock() {
  return (
    <span style={{ position: 'absolute', bottom: -2, right: 4 }} aria-hidden="true">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </span>
  )
}

// Tabs PRO que ganham cadeado quando o plano está vencido
const PRO_TABS = ['espelhar', 'envios']

function NavIcon({ name }) {
  if (name === 'inicio') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )
  }
  if (name === 'espelhar') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
        <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
      </svg>
    )
  }
  if (name === 'criar') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    )
  }
  if (name === 'envios') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
      </svg>
    )
  }
  if (name === 'conta') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>
    )
  }
  return null
}

const tabs = [
  { key: 'inicio',   label: 'Início',   href: mobileRoutes.home },
  { key: 'espelhar', label: 'Espelhar', href: mobileRoutes.espelhar },
  { key: 'criar',    label: 'Criar',    href: mobileRoutes.offer, accent: true },
  { key: 'envios',   label: 'Envios',   href: mobileRoutes.logs },
  { key: 'conta',    label: 'Conta',    href: mobileRoutes.account },
]

export function MobileShell({ title = 'Conversor', active = 'inicio', hasAlert = false, showBack, onBack, planExpired = false, children }) {
  const router = useRouter()
  // Setinha de voltar em todas as rotas /m por padrão. Páginas podem desligar
  // com showBack={false} se necessário.
  const displayBack = showBack ?? true
  const handleBack = onBack ?? (() => router.back())
  return (
    <div className="mobile-shell" style={shellStyles.root}>
      <style>{`
        .mobile-shell :is(a, button, input, textarea, select, [role="button"]):focus-visible {
          outline: 3px solid color-mix(in oklab, var(--accent-strong) 70%, white);
          outline-offset: 3px;
          box-shadow: 0 0 0 5px color-mix(in oklab, var(--accent) 22%, transparent);
        }
        .mobile-shell :is(a, button) {
          -webkit-tap-highlight-color: color-mix(in oklab, var(--accent) 20%, transparent);
        }
        .mobile-shell button:disabled {
          cursor: not-allowed;
        }
      `}</style>
      <header style={shellStyles.topbar}>
        <div style={shellStyles.topbarBrand}>
          {displayBack ? (
            <button
              type="button"
              style={{ ...shellStyles.iconBtn, marginRight: 6 }}
              aria-label="Voltar"
              onClick={handleBack}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          ) : (
            <div style={shellStyles.brandMark}>b</div>
          )}
          <div style={shellStyles.brandTxt}>{title}</div>
        </div>
        <button type="button" style={shellStyles.iconBtn} aria-label="Notificações">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          {hasAlert ? <span style={shellStyles.notifDot} aria-hidden="true"/> : null}
        </button>
      </header>

      <main style={shellStyles.content} role="main">{children}</main>

      <nav style={shellStyles.bottomNav} aria-label="Navegação principal mobile">
        {tabs.map((tab) => {
          const isActive = active === tab.key
          const locked = planExpired && PRO_TABS.includes(tab.key)
          const labelStyle = tab.accent && planExpired
            ? { color: 'var(--success)', fontWeight: 700 }
            : undefined
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              style={{ ...shellStyles.navItem(isActive), opacity: locked ? 0.45 : 1 }}
            >
              {tab.accent ? (
                <div style={{ ...shellStyles.navCenterBtn, ...(planExpired ? shellStyles.navCenterBtnFree : null) }}>
                  <NavIcon name={tab.key}/>
                  {planExpired ? <span style={shellStyles.navCenterFreeDot} aria-hidden="true"/> : null}
                </div>
              ) : (
                <div style={{ ...shellStyles.navIconWrap(isActive), position: 'relative' }}>
                  <NavIcon name={tab.key}/>
                  {locked ? <NavLock/> : null}
                </div>
              )}
              <span style={labelStyle}>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function MobileStateCard({ title, description, actionLabel, onAction, tone = 'neutral' }) {
  const bg = tone === 'error' ? 'color-mix(in oklab, var(--danger) 10%, var(--surface))'
            : tone === 'success' ? 'color-mix(in oklab, var(--success) 10%, var(--surface))'
            : 'var(--surface)'
  const border = tone === 'error' ? 'color-mix(in oklab, var(--danger) 30%, var(--line))'
              : tone === 'success' ? 'color-mix(in oklab, var(--success) 30%, var(--line))'
              : 'var(--line)'
  return (
    <section
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: 16,
        margin: '16px',
      }}
      aria-live="polite"
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{description}</p>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 12,
            padding: '8px 14px',
            minHeight: 44,
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
