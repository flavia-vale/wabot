'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

const navGroups = [
  {
    title: 'Operação',
    items: [
      { href: '/dashboard/inicio', icon: '🏠', label: 'Início' },
      { href: '/dashboard', icon: '📱', label: 'Conexão WhatsApp' },
      { href: '/dashboard/envio', icon: '✉️', label: 'Envio de mensagens' },
      { href: '/dashboard/logs', icon: '📋', label: 'Logs' },
    ],
  },
  {
    title: 'Configuração',
    items: [
      { href: '/dashboard/grupos', icon: '👥', label: 'Grupos' },
      { href: '/dashboard/credenciais', icon: '🔑', label: 'Credenciais' },
      { href: '/dashboard/configuracoes', icon: '⚙️', label: 'Configurações' },
      { href: '/dashboard/tutorial', icon: '📘', label: 'Tutorial' },
    ],
  },
  {
    title: 'Conta',
    items: [
      { href: '/dashboard/assinaturas', icon: '💳', label: 'Assinaturas' },
      { href: '/suporte', icon: '🆘', label: 'Suporte' },
    ],
  },
]

const focusClasses = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-700'

const PLAN_LABELS = {
  trial: 'Trial',
  basic: 'Basic',
  pro: 'Pro',
}

function getExpiredAccessInfo(user) {
  if (!user?.accessExpiresAt) return null
  const expiresAt = new Date(user.accessExpiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt >= new Date()) return null

  const dateLabel = expiresAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const planLabel = PLAN_LABELS[user.plan] ?? user.plan ?? 'plano'
  const isTrial = user.plan === 'trial'

  return {
    dateLabel,
    planLabel,
    title: isTrial ? 'Seu período de teste venceu' : 'Seu plano venceu',
    message: isTrial
      ? `Seu trial venceu em ${dateLabel}. Por isso o bot parou de enviar mensagens automaticamente.`
      : `Seu plano ${planLabel} venceu em ${dateLabel}. Por isso o bot parou de enviar mensagens automaticamente.`,
  }
}

function PlanExpiredBanner({ expiredInfo, compact = false, onNavigate }) {
  if (!expiredInfo) return null

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`${compact ? 'border-t border-red-300 px-4 py-3' : 'mb-6 rounded-2xl border border-red-200 p-4 shadow-sm'} bg-red-50 text-red-950`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg" aria-hidden="true">⛔</span>
          <div>
            <p className="text-sm font-bold">{expiredInfo.title}: bot pausado por plano vencido</p>
            <p className="mt-1 text-sm text-red-900">{expiredInfo.message}</p>
            {!compact && (
              <p className="mt-1 text-xs font-medium text-red-800">Renove na aba Assinaturas para liberar novamente os envios automáticos.</p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/assinaturas"
          onClick={onNavigate}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-red-50"
        >
          Renovar agora
        </Link>
      </div>
    </section>
  )
}

function LogoutButton({ mobile = false, loggingOut, onLogout }) {
  return (
    <button
      onClick={onLogout}
      disabled={loggingOut}
      className={`${mobile ? 'w-full min-h-11 rounded-lg bg-green-800 px-3 py-2 text-left text-sm text-green-100 hover:text-white' : 'w-full min-h-11 text-sm text-green-200 hover:text-white text-left'} disabled:cursor-wait disabled:opacity-70 ${focusClasses}`}
    >
      {loggingOut ? 'Saindo...' : 'Sair da conta'}
    </button>
  )
}

export default function DashboardClientLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    let active = true
    api.me()
      .then((user) => {
        if (!active) return
        setCurrentUser(user)
        setCheckingAuth(false)
      })
      .catch(() => { if (active) router.replace('/login') })
    return () => { active = false }
  }, [router])

  useEffect(() => {
    if (!menuOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    await api.logout().catch(() => {})
    router.push('/login')
  }

  const expiredInfo = getExpiredAccessInfo(currentUser)

  const isActive = (href) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  function handleNavigate() {
    setMenuOpen(false)
  }

  function renderNavItems() {
    return navGroups.map(group => (
      <div key={group.title}>
        <p className="text-xs font-semibold uppercase tracking-wide text-green-100 mb-2">{group.title}</p>
        <div className="flex flex-col gap-1">
          {group.items.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavigate}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${focusClasses} ${
                  active
                    ? 'bg-white text-green-700'
                    : 'hover:bg-green-600'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {expiredInfo && item.href === '/dashboard/assinaturas' && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-red-100 text-red-700' : 'bg-red-500 text-white'}`}>Vencido</span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    ))
  }


  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-600" role="status" aria-live="polite">
        <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-600" aria-hidden="true" />
        Validando sua sessão...
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50 md:flex">
      <header className="md:hidden sticky top-0 z-30 bg-green-700 text-white border-b border-green-600">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard/inicio" className={`text-base font-bold ${focusClasses}`} onClick={handleNavigate}>
            <span aria-hidden="true">🤖</span> Bot Conversor
          </Link>
          {expiredInfo && <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Plano vencido</span>}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="mobile-dashboard-menu"
            className={`rounded-lg border border-green-500 px-3 py-2.5 min-h-11 text-sm font-semibold hover:bg-green-600 ${focusClasses}`}
          >
            Menu
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <nav id="mobile-dashboard-menu" aria-label="Navegação do dashboard" className="absolute left-0 top-0 flex h-full w-80 max-w-[90vw] flex-col gap-4 overflow-y-auto bg-green-700 p-4 text-white shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-base font-bold"><span aria-hidden="true">🤖</span> Bot Conversor</p>
              <button type="button" onClick={() => setMenuOpen(false)} className={`rounded-lg border border-green-500 px-3 py-2.5 min-h-11 text-sm font-semibold hover:bg-green-600 ${focusClasses}`}>Fechar</button>
            </div>
            <PlanExpiredBanner expiredInfo={expiredInfo} compact onNavigate={handleNavigate} />
            {renderNavItems()}
            <div className="border-t border-green-600 pt-4">
              <LogoutButton mobile loggingOut={loggingOut} onLogout={logout} />
            </div>
          </nav>
        </div>
      )}

      <aside className="hidden md:flex md:w-56 md:min-h-screen bg-green-700 text-white flex-col">
        <div className="p-5 border-b border-green-600">
          <Link href="/dashboard/inicio" className={`block text-xl font-bold ${focusClasses}`}>
            <span aria-hidden="true">🤖</span> Bot Conversor para Afiliados
          </Link>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-4" aria-label="Navegação do dashboard">
          {renderNavItems()}
        </nav>
        <div className="p-4 border-t border-green-600">
          <LogoutButton loggingOut={loggingOut} onLogout={logout} />
        </div>
      </aside>
      <main className="p-4 md:flex-1 md:p-8">
        <PlanExpiredBanner expiredInfo={expiredInfo} onNavigate={handleNavigate} />
        {children}
      </main>
    </div>
  )
}
