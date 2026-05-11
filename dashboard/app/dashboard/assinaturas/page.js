'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'

const SUPPORT_PHONE = '(32) 99984-4020'
const SUPPORT_WA_NUMBER = '5532999844020'
const PIX_KEY = 'd80c705f-3893-4802-939b-cce5c9338c66'

const PLAN_CARDS = [
  { id: 'basic', name: 'Plano Basic', price: 'R$39', description: 'Acesso por 30 dias com anúncios durante o uso.' },
  { id: 'pro', name: 'Plano Pro', price: 'R$69', description: 'Acesso por 30 dias sem anúncios durante o uso.' },
]

export default function AssinaturasPage() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    let active = true
    api.me()
      .then((user) => {
        if (!active) return
        setEmail(user?.email || '')
      })
      .catch(() => {
        if (!active) return
        setEmail('')
      })

    return () => {
      active = false
    }
  }, [])

  async function handleCopyPix() {
    setCopyError('')
    try {
      await navigator.clipboard.writeText(PIX_KEY)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (_) {
      setCopyError('Não foi possível copiar automaticamente. Pressione e segure para copiar manualmente.')
    }
  }

  const whatsappLink = useMemo(() => {
    const payload = `Olá, acabei de fazer o PIX do meu plano. Segue o comprovante para ativação da conta ${email || '[E-MAIL DO USUÁRIO]'}.`
    return `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(payload)}`
  }, [email])

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="mb-5 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 md:text-2xl">Pagamento via PIX</h1>
        <p className="mt-2 text-sm text-gray-600">Enquanto finalizamos a integração automática, escolha seu plano e pague via PIX Copia e Cola para ativação assistida.</p>
      </header>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLAN_CARDS.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800">{plan.name}</h2>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{plan.price}<span className="ml-1 text-xs font-medium text-gray-500">/ 30 dias</span></p>
            <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-800">PIX Copia e Cola</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={PIX_KEY}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            aria-label="Chave PIX para copiar"
          />
          <button
            type="button"
            onClick={handleCopyPix}
            className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            aria-live="polite"
          >
            {copied ? 'Copiado!' : 'Copiar chave PIX'}
          </button>
        </div>
        {copyError && <p className="mt-2 text-xs text-red-600">{copyError}</p>}

        <p className="mt-4 text-sm text-gray-700">Assim que pagar o PIX, envie o comprovante e em minutos sua conta estará ativa.</p>
        <p className="mt-1 text-sm font-medium text-gray-800">Suporte: {SUPPORT_PHONE}</p>

        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          Enviar comprovante no WhatsApp
        </a>
      </div>
    </section>
  )
}
