export function Alert({ type = 'info', title, message, role, ariaLive }) {
  const variants = {
    error: {
      icon: '⚠️',
      box: 'bg-red-50 border-red-200 text-red-800',
      title: 'text-red-800',
      defaultRole: 'alert',
      defaultAriaLive: 'assertive',
    },
    success: {
      icon: '✅',
      box: 'bg-green-50 border-green-200 text-green-800',
      title: 'text-green-800',
      defaultRole: 'status',
      defaultAriaLive: 'polite',
    },
    info: {
      icon: 'ℹ️',
      box: 'bg-blue-50 border-blue-200 text-blue-800',
      title: 'text-blue-800',
      defaultRole: 'status',
      defaultAriaLive: 'polite',
    },
    warning: {
      icon: '🟡',
      box: 'bg-amber-50 border-amber-200 text-amber-800',
      title: 'text-amber-800',
      defaultRole: 'status',
      defaultAriaLive: 'polite',
    },
  }

  const variant = variants[type] ?? variants.info
  const semanticRole = role ?? variant.defaultRole
  const liveMode = ariaLive ?? variant.defaultAriaLive

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${variant.box}`} role={semanticRole} aria-live={liveMode}>
      {title && <p className={`font-semibold ${variant.title}`}><span aria-hidden="true">{variant.icon}</span> {title}</p>}
      {message && <p className={title ? 'mt-0.5' : ''}>{message}</p>}
    </div>
  )
}
