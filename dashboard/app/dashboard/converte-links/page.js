'use client'

import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const MAX_LINKS = 10
const MAX_TEXT_LENGTH = 12_000
const SUPPORTED_LINK_RE = /https?:\/\/(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com|meli\.la|mluvem\.com|amazon\.com\.br|amzn\.to|a\.co|amzn\.divulgador\.link|shope\.ee|shopee\.com\.br|s\.shopee\.com\.br|magazineluiza\.com\.br|magazinevoce\.com\.br|mlz\.me)\S*/gi

function countSupportedLinks(text) {
  const matches = text.match(SUPPORTED_LINK_RE)
  return matches?.length ?? 0
}

function getLimitMessage(count) {
  return `Cole no máximo ${MAX_LINKS} links por vez. Encontramos ${count} links no texto; divida em partes menores para converter com segurança.`
}

function ResultCard({ result, onCopy }) {
  const converted = result.status === 'converted'
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${converted ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Link {result.index + 1}</p>
          <h2 className="text-base font-bold text-gray-900">{result.label || result.platform}</h2>
        </div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${converted ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {converted ? 'Convertido' : 'Precisa de atenção'}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="font-semibold text-gray-600">Original</p>
          <p className="mt-1 break-all rounded-lg bg-white/80 px-3 py-2 text-gray-800">{result.originalUrl}</p>
        </div>

        {converted ? (
          <div>
            <p className="font-semibold text-gray-600">Link de afiliado</p>
            <div className="mt-1 flex flex-col gap-2 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="break-all font-medium text-green-800">{result.convertedUrl}</p>
              <button
                type="button"
                onClick={() => onCopy(result.convertedUrl)}
                className="min-h-10 shrink-0 rounded-lg border border-green-200 px-3 py-2 text-xs font-bold text-green-700 transition hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                Copiar
              </button>
            </div>
          </div>
        ) : (
          <Alert type="warning" title="Não foi possível converter este link" message={result.error || 'Confira o link e as credenciais da loja.'} />
        )}
      </div>
    </article>
  )
}

export default function ConverteLinksPage() {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [response, setResponse] = useState(null)

  const detectedCount = useMemo(() => countSupportedLinks(text), [text])
  const successfulLinks = useMemo(
    () => response?.results?.filter(result => result.status === 'converted' && result.convertedUrl) ?? [],
    [response],
  )

  async function copyText(value, feedback = 'Link copiado.') {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyFeedback(feedback)
      window.setTimeout(() => setCopyFeedback(''), 2500)
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setCopyFeedback('')
    setResponse(null)

    if (!text.trim()) {
      setError('Cole pelo menos um link de produto para converter.')
      return
    }

    if (detectedCount > MAX_LINKS) {
      setError(getLimitMessage(detectedCount))
      return
    }

    if (text.length > MAX_TEXT_LENGTH) {
      setError(`Texto muito grande para conversão manual. Cole até ${MAX_TEXT_LENGTH.toLocaleString('pt-BR')} caracteres por vez para evitar sobrecarga.`)
      return
    }

    setSubmitting(true)
    try {
      const data = await api.convertLinks(text)
      setResponse(data)
    } catch (err) {
      setError(err.message || 'Falha ao converter links. Tente novamente em instantes.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyAllConverted() {
    const value = successfulLinks.map(result => result.convertedUrl).join('\n')
    await copyText(value, `${successfulLinks.length} link(s) convertido(s) copiado(s).`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">Ferramenta manual</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Converte links</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Cole links de produto da Amazon, Mercado Livre, Shopee ou Magazine Luiza e receba os links com suas credenciais de afiliado. Você pode converter 1 link ou vários de uma vez, com limite de {MAX_LINKS} links por envio e {MAX_TEXT_LENGTH.toLocaleString('pt-BR')} caracteres por texto.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
        <label htmlFor="links" className="text-sm font-bold text-gray-900">Links para converter</label>
        <textarea
          id="links"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={9}
          placeholder="Cole aqui até 10 links, um por linha ou todos no mesmo texto."
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
        />
        <div className="mt-3 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className={detectedCount > MAX_LINKS ? 'font-semibold text-red-700' : 'text-gray-500'}>
            {detectedCount ? `${detectedCount} link(s) compatível(is) detectado(s).` : 'Nenhum link compatível detectado ainda.'}
          </p>
          <p className={text.length > MAX_TEXT_LENGTH ? 'text-xs font-bold text-red-700' : 'text-xs font-medium text-gray-500'}>{text.length.toLocaleString('pt-BR')} / {MAX_TEXT_LENGTH.toLocaleString('pt-BR')} caracteres · Máximo: {MAX_LINKS} links.</p>
        </div>

        {error && <div className="mt-4"><Alert type="error" title="Não foi possível converter" message={error} /></div>}
        {copyFeedback && <div className="mt-4"><Alert type="success" title="Copiado" message={copyFeedback} /></div>}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            {submitting ? 'Convertendo...' : 'Converter links'}
          </button>
          <button
            type="button"
            onClick={() => { setText(''); setResponse(null); setError(''); setCopyFeedback('') }}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
          >
            Limpar
          </button>
        </div>
      </form>

      {response && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Resultado da conversão</h2>
              <p className="mt-1 text-sm text-gray-600">
                {response.convertedCount} convertido(s), {response.failedCount} com atenção, de {response.count} link(s) enviado(s).
              </p>
            </div>
            <button
              type="button"
              onClick={copyAllConverted}
              disabled={!successfulLinks.length}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            >
              Copiar todos convertidos
            </button>
          </div>

          <div className="grid gap-4">
            {response.results.map(result => (
              <ResultCard key={`${result.index}-${result.originalUrl}`} result={result} onCopy={copyText} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
