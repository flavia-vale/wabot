import Link from 'next/link'

export function HelpLink({ children = 'Precisa de ajuda?', topic = '' }) {
  const href = topic ? `/suporte#${topic}` : '/suporte'
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100">
      🆘 {children}
    </Link>
  )
}
