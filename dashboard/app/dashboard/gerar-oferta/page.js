'use client'

import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'

const DEFAULT_TEMPLATE = `🛍️ {{title}}\n\nDe {{oldPrice}}\n💥 Por {{newPrice}}\n\n🛒 Compre aqui 👉 {{link}}\n\n⚠️ Promoção sujeita à alteração de preço e estoque do site{{groupCtaBlock}}`

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
    .replaceAll('{{oldPrice}}', values.oldPrice || '')
    .replaceAll('{{newPrice}}', values.newPrice || '')
    .replaceAll('{{link}}', values.link || '')
    .replaceAll('{{groupCtaBlock}}', values.groupCtaBlock || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function GerarOfertaPage() {
  const [originalLink, setOriginalLink] = useState('')
  const [convertedLink, setConvertedLink] = useState('')
  const [title, setTitle] = useState('')
  const [oldPrice, setOldPrice] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [includeGroupCta, setIncludeGroupCta] = useState(false)
  const [groupCtaText, setGroupCtaText] = useState('Participe do grupo: xxxxxx')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')
  const [loading, setLoading] = useState(false)

  const offerMessage = useMemo(() => applyTemplate(template, {
    title,
    oldPrice: formatOfferPrice(oldPrice),
    newPrice: formatOfferPrice(newPrice),
    link: convertedLink || originalLink,
    groupCtaBlock: includeGroupCta && groupCtaText.trim() ? `\n${groupCtaText.trim()}` : '',
  }), [template, title, oldPrice, newPrice, convertedLink, originalLink, includeGroupCta, groupCtaText])

  async function handleConvertLink() {
    setError('')
    if (!originalLink.trim()) {
      setError('Cole um link para converter.')
      return
    }
    setLoading(true)
    try {
      const data = await api.convertLinks(originalLink.trim())
      const converted = data?.results?.find((item) => item.status === 'converted' && item.convertedUrl)
      if (!converted?.convertedUrl) {
        setError('Não foi possível converter esse link agora. Revise as credenciais e tente novamente.')
        return
      }
      setConvertedLink(converted.convertedUrl)
    } catch (err) {
      setError(err.message || 'Falha ao converter o link.')
    } finally {
      setLoading(false)
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(offerMessage)
      setCopyFeedback('Oferta copiada com sucesso.')
      window.setTimeout(() => setCopyFeedback(''), 2500)
    } catch {
      setError('Não foi possível copiar automaticamente. Copie manualmente abaixo.')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24 sm:space-y-6 sm:pb-0">
      <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 sm:text-sm">Ferramenta manual</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-gray-900 sm:mt-2 sm:text-3xl">Gerar oferta</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">Cole seu link, converta e monte a oferta com template editável.</p>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 space-y-4">
        <label className="text-sm font-bold text-gray-900">Seu link</label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={originalLink} onChange={(e) => setOriginalLink(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm" />
          <button type="button" onClick={handleConvertLink} disabled={loading} className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">{loading ? 'Convertendo...' : 'Converter link'}</button>
        </div>
        {convertedLink && <p className="text-xs text-green-700 break-all">Link convertido: {convertedLink}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da oferta" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          <input value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} placeholder="Preço antigo" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Preço promocional" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <input type="checkbox" checked={includeGroupCta} onChange={(e) => setIncludeGroupCta(e.target.checked)} className="h-4 w-4" />
          Incluir CTA de grupo
        </label>
        {includeGroupCta && <input value={groupCtaText} onChange={(e) => setGroupCtaText(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />}

        <div>
          <p className="text-sm font-bold text-gray-900">Template editável</p>
          <p className="text-xs text-gray-500">Variáveis: {'{{title}}'}, {'{{oldPrice}}'}, {'{{newPrice}}'}, {'{{link}}'}, {'{{groupCtaBlock}}'}</p>
          <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={8} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 text-sm" />
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-sm font-bold text-gray-900">Prévia da oferta</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{offerMessage}</p>
        </div>

        <button type="button" onClick={copyMessage} className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800">Copiar oferta</button>
        {error && <Alert type="error" title="Não foi possível concluir" message={error} />}
        {copyFeedback && <Alert type="success" title="Copiado" message={copyFeedback} />}
      </section>
    </div>
  )
}
