'use client'

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { NAV_GROUPS } from './nav'
import SidebarOnboarding from '@/components/SidebarOnboarding'

/* Contexto compartilhado: dados de sessão/usuário reusados pelas páginas. O
 * status de sessão (`online`/`phone`) é re-buscado periodicamente e ao focar a
 * aba para não ficar obsoleto (ver refreshSession). Páginas também publicam o
 * título do header aqui via usePainelHeader() e podem forçar uma atualização
 * imediata do status via refreshSession(). Nada disso toca o back end além das
 * rotas já existentes em @/lib/api. */
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

/* Ações contextuais da página ficam no topo do próprio conteúdo. O nome do
 * componente é mantido para preservar a API das telas que já o utilizam. */
export function PainelContentActions({ children }) {
  return <div className="pnl-content-actions">{children}</div>
}

const STAR_ICON = <path d="M12 2.5l2.9 6 6.6.6-5 4.4 1.5 6.5L12 16.9 5.5 20.5 7 14 2 9.6l6.6-.6z" />
const LOCK_ICON = <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>
const CHEVRON_ICON = <path d="M9 18l6-6-6-6" />
const BELL_ICON = <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>
const HELP_ICON = <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><path d="M12 17h.01" /></>
const SETTINGS_ICON = <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>
const LOGOUT_ICON = <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>

function planInfo(user) {
  const plan = user?.plan
  const exp = user?.accessExpiresAt ? new Date(user.accessExpiresAt) : null
  const validExp = exp && !Number.isNaN(exp.getTime())
  const expired = validExp && exp < new Date()
  const label = expired
    ? 'Plano vencido'
    : plan === 'pro' ? 'Plano Pro'
      : plan === 'basic' ? 'Plano Basic'
        : plan === 'trial' ? 'Trial'
          : 'Plano e cobrança'
  const dateLabel = validExp ? exp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null
  const sub = expired
    ? 'reative para automatizar'
    : dateLabel ? `renova em ${dateLabel}` : 'gerencie sua assinatura'
  return { expired, label, sub }
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
  const [sessionHealth, setSessionHealth] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [header, setHeader] = useState({ title: 'Painel', subtitle: '' })

  // Autenticação — mesmo contrato do dashboard atual (api.me → /login no erro).
  useEffect(() => {
    let active = true
    api.me()
      .then((u) => { if (active) { setUser(u); setChecking(false) } })
      .catch(() => { if (active) router.replace('/login') })
    return () => { active = false }
  }, [router])

  // Status de sessão + contagem de grupos (compartilhado com a tag do header
  // e a página de espelhamento, que leem `online` deste contexto). Precisa ser
  // re-buscado periodicamente: a página /painel/whatsapp acompanha o status ao
  // vivo (WS+polling), mas o shell não — se ele buscasse só uma vez no mount,
  // ficaria preso em "desconectado" mesmo depois da sessão conectar, gerando a
  // inconsistência entre /painel/whatsapp (conectado) e o resto do painel.
  const refreshSession = useCallback(async () => {
    const [s, g] = await Promise.allSettled([api.sessionStatusFast(), api.groups()])
    if (s.status === 'fulfilled') {
      setOnline(s.value?.status === 'connected')
      setPhone(s.value?.phone ?? null)
    } else {
      setOnline(false)
    }
    if (g.status === 'fulfilled' && Array.isArray(g.value)) setGroupCount(g.value.length)
  }, [])

  const refreshSessionRef = useRef(refreshSession)
  useEffect(() => { refreshSessionRef.current = refreshSession }, [refreshSession])

  useEffect(() => {
    if (checking) return undefined
    let cancelled = false
    const tick = () => { if (!cancelled) refreshSessionRef.current?.() }
    tick()
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      tick()
    }, 20000)
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checking])

  // Saúde da conexão: só sondamos a versão completa do status (com métricas do
  // worker) quando o bot está online. Se a sessão estiver conectada mas sem
  // conseguir ler mensagens (decrypt dessincronizado), o worker devolve
  // sessionHealth.degraded e mostramos o banner global de reconexão.
  useEffect(() => {
    if (!online) return undefined
    let active = true
    let timer = null
    const poll = async () => {
      const s = await api.sessionStatus().catch(() => null)
      if (!active) return
      if (s) setSessionHealth(s.sessionHealth ?? s.metrics?.sessionHealth ?? null)
      timer = setTimeout(poll, 45000)
    }
    poll()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [online])

  async function logout() {
    await api.logout().catch(() => {})
    router.push('/login')
  }

  const ctxValue = useMemo(
    () => ({ user, online, phone, groupCount, sessionHealth, refreshSession, setHeader }),
    [user, online, phone, groupCount, sessionHealth, refreshSession],
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
          <nav className="pnl-nav" aria-label="Navegação do painel">
            <SidebarOnboarding userId={user?.id} onNavigate={() => setMenuOpen(false)} />
            {NAV_GROUPS.map((group) => {
              const hasActiveChild = group.items.some((item) => isActive(item.href))
              const renderItem = (item) => (
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
                  {item.free && <span className="pnl-free">GRÁTIS</span>}
                </Link>
              )

              if (group.collapsible) {
                const open = openGroups[group.title] ?? (group.defaultOpen || hasActiveChild)
                return (
                  <div key={group.title} className="pnl-nav-group">
                    <button
                      type="button"
                      className={`pnl-nav-toggle${open ? ' is-open' : ''}`}
                      aria-expanded={open}
                      onClick={() => setOpenGroups((s) => ({ ...s, [group.title]: !open }))}
                    >
                      <span>{group.title}</span>
                      <svg className="pnl-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                    {open && group.items.map(renderItem)}
                  </div>
                )
              }

              return (
                <div key={group.title} className="pnl-nav-group">
                  <p className="pnl-nav-title">{group.title}</p>
                  {group.items.map(renderItem)}
                </div>
              )
            })}
          </nav>

          {(() => {
            const pi = planInfo(user)
            return (
              <Link href="/painel/plano" className={`pnl-plan${pi.expired ? ' is-expired' : ''}`} onClick={() => setMenuOpen(false)}>
                <span className="pnl-plan-ico"><Icon path={pi.expired ? LOCK_ICON : STAR_ICON} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="pnl-plan-title" style={{ display: 'block' }}>{pi.label}</span>
                  <span className="pnl-plan-sub" style={{ display: 'block' }}>{pi.sub}</span>
                </span>
                {pi.expired ? <span className="pnl-plan-cta">Reativar</span> : <Icon path={CHEVRON_ICON} />}
              </Link>
            )
          })()}

          <div className="pnl-usermenu-wrap">
            {userMenuOpen && (
              <>
                <button type="button" aria-label="Fechar menu da conta" className="pnl-usermenu-scrim" onClick={() => setUserMenuOpen(false)} />
                <div className="pnl-usermenu" role="menu">
                  <Link href="/painel/configuracoes" role="menuitem" className="pnl-usermenu-item" onClick={() => { setUserMenuOpen(false); setMenuOpen(false) }}>
                    <Icon path={SETTINGS_ICON} />
                    <span>Configurações da conta</span>
                  </Link>
                  <button type="button" role="menuitem" className="pnl-usermenu-item is-danger" onClick={logout}>
                    <Icon path={LOGOUT_ICON} />
                    <span>Sair</span>
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              className={`pnl-user${userMenuOpen ? ' is-open' : ''}`}
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              title="Minha conta"
              style={{ background: 'none', border: 'none', borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <span className="pnl-avatar" aria-hidden="true">{initialsOf(user?.name, user?.email)}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="pnl-user-name" style={{ display: 'block' }}>{user?.name || 'Minha conta'}</span>
                <span className="pnl-user-mail" style={{ display: 'block' }}>{user?.email || 'Ver opções'}</span>
              </span>
              <svg className="pnl-user-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
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
              <Link href="/painel/tutorial" className="pnl-bell" aria-label="Tutorial e ajuda" title="Tutorial e ajuda">
                <Icon path={HELP_ICON} />
              </Link>
              <button type="button" className="pnl-bell has-dot" aria-label="Notificações" title="Notificações">
                <Icon path={BELL_ICON} />
              </button>
            </div>
          </header>

          <div className="pnl-content">
            {online && sessionHealth?.degraded && !pathname.startsWith('/painel/whatsapp') && (
              <div
                className="pnl-note-box is-error"
                role="alert"
                style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ fontWeight: 600, display: 'block' }}>⚠️ Sua conexão do WhatsApp está instável</strong>
                  <span>
                    O WhatsApp aparece conectado, mas não está conseguindo ler as mensagens dos seus grupos —
                    suas ofertas podem não estar sendo espelhadas. Reconecte para normalizar.
                  </span>
                </div>
                <button
                  type="button"
                  className="pnl-btn is-primary"
                  style={{ flexShrink: 0 }}
                  onClick={() => router.push('/painel/whatsapp?reconnect=1')}
                >
                  Reconectar agora
                </button>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </PainelContext.Provider>
  )
}
