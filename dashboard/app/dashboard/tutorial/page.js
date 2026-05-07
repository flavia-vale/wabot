'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

function TutorialImages({ images = [] }) {
  if (!images.length) return null
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {images.map((img) => (
        <div key={img.id || img.label} className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{img.label}</p>
          {img.note ? <p className="mb-2 text-xs text-gray-600">{img.note}</p> : null}
          {img.url ? <img src={img.url} alt={img.label || 'Print tutorial'} className="w-full rounded-lg border border-gray-100" /> : <p className="text-xs text-gray-500">Sem imagem configurada.</p>}
        </div>
      ))}
    </div>
  )
}

export default function TutorialPage() {
  const [tutorial, setTutorial] = useState(null)

  useEffect(() => {
    api.publicTutorialContent().then((data) => setTutorial(data?.tutorial ?? null)).catch(() => setTutorial(null))
  }, [])

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-black text-gray-900">{tutorial?.title || 'Tutorial de Credenciais'}</h1>
      <p className="whitespace-pre-wrap text-sm text-gray-700">{tutorial?.body || 'Tutorial ainda não configurado no Admin.'}</p>
      <details className="rounded-xl border border-gray-200 bg-gray-50 p-3" open>
        <summary className="cursor-pointer text-sm font-bold text-gray-800">Prints do tutorial</summary>
        <div className="mt-3"><TutorialImages images={tutorial?.images || []} /></div>
      </details>
    </section>
  )
}
