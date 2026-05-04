export function Alert({ type = 'info', title, message }) {
  const variants = {
    error: {
      icon: '⚠️',
      box: 'bg-red-50 border-red-200 text-red-800',
      title: 'text-red-800',
    },
    success: {
      icon: '✅',
      box: 'bg-green-50 border-green-200 text-green-800',
      title: 'text-green-800',
    },
    info: {
      icon: 'ℹ️',
      box: 'bg-blue-50 border-blue-200 text-blue-800',
      title: 'text-blue-800',
    },
    warning: {
      icon: '🟡',
      box: 'bg-amber-50 border-amber-200 text-amber-800',
      title: 'text-amber-800',
    },
  }

  const variant = variants[type] ?? variants.info

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${variant.box}`} role="alert" aria-live="polite">
      <p className={`font-semibold ${variant.title}`}>{variant.icon} {title}</p>
      {message && <p className="mt-0.5">{message}</p>}
    </div>
  )
}
