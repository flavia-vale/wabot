import Link from 'next/link'

const footerLinks = [
  { href: '/termos', label: 'Termos de Uso' },
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/quem-somos', label: 'Quem Somos' },
  { href: '/suporte', label: 'Suporte' },
]

export function PublicHeader() {
  return (
    <header className="border-b border-green-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <Link href="/" className="text-xl font-black text-green-700">
          🤖 BOTinho
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-gray-600">
          <Link href="/#planos" className="hover:text-green-700">Planos</Link>
          <Link href="/quem-somos" className="hover:text-green-700">Quem somos</Link>
          <Link href="/suporte" className="hover:text-green-700">Suporte</Link>
          <Link href="/login" className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">Entrar</Link>
        </nav>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-green-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-gray-500 md:flex-row md:items-center md:justify-between md:px-8">
        <p>© {new Date().getFullYear()} BOTinho. Software para afiliados no WhatsApp.</p>
        <nav className="flex flex-wrap gap-4">
          {footerLinks.map(link => (
            <Link key={link.href} href={link.href} className="font-medium text-gray-600 hover:text-green-700">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export function PublicShell({ children }) {
  return (
    <div className="min-h-screen bg-[#EEF6F2] text-gray-900">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  )
}

export function PublicPage({ eyebrow, title, description, children }) {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-4xl px-5 py-12 md:px-8 md:py-16">
        {eyebrow && <p className="text-sm font-bold uppercase tracking-wide text-green-700">{eyebrow}</p>}
        <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
        {description && <p className="mt-4 text-lg leading-8 text-gray-600">{description}</p>}
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-green-100 md:p-8">
          {children}
        </div>
      </main>
    </PublicShell>
  )
}

export const publicLinks = footerLinks
