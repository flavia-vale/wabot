'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitLead } from '@/lib/free-tools/lead-capture-client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* Captura de e-mail embaixo do resultado das ferramentas gratuitas e, em
 * seguida, encaminha para o cadastro com o e-mail já preenchido.
 *
 * Três regras de produto que NÃO devem regredir:
 *
 * 1. O resultado NUNCA fica atrás do e-mail. A pessoa vê o número dela primeiro
 *    e só então decide continuar. Travar o resultado aumenta o número de
 *    e-mails falsos e derruba o uso da ferramenta, que é o ativo de SEO.
 * 2. A copy NÃO promete e-mail. O SMTP é opcional no projeto (sem as envs
 *    `SMTP_*` o envio vira no-op silencioso), então prometer "enviamos o
 *    relatório para você" seria uma promessa quebrada em silêncio.
 * 3. O botão diz para onde leva. Como o clique encaminha para o cadastro, o
 *    rótulo fala em criar conta — rotular de "entrar na lista" e jogar a pessoa
 *    numa tela de cadastro é isca, e isca queima confiança de quem chegou pela
 *    busca.
 */
export function ToolLeadCapture({ source, context = {}, question, utmCampaign = 'ferramentas-gratuitas' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | error
  const [error, setError] = useState('')

  function buildRegisterHref(cleanEmail) {
    const params = new URLSearchParams({
      mode: 'register',
      email: cleanEmail,
      source,
      utm_source: 'ferramentas',
      utm_medium: 'organic',
      utm_campaign: utmCampaign,
      utm_content: source,
    })
    return `/login?${params.toString()}`
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const value = email.trim()

    if (!value) {
      setError('Escreva seu e-mail para continuar.')
      return
    }
    if (!EMAIL_RE.test(value)) {
      setError('Confira o formato do e-mail antes de continuar.')
      return
    }

    setError('')
    setStatus('sending')

    /* O encaminhamento acontece MESMO se a captura falhar. Terminar o cadastro
     * vale mais que guardar o lead; barrar a pessoa por causa de um erro nosso
     * de banco trocaria a conversão mais valiosa por uma linha de tabela. A
     * falha não some: a rota grava `tool_lead_rejected` / responde 500. */
    try {
      await submitLead({ email: value, source, context })
    } catch {}

    router.push(buildRegisterHref(value))
  }

  return (
    <aside className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <h2 className="text-2xl font-black tracking-tight text-gray-950">
        {question ?? 'Quer aplicar isso na sua operação?'}
      </h2>
      <p className="mt-3 text-sm leading-6 text-gray-700">
        Deixe seu e-mail e a gente leva você para terminar o cadastro — leva menos de um minuto e
        você não precisa digitar o e-mail de novo. O resultado acima já é seu de qualquer jeito.
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
          {status === 'sending' ? 'Um instante…' : 'Continuar para criar conta'}
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
