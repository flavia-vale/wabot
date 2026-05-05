'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    api.me()
      .then(() => { if (active) setCheckingAuth(false) })
      .catch(() => { if (active) router.replace('/login') })
    return () => { active = false }
  }, [router])

  async function logout() {
    await api.logout().catch(() => {})
    router.push('/login')
  }

  const navGroups = [
    {
      title: 'Operação',
      items: [
        { href: '/dashboard/inicio', label: '🏠 Início' },
        { href: '/dashboard', label: '📱 Conexão WhatsApp' },
        { href: '/dashboard/envio', label: '📤 Envio' },
        { href: '/dashboard/logs', label: '📋 Logs' },
      ],
    },
    {
      title: 'Configuração',
      items: [
        { href: '/dashboard/grupos', label: '👥 Grupos' },
        { href: '/dashboard/credenciais', label: '🔑 Credenciais' },
        { href: '/dashboard/configuracoes', label: '⚙️ Configurações' },
      ],
    },
    {
      title: 'Conta',
      items: [
        { href: '/dashboard/planos', label: '💳 Planos' },
        { href: '/suporte', label: '🆘 Suporte' },
      ],
    },
  ]

  const isActive = (href) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  function handleNavigate() {
    setMenuOpen(false)
  }

  function renderNavItems() {
    return navGroups.map(group => (
      <div key={group.title}>
        <p className="text-xs font-semibold uppercase tracking-wide text-green-100 mb-2">{group.title}</p>
        <div className="flex flex-col gap-1">
          {group.items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigate}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive(item.href)
                  ? 'bg-white text-green-700'
                  : 'hover:bg-green-600'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    ))
  }

  if (checkingAuth) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-600">Validando sessão...</div>

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <header className="md:hidden sticky top-0 z-30 bg-green-700 text-white border-b border-green-600">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-base font-bold">🤖 Bot Conversor</h1>
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-dashboard-menu"
            className="rounded-lg border border-green-500 px-3 py-1.5 text-sm font-semibold hover:bg-green-600"
          >
            {menuOpen ? 'Fechar' : 'Menu'}
          </button>
        </div>
        {menuOpen && (
          <nav id="mobile-dashboard-menu" className="p-4 flex flex-col gap-4 border-t border-green-600">
            {renderNavItems()}
            <button
              onClick={logout}
              className="w-full rounded-lg bg-green-800 px-3 py-2 text-left text-sm text-green-100 hover:text-white"
            >
              Sair →
            </button>
          </nav>
        )}
      </header>

      <aside className="hidden md:flex md:w-56 md:min-h-screen bg-green-700 text-white flex-col">
        <div className="p-5 border-b border-green-600">
          <h1 className="text-xl font-bold">🤖 Bot Conversor para Afiliados</h1>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-4">
          {renderNavItems()}
        </nav>
        <div className="p-4 border-t border-green-600">
          <button
            onClick={logout}
            className="w-full text-sm text-green-200 hover:text-white text-left"
          >
            Sair →
          </button>
        </div>
      </aside>
      <main className="p-4 md:flex-1 md:p-8">{children}</main>
    </div>
  )
}
