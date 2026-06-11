'use client'

export function FeatureToggle({ checked, onChange, disabled, label = 'Ativar funcionalidade' }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <span className="text-xs font-semibold text-gray-700">{checked ? 'Funcionalidade ativa' : 'Funcionalidade desligada'}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-gray-200'}`}
      >
        <span aria-hidden="true" className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}
