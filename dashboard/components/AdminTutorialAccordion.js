'use client'
import { useState } from 'react'

export default function AdminTutorialAccordion({ tutorial, onSaveTutorial, TutorialEditor }) {
  const [open, setOpen] = useState(false)
  return (
    <section id="admin-tutorial-content" className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={open}
        aria-controls="admin-tutorial-content-panel"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Conteúdo do Dashboard · último bloco</p>
          <h2 className="text-lg font-black text-gray-900">Tutorial (Dashboard)</h2>
          <p className="text-sm text-gray-500">Edite aqui o texto e os prints exibidos em /dashboard/tutorial.</p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{open ? 'Recolher' : 'Expandir'}</span>
      </button>
      {open && (
        <div id="admin-tutorial-content-panel" className="border-t border-gray-100 p-5">
          <TutorialEditor key={`tutorial-${tutorial?.updatedAt ?? 'empty'}`} tutorial={tutorial} onSave={onSaveTutorial} />
        </div>
      )}
    </section>
  )
}
