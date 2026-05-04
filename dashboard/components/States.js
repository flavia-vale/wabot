export function LoadingState({ message = 'Carregando...' }) {
  return <p className="text-gray-500 text-sm">{message}</p>
}

export function ErrorState({ title = 'Ops! Algo deu errado', message, actionLabel, onAction }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
      <p className="font-semibold mb-1">{title}</p>
      {message && <p className="mb-2">{message}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="underline font-medium">
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'Nenhum item encontrado.' }) {
  return <p className="text-gray-500 text-sm">{message}</p>
}
