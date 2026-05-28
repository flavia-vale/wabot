'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { buildOfferPriceBlocks, OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT, getConversionStatusPresentation, toggleTemplateVisibility } from '@/lib/offerBuilderUi'

const DEFAULT_TEMPLATE = `🛍️ {{title}}{{oldPriceBlock}}{{newPriceBlock}}\n\n🛒 Compre aqui 👉 {{link}}`

function formatOfferPrice(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const numeric = Number.parseFloat(normalized)
  if (!Number.isFinite(numeric) || numeric <= 0) return value
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function applyTemplate(template, values) {
  return String(template || '')
    .replaceAll('{{title}}', values.title || '')
    .replaceAll('{{oldPriceBlock}}', values.oldPriceBlock || '')
    .replaceAll('{{newPriceBlock}}', values.newPriceBlock || '')
    .replaceAll('{{link}}', values.link || '')
    .replaceAll('{{groupCtaBlock}}', values.groupCtaBlock || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// OfferBuilder centraliza o comportamento de "Gerar oferta" usado pela página
// /dashboard/gerar-oferta e pelo card "Montador de oferta" dentro de
// /dashboard/converte-links. Qualquer mudança aqui propaga para os dois lugares.
//
// mode='standalone': mostra input de link + botão "Gerar oferta" (página dedicada).
// mode='inline': link vem pronto (já-afiliado da conversão) e a busca de preços
//                roda automaticamente quando o card é expandido.
export function OfferBuilder({ mode = 'standalone', initialLink = '', onCopy, copyLabelCopied }) {
  const [link, setLink] = useState(initialLink)
  const [generated, setGenerated] = useState(null)
  const [includeGroupCta, setIncludeGroupCta] = useState(false)
  const [groupCtaText, setGroupCtaText] = useState('Participe do grupo: xxxxxx')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [showTemplate, setShowTemplate] = useState(OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversionStatus, setConversionStatus] = useState(null)
  const autoScrapedRef = useRef(false)

  const priceBlocks = buildOfferPriceBlocks({
    oldPrice: generated?.oldPrice,
    newPrice: generated?.newPrice,
    formatPrice: formatOfferPrice,
  })

  const offerMessage = useMemo(() => applyTemplate(template, {
    title: generated?.title || '',
    oldPriceBlock: priceBlocks.oldPriceBlock,
    newPriceBlock: priceBlocks.newPriceBlock,
    link: generated?.link || link,
    groupCtaBlock: includeGroupCta && groupCtaText.trim() ? `\n${groupCtaText.trim()}` : '',
  }), [template, generated?.title, generated?.link, priceBlocks.oldPriceBlock, priceBlocks.newPriceBlock, link, includeGroupCta, groupCtaText])

  async function runScrape(targetLink) {
    setError('')
    setConversionStatus(null)
    const trimmed = (targetLink ?? link).trim()
    if (!trimmed) {
      setError('Cole seu link para gerar a oferta.')
      return
    }
    setLoading(true)
    try {
      const info = await api.scrapeOffer(trimmed)
      if (!info?.title && !info?.newPrice) {
        setError('Não conseguimos ler título e preço desse link. Preencha os campos manualmente abaixo.')
      }
      setGenerated({
        title: info?.title || '',
        oldPrice: info?.oldPrice || '',
        newPrice: info?.newPrice || '',
        link: info?.offerUrl || trimmed,
      })
      setConversionStatus(info?.conversion || null)
    } catch (err) {
      setError(err.message || 'Falha ao gerar a oferta.')
    } finally {
      setLoading(false)
    }
  }

  // No modo inline o link já vem pronto da conversão — disparamos a busca
  // automaticamente uma vez quando o card é montado/expandido.
  useEffect(() => {
    if (mode !== 'inline') return
    if (autoScrapedRef.current) return
    if (!initialLink) return
    autoScrapedRef.current = true
    Promise.resolve().then(() => runScrape(initialLink))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialLink])

  async function copyMessage() {
    if (onCopy) {
      onCopy(offerMessage)
      return
    }
    try {
      await navigator.clipboard.writeText(offerMessage)
      setCopyFeedback('Oferta copiada com sucesso.')
      window.setTimeout(() => setCopyFeedback(''), 2500)
    } catch {
      setError('Não foi possível copiar automaticamente. Copie manualmente abaixo.')
    }
  }

  const conversionPresentation = getConversionStatusPresentation(conversionStatus)

  return (
    <div className="space-y-4">
      {mode === 'standalone' && (
        <>
          <label className="text-sm font-bold text-gray-900">Seu link</label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
            />
            <button
              type="button"
              onClick={() => runScrape()}
              disabled={loading}
              className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? 'Gerando...' : 'Gerar oferta'}
            </button>
          </div>
          {generated?.link && <p className="text-xs text-green-700 break-all">Link da oferta: {generated.link}</p>}
        </>
      )}

      {mode === 'inline' && loading && (
        <p className="text-xs font-semibold text-indigo-700">Buscando título e preços...</p>
      )}

      {conversionPresentation && (
        <div
          role="status"
          aria-live="polite"
          className={conversionPresentation.tone === 'success'
            ? 'rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800'
            : 'rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'}
        >
          <p className="font-semibold">{conversionPresentation.title}</p>
          {conversionPresentation.hint ? <p className="mt-1 text-xs font-medium">{conversionPresentation.hint}</p> : null}
        </div>
      )}

      {generated && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className="text-xs font-semibold text-gray-700">Título</label>
            <input
              value={generated.title}
              onChange={(e) => setGenerated((g) => ({ ...g, title: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Preço antigo (de)</label>
            <input
              value={generated.oldPrice}
              onChange={(e) => setGenerated((g) => ({ ...g, oldPrice: e.target.value }))}
              placeholder="Ex: 199,90"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Preço atual (por)</label>
            <input
              value={generated.newPrice}
              onChange={(e) => setGenerated((g) => ({ ...g, newPrice: e.target.value }))}
              placeholder="Ex: 149,90"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
        <input type="checkbox" checked={includeGroupCta} onChange={(e) => setIncludeGroupCta(e.target.checked)} className="h-4 w-4" />
        Incluir CTA de grupo
      </label>
      {includeGroupCta && (
        <input
          value={groupCtaText}
          onChange={(e) => setGroupCtaText(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        />
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowTemplate((v) => toggleTemplateVisibility(v))}
          aria-expanded={showTemplate}
          aria-controls="offer-template-editor"
          className="min-h-11 text-xs font-semibold text-indigo-700 underline"
        >
          {showTemplate ? 'Ocultar template' : 'Editar template'}
        </button>
        {showTemplate && (
          <>
            <p className="mt-2 text-xs text-gray-500">Variáveis: {'{{title}}'}, {'{{oldPriceBlock}}'}, {'{{newPriceBlock}}'}, {'{{link}}'}, {'{{groupCtaBlock}}'}</p>
            <textarea
              id="offer-template-editor"
              aria-label="Template da oferta"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={8}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
            />
          </>
        )}
      </div>

      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-sm font-bold text-gray-900">Prévia da oferta</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{offerMessage}</p>
      </div>

      <button
        type="button"
        onClick={copyMessage}
        className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800"
      >
        {copyLabelCopied || 'Copiar oferta'}
      </button>

      {error && <Alert type="error" title="Não foi possível concluir" message={error} />}
      {copyFeedback && <Alert type="success" title="Copiado" message={copyFeedback} />}
    </div>
  )
}
