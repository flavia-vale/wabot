'use client'

/* Criar oferta — card de link no topo com loja detectada, prévia editável do
 * WhatsApp (o texto composto pelo template pode ser ajustado direto na
 * mensagem, dispensando o antigo card "Produto encontrado") e card de Envio
 * com três modos exclusivos: enviar agora (grupos), agendar (data + grupos) e
 * inserir na fila (a fila já carrega os próprios grupos de destino). Reusa os
 * helpers de lib/offerBuilderUi e as APIs de broadcast, agendamento e filas. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'
import { WhatsAppBubble } from '../WhatsAppBubble'
import { getConversionStatusPresentation } from '@/lib/offerBuilderUi'
import { hasProLikeAccess } from '@/lib/planEntitlements'
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
  { test: /shein/i, name: 'SHEIN', bg: '#000000', fg: '#fff', mark: 'S' },
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

function extractFirstUrl(raw) {
  const text = String(raw || '').trim()
  const match = text.match(/https?:\/\/[^\s<>()"']+/i)
  return match ? match[0].replace(/[.,;:!?]+$/, '') : text
}

export default function CriarOfertaPage() {
  usePainelHeader({ title: 'Criar oferta', subtitle: 'Cole o seu link de afiliado — o bot monta a oferta pronta' })

  const [link, setLink] = useState('')
  const [generated, setGenerated] = useState(null)
  // Lazy initializers: cache local síncrono no primeiro render (no SSR caem
  // nos defaults — o select só aparece após interação, sem risco de mismatch).
  const [templates, setTemplates] = useState(() => loadAllTemplates())
  const [templateKey, setTemplateKey] = useState(() => readSavedTemplateKey())
  const [loading, setLoading] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [error, setError] = useState('')
  const [conversionStatus, setConversionStatus] = useState(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [pasteFeedback, setPasteFeedback] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedJids, setSelectedJids] = useState([])
  const [queues, setQueues] = useState([])
  const [queueId, setQueueId] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [sendMode, setSendMode] = useState('')
  const [canUseQueues, setCanUseQueues] = useState(true)
  const [dispatching, setDispatching] = useState('')
  const [dispatchFeedback, setDispatchFeedback] = useState('')
  // Texto da prévia editado à mão. null = segue o template; qualquer edição
  // manual passa a valer até trocar de template ou gerar nova oferta.
  const [customText, setCustomText] = useState(null)

  useEffect(() => {
    Promise.all([api.groups(), api.offerQueues(), api.me().catch(() => null)]).then(([allGroups, allQueues, me]) => {
      const destinations = allGroups.filter((group) => group.role === 'post')
      const queuesAllowed = me ? hasProLikeAccess({ plan: me.plan ?? 'trial', accessExpiresAt: me.accessExpiresAt ?? null }) : true
      const requestedQueueId = new URLSearchParams(window.location.search).get('fila')
      const initialQueueId = allQueues.some((queue) => queue.id === requestedQueueId)
        ? requestedQueueId
        : allQueues[0]?.id || ''
      setGroups(destinations)
      setSelectedJids(destinations.map((group) => group.waJid))
      setQueues(allQueues)
      setQueueId(initialQueueId)
      setCanUseQueues(queuesAllowed)
      if (queuesAllowed && requestedQueueId === initialQueueId) setSendMode('queue')
    }).catch((err) => setError(err.message))
  }, [])

  const selectedTemplate = resolveSelectedTemplate(templates, templateKey)
  const store = detectStore(generated?.link || link)
  const dp = generated ? discountPct(generated.oldPrice, generated.newPrice) : null

  // Sem useMemo manual: o React Compiler memoiza sozinho (a regra
  // preserve-manual-memoization rejeita deps mais específicas que as inferidas).
  const templateMessage = buildMobileOfferText({
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
  const offerMessage = customText ?? templateMessage

  function selectTemplate(key) {
    setTemplateKey(key)
    saveTemplateKey(key)
    setCustomText(null)
  }

  async function pasteFromClipboard() {
    setError('')
    setPasteFeedback('')

    if (!navigator?.clipboard?.readText) {
      setError('Seu navegador não permite colar automaticamente. Use Ctrl+V no campo do link.')
      return
    }

    setPasting(true)
    try {
      const clipboardText = await navigator.clipboard.readText()
      const nextLink = extractFirstUrl(clipboardText)
      if (!nextLink) {
        setError('Sua área de transferência está vazia.')
        return
      }

      setLink(nextLink)
      setGenerated(null)
      setConversionStatus(null)
      setCustomText(null)
      setCopyFeedback('')
      setDispatchFeedback('')
      setPasteFeedback('Link colado. Agora clique em Gerar.')
    } catch {
      setError('Não foi possível acessar sua área de transferência. Use Ctrl+V no campo do link.')
    } finally {
      setPasting(false)
    }
  }

  async function runScrape() {
    setError('')
    setPasteFeedback('')
    setConversionStatus(null)
    const trimmed = link.trim()
    if (!trimmed) { setError('Cole seu link para gerar a oferta.'); return }
    setLoading(true)
    try {
      const info = await api.scrapeOffer(trimmed)
      const title = normalizeText(info?.title)
      const newPrice = normalizeText(info?.newPrice)
      // RCA 2026-09-19: o aviso só saía quando título E preço faltavam. Com o
      // título vindo e o preço não, a cliente não via aviso nenhum e enviava a
      // oferta sem preço. Agora cada caso tem o seu — e o preço, por ser o que
      // some com mais frequência, também ganha faixa fixa acima da prévia.
      if (!title && !newPrice) setError('Não conseguimos ler título e preço desse link. Edite a mensagem direto na prévia abaixo.')
      else if (!title) setError('Não conseguimos ler o nome do produto desse link. Escreva o nome na mensagem antes de enviar.')
      setCustomText(null)
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

  function resetOfferForm() {
    setLink('')
    setGenerated(null)
    setConversionStatus(null)
    setCopyFeedback('')
    setPasteFeedback('')
    setScheduleAt('')
    setCustomText(null)
  }

  async function dispatch(mode, { createNew = false } = {}) {
    if (mode !== 'queue' && !selectedJids.length) { setDispatchFeedback('Selecione pelo menos um grupo de destino.'); return }
    if (mode === 'schedule' && (!scheduleAt || new Date(scheduleAt) <= new Date())) { setDispatchFeedback('Escolha uma data e hora futuras.'); return }
    if (mode === 'queue' && !queueId) { setDispatchFeedback('Crie ou selecione uma fila.'); return }
    const actionKey = createNew ? `${mode}-new` : mode
    setDispatching(actionKey)
    setDispatchFeedback('')
    try {
      const payload = { text: offerMessage, imageUrl: generated?.imageUrl, imageRefererUrl: generated?.imageRefererUrl }
      if (mode === 'now') await api.broadcastSend({ ...payload, jids: selectedJids })
      if (mode === 'schedule') await api.scheduledCreate({ ...payload, jids: selectedJids, scheduledAt: new Date(scheduleAt).toISOString() })
      // Na fila não enviamos jids: o item herda os grupos configurados na fila.
      if (mode === 'queue') await api.offerQueueItemAdd(queueId, payload)
      setDispatchFeedback(createNew
        ? (mode === 'now' ? 'Oferta enviada para a fila de envio do WhatsApp. Nova oferta pronta para criação.' : mode === 'schedule' ? 'Oferta agendada com sucesso. Nova oferta pronta para criação.' : 'Oferta inserida na fila com sucesso. Nova oferta pronta para criação.')
        : (mode === 'now' ? 'Oferta enviada para a fila de envio do WhatsApp.' : mode === 'schedule' ? 'Oferta agendada com sucesso. Veja em Agendados.' : 'Oferta inserida na fila com sucesso.'))
      if (createNew) resetOfferForm()
    } catch (err) { setDispatchFeedback(err.message) }
    finally { setDispatching('') }
  }

  const conv = getConversionStatusPresentation(conversionStatus)
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const productImageUrl = generated?.imageUrl || ''

  return (
    <div className="pnl-grid" style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* TEMPORÁRIO: sem conversão de link — o usuário precisa colar o próprio
          link de afiliado, e a oferta sai exatamente com o link colado. */}
      <div className="pnl-note-box is-warn" role="note">
        <strong style={{ fontWeight: 600 }}>⚠️ Atenção:</strong> cole o <strong style={{ fontWeight: 600 }}>seu próprio link de afiliado</strong>. Por enquanto o link não é convertido — a oferta é gerada exatamente com o link que você colar.
      </div>

      {/* Link — card no topo */}
      <section className="pnl-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span className="pnl-icon-tile" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
          </span>
          <input
            className="pnl-input"
            style={{ flex: 1, minWidth: 180, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace", fontSize: 13 }}
            value={link}
            onChange={(e) => { setLink(e.target.value); setPasteFeedback('') }}
            placeholder="https://..."
            onKeyDown={(e) => { if (e.key === 'Enter') runScrape() }}
          />
          <button type="button" className="pnl-btn is-primary" onClick={pasteFromClipboard} disabled={pasting || loading} style={{ justifyContent: 'center' }}>
            {pasting ? 'Colando…' : 'Colar'}
          </button>
          <button type="button" className="pnl-btn is-primary" onClick={runScrape} disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Gerando…' : 'Gerar'}
          </button>
        </div>
        <div style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
          {store ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="pnl-store-badge" style={{ background: store.bg, color: store.fg }}>{store.mark}</span>
              {store.name} detectada
            </span>
          ) : (
            <span>Cole um link de Shopee, Amazon, Mercado Livre, Magalu ou SHEIN.</span>
          )}
          {generated && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                oferta gerada com o link colado (sem conversão)
              </span>
            </>
          )}
        </div>
      </section>

      {conv && <div className={`pnl-note-box ${conv.tone === 'success' ? 'is-success' : 'is-error'}`} role="status"><strong style={{ fontWeight: 600 }}>{conv.title}</strong>{conv.hint && <p style={{ marginTop: 4 }}>{conv.hint}</p>}</div>}
      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}
      {pasteFeedback && <div className="pnl-note-box is-success" role="status">{pasteFeedback}</div>}

      {generated && !generated.newPrice && (
        <div className="pnl-note-box is-warn" role="alert">
          <strong style={{ fontWeight: 600 }}>Não conseguimos ler o preço na loja.</strong>
          <p style={{ marginTop: 4 }}>A oferta vai sair <strong style={{ fontWeight: 600 }}>sem preço</strong>. Confira o preço na loja e escreva ele na mensagem abaixo antes de enviar.</p>
        </div>
      )}

      {/* Prévia editável: substitui o antigo card "Produto encontrado" — o
          usuário ajusta título/preços direto no texto da mensagem. */}
      {generated && (
        <section className="pnl-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="pnl-card-title">Prévia no WhatsApp</div>
            <span className="pnl-card-note">edite o texto como quiser — é assim que vai chegar no grupo</span>
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

          <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
            <div className="pnl-field">
              <label className="pnl-label" htmlFor="of-message">Mensagem da oferta</label>
              <textarea
                id="of-message"
                className="pnl-input"
                rows={10}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5 }}
                value={offerMessage}
                onChange={(e) => setCustomText(e.target.value)}
              />
              {customText != null && (
                <button type="button" className="pnl-detail-btn" style={{ marginTop: 8 }} onClick={() => setCustomText(null)}>Restaurar texto do template</button>
              )}
            </div>
            <div>
              <WhatsAppBubble text={offerMessage} time={now} imageUrl={productImageUrl} format />
              {productImageUrl && (
                <p className="pnl-hint" style={{ marginTop: 8 }}>A imagem é ilustrativa — copie o texto e anexe a foto no WhatsApp.</p>
              )}
            </div>
          </div>

          <button type="button" className="pnl-btn is-primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={copyMessage}>Copiar oferta</button>
          {copyFeedback && <div className="pnl-note-box is-success" style={{ marginTop: 10 }} role="status">{copyFeedback}</div>}
        </section>
      )}

      {generated && (
        <section className="pnl-card" aria-labelledby="dispatch-title">
          <div className="pnl-card-title" id="dispatch-title">Envio</div>
          <p className="pnl-hint" style={{ marginTop: 4 }}>Como você quer enviar esta oferta?</p>

          {/* Seletor de modo: cada modo revela só os campos pertinentes. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }} role="group" aria-label="Modo de envio">
            {[['now', 'Enviar agora'], ['schedule', 'Agendar'], ['queue', 'Inserir na fila']].map(([mode, label]) => {
              const lockedQueueMode = mode === 'queue' && !canUseQueues
              return (
                <button
                  key={mode}
                  type="button"
                  className={`pnl-btn${sendMode === mode ? ' is-primary' : ''}`}
                  aria-pressed={sendMode === mode}
                  disabled={lockedQueueMode}
                  title={lockedQueueMode ? 'As filas de ofertas estão disponíveis no Trial ativo e no plano Pro.' : undefined}
                  onClick={() => { setSendMode(mode); setDispatchFeedback('') }}
                >
                  {label}{lockedQueueMode && <span className="pnl-tag" style={{ marginLeft: 6 }}>Pro</span>}
                </button>
              )
            })}
          </div>

          {sendMode === 'schedule' && (
            <div className="pnl-field" style={{ marginTop: 16, maxWidth: 280 }}>
              <label className="pnl-label" htmlFor="schedule-at">Dia e hora</label>
              <input id="schedule-at" className="pnl-input" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            </div>
          )}

          {(sendMode === 'now' || sendMode === 'schedule') && (
            <div style={{ marginTop: 16 }}>
              <span className="pnl-label">Grupos de destino</span>
              <div className="pnl-grid" style={{ marginTop: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                {groups.map((group) => <label className="pnl-check" key={group.id}><input type="checkbox" checked={selectedJids.includes(group.waJid)} onChange={() => setSelectedJids((current) => current.includes(group.waJid) ? current.filter((jid) => jid !== group.waJid) : [...current, group.waJid])} />{group.name}</label>)}
              </div>
              {!groups.length && <p className="pnl-note-box is-error" style={{ marginTop: 8 }}>Nenhum grupo de postagem configurado. <Link href="/painel/grupos">Adicionar grupos</Link></p>}
            </div>
          )}

          {sendMode === 'queue' && (
            <div className="pnl-field" style={{ marginTop: 16, maxWidth: 380 }}>
              <label className="pnl-label" htmlFor="queue-id">Fila automática</label>
              {queues.length ? (
                <>
                  <select id="queue-id" className="pnl-input" value={queueId} onChange={(e) => setQueueId(e.target.value)}>
                    {queues.map((queue) => <option value={queue.id} key={queue.id}>{queue.name}{queue.enabled ? '' : ' (pausada)'}</option>)}
                  </select>
                  <p className="pnl-hint" style={{ marginTop: 6 }}>A oferta será enviada para os grupos configurados na fila.</p>
                </>
              ) : (
                <Link className="pnl-btn" href="/painel/filas">Criar minha primeira fila</Link>
              )}
            </div>
          )}

          {sendMode && (() => {
            const disabled = !!dispatching || (sendMode !== 'queue' && !selectedJids.length) || (sendMode === 'schedule' && !scheduleAt) || (sendMode === 'queue' && !queueId)
            const baseLabel = sendMode === 'now' ? 'Enviar agora' : sendMode === 'schedule' ? 'Agendar' : 'Inserir na fila'
            const loadingLabel = sendMode === 'now' ? 'Enviando…' : sendMode === 'schedule' ? 'Agendando…' : 'Inserindo…'
            return (
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="pnl-btn is-primary"
                  style={{ justifyContent: 'center' }}
                  disabled={disabled}
                  onClick={() => dispatch(sendMode, { createNew: true })}
                >
                  {dispatching === `${sendMode}-new` ? loadingLabel : `${baseLabel} e criar nova oferta`}
                </button>
                <button
                  type="button"
                  className="pnl-btn is-primary"
                  style={{ justifyContent: 'center' }}
                  disabled={disabled}
                  onClick={() => dispatch(sendMode)}
                >
                  {dispatching === sendMode ? loadingLabel : baseLabel}
                </button>
              </div>
            )
          })()}

          {dispatchFeedback && <div className={`pnl-note-box ${/sucesso|enviada|agendada|inserida/i.test(dispatchFeedback) ? 'is-success' : 'is-error'}`} style={{ marginTop: 14 }} role="status">{dispatchFeedback}{dispatchFeedback.includes('Agendados') && <> <Link href="/painel/agendados">Abrir agendados</Link></>}</div>}
        </section>
      )}
    </div>
  )
}
