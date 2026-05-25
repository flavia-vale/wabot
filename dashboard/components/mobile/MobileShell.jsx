'use client'

import Link from 'next/link'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { mobileRoutes } from '@/components/mobile/routes'

function MobileIcon({ name, size = 16, stroke = 1.8 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  switch (name) {
    case 'menu':
      return <svg {...props}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="14" y2="18" /></svg>
    case 'home':
      return <svg {...props}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'link':
      return <svg {...props}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 1 0 11 21l1.5-1.5" /></svg>
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>
    case 'send':
      return <svg {...props}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
    case 'logs':
      return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></svg>
    default:
      return null
  }
}

const tabs = [
  { key: 'inicio', href: mobileRoutes.home, label: 'Início', icon: 'home' },
  { key: 'converter', href: mobileRoutes.converter, label: 'Converter', icon: 'link' },
  { key: 'criar', href: mobileRoutes.offer, label: 'Criar', icon: 'plus' },
  { key: 'envios', href: mobileRoutes.sends, label: 'Envios', icon: 'send' },
  { key: 'logs', href: mobileRoutes.logs, label: 'Logs', icon: 'logs' },
]

const drawerLinks = [
  { href: mobileRoutes.home, label: 'Início' },
  { href: mobileRoutes.converter, label: 'Conversor' },
  { href: mobileRoutes.offer, label: 'Gerar oferta' },
  { href: mobileRoutes.sends, label: 'Envios' },
  { href: mobileRoutes.logs, label: 'Logs' },
  { href: mobileRoutes.configGroups, label: 'Grupos e canais' },
  { href: mobileRoutes.configWhatsApp, label: 'Conexão WhatsApp' },
]

function useFocusTrap({ open, onClose, containerRef, firstFocusRef }) {
  useEffect(() => {
    if (!open || !containerRef.current) return undefined
    const container = containerRef.current
    const prevActive = document.activeElement
    const focusables = () => Array.from(container.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))

    const focusFirst = () => {
      if (firstFocusRef.current) {
        firstFocusRef.current.focus()
        return
      }
      focusables()[0]?.focus()
    }

    focusFirst()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const nodes = focusables()
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (prevActive && typeof prevActive.focus === 'function') prevActive.focus()
    }
  }, [open, onClose, containerRef, firstFocusRef])
}

export function MobileShell({ title = 'Conversor', active = 'inicio', children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerId = useId()
  const drawerRef = useRef(null)
  const closeBtnRef = useRef(null)

  useFocusTrap({
    open: drawerOpen,
    onClose: () => setDrawerOpen(false),
    containerRef: drawerRef,
    firstFocusRef: closeBtnRef,
  })

  const headerClass = useMemo(
    () => 'sticky top-0 z-20 flex items-center justify-between border-b border-[#d7e7de] bg-[#FCFEFD] px-4 py-3',
    [],
  )

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md bg-[#EEF6F2] text-[#1F2D2A]">
      <header className={headerClass}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-[#d7e7de] px-2 py-1 text-xs font-semibold"
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            onClick={() => setDrawerOpen(true)}
          >
            <MobileIcon name="menu" size={14} />
            <span>Menu</span>
          </button>
          <h1 className="text-sm font-semibold">{title}</h1>
        </div>
        <Link className="text-xs font-semibold text-[#3E9C7A]" href="/m?view=mobile" aria-label="Manter visual mobile">Mobile</Link>
      </header>

      {drawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            id={drawerId}
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navegação mobile"
            className="fixed left-0 top-0 z-40 h-full w-[82%] max-w-sm border-r border-[#d7e7de] bg-white p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Navegação</p>
              <button
                ref={closeBtnRef}
                type="button"
                className="rounded-md border border-[#d7e7de] px-2 py-1 text-xs"
                onClick={() => setDrawerOpen(false)}
              >
                Fechar
              </button>
            </div>
            <nav className="flex flex-col gap-2" aria-label="Links do menu mobile">
              {drawerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg border border-[#e4efe9] px-3 py-2 text-sm"
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="inline-flex items-center gap-2">
                    <MobileIcon
                      name={
                        link.href === mobileRoutes.home ? 'home'
                          : link.href === mobileRoutes.converter ? 'link'
                            : link.href === mobileRoutes.offer ? 'plus'
                              : link.href === mobileRoutes.sends ? 'send'
                                : 'logs'
                      }
                      size={14}
                    />
                    {link.label}
                  </span>
                </Link>
              ))}
            </nav>
          </aside>
        </>
      ) : null}

      <main className="px-4 py-4 pb-24" role="main">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#d7e7de] bg-[#FCFEFD]" aria-label="Navegação principal mobile">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((tab) => {
            const isActive = active === tab.key
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-1 py-2 text-center text-[11px] font-semibold ${isActive ? 'text-[#3E9C7A]' : 'text-[#5A6E68]'}`}
                >
                  <MobileIcon name={tab.icon} size={16} />
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

export function MobileStateCard({ title, description, actionLabel, onAction, tone = 'neutral' }) {
  const toneClass = tone === 'error' ? 'border-[#f3c8be] bg-[#fff6f3]' : tone === 'success' ? 'border-[#bde3d2] bg-[#f3fbf7]' : 'border-[#d7e7de] bg-white'
  return (
    <section className={`rounded-2xl border p-4 ${toneClass}`} aria-live="polite">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-[#5A6E68]">{description}</p>
      {actionLabel ? (
        <button type="button" onClick={onAction} className="mt-3 rounded-full border border-[#d7e7de] px-3 py-2 text-xs font-semibold">
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
