'use client'
import { useEffect } from 'react'
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

  const nav = [
    { href: '/dashboard', label: '📱 WhatsApp' },
    { href: '/dashboard/grupos', label: '👥 Grupos' },
    { href: '/dashboard/credenciais', label: '🔑 Credenciais' },
    { href: '/dashboard/planos', label: '💳 Planos' },
  ]

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-green-700 text-white flex flex-col">
        <div className="p-5 border-b border-green-600">
          <h1 className="text-xl font-bold">🤖 WaBot</h1>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-white text-green-700'
                  : 'hover:bg-green-600'
              }`}
            >
              {item.label}
            </Link>
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
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
