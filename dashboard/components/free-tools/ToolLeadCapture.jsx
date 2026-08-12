'use client'

import { useState } from 'react'
import { submitLead } from '@/lib/free-tools/lead-capture-client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* Captura de e-mail embaixo do resultado das ferramentas gratuitas.
 *
 * Duas regras de produto que NÃO devem regredir:
 *
 * 1. O resultado NUNCA fica atrás do e-mail. A pessoa vê o número dela primeiro
 *    e só então decide deixar contato. Travar o resultado aumenta o número de
 *    e-mails falsos e derruba o uso da ferramenta, que é o ativo de SEO.
 * 2. A copy NÃO promete e-mail. O SMTP é opcional no projeto (sem as envs
 *    `SMTP_*` o envio vira no-op silencioso), então prometer "enviamos o
 *    relatório para você" seria uma promessa quebrada em silêncio. Quando o
 *    SMTP for ligado, esta copy muda junto com o envio — não antes.
 */
export function ToolLeadCapture({ source, context = {}, question }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | done | error
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const value = email.trim()

    if (!value) {
      setError('Escreva seu e-mail para entrar na lista.')
      return
    }
    if (!EMAIL_RE.test(value)) {
      setError('Confira o formato do e-mail antes de continuar.')
      return
    }

    setError('')
    setStatus('sending')

    try {
      await submitLead({ email: value, source, context })
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Não conseguimos salvar agora. Tente de novo em instantes.')
    }
  }

  if (status === 'done') {
    return (
      <aside className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <p role="status" className="text-lg font-black tracking-tight text-emerald-900">
          Pronto, você está na lista.
        </p>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          Quando sair material novo sobre isso, avisamos você. Pode pedir para sair quando quiser.
        </p>
      </aside>
    )
  }

  return (
    <aside className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <h2 className="text-2xl font-black tracking-tight text-gray-950">
        {question ?? 'Quer receber o que a gente publicar sobre isso?'}
      </h2>
      <p className="mt-3 text-sm leading-6 text-gray-700">
        Deixe seu e-mail e avisamos quando sair guia, checklist ou novidade sobre divulgação no
        WhatsApp. Sem custo e sem compromisso — o resultado acima já é seu.
      </p>

      <form className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-2">
          <label className="text-sm font-bold text-gray-800" htmlFor={`tool-lead-email-${source}`}>
            Seu e-mail
          </label>
          <input
            id={`tool-lead-email-${source}`}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            placeholder="voce@email.com"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `tool-lead-error-${source}` : undefined}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError('')
            }}
            className="min-h-12 rounded-xl border border-emerald-200 bg-white px-4 text-gray-900 outline-none ring-emerald-300 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="min-h-12 self-end rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending' ? 'Salvando…' : 'Entrar na lista'}
        </button>
      </form>

      {error && (
        <p id={`tool-lead-error-${source}`} role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs leading-5 text-gray-500">
        Guardamos só seu e-mail e o resultado que você acabou de ver. Nada de promessa de ganho — o
        resultado depende das suas ofertas e do seu público.
      </p>
    </aside>
  )
}
