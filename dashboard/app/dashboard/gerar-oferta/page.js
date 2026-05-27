'use client'

import { OfferBuilder } from '@/components/OfferBuilder'

export default function GerarOfertaPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24 sm:space-y-6 sm:pb-0">
      <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 sm:text-sm">Ferramenta manual</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-gray-900 sm:mt-2 sm:text-3xl">Gerar oferta</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">Cole seu link e clique em gerar oferta. Vamos tentar converter automaticamente; se não der, seguimos com o link original e avisamos você. O template fica disponível em “Editar template”.</p>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <OfferBuilder mode="standalone" />
      </section>
    </div>
  )
}
