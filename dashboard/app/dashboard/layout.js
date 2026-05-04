'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) router.replace('/login')
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const [menuOpen, setMenuOpen] = useState(false)

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
      items: [{ href: '/dashboard/planos', label: '💳 Planos' }],
    },
  ]

  const isActive = (href) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  function handleNavigate() {
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-green-700 text-white flex flex-col">
        <div className="p-5 border-b border-green-600">
          <h1 className="text-xl font-bold">🤖 Bot Conversor para Afiliados</h1>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-4">
          {navGroups.map(group => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-100 mb-2">{group.title}</p>
              <div className="flex flex-col gap-1">
                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
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
          ))}
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
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  )
}