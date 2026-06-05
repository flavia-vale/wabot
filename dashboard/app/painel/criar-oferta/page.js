'use client'

/* Criar oferta — reskin Menta do corpo. A lógica é idêntica à do OfferBuilder
 * (mode=standalone): scrapeOffer → editar título/preços → CTA de grupo opcional
 * → template → prévia → copiar. Reusa os helpers compartilhados de
 * lib/offerBuilderUi e replica as funções puras de apresentação do builder.
 * Nenhuma mudança no back end. (O builder standalone não posta direto em grupo
 * — só gera e copia —, então mantemos esse comportamento.) */

import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader, PainelTopbarAction } from '../PainelShell'
import {
  buildOfferPriceBlocks,
  getConversionStatusPresentation,
  OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT,
  toggleTemplateVisibility,
} from '@/lib/offerBuilderUi'

const DEFAULT_TEMPLATE = `🛍️ {{title}}{{oldPriceBlock}}{{newPriceBlock}}\n\n🛒 Compre aqui 👉 {{link}}`

function formatOfferPrice(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  const normalized = value.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const numeric = Number.parseFloat(normalized)
  if (!Number.isFinite(numeric) || numeric <= 0) return value
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const normalizeText = (raw) => (typeof raw === 'string' ? raw : '')
function normalizeLink(raw, fallback = '') {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    if (typeof raw.url === 'string') return raw.url
    if (typeof raw.href === 'string') return raw.href
  }
  return typeof fallback === 'string' ? fallback : ''
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

export default function CriarOfertaPage() {
  usePainelHeader({ title: 'Criar oferta', subtitle: 'Cole um link de produto — o bot monta a oferta pronta' })

  const [link, setLink] = useState('')
  const [generated, setGenerated] = useState(null)
  const [includeGroupCta, setIncludeGroupCta] = useState(false)
  const [groupCtaText, setGroupCtaText] = useState('Participe do grupo: xxxxxx')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [showTemplate, setShowTemplate] = useState(OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversionStatus, setConversionStatus] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')

  const priceBlocks = buildOfferPriceBlocks({ oldPrice: generated?.oldPrice, newPrice: generated?.newPrice, formatPrice: formatOfferPrice })

  const offerMessage = useMemo(() => applyTemplate(template, {
    title: generated?.title || '',
    oldPriceBlock: priceBlocks.oldPriceBlock,
    newPriceBlock: priceBlocks.newPriceBlock,
    link: generated?.link || link,
    groupCtaBlock: includeGroupCta && groupCtaText.trim() ? `\n${groupCtaText.trim()}` : '',
  }), [template, generated?.title, generated?.link, priceBlocks.oldPriceBlock, priceBlocks.newPriceBlock, link, includeGroupCta, groupCtaText])

  async function runScrape() {
    setError('')
    setConversionStatus(null)
    const trimmed = link.trim()
    if (!trimmed) { setError('Cole seu link para gerar a oferta.'); return }
    setLoading(true)
    try {
      const info = await api.scrapeOffer(trimmed)
      const title = normalizeText(info?.title)
      const newPrice = normalizeText(info?.newPrice)
      if (!title && !newPrice) setError('Não conseguimos ler título e preço desse link. Preencha os campos manualmente abaixo.')
      setGenerated({
        title,
        oldPrice: normalizeText(info?.oldPrice),
        newPrice,
        link: normalizeLink(info?.offerUrl, trimmed),
      })
      setConversionStatus(info?.conversion || null)
    } catch (err) {
      setError(err?.message || 'Falha ao gerar a oferta.')
    } finally {
      setLoading(false)
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(offerMessage)
      setCopyFeedback('Oferta copiada com sucesso.')
      setTimeout(() => setCopyFeedback(''), 2500)
    } catch {
      setError('Não foi possível copiar automaticamente. Copie manualmente da prévia.')
    }
  }

  const conv = getConversionStatusPresentation(conversionStatus)
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="pnl-grid" style={{ maxWidth: 760, margin: '0 auto' }}>
      <PainelTopbarAction>
        <span className="pnl-tag is-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>✓ GRÁTIS</span>
      </PainelTopbarAction>
      {/* Link */}
      <section className="pnl-card">
        <div className="pnl-card-title">Seu link</div>
        <p className="pnl-card-note" style={{ marginBottom: 12 }}>Cole o link do produto (Shopee, Amazon, Mercado Livre, Magalu…). Tentamos converter para o seu link de afiliado; se não der, seguimos com o original.</p>
        <div className="pnl-inline-form">
          <input className="pnl-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." onKeyDown={(e) => { if (e.key === 'Enter') runScrape() }} />
          <button type="button" className="pnl-btn is-primary" onClick={runScrape} disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Gerando…' : 'Gerar oferta'}
          </button>
        </div>
        {generated?.link && <p className="pnl-hint" style={{ marginTop: 8, wordBreak: 'break-all' }}>Link da oferta: {generated.link}</p>}
        {conv && <div className={`pnl-note-box ${conv.tone === 'success' ? 'is-success' : 'is-error'}`} style={{ marginTop: 12 }} role="status"><strong style={{ fontWeight: 600 }}>{conv.title}</strong>{conv.hint && <p style={{ marginTop: 4 }}>{conv.hint}</p>}</div>}
        {error && <div className="pnl-note-box is-error" style={{ marginTop: 12 }} role="alert">{error}</div>}
      </section>

      {/* Produto + composição */}
      {generated && (
        <section className="pnl-card">
          <div className="pnl-card-title" style={{ marginBottom: 12 }}>Produto encontrado</div>
          <div className="pnl-field" style={{ marginBottom: 12 }}>
            <label className="pnl-label" htmlFor="of-title">Título</label>
            <input id="of-title" className="pnl-input" value={generated.title} onChange={(e) => setGenerated((g) => ({ ...g, title: e.target.value }))} />
          </div>
          <div className="pnl-price-grid">
            <div className="pnl-field">
              <label className="pnl-label" htmlFor="of-old">Preço antigo (de)</label>
              <input id="of-old" className="pnl-input" value={generated.oldPrice} onChange={(e) => setGenerated((g) => ({ ...g, oldPrice: e.target.value }))} placeholder="Ex: 199,90" />
            </div>
            <div className="pnl-field">
              <label className="pnl-label" htmlFor="of-new">Preço atual (por)</label>
              <input id="of-new" className="pnl-input" value={generated.newPrice} onChange={(e) => setGenerated((g) => ({ ...g, newPrice: e.target.value }))} placeholder="Ex: 149,90" />
            </div>
          </div>

          <label className="pnl-check" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={includeGroupCta} onChange={(e) => setIncludeGroupCta(e.target.checked)} />
            Incluir CTA de grupo
          </label>
          {includeGroupCta && <input className="pnl-input" style={{ marginTop: 8 }} value={groupCtaText} onChange={(e) => setGroupCtaText(e.target.value)} />}

          <div style={{ marginTop: 14 }}>
            <button type="button" className="pnl-detail-btn" onClick={() => setShowTemplate((v) => toggleTemplateVisibility(v))} aria-expanded={showTemplate}>
              {showTemplate ? 'Ocultar template' : 'Editar template'}
            </button>
            {showTemplate && (
              <div style={{ marginTop: 8 }}>
                <p className="pnl-hint">Variáveis: {'{{title}}'}, {'{{oldPriceBlock}}'}, {'{{newPriceBlock}}'}, {'{{link}}'}, {'{{groupCtaBlock}}'}</p>
                <textarea className="pnl-input" style={{ marginTop: 6 }} rows={8} aria-label="Template da oferta" value={template} onChange={(e) => setTemplate(e.target.value)} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Prévia WhatsApp */}
      {generated && (
        <section className="pnl-card">
          <div className="pnl-card-title">Prévia no WhatsApp</div>
          <div className="pnl-card-note" style={{ marginBottom: 12 }}>como vai chegar no grupo</div>
          <div className="pnl-wa">
            <div className="pnl-wa-bubble">
              {offerMessage || '—'}
              <div className="pnl-wa-meta">{now} ✓✓</div>
            </div>
          </div>
          <button type="button" className="pnl-btn is-primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={copyMessage}>Copiar oferta</button>
          {copyFeedback && <div className="pnl-note-box is-success" style={{ marginTop: 10 }} role="status">{copyFeedback}</div>}
        </section>
      )}
    </div>
  )
}
