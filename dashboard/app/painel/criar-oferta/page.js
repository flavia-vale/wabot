'use client'

/* Criar oferta — reskin Menta do corpo, layout fiel ao mockup App.html
 * (screen-criar): card de link no topo com loja detectada + ID de afiliada,
 * e grade 2 colunas (produto + composição | prévia no WhatsApp). A lógica é
 * idêntica à do OfferBuilder standalone: scrapeOffer → editar título/preços →
 * CTA de grupo opcional → template → prévia → copiar. Reusa os helpers de
 * lib/offerBuilderUi. Nenhuma mudança no back end. */

import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader, PainelTopbarAction } from '../PainelShell'
import { WhatsAppBubble } from '../WhatsAppBubble'
import {
  buildOfferPriceBlocks,
  getConversionStatusPresentation,
  OFFER_BUILDER_TEMPLATE_VISIBLE_DEFAULT,
  toggleTemplateVisibility,
} from '@/lib/offerBuilderUi'

const DEFAULT_TEMPLATE = `🛍️ {{title}}{{oldPriceBlock}}{{newPriceBlock}}\n\n🛒 Compre aqui 👉 {{link}}`

const STORES = [
  { test: /shopee/i, name: 'Shopee', bg: '#EE4D2D', fg: '#fff', mark: 'S' },
  { test: /amazon|amzn/i, name: 'Amazon', bg: '#FF9900', fg: '#fff', mark: 'a' },
  { test: /mercadoliv|mercadolib|mlstatic/i, name: 'Mercado Livre', bg: '#FFE600', fg: '#1F2D2A', mark: 'ML' },
  { test: /magazineluiza|magazinevoce|magalu/i, name: 'Magalu', bg: '#0086FF', fg: '#fff', mark: 'M' },
]
function detectStore(url) {
  const u = String(url || '')
  return STORES.find((s) => s.test.test(u)) || null
}

function parseNum(raw) {
  const v = String(raw || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
function discountPct(oldP, newP) {
  const o = parseNum(oldP)
  const n = parseNum(newP)
  if (o > 0 && n > 0 && n < o) return Math.round((1 - n / o) * 100)
  return null
}

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
  const [imgFailed, setImgFailed] = useState(false)

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
    setImgFailed(false)
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
        image: normalizeText(info?.image),
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
  const store = detectStore(generated?.link || link)
  const dp = generated ? discountPct(generated.oldPrice, generated.newPrice) : null
  const affiliateApplied = conv?.tone === 'success'

  return (
    <div className="pnl-grid" style={{ maxWidth: 1040, margin: '0 auto' }}>
      <PainelTopbarAction>
        <span className="pnl-tag is-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>✓ GRÁTIS</span>
      </PainelTopbarAction>

      {/* Link — card no topo */}
      <section className="pnl-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span className="pnl-icon-tile" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
          </span>
          <input
            className="pnl-input"
            style={{ flex: 1, minWidth: 180, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13 }}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            onKeyDown={(e) => { if (e.key === 'Enter') runScrape() }}
          />
          <button type="button" className="pnl-btn is-primary" onClick={runScrape} disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Gerando…' : 'Gerar oferta'}
          </button>
        </div>
        <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
          {store ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="pnl-store-badge" style={{ background: store.bg, color: store.fg }}>{store.mark}</span>
              {store.name} detectada
            </span>
          ) : (
            <span>Cole um link de Shopee, Amazon, Mercado Livre ou Magalu.</span>
          )}
          {generated && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: affiliateApplied ? 'var(--success)' : 'var(--ink-soft)' }}>
                {affiliateApplied ? '✓ link de afiliado aplicado' : 'usando o link original (sem conversão)'}
              </span>
            </>
          )}
        </div>
      </section>

      {conv && <div className={`pnl-note-box ${conv.tone === 'success' ? 'is-success' : 'is-error'}`} role="status"><strong style={{ fontWeight: 600 }}>{conv.title}</strong>{conv.hint && <p style={{ marginTop: 4 }}>{conv.hint}</p>}</div>}
      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}

      {/* Grade 2 colunas */}
      {generated && (
        <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          {/* Esquerda: produto + composição */}
          <div className="pnl-grid">
            <section className="pnl-card">
              <div className="pnl-card-title" style={{ marginBottom: 14 }}>Produto encontrado</div>
              <div style={{ display: 'flex', gap: 14 }}>
                <span className="pnl-prod-img" aria-hidden="true" style={generated.image && !imgFailed ? { overflow: 'hidden', padding: 0 } : undefined}>
                  {generated.image && !imgFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={generated.image} alt="" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.2" /></svg>
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)' }}>{generated.title || 'Sem título detectado'}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {generated.newPrice ? <span className="pnl-price-now">{formatOfferPrice(generated.newPrice)}</span> : <span className="pnl-card-note">preço não detectado</span>}
                    {generated.oldPrice && <span className="pnl-price-old">{formatOfferPrice(generated.oldPrice)}</span>}
                    {dp != null && <span className="pnl-disc">-{dp}%</span>}
                  </div>
                </div>
              </div>

              {/* Campos editáveis */}
              <div style={{ marginTop: 16 }}>
                <label className="pnl-label" htmlFor="of-title">Título</label>
                <input id="of-title" className="pnl-input" value={generated.title} onChange={(e) => setGenerated((g) => ({ ...g, title: e.target.value }))} />
              </div>
              <div className="pnl-price-grid" style={{ marginTop: 12 }}>
                <div className="pnl-field">
                  <label className="pnl-label" htmlFor="of-old">Preço antigo (de)</label>
                  <input id="of-old" className="pnl-input" value={generated.oldPrice} onChange={(e) => setGenerated((g) => ({ ...g, oldPrice: e.target.value }))} placeholder="Ex: 199,90" />
                </div>
                <div className="pnl-field">
                  <label className="pnl-label" htmlFor="of-new">Preço atual (por)</label>
                  <input id="of-new" className="pnl-input" value={generated.newPrice} onChange={(e) => setGenerated((g) => ({ ...g, newPrice: e.target.value }))} placeholder="Ex: 149,90" />
                </div>
              </div>
            </section>

            <section className="pnl-card">
              <div className="pnl-card-title" style={{ marginBottom: 12 }}>Configurar envio</div>
              <label className="pnl-check">
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
              {generated.link && <p className="pnl-hint" style={{ marginTop: 12, wordBreak: 'break-all' }}>Link da oferta: {generated.link}</p>}
            </section>
          </div>

          {/* Direita: prévia WhatsApp */}
          <section className="pnl-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className="pnl-card-title">Prévia no WhatsApp</div>
              <span className="pnl-card-note">como vai chegar no grupo</span>
            </div>
            <WhatsAppBubble text={offerMessage} time={now} />
            <button type="button" className="pnl-btn is-primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={copyMessage}>Copiar oferta</button>
            {copyFeedback && <div className="pnl-note-box is-success" style={{ marginTop: 10 }} role="status">{copyFeedback}</div>}
          </section>
        </div>
      )}
    </div>
  )
}
