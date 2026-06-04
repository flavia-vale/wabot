'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { NAV_GROUPS, TOP_CTA } from './nav'

/* Contexto compartilhado: dados de sessão/usuário buscados uma vez pelo shell
 * e reusados pelas páginas (sem refetch). Páginas também publicam o título do
 * header aqui via usePainelHeader(). Nada disso toca o back end além das rotas
 * já existentes em @/lib/api. */
const PainelContext = createContext(null)

export function usePainel() {
  const ctx = useContext(PainelContext)
  if (!ctx) throw new Error('usePainel deve ser usado dentro de <PainelShell>')
  return ctx
}

export function usePainelHeader(header) {
  const { setHeader } = usePainel()
  const title = header?.title
  const subtitle = header?.subtitle
  useEffect(() => {
    setHeader({ title, subtitle })
  }, [title, subtitle, setHeader])
}

function initialsOf(name, email) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function Icon({ path }) {
  return (
    <svg className="pnl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  )
}

function OnlinePill({ online, groupCount }) {
  const state = online === null ? 'is-idle' : online ? 'is-on' : 'is-off'
  const label = online === null
    ? 'verificando…'
    : online
      ? `bot online${groupCount != null ? ` · ${groupCount} grupos` : ''}`
      : 'bot offline'
  return (
    <span className="pnl-online">
      <span className={`pnl-dot ${state}`} aria-hidden="true" />
      {label}
    </span>
  )
}

export default function PainelShell({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [online, setOnline] = useState(null)
  const [phone, setPhone] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [header, setHeader] = useState({ title: 'Painel', subtitle: '' })

  // Autenticação — mesmo contrato do dashboard atual (api.me → /login no erro).
  useEffect(() => {
    let active = true
    api.me()
      .then((u) => { if (active) { setUser(u); setChecking(false) } })
      .catch(() => { if (active) router.replace('/login') })
    return () => { active = false }
  }, [router])

  // Status de sessão + contagem de grupos (compartilhado com as páginas).
  useEffect(() => {
    if (checking) return undefined
    let active = true
    Promise.allSettled([api.sessionStatusFast(), api.groups()]).then(([s, g]) => {
      if (!active) return
      if (s.status === 'fulfilled') {
        setOnline(s.value?.status === 'connected')
        setPhone(s.value?.phone ?? null)
      } else {
        setOnline(false)
      }
      if (g.status === 'fulfilled' && Array.isArray(g.value)) setGroupCount(g.value.length)
    })
    return () => { active = false }
  }, [checking])

  async function logout() {
    await api.logout().catch(() => {})
    router.push('/login')
  }

  const ctxValue = useMemo(
    () => ({ user, online, phone, groupCount, setHeader }),
    [user, online, phone, groupCount],
  )

  if (checking) {
    return (
      <div className="pnl-center" role="status" aria-live="polite">
        <span className="pnl-spin" aria-hidden="true" /> Validando sua sessão…
      </div>
    )
  }

  const isActive = (href) => href === '/painel' ? pathname === '/painel' : pathname.startsWith(href)

  return (
    <PainelContext.Provider value={ctxValue}>
      <div className={`pnl-root${menuOpen ? ' is-menu-open' : ''}`}>
        {menuOpen && <button type="button" aria-label="Fechar menu" className="pnl-overlay" onClick={() => setMenuOpen(false)} />}

        <aside className="pnl-sidebar">
          <Link href="/painel" className="pnl-brand" onClick={() => setMenuOpen(false)}>
            BOTinho <small>.app</small>
          </Link>

          <Link href={TOP_CTA.href} className="pnl-cta" onClick={() => setMenuOpen(false)}>
            <b>{TOP_CTA.label}</b>
            <span>{TOP_CTA.note}</span>
          </Link>

          <nav className="pnl-nav" aria-label="Navegação do painel">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="pnl-nav-group">
                <p className="pnl-nav-title">{group.title}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={`pnl-nav-item${isActive(item.href) ? ' is-active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon path={item.icon} />
                    <span>{item.label}</span>
                    {item.pro && <span className="pnl-pro">PRO</span>}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <button type="button" className="pnl-user" onClick={logout} title="Sair da conta" style={{ background: 'none', border: 'none', borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
            <span className="pnl-avatar" aria-hidden="true">{initialsOf(user?.name, user?.email)}</span>
            <span style={{ minWidth: 0 }}>
              <span className="pnl-user-name" style={{ display: 'block' }}>{user?.name || 'Minha conta'}</span>
              <span className="pnl-user-mail" style={{ display: 'block' }}>{user?.email || 'Sair'}</span>
            </span>
          </button>
        </aside>

        <div className="pnl-main">
          <header className="pnl-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" className="pnl-burger" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
                <Icon path={<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>} />
              </button>
              <div>
                <h1>{header.title}</h1>
                {header.subtitle && <div className="pnl-sub">{header.subtitle}</div>}
              </div>
            </div>
            <div className="pnl-header-right">
              <OnlinePill online={online} groupCount={groupCount} />
            </div>
          </header>

          <div className="pnl-content">{children}</div>
        </div>
      </div>
    </PainelContext.Provider>
  )
}
