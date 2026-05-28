'use client'

import { useState, useEffect } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard } from '@/components/mobile/MobileAsyncState'
import { mobi } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

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
  pasteBtn: {
    width: 76, minHeight: 60, padding:'0 12px',
    borderRadius: 14, border:'1.5px solid var(--ink)',
    background:'var(--ink)', color:'white',
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap: 6,
    fontSize: 12.5, fontWeight: 700, fontFamily:'inherit',
    cursor:'pointer', boxShadow:'0 10px 22px rgba(15, 23, 42, 0.12)',
    flexShrink: 0,
  },
  inputHint: {
    fontSize: 11.5, color:'var(--ink-faint)',
    marginTop: 8, display:'flex', alignItems:'center', gap: 6,
  },
  inputClear: {
    position:'absolute', right: 12, top: 12,
    width: 24, height: 24, borderRadius:'50%',
    background:'var(--bg-soft)', border:'1px solid var(--line)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--ink-soft)',
    cursor:'pointer',
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
  }),
  beforeLabel: { fontSize: 10.5, color:'var(--ink-faint)', marginBottom: 4 },
  beforeLink: {
    fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5,
    color:'var(--ink-faint)', textDecoration:'line-through',
    wordBreak:'break-all', lineHeight: 1.45,
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
    wordBreak:'break-all', lineHeight: 1.45,
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
  const [input, setInput] = useState('')
  const [state, setState] = useState('empty')
  const [expand, setExpand] = useState(false)
  const [converting, setConverting] = useState(false)
  const [productData, setProductData] = useState(null)
  const [convertedLink, setConvertedLink] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('achadinho')
  const [bonuses, setBonuses] = useState('both')
  const bonusLayout = 'unified'

  const handlePasteFromClipboard = async () => {
    setPasteFeedback('')

    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      setPasteFeedback('Não consegui acessar a área de transferência neste navegador. Toque no campo e use Colar.')
      return
    }

    try {
      const clipboardText = await navigator.clipboard.readText()
      const nextInput = clipboardText.trim()

      if (!nextInput) {
        setPasteFeedback('Sua área de transferência está vazia.')
        return
      }

      setInput(nextInput)
      setPasteFeedback('Link colado.')
    } catch (error) {
      console.warn('Clipboard paste failed:', error)
      setPasteFeedback('Permita o acesso à área de transferência ou toque no campo e use Colar.')
    }
  }

  const handleConvert = async () => {
    if (!input.trim()) return
    setConverting(true)
    try {
      const convResult = await api.convertLinks(input)
      const converted = convResult?.results?.[0]?.convertedUrl || input
      setConvertedLink(converted)

      try {
        const scrapeResult = await api.scrapeOffer(input)
        setProductData(scrapeResult)
        setState(scrapeResult?.title ? 'converted' : 'scrapeFail')
      } catch {
        setState('converted')
      }
    } catch (e) {
      console.error('Conversion failed:', e)
      setState('noConverter')
    } finally {
      setConverting(false)
    }
  }

  const isEmpty = state === 'empty';
  const cfg = STATE_CFG[state];
  const productDetected = state === 'converted' || state === 'updated';
  const isNoConv = state === 'noConverter';
  const isFail = state === 'scrapeFail';

  const linkOriginal = input || 'shopee.com.br/sandalia-bege-verao-i.4738291.928374'
  const linkAfiliada = convertedLink || input || 's.shopee.com.br/3As9XkLp2'

  return (
    <MobileShell title="Conversor" active="criar">
      {/* Header — limpo, sem italianização */}
      <div style={criarStyles.pageH}>
        <div style={criarStyles.pageEyebrow}>Grátis · sem limite</div>
        <div style={criarStyles.pageTitle}>Cole um link, posta oferta.</div>
        <div style={criarStyles.pageSub}>
          A gente converte pro seu link de afiliada e gera a mensagem pronta.
        </div>
      </div>

      {/* INPUT — sempre o protagonista */}
      <div style={criarStyles.inputBlock}>
        <div style={criarStyles.inputLabel}>Link do produto</div>
        <div style={criarStyles.inputRow}>
          <div style={criarStyles.inputFieldWrap}>
            {isEmpty ? (
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setPasteFeedback('')
                }}
                style={{...criarStyles.inputField(false), minHeight: 60, resize: 'none'}}
                placeholder="https://..."
                autoFocus={false}
              />
            ) : (
              <>
                <div style={criarStyles.inputField(true)}>{linkOriginal}</div>
                <div
                  onClick={() => { setInput(''); setState('empty'); setProductData(null); setPasteFeedback('') }}
                  style={criarStyles.inputClear}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
                  </svg>
                </div>
              </>
            )}
          </div>
          {isEmpty && (
            <button type="button" onClick={handlePasteFromClipboard} style={criarStyles.pasteBtn}>
              Colar
            </button>
          )}
        </div>

        {isEmpty && (
          <div style={criarStyles.inputHint}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5"/>
            </svg>
            {pasteFeedback || 'Toque em Colar para preencher com o link copiado.'}
          </div>
        )}
      </div>

      {/* RESULTADO — só quando há link */}
      {!isEmpty && (
        <div style={criarStyles.resultBlock}>
          <div style={criarStyles.resultHead}>
            <div style={criarStyles.resultBadge(cfg.tone)}>
              {cfg.tone === 'warn' ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r=".5"/>
                </svg>
              ) : <MobileIcon name="check" size={12} stroke={3}/>}
            </div>
            <div style={criarStyles.resultText}>
              <div style={criarStyles.resultTitle}>{cfg.title}</div>
              <div style={criarStyles.resultSub}>{cfg.sub}</div>
            </div>
          </div>

          <div style={criarStyles.linkCard(cfg.tone)}>
            {cfg.showSingle ? (
              <>
                <div style={criarStyles.beforeLabel}>seu link</div>
                <div style={{...criarStyles.afterLink, fontWeight: 400}}>{linkOriginal}</div>
              </>
            ) : (
              <>
                <div style={criarStyles.beforeLabel}>
                  {state === 'updated' ? 'link com afiliada antiga' : 'link original'}
                </div>
                <div style={criarStyles.beforeLink}>{linkOriginal}</div>
                <div style={criarStyles.afterArrow}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  seu link de afiliada
                </div>
                <div style={criarStyles.afterLink}>{linkAfiliada}</div>
              </>
            )}

            <div style={criarStyles.copyBtn}>
              <button style={criarStyles.flatBtn('ghost', true)}>
                <MobileIcon name="link" size={12}/> Copiar
              </button>
              <button style={criarStyles.flatBtn('ghost', true)}>
                Compartilhar
              </button>
            </div>
          </div>

          {productDetected && (
            <div style={criarStyles.productCard}>
              <div style={criarStyles.productImg}>IMG</div>
              <div style={criarStyles.productInfo}>
                <div style={criarStyles.productTitle}>Sandália Bege Verão 2026 — Conforto Anatômico</div>
                <div style={criarStyles.productPrices}>
                  <span style={criarStyles.priceNow}>R$ 39,90</span>
                  <span style={criarStyles.priceWas}>R$ 79,90</span>
                  <span style={criarStyles.pill}>−50%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Form manual — scrape fail OU noConverter */}
      {(isFail || isNoConv) && (
        <div style={criarStyles.manualCard}>
          <div style={criarStyles.fieldRow}>
            <div style={criarStyles.fieldLabel}>Título do produto</div>
            <input style={criarStyles.fieldInput} defaultValue={isNoConv ? 'Cafeteira Elétrica 3 em 1' : ''} placeholder="ex: Sandália Bege Verão"/>
          </div>
          <div style={{display:'flex', gap: 10}}>
            <div style={{...criarStyles.fieldRow, flex: 1, marginBottom: 0}}>
              <div style={criarStyles.fieldLabel}>Preço por</div>
              <input style={criarStyles.fieldInput} defaultValue={isNoConv ? 'R$ 189,00' : ''} placeholder="R$ 39,90"/>
            </div>
            <div style={{...criarStyles.fieldRow, flex: 1, marginBottom: 0}}>
              <div style={criarStyles.fieldLabel}>De (opcional)</div>
              <input style={criarStyles.fieldInput} defaultValue={isNoConv ? 'R$ 279,00' : ''} placeholder="R$ 79,90"/>
            </div>
          </div>
        </div>
      )}

      {/* CTA pra ir pro próximo passo (montar oferta) */}
      {isEmpty && input.trim() && !converting && (
        <div style={criarStyles.ctaWrap}>
          <button onClick={handleConvert} style={criarStyles.cta}>
            <MobileIcon name="sparkles" size={15}/>
            Converter
            <MobileIcon name="arrow" size={14}/>
          </button>
        </div>
      )}

      {converting && (
        <div style={criarStyles.ctaWrap}>
          <div style={{...criarStyles.cta, opacity: 0.6, cursor: 'not-allowed', justifyContent: 'center'}}>
            <MobileLoadingCard label="Convertendo..." />
          </div>
        </div>
      )}

      {!isEmpty && !expand && (
        <div style={criarStyles.ctaWrap}>
          <button onClick={() => setExpand(true)} style={{...criarStyles.cta, ...(isNoConv ? criarStyles.ctaWarn : {})}}>
            <MobileIcon name="sparkles" size={15}/>
            Montar oferta
            <MobileIcon name="arrow" size={14}/>
          </button>
          <div style={criarStyles.ctaNote}>
            {isNoConv
              ? 'a oferta vai sair sem afiliada'
              : 'ou só copia o link aí em cima ↑'}
          </div>
        </div>
      )}

      {/* OFERTA EXPANDIDA — template + editor + destinos + enviar */}
      {!isEmpty && expand && (
        <>
          {isNoConv && (
            <div style={criarStyles.warnBanner}>
              <span style={{color:'var(--warn)', flexShrink:0, marginTop: 1}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r=".5"/></svg>
              </span>
              <span><strong style={{color:'var(--warn)'}}>Sem comissão:</strong> essa oferta vai com o link direto da loja.</span>
            </div>
          )}

          <div style={criarStyles.sectionH}>
            <div style={criarStyles.sectionTitle}>Escolha um modelo</div>
            <div style={{display:'flex', alignItems:'center', gap: 4}}>
              <button style={criarStyles.editTemplateLink}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Gerenciar
              </button>
              <button style={criarStyles.aiPill}>
                <MobileIcon name="sparkles" size={11}/> Reescrever
              </button>
            </div>
          </div>
          <div style={criarStyles.sectionHint}>
            Cada modelo tem mensagem, link do grupo e cupons configurados.
          </div>

          <div style={criarStyles.templateRow}>
            {[
              {key:'achadinho', name:'Achadinho ✨', preview:'✨ Achadinho do dia\n\n[produto]\nPor R$ 39,90 com frete!'},
              {key:'relampago', name:'Relâmpago ⚡', preview:'⚡ ÚLTIMAS HORAS ⚡\n\n[produto]\nDe R$ 79 por R$ 39!'},
              {key:'tech', name:'Tech 🔌', preview:'🔌 Achado tech\n\n[produto]\nspecs · cupom · link'},
              {key:'beleza', name:'Beleza 💄', preview:'💄 Pra mimar você\n\n[produto]\npreço cheio R$ 79, hoje:'},
            ].map(t => (
              <button key={t.key} onClick={() => setSelectedTemplate(t.key)} style={criarStyles.templateCard(selectedTemplate === t.key)}>
                <div style={criarStyles.templateName}>{t.name}</div>
                <div style={criarStyles.templatePreview(selectedTemplate === t.key)}>{t.preview}</div>
              </button>
            ))}
          </div>

          {/* Editor */}
          <div style={criarStyles.editorWrap}>
            <textarea style={criarStyles.editor} defaultValue={`✨ Achadinho do dia\n\nSandália Bege Verão 2026 — só hoje por *R$ 39,90* com frete grátis!\n\nDe ~R$ 79,90~ por R$ 39,90 🔥\n\n👉 ${isNoConv ? linkOriginal : linkAfiliada}${bonuses === 'both' || bonuses === 'coupons' ? '\n\n🎟 Mais cupons da Shopee:\ns.shopee.com.br/cupons-sol' : ''}${bonuses === 'both' || bonuses === 'group' ? '\n\n💜 Entra no nosso grupo:\nwa.me/achadosdasol' : ''}\n\n#achados #moda`}/>
            <div style={criarStyles.vars}>
              {['{produto}','{preço}','{preço_de}','{link}','{loja}'].map(v => (
                <span key={v} style={criarStyles.varChip}>{v}</span>
              ))}
            </div>
          </div>

          {/* ─── BÔNUS NA MENSAGEM ─── */}
          <div style={criarStyles.sectionH}>
            <div style={criarStyles.sectionTitle}>Adicionar à mensagem</div>
          </div>
          <div style={criarStyles.sectionHint}>
            Configurado aqui vale pra toda oferta com este modelo. Editável a qualquer hora.
          </div>

          {(() => {
            const groupOn   = bonuses === 'group'   || bonuses === 'both';
            const couponsOn = bonuses === 'coupons' || bonuses === 'both';
            const lojas = [
              {key:'shopee', nome:'Shopee',        cor:'#EE4D2D', sel:true, url:'s.shopee.com.br/cupons-sol'},
              {key:'ml',     nome:'Mercado Livre', cor:'#FFE600', sel:true, url:'mercadolivre.com/loja-sol/cupons'},
              {key:'amazon', nome:'Amazon',        cor:'#FF9900', sel:false, url:''},
              {key:'magalu', nome:'Magalu',        cor:'#0086FF', sel:false, url:''},
            ];

            // ─── conteúdo de cada bônus (reaproveitado em ambos os layouts) ───
            const toggleGroup = () => {
              if (bonuses === 'group' || bonuses === 'both') {
                setBonuses(bonuses === 'both' ? 'coupons' : '');
              } else {
                setBonuses(bonuses === 'coupons' ? 'both' : 'group');
              }
            };
            const toggleCoupons = () => {
              if (bonuses === 'coupons' || bonuses === 'both') {
                setBonuses(bonuses === 'both' ? 'group' : '');
              } else {
                setBonuses(bonuses === 'group' ? 'both' : 'coupons');
              }
            };
            const groupHead = (on) => (
              <div style={{display:'flex', alignItems:'center', gap: 12}} onClick={toggleGroup}>
                <div style={criarStyles.bonusIcon(on)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div style={criarStyles.bonusMain}>
                  <div style={criarStyles.bonusTitle}>Link do seu grupo</div>
                  <div style={criarStyles.bonusSub}>
                    {on ? 'aparece no fim de toda mensagem' : 'convida pra entrar no seu grupo principal'}
                  </div>
                </div>
                <div style={criarStyles.bonusToggle(on)}>
                  <div style={criarStyles.bonusKnob(on)}/>
                </div>
              </div>
            );
            const groupBody = (
              <>
                <div style={criarStyles.bonusField}>
                  <div style={criarStyles.bonusLabel}>Link de convite</div>
                  <input style={criarStyles.bonusInput} defaultValue="wa.me/achadosdasol"/>
                </div>
                <div style={criarStyles.bonusField}>
                  <div style={criarStyles.bonusLabel}>Chamada (CTA)</div>
                  <input style={criarStyles.bonusInputText} defaultValue="💜 Entra no nosso grupo:"/>
                </div>
                <div>
                  <div style={criarStyles.bonusPreviewLabel}>
                    <MobileIcon name="check" size={10} stroke={3}/>
                    como vai aparecer
                  </div>
                  <div style={criarStyles.bonusPreview}>
                    💜 Entra no nosso grupo:{'\n'}wa.me/achadosdasol
                  </div>
                </div>
              </>
            );

            const couponsHead = (on) => (
              <div style={{display:'flex', alignItems:'center', gap: 12}} onClick={toggleCoupons}>
                <div style={criarStyles.bonusIcon(on)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 12V8H4v8h16v-4z"/><path d="M9 8v8M15 8v8"/>
                  </svg>
                </div>
                <div style={criarStyles.bonusMain}>
                  <div style={criarStyles.bonusTitle}>Página de cupons da loja</div>
                  <div style={criarStyles.bonusSub}>
                    {on ? 'só aparece quando a oferta for da loja correspondente' : 'leva pra sua página de cupons da loja'}
                  </div>
                </div>
                <div style={criarStyles.bonusToggle(on)}>
                  <div style={criarStyles.bonusKnob(on)}/>
                </div>
              </div>
            );
            const couponsBody = (
              <>
                <div style={criarStyles.bonusField}>
                  <div style={criarStyles.bonusLabel}>Quais lojas você tem cupom?</div>
                  <div style={criarStyles.storeChips}>
                    {lojas.map(l => (
                      <button key={l.key} style={criarStyles.storeChip(l.sel)}>
                        {l.sel && <MobileIcon name="check" size={10} stroke={3}/>}
                        {l.nome}
                      </button>
                    ))}
                  </div>
                </div>

                {lojas.filter(l => l.sel).map(l => (
                  <div key={l.key} style={criarStyles.bonusField}>
                    <div style={criarStyles.storeRow}>
                      <div style={criarStyles.storeBadge(l.cor)}>{l.nome.slice(0,2).toUpperCase()}</div>
                      <span style={criarStyles.storeName}>Link {l.nome}</span>
                    </div>
                    <input style={{...criarStyles.bonusInput, marginTop: 6}} defaultValue={l.url}/>
                  </div>
                ))}

                <div style={criarStyles.bonusField}>
                  <div style={criarStyles.bonusLabel}>
                    Chamada (CTA) · use {'{loja}'} pro nome
                  </div>
                  <input style={criarStyles.bonusInputText} defaultValue="🎟 Mais cupons da {loja}:"/>
                </div>
                <div>
                  <div style={criarStyles.bonusPreviewLabel}>
                    <MobileIcon name="check" size={10} stroke={3}/>
                    nesta oferta (Shopee)
                  </div>
                  <div style={criarStyles.bonusPreview}>
                    🎟 Mais cupons da Shopee:{'\n'}s.shopee.com.br/cupons-sol
                  </div>
                </div>
              </>
            );

            // ─── LAYOUT UNIFIED — um card só, dividido em sub-rows ───
            if (bonusLayout === 'unified') {
              return (
                <div style={{...criarStyles.unifiedCard, marginTop: 4}}>
                  <div style={criarStyles.unifiedRow(groupOn, false)}>
                    <div style={criarStyles.unifiedRowHead}>{groupHead(groupOn)}</div>
                    {groupOn && <div style={criarStyles.unifiedBody}>{groupBody}</div>}
                  </div>
                  <div style={criarStyles.unifiedRow(couponsOn, true)}>
                    <div style={criarStyles.unifiedRowHead}>{couponsHead(couponsOn)}</div>
                    {couponsOn && <div style={criarStyles.unifiedBody}>{couponsBody}</div>}
                  </div>
                </div>
              );
            }

            // ─── LAYOUT SEPARATE — 2 cards ───
            return (
              <>
                <div style={{...criarStyles.bonusCard(groupOn), marginTop: 4}}>
                  <div style={criarStyles.bonusHead}>{groupHead(groupOn)}</div>
                  {groupOn && <div style={criarStyles.bonusBody}>{groupBody}</div>}
                </div>
                <div style={criarStyles.bonusCard(couponsOn)}>
                  <div style={criarStyles.bonusHead}>{couponsHead(couponsOn)}</div>
                  {couponsOn && <div style={criarStyles.bonusBody}>{couponsBody}</div>}
                </div>
              </>
            );
          })()}

          {/* Destinos — checkbox style com seleção visual clara */}
          <div style={criarStyles.sectionH}>
            <div style={criarStyles.sectionTitle}>Postar em</div>
            <span style={{fontSize: 11, color:'var(--ink-soft)', fontWeight: 600}}>2 selecionados</span>
          </div>

          <div style={criarStyles.destCard}>
            {[
              {nome:'Achados da Sol 💜', tipo:'grupo · 247 pessoas', sel:true, g:'linear-gradient(135deg, var(--accent), var(--accent-2))'},
              {nome:'Sol · Tech & Casa', tipo:'grupo · 118 pessoas', sel:false, g:'linear-gradient(135deg, var(--accent-3), var(--warn))'},
              {nome:'Canal Sol Achados', tipo:'canal · 2.4k inscritos', sel:true, g:'linear-gradient(135deg, var(--accent-2), var(--accent-strong))'},
            ].map((d, i, a) => (
              <div key={i} style={criarStyles.destRow(d.sel, i === a.length-1)}>
                <div style={criarStyles.destCheck(d.sel)}>
                  {d.sel && <MobileIcon name="check" size={11} stroke={3}/>}
                </div>
                <div style={criarStyles.destAvatar(d.g)}>
                  {d.nome.split(' ').slice(0,2).map(w=>w[0]).join('').replace(/[^A-Za-zÀ-ÿ]/g,'').toUpperCase().slice(0,2)}
                </div>
                <div style={criarStyles.destMain}>
                  <div style={criarStyles.destName}>{d.nome}</div>
                  <div style={criarStyles.destSub}>{d.tipo}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Enviar */}
          <div style={criarStyles.sendWrap}>
            <div style={criarStyles.sendRow}>
              <button style={criarStyles.schedBtn}>
                <MobileIcon name="bolt" size={14}/> Agendar
              </button>
              <button style={criarStyles.sendBtn}>
                Enviar agora <MobileIcon name="arrow" size={14}/>
              </button>
            </div>
            <div style={criarStyles.sendNote}>
              Vai pra <strong style={{color:'var(--ink)'}}>Achados da Sol 💜</strong> + <strong style={{color:'var(--ink)'}}>Canal Sol Achados</strong>
            </div>
          </div>
        </>
      )}

      <div style={{height: 20}}/>
    </MobileShell>
  );
}
