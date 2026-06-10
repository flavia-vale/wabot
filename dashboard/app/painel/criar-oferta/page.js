'use client'

/* Criar oferta — reskin Menta do corpo, layout fiel ao mockup App.html
 * (screen-criar): card de link no topo com loja detectada + ID de afiliada,
 * e grade 2 colunas (produto + composição | prévia no WhatsApp). A lógica é
 * idêntica à do OfferBuilder standalone: scrapeOffer → editar título/preços →
 * CTA de grupo opcional → template → prévia → copiar. Reusa os helpers de
 * lib/offerBuilderUi. O bloco de despacho usa as APIs de broadcast, agendamento e filas. */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainelHeader, PainelTopbarAction } from '../PainelShell'
import { WhatsAppBubble } from '../WhatsAppBubble'
import { getConversionStatusPresentation } from '@/lib/offerBuilderUi'
import { buildMobileOfferText } from '@/lib/mobileOfferComposer'
import { composeTemplates, loadAllTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import {
  readSavedTemplateKey,
  resolveSelectedTemplate,
  saveTemplateKey,
} from '@/lib/offerTemplateSelection'

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

function ProductImagePlaceholder() {
  return (
    <span className="pnl-prod-img" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.2" /></svg>
    </span>
  )
}

export default function CriarOfertaPage() {
  usePainelHeader({ title: 'Criar oferta', subtitle: 'Cole um link de produto — o bot monta a oferta pronta' })

  const [link, setLink] = useState('')
  const [generated, setGenerated] = useState(null)
  const [imageFailed, setImageFailed] = useState(false)
  // Lazy initializers: cache local síncrono no primeiro render (no SSR caem
  // nos defaults — o select só aparece após interação, sem risco de mismatch).
  const [templates, setTemplates] = useState(() => loadAllTemplates())
  const [templateKey, setTemplateKey] = useState(() => readSavedTemplateKey())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversionStatus, setConversionStatus] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedJids, setSelectedJids] = useState([])
  const [queues, setQueues] = useState([])
  const [queueId, setQueueId] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [dispatching, setDispatching] = useState('')
  const [dispatchFeedback, setDispatchFeedback] = useState('')

  useEffect(() => {
    Promise.all([api.groups(), api.offerQueues()]).then(([allGroups, allQueues]) => {
      const destinations = allGroups.filter((group) => group.role === 'post')
      setGroups(destinations)
      setSelectedJids(destinations.map((group) => group.waJid))
      setQueues(allQueues)
      setQueueId(allQueues[0]?.id || '')
    }).catch((err) => setError(err.message))
  }, [])

  // Reconcilia a lista com o servidor (fonte de verdade:
  // BotConfig.mobileTemplatesJson, editado em /painel/mensagens).
  useEffect(() => {
    let cancelled = false
    loadTemplateStore().then((store) => {
      if (!cancelled) setTemplates(composeTemplates(store))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const selectedTemplate = resolveSelectedTemplate(templates, templateKey)
  const store = detectStore(generated?.link || link)
  const dp = generated ? discountPct(generated.oldPrice, generated.newPrice) : null

  // Sem useMemo manual: o React Compiler memoiza sozinho (a regra
  // preserve-manual-memoization rejeita deps mais específicas que as inferidas).
  const offerMessage = buildMobileOfferText({
    product: {
      title: generated?.title || '',
      price: generated?.newPrice ? formatOfferPrice(generated.newPrice) : '',
      oldPrice: generated?.oldPrice ? formatOfferPrice(generated.oldPrice) : '',
      discount: dp != null ? `-${dp}% OFF` : '',
      storeName: store?.name || '',
    },
    link: generated?.link || link,
    template: selectedTemplate?.key,
    templateBody: selectedTemplate?.body,
  })

  function selectTemplate(key) {
    setTemplateKey(key)
    saveTemplateKey(key)
  }

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
      setImageFailed(false)
      setGenerated({
        title,
        oldPrice: normalizeText(info?.oldPrice),
        newPrice,
        link: normalizeLink(info?.offerUrl, trimmed),
        imageUrl: info?.imageUrl || null,
        imageRefererUrl: info?.imageRefererUrl || null,
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

  function dispatchPayload() {
    return { text: offerMessage, jids: selectedJids, imageUrl: generated?.imageUrl, imageRefererUrl: generated?.imageRefererUrl }
  }

  async function dispatch(mode) {
    if (!selectedJids.length) { setDispatchFeedback('Selecione pelo menos um grupo de destino.'); return }
    if (mode === 'schedule' && (!scheduleAt || new Date(scheduleAt) <= new Date())) { setDispatchFeedback('Escolha uma data e hora futuras.'); return }
    if (mode === 'queue' && !queueId) { setDispatchFeedback('Crie ou selecione uma fila.'); return }
    setDispatching(mode)
    setDispatchFeedback('')
    try {
      const payload = dispatchPayload()
      if (mode === 'now') await api.broadcastSend(payload)
      if (mode === 'schedule') await api.scheduledCreate({ ...payload, scheduledAt: new Date(scheduleAt).toISOString() })
      if (mode === 'queue') await api.offerQueueItemAdd(queueId, payload)
      setDispatchFeedback(mode === 'now' ? 'Oferta enviada para a fila de envio do WhatsApp.' : mode === 'schedule' ? 'Oferta agendada com sucesso. Veja em Agendados.' : 'Oferta inserida na fila com sucesso.')
    } catch (err) { setDispatchFeedback(err.message) }
    finally { setDispatching('') }
  }

  const conv = getConversionStatusPresentation(conversionStatus)
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const affiliateApplied = conv?.tone === 'success'
  const productImageUrl = !imageFailed && generated?.imageUrl ? generated.imageUrl : ''

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
          {/* Esquerda: produto */}
          <section className="pnl-card">
            <div className="pnl-card-title" style={{ marginBottom: 14 }}>Produto encontrado</div>
            <div style={{ display: 'flex', gap: 14 }}>
              {productImageUrl ? (
                <img
                  src={productImageUrl}
                  alt=""
                  className="pnl-prod-img"
                  style={{ objectFit: 'cover' }}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <ProductImagePlaceholder />
              )}
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

          {/* Direita: template + prévia WhatsApp */}
          <section className="pnl-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className="pnl-card-title">Prévia no WhatsApp</div>
              <span className="pnl-card-note">como vai chegar no grupo</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="pnl-label" htmlFor="of-template">Template</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  id="of-template"
                  className="pnl-input"
                  style={{ flex: 1, minWidth: 160 }}
                  value={selectedTemplate?.key || ''}
                  onChange={(e) => selectTemplate(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.key} value={t.key}>{t.name}{t.isCustom ? ' (personalizado)' : ''}</option>
                  ))}
                </select>
                <Link href="/painel/mensagens" className="pnl-detail-btn" style={{ whiteSpace: 'nowrap' }}>Gerenciar templates</Link>
              </div>
            </div>

            <WhatsAppBubble text={offerMessage} time={now} imageUrl={productImageUrl} format />
            {productImageUrl && (
              <p className="pnl-hint" style={{ marginTop: 8 }}>A imagem é ilustrativa — copie o texto e anexe a foto no WhatsApp.</p>
            )}
            <button type="button" className="pnl-btn is-primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={copyMessage}>Copiar oferta</button>
            {copyFeedback && <div className="pnl-note-box is-success" style={{ marginTop: 10 }} role="status">{copyFeedback}</div>}
          </section>
        </div>
      )}

      {generated && (
        <section className="pnl-card" aria-labelledby="dispatch-title">
          <div className="pnl-card-title" id="dispatch-title">Despacho</div>
          <p className="pnl-hint" style={{ marginTop: 4 }}>Escolha os destinos e envie agora, agende ou adicione a uma fila automática.</p>
          <div style={{ marginTop: 16 }}>
            <span className="pnl-label">Grupos de destino</span>
            <div className="pnl-grid" style={{ marginTop: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
              {groups.map((group) => <label className="pnl-check" key={group.id}><input type="checkbox" checked={selectedJids.includes(group.waJid)} onChange={() => setSelectedJids((current) => current.includes(group.waJid) ? current.filter((jid) => jid !== group.waJid) : [...current, group.waJid])} />{group.name}</label>)}
            </div>
            {!groups.length && <p className="pnl-note-box is-error" style={{ marginTop: 8 }}>Nenhum grupo de postagem configurado. <Link href="/painel/grupos">Adicionar grupos</Link></p>}
          </div>
          <div className="pnl-grid" style={{ marginTop: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', alignItems: 'end' }}>
            <button type="button" className="pnl-btn is-primary" style={{ justifyContent: 'center' }} disabled={!!dispatching || !selectedJids.length} onClick={() => dispatch('now')}>{dispatching === 'now' ? 'Enviando…' : 'Enviar agora'}</button>
            <div className="pnl-field"><label className="pnl-label" htmlFor="schedule-at">Dia e hora</label><input id="schedule-at" className="pnl-input" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} /><button type="button" className="pnl-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={!!dispatching || !scheduleAt} onClick={() => dispatch('schedule')}>{dispatching === 'schedule' ? 'Agendando…' : 'Agendar'}</button></div>
            <div className="pnl-field"><label className="pnl-label" htmlFor="queue-id">Fila automática</label>{queues.length ? <><select id="queue-id" className="pnl-input" value={queueId} onChange={(e) => setQueueId(e.target.value)}>{queues.map((queue) => <option value={queue.id} key={queue.id}>{queue.name}{queue.enabled ? '' : ' (pausada)'}</option>)}</select><button type="button" className="pnl-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={!!dispatching || !queueId} onClick={() => dispatch('queue')}>{dispatching === 'queue' ? 'Inserindo…' : 'Inserir na fila'}</button></> : <Link className="pnl-btn" href="/painel/filas">Criar minha primeira fila</Link>}</div>
          </div>
          {dispatchFeedback && <div className={`pnl-note-box ${/sucesso|enviada|agendada|inserida/i.test(dispatchFeedback) ? 'is-success' : 'is-error'}`} style={{ marginTop: 14 }} role="status">{dispatchFeedback}{dispatchFeedback.includes('Agendados') && <> <Link href="/painel/agendados">Abrir agendados</Link></>}</div>}
        </section>
      )}
    </div>
  )
}
