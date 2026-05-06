export function LoadingState({ message = 'Carregando...', role = 'status', ariaLive = 'polite' }) {
  return <p role={role} aria-live={ariaLive} className="text-gray-500 text-sm">{message}</p>
}

export function ErrorState({ title = 'Ops! Algo deu errado', message, actionLabel, onAction }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm" role="alert" aria-live="assertive">
      <p className="font-semibold mb-1">{title}</p>
      {message && <p className="mb-2">{message}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="underline font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, message = 'Nenhum item encontrado.', actionLabel, onAction, actionHref }) {
  const content = (
    <>
      {title && <p className="font-semibold text-gray-700 mb-1">{title}</p>}
      {message && <p className="text-gray-500 text-sm">{message}</p>}
    </>
  )

  if (!actionLabel) {
    return title ? <div>{content}</div> : <p className="text-gray-500 text-sm">{message}</p>
  }

  const actionClass = 'inline-flex items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2'

  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
      {content}
      {actionHref ? (
        <a href={actionHref} className={`${actionClass} mt-3`}>{actionLabel}</a>
      ) : onAction ? (
        <button type="button" onClick={onAction} className={`${actionClass} mt-3`}>{actionLabel}</button>
      ) : null}
    </div>
  )
}
