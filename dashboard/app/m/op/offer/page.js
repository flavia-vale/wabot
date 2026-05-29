'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard } from '@/components/mobile/MobileAsyncState'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'
import {
  COUPON_STORES,
  TEMPLATE_OPTIONS,
  buildMobileOfferText,
  detectMobileOfferStoreKey,
  getMobileOfferSingleLinkWarning,
  isValidHttpUrl,
} from '@/lib/mobileOfferComposer'
import { loadAllTemplates } from '@/lib/mobileTemplateStore'

const COUPON_LINKS_STORAGE_KEY = 'wabot.mobile.offer.couponLinks.v1'
const DEFAULT_COUPON_LINKS = { shopee: '', mercadolivre: '', amazon: '', magazineluiza: '' }

function readStoredCouponLinks() {
  if (typeof window === 'undefined') return DEFAULT_COUPON_LINKS
  try {
    const stored = JSON.parse(window.localStorage.getItem(COUPON_LINKS_STORAGE_KEY) || '{}')
    return { ...DEFAULT_COUPON_LINKS, ...stored }
  } catch {
    return DEFAULT_COUPON_LINKS
  }
}

function saveStoredCouponLinks(links) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COUPON_LINKS_STORAGE_KEY, JSON.stringify(links))
  } catch {
    // localStorage indisponível: mantém os links editáveis só na sessão atual.
  }
}

const criarStyles = {
  pageH: { padding:'18px 20px 0' },
  pageEyebrow: { fontSize: 12, color:'var(--ink-soft)' },
  pageTitle: { fontSize: 22, fontWeight: 600, color:'var(--ink)', letterSpacing:'-0.01em', marginTop: 2 },
  pageSub: { fontSize: 13, color:'var(--ink-soft)', marginTop: 6, lineHeight: 1.5 },

  // Input — protagonista. Quando vazio, parece input. Quando preenchido, parece link.
  inputBlock: { margin:'16px 16px 0' },
  inputLabel: {
    fontSize: 11, fontWeight: 600, color:'var(--ink-soft)',
    textTransform:'uppercase', letterSpacing:'0.06em', marginBottom: 8,
  },
  inputRow: {
    display:'flex', alignItems:'stretch', gap: 8,
  },
  inputFieldWrap: { flex: 1, minWidth: 0, position:'relative' },
  inputField: (filled) => ({
    width:'100%',
    padding:'18px 16px',
    background: filled ? 'var(--surface)' : 'var(--bg-soft)',
    border:'1.5px solid ' + (filled ? 'var(--line)' : 'var(--line-strong)'),
    borderRadius: 14,
    fontSize: 14,
    fontFamily: filled ? "'JetBrains Mono', monospace" : 'inherit',
    color: filled ? 'var(--ink)' : 'var(--ink-faint)',
    minHeight: 60,
    outline: 'none',
    transition: 'all .2s',
    wordBreak:'break-all', lineHeight: 1.4,
  }),
  inputHint: {
    fontSize: 11.5, color:'var(--ink-faint)',
    marginTop: 8, display:'flex', alignItems:'center', gap: 6,
  },
  inputClear: {
    position:'absolute', right: 10, top: '50%', transform:'translateY(-50%)',
    width: 34, height: 34, borderRadius:'50%',
    background:'color-mix(in oklab, var(--danger) 14%, var(--surface))',
    border:'1.5px solid color-mix(in oklab, var(--danger) 45%, var(--line))',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--danger)',
    fontSize: 20, fontWeight: 700, lineHeight: 1,
    cursor:'pointer', padding: 0,
  },
  // Botão para descartar o link convertido e colar outro
  changeLinkBtn: {
    marginTop: 10, width:'100%',
    padding:'12px 14px', borderRadius: 12,
    background:'color-mix(in oklab, var(--danger) 8%, var(--surface))',
    border:'1px solid color-mix(in oklab, var(--danger) 35%, var(--line))',
    color:'var(--danger)',
    fontSize: 13, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
    display:'flex', alignItems:'center', justifyContent:'center', gap: 8,
  },

  // Quick examples (só no empty state)
  examples: { display:'flex', gap: 6, marginTop: 12, flexWrap:'wrap' },
  examChip: {
    padding:'7px 12px', borderRadius: 999,
    background:'var(--surface)', border:'1px solid var(--line)',
    fontSize: 11.5, color:'var(--ink)', fontWeight: 500,
    cursor:'pointer', fontFamily:'inherit',
  },

  // Bloco de resultado — só 1, não estrutura de wizard
  resultBlock: { padding:'18px 16px 0' },
  resultHead: { display:'flex', alignItems:'flex-start', gap: 10, marginBottom: 10 },
  resultBadge: (tone) => ({
    width: 22, height: 22, borderRadius:'50%',
    background: tone === 'warn' ? 'var(--warn)' : 'var(--success)',
    color:'white', display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0, marginTop: 1,
  }),
  resultText: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  resultSub: { fontSize: 12, color:'var(--ink-soft)', marginTop: 3, lineHeight: 1.45 },

  // Card de link convertido — clean, focado
  linkCard: (tone) => ({
    background: tone === 'warn'
      ? 'color-mix(in oklab, var(--warn) 10%, var(--surface))'
      : 'var(--surface)',
    border:'1px solid ' + (tone === 'warn'
      ? 'color-mix(in oklab, var(--warn) 28%, var(--line))'
      : 'var(--line)'),
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
    minWidth: 0,
  }),
  beforeLabel: { fontSize: 10.5, color:'var(--ink-faint)', marginBottom: 4 },
  beforeLink: {
    fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5,
    color:'var(--ink-faint)', textDecoration:'line-through',
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  afterArrow: {
    display:'flex', alignItems:'center', gap: 6,
    fontSize: 10.5, color:'var(--ink-soft)', textTransform:'uppercase',
    letterSpacing:'0.06em', fontWeight: 600,
    marginTop: 10, marginBottom: 6,
  },
  afterLink: {
    fontFamily:"'JetBrains Mono', monospace", fontSize: 13,
    color:'var(--ink)', fontWeight: 500,
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  copyBtn: {
    marginTop: 12, display:'flex', gap: 6,
  },
  flatBtn: (kind, full) => ({
    flex: full ? 1 : 'initial',
    padding:'10px 14px', borderRadius: 999,
    background: kind === 'primary' ? 'var(--ink)' : 'var(--surface)',
    color: kind === 'primary' ? 'white' : 'var(--ink)',
    border:'1px solid ' + (kind === 'primary' ? 'var(--ink)' : 'var(--line)'),
    fontSize: 12.5, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap: 6,
  }),

  // Card do produto detectado
  productCard: {
    margin:'12px 0 0',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 16, padding: 14,
    display:'flex', gap: 12,
  },
  productImg: {
    width: 64, height: 64, borderRadius: 10,
    background:'repeating-linear-gradient(135deg, var(--bg-soft) 0 6px, var(--surface) 6px 12px)',
    border:'1px solid var(--line)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--ink-faint)', fontSize: 9, letterSpacing:'0.06em',
    fontFamily:"'JetBrains Mono', monospace",
    flexShrink: 0,
  },
  productInfo: { flex: 1, minWidth: 0 },
  productTitle: { fontSize: 13, fontWeight: 500, color:'var(--ink)', lineHeight: 1.3 },
  productPrices: { display:'flex', gap: 8, alignItems:'baseline', marginTop: 6 },
  priceNow: { fontSize: 18, fontWeight: 600, color:'var(--ink)' },
  priceWas: { fontSize: 11.5, color:'var(--ink-faint)', textDecoration:'line-through' },
  pill: { fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 999, background:'color-mix(in oklab, var(--success) 18%, var(--surface))', color:'var(--success)', border:'1px solid var(--line)' },

  // CTA grande
  ctaWrap: { padding:'20px 16px 0' },
  cta: {
    width:'100%', padding:'16px 18px',
    background:'var(--ink)', color:'white',
    border:'none', borderRadius: 14,
    display:'flex', alignItems:'center', justifyContent:'center', gap: 10,
    fontSize: 14, fontWeight: 600,
    cursor:'pointer', fontFamily:'inherit',
  },
  ctaWarn: {
    background:'var(--surface)', color:'var(--ink)',
    border:'1px solid var(--line)',
  },
  ctaNote: { textAlign:'center', fontSize: 11.5, color:'var(--ink-soft)', marginTop: 10 },

  // Banner sem comissão (no expand)
  warnBanner: {
    margin:'16px 16px 0',
    padding:'10px 12px',
    background:'color-mix(in oklab, var(--warn) 12%, var(--surface))',
    border:'1px solid color-mix(in oklab, var(--warn) 30%, var(--line))',
    borderRadius: 10,
    fontSize: 11.5, color:'var(--ink)', lineHeight: 1.45,
    display:'flex', alignItems:'flex-start', gap: 8,
  },
  inlineWarn: {
    padding:'9px 11px',
    background:'color-mix(in oklab, var(--warn) 10%, var(--surface))',
    border:'1px solid color-mix(in oklab, var(--warn) 26%, var(--line))',
    borderRadius: 9,
    fontSize: 11.5, color:'var(--ink)', lineHeight: 1.45,
  },
  inlineInfo: {
    padding:'9px 11px',
    background:'var(--bg-soft)',
    border:'1px solid var(--line)',
    borderRadius: 9,
    fontSize: 11.5, color:'var(--ink-soft)', lineHeight: 1.45,
  },

  // Form manual
  manualCard: {
    margin:'12px 16px 0',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 16, padding: 14,
  },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom: 6 },
  fieldInput: {
    width:'100%', padding:'11px 12px', fontSize: 13.5,
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 10,
    fontFamily:'inherit', color:'var(--ink)', outline:'none',
  },

  // Sub-header de seção (oferta)
  sectionH: { padding:'24px 20px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color:'var(--ink)' },
  sectionHint: { padding:'0 20px', fontSize: 11.5, color:'var(--ink-soft)', marginBottom: 6, lineHeight: 1.4 },
  aiPill: {
    padding:'5px 10px', borderRadius: 999,
    background:'color-mix(in oklab, var(--accent-2) 60%, var(--surface))',
    border:'1px solid var(--line)', fontSize: 11, fontWeight: 600,
    color:'var(--ink)', cursor:'pointer', fontFamily:'inherit',
    display:'inline-flex', alignItems:'center', gap: 4,
  },

  // Templates — com PREVIEW, não só nome
  templateRow: { padding:'0 16px', display:'flex', gap: 8, overflowX:'auto', scrollbarWidth:'none', paddingBottom: 4 },
  templateCard: (sel) => ({
    flexShrink: 0, minWidth: 170,
    padding:'12px', borderRadius: 14,
    background: sel ? 'var(--ink)' : 'var(--surface)',
    border:'1.5px solid ' + (sel ? 'var(--ink)' : 'var(--line)'),
    color: sel ? 'white' : 'var(--ink)',
    cursor:'pointer', fontFamily:'inherit',
    textAlign:'left',
  }),
  templateName: { fontSize: 12.5, fontWeight: 600, marginBottom: 6 },
  templatePreview: (sel) => ({
    fontSize: 10.5, lineHeight: 1.45,
    color: sel ? 'rgba(255,255,255,0.7)' : 'var(--ink-soft)',
    whiteSpace:'pre-wrap',
    fontFamily: 'inherit',
  }),

  // Editor de mensagem
  editorWrap: { padding:'12px 16px 0' },
  editor: {
    width:'100%', padding:'14px',
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 14,
    fontSize: 13.5, color:'var(--ink)',
    fontFamily:'inherit', lineHeight: 1.5,
    minHeight: 150, resize:'none', outline:'none',
  },
  vars: { display:'flex', gap: 6, marginTop: 10, flexWrap:'wrap' },
  varChip: {
    fontSize: 11, fontFamily:"'JetBrains Mono', monospace",
    padding:'3px 7px', borderRadius: 5,
    background:'var(--bg-soft)', color:'var(--ink-soft)', border:'1px solid var(--line)',
  },

  // ─── Bônus na mensagem ───
  bonusCard: (on) => ({
    margin:'0 16px 10px',
    background: on ? 'var(--surface)' : 'var(--bg-soft)',
    border:'1px solid ' + (on ? 'color-mix(in oklab, var(--accent) 35%, var(--line))' : 'var(--line)'),
    borderRadius: 14,
    overflow:'hidden',
    transition:'all .2s',
  }),
  bonusHead: {
    display:'flex', alignItems:'center', gap: 12,
    padding:'14px 14px',
    cursor:'pointer',
  },
  bonusIcon: (on) => ({
    width: 32, height: 32, borderRadius: 9,
    background: on ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))' : 'var(--surface)',
    color: on ? 'var(--accent-strong)' : 'var(--ink-soft)',
    border:'1px solid ' + (on ? 'color-mix(in oklab, var(--accent) 30%, var(--line))' : 'var(--line)'),
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink: 0,
  }),
  bonusMain: { flex: 1, minWidth: 0 },
  bonusTitle: { fontSize: 13.5, fontWeight: 600, color:'var(--ink)' },
  bonusSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },
  bonusToggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? 'var(--accent-strong)' : 'var(--line-strong)',
    position:'relative', flexShrink: 0, cursor:'pointer',
    transition:'background .2s',
  }),
  bonusKnob: (on) => ({
    width: 16, height: 16, borderRadius:'50%', background:'white',
    position:'absolute', top: 2, left: on ? 18 : 2,
    boxShadow:'0 1px 2px rgba(0,0,0,0.15)',
    transition:'left .2s',
  }),

  bonusBody: {
    padding:'0 14px 14px',
    display:'flex', flexDirection:'column', gap: 12,
    borderTop:'1px solid var(--line)', paddingTop: 12,
  },

  // Pequenas linhas de input dentro do bônus
  bonusField: {},
  bonusLabel: {
    fontSize: 10.5, color:'var(--ink-soft)',
    textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600,
    marginBottom: 6,
  },
  bonusInput: {
    width:'100%', padding:'9px 11px', fontSize: 12.5,
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 9,
    fontFamily:"'JetBrains Mono', monospace",
    color:'var(--ink)', outline:'none',
  },
  bonusInputText: {
    width:'100%', padding:'9px 11px', fontSize: 12.5,
    background:'var(--bg-soft)', border:'1px solid var(--line)', borderRadius: 9,
    fontFamily:'inherit',
    color:'var(--ink)', outline:'none',
  },

  // Seleção de lojas para cupom
  storeChips: { display:'flex', gap: 6, flexWrap:'wrap' },
  storeChip: (sel) => ({
    padding:'7px 12px', borderRadius: 999,
    border:'1.5px solid ' + (sel ? 'var(--ink)' : 'var(--line)'),
    background: sel ? 'var(--ink)' : 'var(--surface)',
    color: sel ? 'white' : 'var(--ink)',
    fontSize: 12, fontWeight: 500, cursor:'pointer', fontFamily:'inherit',
    display:'inline-flex', alignItems:'center', gap: 5,
  }),

  // Linha por loja (URL do cupom da loja)
  storeRow: {
    display:'flex', alignItems:'center', gap: 10,
    paddingTop: 2,
  },
  storeBadge: (cor) => ({
    width: 28, height: 28, borderRadius: 7,
    background: cor, color:'white', flexShrink: 0,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight: 700, fontSize: 9.5,
  }),
  storeName: { fontSize: 12, color:'var(--ink-soft)', fontWeight: 500, flexShrink: 0, minWidth: 80 },

  // Preview do bônus aplicado
  bonusPreview: {
    padding:'10px 12px',
    background:'color-mix(in oklab, var(--success) 8%, var(--bg-soft))',
    border:'1px dashed color-mix(in oklab, var(--success) 30%, var(--line))',
    borderRadius: 9,
    fontSize: 11.5, lineHeight: 1.5,
    color:'var(--ink)',
    whiteSpace:'pre-wrap',
  },
  bonusPreviewLabel: {
    fontSize: 10, color:'var(--ink-soft)',
    textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600,
    marginBottom: 4, display:'flex', alignItems:'center', gap: 5,
  },

  // ─── Variante UNIFIED: tudo num card só com sub-seções ───
  unifiedCard: {
    margin:'0 16px',
    background:'var(--surface)', border:'1px solid var(--line)',
    borderRadius: 16, overflow:'hidden',
  },
  unifiedRow: (on, last) => ({
    padding:'14px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
    background: on ? 'transparent' : 'var(--bg-soft)',
  }),
  unifiedRowHead: { display:'flex', alignItems:'center', gap: 12, cursor:'pointer' },
  unifiedBody: { paddingTop: 12, display:'flex', flexDirection:'column', gap: 10 },

  // Link "abrir editor de modelos" inline
  editTemplateLink: {
    display:'inline-flex', alignItems:'center', gap: 5,
    fontSize: 11.5, fontWeight: 600,
    color:'var(--accent-strong)',
    background:'transparent', border:'none',
    padding:'4px 8px', borderRadius: 999,
    cursor:'pointer', fontFamily:'inherit',
  },

  // Destinos — checkbox style, não toggle
  destCard: { margin:'0 16px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 16, overflow:'hidden' },
  destRow: (sel, last) => ({
    display:'flex', alignItems:'center', gap: 12,
    padding:'13px 14px',
    borderBottom: last ? 'none' : '1px solid var(--line)',
    background: sel ? 'color-mix(in oklab, var(--accent) 8%, var(--surface))' : 'transparent',
    cursor:'pointer',
  }),
  destCheck: (sel) => ({
    width: 22, height: 22, borderRadius: 6,
    background: sel ? 'var(--accent-strong)' : 'var(--surface)',
    border:'1.5px solid ' + (sel ? 'var(--accent-strong)' : 'var(--line-strong)'),
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', flexShrink: 0,
  }),
  destAvatar: (g) => ({
    width: 32, height: 32, borderRadius:'50%',
    background: g,
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'white', fontWeight: 600, fontSize: 11, flexShrink: 0,
  }),
  destMain: { flex: 1, minWidth: 0 },
  destName: { fontSize: 13.5, fontWeight: 500, color:'var(--ink)' },
  destSub: { fontSize: 11.5, color:'var(--ink-soft)', marginTop: 2 },

  // CTA final do envio
  sendWrap: { padding:'20px 16px 24px' },
  sendRow: { display:'flex', gap: 8 },
  schedBtn: {
    flex: 1, padding:'14px',
    background:'var(--surface)', border:'1px solid var(--line)', borderRadius: 12,
    color:'var(--ink)', fontWeight: 600, fontSize: 13,
    display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
    cursor:'pointer', fontFamily:'inherit',
  },
  sendBtn: {
    flex: 2, padding:'14px',
    background:'var(--ink)', border:'none', borderRadius: 12,
    color:'white', fontWeight: 600, fontSize: 13,
    display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
    cursor:'pointer', fontFamily:'inherit',
  },
  sendNote: { textAlign:'center', fontSize: 11.5, color:'var(--ink-soft)', marginTop: 12 },
};

// Por-estado: tom, título, sub

const STATE_CFG = {
  converted: {
    tone:'ok',
    title:'Convertido pra sua afiliada',
    sub:'Trocamos o link original pelo seu de afiliada. A comissão vem pra você.',
    showBefore: true, showAfter: true,
  },
  updated: {
    tone:'ok',
    title:'Afiliada trocada pela sua',
    sub:'O link já era de afiliada. Substituímos pelo seu ID — se já era o seu, fica funcionalmente igual.',
    showBefore: true, showAfter: true,
  },
  noConverter: {
    tone:'warn',
    title:'Loja sem conversor',
    sub:'Ainda não temos integração de afiliados pra essa loja. Você pode gerar a oferta, mas o link não terá sua comissão.',
    showSingle: true,
  },
  scrapeFail: {
    tone:'ok',
    title:'Link pronto · produto manual',
    sub:'Conversão ok. Só não consegui ler o produto na página — preenche aí em baixo.',
    showBefore: true, showAfter: true,
  },
};

export default function OfferPage() {
  useMobileRoutePerf('m/op/offer')
  const router = useRouter()
  const [input, setInput] = useState('')
  const [state, setState] = useState('empty')
  const [expand, setExpand] = useState(false)
  const [converting, setConverting] = useState(false)
  const [sending, setSending] = useState(false)
  const [productData, setProductData] = useState(null)
  const [manualProduct, setManualProduct] = useState({ title: '', price: '', oldPrice: '' })
  const [convertedLink, setConvertedLink] = useState('')
  const [pasteFeedback, setPasteFeedback] = useState('')
  const inputRef = useRef(null)
  const [selectedTemplate, setSelectedTemplate] = useState('simples')
  const [allTemplates, setAllTemplates] = useState(TEMPLATE_OPTIONS)
  const [bonuses, setBonuses] = useState('')
  const [groupBonus, setGroupBonus] = useState({ link: '', cta: '💜 Entra no nosso grupo:' })
  const [couponCta, setCouponCta] = useState('🎟 Mais cupons da {loja}:')
  const [couponLinks, setCouponLinks] = useState(DEFAULT_COUPON_LINKS)
  const [selectedCouponStores] = useState(COUPON_STORES.map((store) => store.key))
  const [baseOfferText, setBaseOfferText] = useState('')
  const [editorText, setEditorText] = useState('')
  const [editorDirty, setEditorDirty] = useState(false)
  const [bonusRegenerateNotice, setBonusRegenerateNotice] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedDestinations, setSelectedDestinations] = useState([])
  const [sendFeedback, setSendFeedback] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const timer = window.setTimeout(() => {
      const urlFromQuery = new URLSearchParams(window.location.search).get('url')?.trim()
      if (urlFromQuery) setInput((current) => current || urlFromQuery)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    let active = true
    api.groups()
      .then((list) => {
        if (!active) return
        const destinations = Array.isArray(list) ? list.filter((group) => group.role === 'post' && group.active !== false) : []
        setGroups(destinations)
        setSelectedDestinations(destinations.slice(0, 1).map((group) => group.waJid || group.jid || group.id).filter(Boolean))
      })
      .catch(() => {
        if (active) setGroups([])
      })
    return () => { active = false }
  }, [])



  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCouponLinks(readStoredCouponLinks())
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAllTemplates(loadAllTemplates())
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function resetInput() {
    setInput('')
    setState('empty')
    setProductData(null)
    setConvertedLink('')
    setExpand(false)
    setPasteFeedback('')
    setGeneratedOfferText('')
  }

  const handleInputPaste = (e) => {
    const text = e.clipboardData?.getData('text')?.trim()
    if (!text) return
    e.preventDefault()
    setInput(text)
    setPasteFeedback('Link colado.')
  }

  function buildOfferText(
    nextProduct = productData,
    link = convertedLink || input,
    template = selectedTemplate,
    bonusMode = bonuses,
    overrides = {},
  ) {
    const offerStoreKey = overrides.offerStoreKey ?? detectMobileOfferStoreKey({ product: nextProduct || {}, link: input || link })
    const tpl = allTemplates.find((t) => t.key === template)
    return buildMobileOfferText({
      product: nextProduct || {},
      manualProduct,
      link,
      template,
      templateBody: tpl?.body || null,
      bonusMode,
      groupBonus: overrides.groupBonus || groupBonus,
      couponLinks: overrides.couponLinks || couponLinks,
      selectedCouponStores,
      couponCta: overrides.couponCta || couponCta,
      offerStoreKey,
    })
  }

  function setGeneratedOfferText(text) {
    setBaseOfferText(text)
    setEditorText(text)
    setEditorDirty(false)
    setBonusRegenerateNotice('')
  }

  function refreshEditorWithBonuses(nextBonusMode = bonuses, overrides = {}) {
    const nextText = buildOfferText(productData, convertedLink || input, selectedTemplate, nextBonusMode, overrides)
    setBaseOfferText(nextText)
    if (editorDirty) {
      setBonusRegenerateNotice('Atualizar bônus vai regenerar a mensagem.')
      return
    }
    setEditorText(nextText)
    setBonusRegenerateNotice('')
  }

  function applyRegeneratedMessage() {
    setEditorText(baseOfferText)
    setEditorDirty(false)
    setBonusRegenerateNotice('')
  }

  const handleConvert = async () => {
    if (!input.trim()) return
    const singleLinkWarning = getMobileOfferSingleLinkWarning(input)
    if (singleLinkWarning) {
      setPasteFeedback(singleLinkWarning)
      return
    }
    setConverting(true)
    setSendFeedback('')
    try {
      const convResult = await api.convertLinks(input)
      const converted = convResult?.results?.[0]?.convertedUrl || input
      setConvertedLink(converted)

      let scraped = null
      try {
        scraped = await api.scrapeOffer(input)
        setProductData(scraped)
        setManualProduct({ title: scraped?.title || '', price: scraped?.price || scraped?.newPrice || scraped?.priceNow || '', oldPrice: scraped?.oldPrice || scraped?.priceWas || '' })
        setState(scraped?.title ? 'converted' : 'scrapeFail')
      } catch {
        setProductData(null)
        setState('scrapeFail')
      }
      setGeneratedOfferText(buildOfferText(scraped, converted))
    } catch (e) {
      console.error('Conversion failed:', e)
      setConvertedLink(input)
      setState('noConverter')
      setGeneratedOfferText(buildOfferText(null, input))
    } finally {
      setConverting(false)
    }
  }

  function updateTemplate(template) {
    setSelectedTemplate(template)
    setGeneratedOfferText(buildOfferText(productData, convertedLink || input, template, bonuses))
  }

  function updateManualProduct(field, value) {
    const next = { ...manualProduct, [field]: value }
    setManualProduct(next)
    setGeneratedOfferText(buildOfferText({ title: next.title, price: next.price, oldPrice: next.oldPrice }, convertedLink || input))
  }

  function toggleDestination(jid) {
    setSelectedDestinations((current) => current.includes(jid) ? current.filter((item) => item !== jid) : [...current, jid])
  }

  async function sendNow() {
    if (!editorText.trim() || selectedDestinations.length === 0) return
    setSending(true)
    setSendFeedback('')
    try {
      await api.broadcastSend(editorText, selectedDestinations)
      setSendFeedback('Oferta enviada para os destinos selecionados.')
    } catch (error) {
      setSendFeedback(error.message || 'Não foi possível enviar a oferta.')
    } finally {
      setSending(false)
    }
  }

  const isEmpty = state === 'empty'
  const cfg = STATE_CFG[state]
  const productDetected = state === 'converted'
  const isNoConv = state === 'noConverter'
  const isFail = state === 'scrapeFail'
  const linkOriginal = input
  const linkAfiliada = convertedLink || input
  const selectedNames = groups
    .filter((group) => selectedDestinations.includes(group.waJid || group.jid || group.id))
    .map((group) => group.name || group.subject || group.waJid || group.jid)
  const singleLinkWarning = getMobileOfferSingleLinkWarning(input)
  const currentOfferStoreKey = useMemo(() => detectMobileOfferStoreKey({ product: productData || {}, link: input || convertedLink }), [productData, input, convertedLink])
  const currentOfferStore = COUPON_STORES.find((store) => store.key === currentOfferStoreKey)

  return (
    <MobileShell title="Conversor" active="criar">
      <div style={criarStyles.pageH}>
        <div style={criarStyles.pageEyebrow}>Oferta manual</div>
        <div style={criarStyles.pageTitle}>Cole um link, posta oferta.</div>
        <div style={criarStyles.pageSub}>A gente converte pro seu link de afiliada e monta a mensagem com destinos reais do backoffice.</div>
      </div>

      <div style={criarStyles.inputBlock}>
        <div style={criarStyles.inputLabel}>Link do produto · apenas 1 por oferta</div>
        <div style={criarStyles.inputRow}>
          <div style={criarStyles.inputFieldWrap}>
            {isEmpty ? (
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); setPasteFeedback('') }}
                onPaste={handleInputPaste}
                style={{...criarStyles.inputField(false), minHeight: 60, resize: 'none'}}
                placeholder="https://..."
                autoFocus={false}
              />
            ) : (
              <>
                <div style={{...criarStyles.inputField(true), minHeight: 60, height: 60, paddingRight: 56, display:'flex', alignItems:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', wordBreak:'normal'}}>{linkOriginal}</div>
                <button type="button" onClick={resetInput} style={criarStyles.inputClear} aria-label="Apagar link">
                  ×
                </button>
              </>
            )}
          </div>
        </div>
        {!isEmpty && (
          <button type="button" onClick={resetInput} style={criarStyles.changeLinkBtn}>
            <MobileIcon name="arrow" size={14}/> Trocar link
          </button>
        )}
        {isEmpty && <div style={{...criarStyles.inputHint, color: singleLinkWarning ? 'var(--danger)' : 'var(--ink-faint)'}}>{singleLinkWarning || pasteFeedback || 'Cole apenas um link de produto por oferta. Para vários links, use o Conversor.'}</div>}
      </div>

      {isEmpty && input.trim() && !converting && (
        <div style={criarStyles.ctaWrap}>
          <button type="button" onClick={handleConvert} disabled={Boolean(singleLinkWarning)} style={{...criarStyles.cta, opacity: singleLinkWarning ? 0.6 : 1, cursor: singleLinkWarning ? 'not-allowed' : 'pointer'}}>
            <MobileIcon name="sparkles" size={15}/> Converter <MobileIcon name="arrow" size={14}/>
          </button>
        </div>
      )}

      {converting && <div style={criarStyles.ctaWrap}><div style={{...criarStyles.cta, opacity: 0.6, cursor: 'not-allowed', justifyContent: 'center'}}><MobileLoadingCard label="Convertendo..." /></div></div>}

      {!isEmpty && (
        <div style={criarStyles.resultBlock}>
          <div style={criarStyles.resultHead}>
            <div style={criarStyles.resultBadge(cfg.tone)}>{cfg.tone === 'warn' ? '!' : <MobileIcon name="check" size={12} stroke={3}/>}</div>
            <div style={criarStyles.resultText}>
              <div style={criarStyles.resultTitle}>{cfg.title}</div>
              <div style={criarStyles.resultSub}>{cfg.sub}</div>
            </div>
          </div>
          <div style={criarStyles.linkCard(cfg.tone)}>
            <div style={criarStyles.beforeLabel}>link original</div>
            <div style={criarStyles.beforeLink}>{linkOriginal}</div>
            <div style={criarStyles.afterArrow}>seu link de afiliada</div>
            <div style={criarStyles.afterLink}>{linkAfiliada}</div>
          </div>
          {productDetected && (
            <div style={criarStyles.productCard}>
              <div style={criarStyles.productImg}>{productData?.imageUrl ? 'IMG' : '—'}</div>
              <div style={criarStyles.productInfo}>
                <div style={criarStyles.productTitle}>{productData?.title}</div>
                {(productData?.price || productData?.newPrice || productData?.priceNow || productData?.oldPrice) && (
                  <div style={criarStyles.productPrices}>
                    {(productData?.price || productData?.newPrice || productData?.priceNow) && <span style={criarStyles.priceNow}>{productData.price || productData.newPrice || productData.priceNow}</span>}
                    {productData?.oldPrice && <span style={criarStyles.priceWas}>{productData.oldPrice}</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(isFail || isNoConv) && (
        <div style={criarStyles.manualCard}>
          <div style={criarStyles.fieldRow}>
            <div style={criarStyles.fieldLabel}>Título do produto</div>
            <input style={criarStyles.fieldInput} value={manualProduct.title} onChange={(event) => updateManualProduct('title', event.target.value)} placeholder="Nome do produto" />
          </div>
          <div style={{display:'flex', gap: 10}}>
            <div style={{...criarStyles.fieldRow, flex: 1, marginBottom: 0}}>
              <div style={criarStyles.fieldLabel}>Preço por</div>
              <input style={criarStyles.fieldInput} value={manualProduct.price} onChange={(event) => updateManualProduct('price', event.target.value)} placeholder="R$ 0,00" />
            </div>
            <div style={{...criarStyles.fieldRow, flex: 1, marginBottom: 0}}>
              <div style={criarStyles.fieldLabel}>De (opcional)</div>
              <input style={criarStyles.fieldInput} value={manualProduct.oldPrice} onChange={(event) => updateManualProduct('oldPrice', event.target.value)} placeholder="R$ 0,00" />
            </div>
          </div>
        </div>
      )}

      {!isEmpty && !expand && (
        <div style={criarStyles.ctaWrap}>
          <button type="button" onClick={() => setExpand(true)} style={{...criarStyles.cta, ...(isNoConv ? criarStyles.ctaWarn : {})}}>
            <MobileIcon name="sparkles" size={15}/> Montar oferta <MobileIcon name="arrow" size={14}/>
          </button>
          <div style={criarStyles.ctaNote}>{isNoConv ? 'a oferta vai sair sem afiliada se o link não converter' : 'ou só copie o link convertido acima'}</div>
        </div>
      )}

      {!isEmpty && expand && (
        <>
          <div style={criarStyles.sectionH}>
            <div style={criarStyles.sectionTitle}>Escolha um modelo</div>
            <button type="button" onClick={() => router.push(mobileRoutes.accountTemplates)} style={criarStyles.editTemplateLink}>Editar</button>
          </div>
          <div style={criarStyles.templateRow}>
            {allTemplates.map((template) => (
              <button key={template.key} type="button" onClick={() => updateTemplate(template.key)} style={criarStyles.templateCard(selectedTemplate === template.key)}>
                <div style={criarStyles.templateName}>{template.name}</div>
                <div style={criarStyles.templatePreview(selectedTemplate === template.key)}>{(template.body || template.preview || '').split('\n').slice(0, 4).join('\n')}</div>
              </button>
            ))}
          </div>

          <div style={criarStyles.editorWrap}>
            <textarea style={criarStyles.editor} value={editorText} onChange={(event) => { setEditorText(event.target.value); setEditorDirty(event.target.value !== baseOfferText) }} />
              {editorDirty && <div style={{...criarStyles.inlineInfo, marginTop: 8}}>Você editou a mensagem manualmente. Atualizar bônus vai regenerar a mensagem.</div>}
          </div>

          <div style={criarStyles.sectionH}>
            <div style={criarStyles.sectionTitle}>Adicionar à mensagem</div>
          </div>
          <div style={criarStyles.sectionHint}>
            Configure links extras do modelo sem sair da oferta. Atualizar bônus vai regenerar a mensagem.
          </div>
          {bonusRegenerateNotice && (
            <div style={{margin:'0 16px 10px', display:'grid', gap: 8}}>
              <div style={criarStyles.inlineWarn}>{bonusRegenerateNotice}</div>
              <button type="button" onClick={applyRegeneratedMessage} style={criarStyles.flatBtn('primary', true)}>Atualizar mensagem com bônus</button>
            </div>
          )}

          {(() => {
            const groupOn = bonuses === 'group' || bonuses === 'both'
            const couponsOn = bonuses === 'coupons' || bonuses === 'both'
            const toggleGroup = () => {
              const next = groupOn ? (bonuses === 'both' ? 'coupons' : '') : (couponsOn ? 'both' : 'group')
              setBonuses(next)
              refreshEditorWithBonuses(next)
            }
            const toggleCoupons = () => {
              const next = couponsOn ? (bonuses === 'both' ? 'group' : '') : (groupOn ? 'both' : 'coupons')
              setBonuses(next)
              refreshEditorWithBonuses(next)
            }
            const updateGroupBonus = (field, value) => {
              const nextGroupBonus = { ...groupBonus, [field]: value }
              setGroupBonus(nextGroupBonus)
              refreshEditorWithBonuses(bonuses, { groupBonus: nextGroupBonus })
            }
            const updateCouponLink = (storeKey, value) => {
              const nextCouponLinks = { ...couponLinks, [storeKey]: value }
              setCouponLinks(nextCouponLinks)
              saveStoredCouponLinks(nextCouponLinks)
              refreshEditorWithBonuses(bonuses, { couponLinks: nextCouponLinks })
            }
            const updateCouponCta = (value) => {
              setCouponCta(value)
              refreshEditorWithBonuses(bonuses, { couponCta: value })
            }
            const groupLinkInvalid = groupBonus.link.trim() && !isValidHttpUrl(groupBonus.link)
            const groupPreview = groupLinkInvalid
              ? 'Link inválido. Use uma URL começando com http:// ou https://.'
              : groupBonus.link.trim()
                ? `${groupBonus.cta.trim() || 'Entre no nosso grupo:'}
${groupBonus.link.trim()}`
                : 'Preencha o link do grupo para ele aparecer na mensagem.'
            const currentCouponLink = currentOfferStoreKey ? String(couponLinks[currentOfferStoreKey] || '').trim() : ''
            const currentCouponInvalid = currentCouponLink && !isValidHttpUrl(currentCouponLink)
            const couponPreview = !currentOfferStore
              ? 'Não detectei a loja desta oferta. O cupom não será adicionado automaticamente.'
              : currentCouponInvalid
                ? `O link de cupom da ${currentOfferStore.nome} não é uma URL válida. Use http:// ou https://.`
                : currentCouponLink
                  ? `${(couponCta.trim() || 'Mais cupons da {loja}:').replace('{loja}', currentOfferStore.nome)}
${currentCouponLink}`
                  : `Preencha o link de cupom da ${currentOfferStore.nome}. Só esse link será usado nesta oferta.`

            const groupHead = (on) => (
              <button type="button" style={{...criarStyles.unifiedRowHead, width:'100%', border:'none', background:'transparent', padding:0, textAlign:'left', fontFamily:'inherit'}} onClick={toggleGroup} aria-pressed={on}>
                <div style={criarStyles.bonusIcon(on)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div style={criarStyles.bonusMain}>
                  <div style={criarStyles.bonusTitle}>Link do seu grupo</div>
                  <div style={criarStyles.bonusSub}>{on ? 'aparece no fim da mensagem quando houver link' : 'convida pra entrar no seu grupo principal'}</div>
                </div>
                <div style={criarStyles.bonusToggle(on)}><div style={criarStyles.bonusKnob(on)}/></div>
              </button>
            )
            const couponsHead = (on) => (
              <button type="button" style={{...criarStyles.unifiedRowHead, width:'100%', border:'none', background:'transparent', padding:0, textAlign:'left', fontFamily:'inherit'}} onClick={toggleCoupons} aria-pressed={on}>
                <div style={criarStyles.bonusIcon(on)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 12V8H4v8h16v-4z"/><path d="M9 8v8M15 8v8"/>
                  </svg>
                </div>
                <div style={criarStyles.bonusMain}>
                  <div style={criarStyles.bonusTitle}>Página de cupons da loja</div>
                  <div style={criarStyles.bonusSub}>{on ? 'usa somente o cupom da loja desta oferta' : 'links ficam salvos neste navegador e editáveis'}</div>
                </div>
                <div style={criarStyles.bonusToggle(on)}><div style={criarStyles.bonusKnob(on)}/></div>
              </button>
            )

            return (
              <div style={{...criarStyles.unifiedCard, marginTop: 4}}>
                <div style={criarStyles.unifiedRow(groupOn, false)}>
                  {groupHead(groupOn)}
                  {groupOn && (
                    <div style={criarStyles.unifiedBody}>
                      <label style={criarStyles.bonusField}>
                        <div style={criarStyles.bonusLabel}>Link de convite</div>
                        <input style={criarStyles.bonusInput} value={groupBonus.link} onChange={(event) => updateGroupBonus('link', event.target.value)} placeholder="https://chat.whatsapp.com/..." />
                        {groupLinkInvalid && <div style={{...criarStyles.inlineWarn, marginTop: 6}}>Use uma URL começando com http:// ou https://.</div>}
                      </label>
                      <label style={criarStyles.bonusField}>
                        <div style={criarStyles.bonusLabel}>Chamada (CTA)</div>
                        <input style={criarStyles.bonusInputText} value={groupBonus.cta} onChange={(event) => updateGroupBonus('cta', event.target.value)} />
                      </label>
                      <div>
                        <div style={criarStyles.bonusPreviewLabel}><MobileIcon name="check" size={10} stroke={3}/>como vai aparecer</div>
                        <div style={criarStyles.bonusPreview}>{groupPreview}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={criarStyles.unifiedRow(couponsOn, true)}>
                  {couponsHead(couponsOn)}
                  {couponsOn && (
                    <div style={criarStyles.unifiedBody}>
                      <div style={criarStyles.inlineInfo}>
                        {currentOfferStore ? `Nesta oferta será usado apenas o link de cupom da ${currentOfferStore.nome}. Os links preenchidos ficam memorizados neste navegador para as próximas ofertas e continuam editáveis abaixo.` : 'Preencha os links de cupom por loja. Quando a loja da oferta for detectada, usamos apenas o link correspondente.'}
                      </div>
                      {COUPON_STORES.filter((store) => selectedCouponStores.includes(store.key)).map((store) => (
                        <label key={store.key} style={criarStyles.bonusField}>
                          <div style={criarStyles.storeRow}>
                            <div style={criarStyles.storeBadge(store.cor)}>{store.nome.slice(0,2).toUpperCase()}</div>
                            <span style={criarStyles.storeName}>Link {store.nome}</span>
                          </div>
                          <input style={{...criarStyles.bonusInput, marginTop: 6}} value={couponLinks[store.key] || ''} onChange={(event) => updateCouponLink(store.key, event.target.value)} placeholder="https://..." />
                          {couponLinks[store.key]?.trim() && !isValidHttpUrl(couponLinks[store.key]) && <div style={{...criarStyles.inlineWarn, marginTop: 6}}>Este link não é uma URL válida. Use http:// ou https://.</div>}
                        </label>
                      ))}
                      <label style={criarStyles.bonusField}>
                        <div style={criarStyles.bonusLabel}>Chamada (CTA) · use {'{loja}'} pro nome</div>
                        <input style={criarStyles.bonusInputText} value={couponCta} onChange={(event) => updateCouponCta(event.target.value)} />
                      </label>
                      <div>
                        <div style={criarStyles.bonusPreviewLabel}><MobileIcon name="check" size={10} stroke={3}/>nesta oferta</div>
                        <div style={criarStyles.bonusPreview}>{couponPreview}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          <div style={criarStyles.sectionH}>
            <div style={criarStyles.sectionTitle}>Postar em</div>
            <span style={{fontSize: 11, color:'var(--ink-soft)', fontWeight: 600}}>{selectedDestinations.length} selecionado(s)</span>
          </div>
          <div style={criarStyles.destCard}>
            {groups.length === 0 ? (
              <div style={{padding: 16, fontSize: 12, color:'var(--ink-soft)'}}>Nenhum destino ativo configurado em Grupos e canais.</div>
            ) : groups.map((group, index) => {
              const jid = group.waJid || group.jid || group.id
              const selected = selectedDestinations.includes(jid)
              const name = group.name || group.subject || jid
              return (
                <button key={jid} type="button" onClick={() => toggleDestination(jid)} style={{...criarStyles.destRow(selected, index === groups.length - 1), width:'100%', border:'none', background:'transparent', textAlign:'left'}}>
                  <div style={criarStyles.destCheck(selected)}>{selected && <MobileIcon name="check" size={11} stroke={3}/>}</div>
                  <div style={criarStyles.destAvatar('linear-gradient(135deg, var(--accent), var(--accent-2))')}>{name.split(' ').slice(0,2).map(w=>w[0]).join('').replace(/[^A-Za-zÀ-ÿ]/g,'').toUpperCase().slice(0,2) || 'WA'}</div>
                  <div style={criarStyles.destMain}>
                    <div style={criarStyles.destName}>{name}</div>
                    <div style={criarStyles.destSub}>{group.kind === 'channel' ? 'canal' : 'grupo'}</div>
                  </div>
                </button>
              )
            })}
          </div>

          <div style={criarStyles.sendWrap}>
            <div style={criarStyles.sendRow}>
              <button type="button" disabled style={{...criarStyles.schedBtn, opacity: 0.55}}>Agendar em breve</button>
              <button type="button" onClick={sendNow} disabled={sending || selectedDestinations.length === 0 || !editorText.trim()} style={{...criarStyles.sendBtn, opacity: sending || selectedDestinations.length === 0 || !editorText.trim() ? 0.6 : 1}}>
                {sending ? 'Enviando...' : 'Enviar agora'} <MobileIcon name="arrow" size={14}/>
              </button>
            </div>
            <div style={criarStyles.sendNote}>{selectedNames.length ? `Vai para ${selectedNames.join(', ')}` : 'Selecione pelo menos um destino real.'}</div>
            {sendFeedback && <div style={{fontSize: 12, color: sendFeedback.includes('Não') ? 'var(--danger)' : 'var(--success)', marginTop: 8}}>{sendFeedback}</div>}
          </div>
        </>
      )}

      <div style={{height: 20}}/>
    </MobileShell>
  )
}
