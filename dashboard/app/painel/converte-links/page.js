'use client'

/* Conversor de links avulso — versão Menta do painel. A lógica (validação,
 * detecção de links, chamada api.convertLinks, montador inline) é idêntica à
 * do conversor canônico; aqui o título da tela vai para a topbar do
 * PainelShell via usePainelHeader e o restante reusa os mesmos componentes. */

import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { usePainelHeader } from '../PainelShell'

const MAX_LINKS = 1
const MAX_TEXT_LENGTH = 12_000
// SHEIN fica num ramo à parte, com prefixo de subdomínio `(?:[a-z0-9-]+\.)*`
// e um delimitador ancorado logo após o domínio (`/?#:` ou fim) — sem isso
// `br.shein.com`/`m.shein.com` (hosts que o próprio conversor emite, ver
// data-model.md §3) não batiam contra o prefixo fixo `(?:www\.)?` usado pelas
// outras lojas, e o painel mostrava "0 links detectados"/"link não suportado"
// para um link que o espelhamento converte normalmente (T071). As outras
// entradas não mudam.
const SUPPORTED_LINK_RE = /https?:\/\/(?:(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com|meli\.la|mluvem\.com|amazon\.com\.br|amzn\.to|a\.co|amzn\.divulgador\.link|shope\.ee|shopee\.com\.br|s\.shopee\.com\.br|magazineluiza\.com\.br|magazinevoce\.com\.br|mlz\.me)|(?:[a-z0-9-]+\.)*(?:shein\.com|onelink\.shein\.com|shein\.top|aliexpress\.com|aliexpress\.us)(?=[\/?#:]|\s|$))\S*/gi

function countSupportedLinks(text) {
  const matches = text.match(SUPPORTED_LINK_RE)
  return matches?.length ?? 0
}

function getLimitMessage(count) {
  return `Cole apenas 1 link por vez. Encontramos ${count} links no texto; converta um produto por vez para manter o fluxo simples.`
}

function hasAmbiguousSeparators(text) {
  return /;\s*https?:\/\//i.test(text)
}

function classifyConversionError(errorMessage) {
  const message = String(errorMessage || '').toLowerCase()

  if (!message.trim()) {
    return { badge: 'Falha temporária', hint: 'Tente novamente em instantes.' }
  }

  if (message.includes('credencial') || message.includes('credential') || message.includes('token') || message.includes('chave')) {
    return { badge: 'Sem credencial', hint: 'Revise as credenciais da loja em IDs de afiliada.' }
  }

  if (message.includes('não suport') || message.includes('not support') || message.includes('unsupported')) {
    return { badge: 'Link não suportado', hint: 'Use um link de Amazon, Mercado Livre, Shopee, Magazine Luiza, SHEIN ou AliExpress.' }
  }

  if (message.includes('inválid') || message.includes('invalid') || message.includes('malform') || message.includes('url')) {
    return { badge: 'URL inválida', hint: 'Confira se o link foi copiado por completo.' }
  }

  return { badge: 'Falha temporária', hint: 'Não foi possível converter agora. Tente novamente.' }
}


function MetricPill({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-gray-200 bg-gray-50 text-gray-700',
    success: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  }
  return (
    <div className={`rounded-2xl border px-3 py-2 ${tones[tone] ?? tones.neutral}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-base font-black leading-none">{value}</p>
    </div>
  )
}

function ResultCard({ result, onCopy, copied }) {
  const converted = result.status === 'converted'
  const errorMeta = converted ? null : classifyConversionError(result.error)
  return (
    <article className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${converted ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Link {result.index + 1}</p>
          <h2 className="mt-0.5 truncate text-base font-bold text-gray-900">{result.label || result.platform}</h2>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${converted ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {converted ? 'OK' : errorMeta.badge}
        </span>
      </div>

      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="font-semibold text-gray-600">Original</p>
          <p className="mt-1 max-h-24 overflow-y-auto break-all rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-gray-800 sm:text-sm">{result.originalUrl}</p>
        </div>

        {converted ? (
          <div>
            <p className="font-semibold text-gray-600">Link de afiliado</p>
            <div className="mt-1 rounded-xl bg-white px-3 py-2">
              <p className="max-h-28 overflow-y-auto break-all text-xs font-medium leading-5 text-green-800 sm:text-sm">{result.convertedUrl}</p>
              <button
                type="button"
                onClick={() => onCopy(result.convertedUrl)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-green-200 px-3 py-2 text-sm font-bold text-green-700 transition hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 sm:w-auto"
              >
                {copied ? 'Copiado ✅' : 'Copiar link'}
              </button>
            </div>
          </div>
        ) : (
          <Alert type="warning" title="Não foi possível converter" message={`${errorMeta.hint}${result.error ? ` (${result.error})` : ''}`} />
        )}
      </div>
    </article>
  )
}


export default function ConverteLinksPage() {
  usePainelHeader({ title: 'Conversor de links', subtitle: 'Cole 1 link de produto e receba o link de afiliado pronto para copiar' })

  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [response, setResponse] = useState(null)
  const [requestPhase, setRequestPhase] = useState('idle')
  const [copiedItemKey, setCopiedItemKey] = useState('')

  const detectedCount = useMemo(() => countSupportedLinks(text), [text])
  const successfulLinks = useMemo(
    () => response?.results?.filter(result => result.status === 'converted' && result.convertedUrl) ?? [],
    [response],
  )
  const charsOverLimit = text.length > MAX_TEXT_LENGTH
  const linksOverLimit = detectedCount > MAX_LINKS
  const noisyTextWithoutLinks = text.trim().length >= 240 && detectedCount === 0
  const ambiguousSeparators = hasAmbiguousSeparators(text)

  async function copyText(value, feedback = 'Link copiado.', itemKey = '') {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      if (itemKey) {
        setCopiedItemKey(itemKey)
      }
      setCopyFeedback(feedback)
      window.setTimeout(() => {
        setCopyFeedback('')
        if (itemKey) setCopiedItemKey('')
      }, 2500)
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setCopyFeedback('')
    setCopiedItemKey('')
    setResponse(null)
    setRequestPhase('validating')

    if (!text.trim()) {
      setError('Cole pelo menos um link de produto para converter.')
      setRequestPhase('idle')
      return
    }

    if (linksOverLimit) {
      setError(getLimitMessage(detectedCount))
      setRequestPhase('idle')
      return
    }

    if (charsOverLimit) {
      setError(`Texto muito grande para conversão manual. Cole até ${MAX_TEXT_LENGTH.toLocaleString('pt-BR')} caracteres por vez para evitar sobrecarga.`)
      setRequestPhase('idle')
      return
    }

    if (ambiguousSeparators) {
      setError('Separe múltiplos links com quebra de linha (Enter). Não use ponto e vírgula entre links.')
      setRequestPhase('idle')
      return
    }

    setRequestPhase('submitting')
    setSubmitting(true)
    try {
      const data = await api.convertLinks(text)
      setRequestPhase('renderingResult')
      setResponse(data)
    } catch (err) {
      setError(err.message || 'Falha ao converter links. Tente novamente em instantes.')
    } finally {
      setSubmitting(false)
      setRequestPhase('idle')
    }
  }

  async function copyAllConverted() {
    const value = successfulLinks.map(result => result.convertedUrl).join('\n')
    await copyText(value, `${successfulLinks.length} link(s) convertido(s) copiado(s).`, 'all')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24 sm:space-y-6 sm:pb-0">
      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:max-w-xl sm:grid-cols-3">
          <MetricPill label="Por envio" value="1 link" />
          <MetricPill label="Texto" value={`${Math.round(MAX_TEXT_LENGTH / 1000)} mil`} />
          <MetricPill label="Formato" value="1:1" tone="success" />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="links" className="text-sm font-bold text-gray-900">Links para converter</label>
            <p className="mt-1 text-xs leading-5 text-gray-500">Cole o link original do produto. O resultado aparece logo abaixo para copiar.</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] sm:flex sm:flex-wrap sm:gap-2" aria-label="Dicas rápidas de uso">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 font-semibold text-green-800">✅ 1 produto por conversão</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setText(''); setResponse(null); setError(''); setCopyFeedback(''); setCopiedItemKey(''); setRequestPhase('idle') }}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 sm:hidden"
          >
            Limpar
          </button>
        </div>

        <textarea
          id="links"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          placeholder="Exemplo:\nhttps://www.amazon.com.br/dp/..."
          className="mt-3 w-full rounded-2xl border border-gray-300 px-3 py-3 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-sm placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 sm:px-4 sm:text-sm"
        />

        <p className="mt-2 text-xs font-medium text-gray-600">Precisa converter outro produto? Limpe o campo e cole o próximo link.</p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
          <MetricPill label="Detectados" value={detectedCount || '0'} tone={linksOverLimit ? 'danger' : detectedCount ? 'success' : 'neutral'} />
          <MetricPill label="Caracteres" value={`${text.length.toLocaleString('pt-BR')}/${MAX_TEXT_LENGTH.toLocaleString('pt-BR')}`} tone={charsOverLimit ? 'danger' : 'neutral'} />
        </div>

        {(linksOverLimit || charsOverLimit) && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700" role="alert">
            {linksOverLimit ? getLimitMessage(detectedCount) : `Reduza o texto para até ${MAX_TEXT_LENGTH.toLocaleString('pt-BR')} caracteres.`}
          </p>
        )}

        {noisyTextWithoutLinks && !linksOverLimit && !charsOverLimit && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900" role="status" aria-live="polite">
            Ainda não detectamos links suportados neste texto. Cole URLs completas de produto para converter com mais precisão.
          </p>
        )}

        {requestPhase !== 'idle' && (
          <p className="mt-3 text-xs font-semibold text-gray-600" aria-live="polite">
            {requestPhase === 'validating' && 'Validando links...'}
            {requestPhase === 'submitting' && 'Enviando para conversão...'}
            {requestPhase === 'renderingResult' && 'Processando resultado...'}
          </p>
        )}

        <div className="mt-4 space-y-3" aria-live="polite">
          {error && <Alert type="error" title="Não foi possível converter" message={error} />}
          {copyFeedback && <Alert type="success" title="Copiado" message={copyFeedback} />}
        </div>

        <div className="sticky bottom-3 z-10 mt-5 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-xl backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 sm:px-5"
            >
              {submitting ? 'Convertendo...' : 'Converter'}
            </button>
            <button
              type="button"
              onClick={() => { setText(''); setResponse(null); setError(''); setCopyFeedback(''); setCopiedItemKey(''); setRequestPhase('idle') }}
              className="hidden min-h-12 items-center justify-center rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
            >
              Limpar
            </button>
          </div>
        </div>
      </form>

      {response && (
        <section className="space-y-3 sm:space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Resultado</h2>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
                <MetricPill label="Total" value={response.count} />
                <MetricPill label="OK" value={response.convertedCount} tone="success" />
                <MetricPill label="Atenção" value={response.failedCount} tone={response.failedCount ? 'warning' : 'neutral'} />
              </div>
            </div>
            <button
              type="button"
              onClick={copyAllConverted}
              disabled={!successfulLinks.length}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 sm:mt-0 sm:w-auto"
            >
              Copiar todos
            </button>
          </div>

          <div className="grid gap-3 sm:gap-4">
            {response.results.map(result => (
              <div key={`${result.index}-${result.originalUrl}`} className="space-y-3">
                <ResultCard result={result} onCopy={(value) => copyText(value, 'Link copiado.', `${result.index}-${result.originalUrl}`)} copied={copiedItemKey === `${result.index}-${result.originalUrl}`} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
