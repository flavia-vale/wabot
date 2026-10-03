'use client'
import { useState } from 'react'

export default function AdminTutorialAccordion({ tutorial, onSaveTutorial, TutorialEditor }) {
  const [open, setOpen] = useState(false)
  return (
    <section id="admin-tutorial-content" className="rounded-2xl bg-ds-surface shadow-sm ring-1 ring-ds-line">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-col gap-3 p-5 text-left sm:flex-row sm:items-center sm:justify-between"
        aria-expanded={open}
        aria-controls="admin-tutorial-content-panel"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-accent-strong">Conteúdo do Dashboard · último bloco</p>
          <h2 className="text-lg font-black text-ds-ink">Tutorial (Dashboard)</h2>
          <p className="text-sm text-ds-ink-soft">Edite aqui o texto e os prints exibidos em /painel/tutorial.</p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-ds-accent/20 px-3 py-1 text-xs font-bold text-ds-accent-strong">{open ? 'Recolher' : 'Expandir'}</span>
      </button>
      {open && (
        <div id="admin-tutorial-content-panel" className="border-t border-ds-line p-5">
          <TutorialEditor key={`tutorial-${tutorial?.updatedAt ?? 'empty'}`} tutorial={tutorial} onSave={onSaveTutorial} />
        </div>
      )}
    </section>
  )
}
