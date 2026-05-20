'use client'

export function PresetButtons({ presets, onApply, disabled, hint }) {
  return (
    <div className="mb-3 rounded-lg bg-gray-50 p-2.5 ring-1 ring-gray-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1.5">
        Sugestões prontas {hint ? <span className="font-normal normal-case text-gray-500">— {hint}</span> : null}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => onApply(p.values)}
            disabled={disabled}
            title={p.description}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${p.tone === 'safe' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100' : p.tone === 'medium' ? 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100' : 'bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100'} disabled:opacity-50`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
