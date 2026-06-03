'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MobileShell } from '@/components/mobile/MobileShell'
import { tint } from '@/components/mobile/mobileStyles'
import { api } from '@/lib/api'
import {
  getConvertedLinksText,
  buildMobileOfferUrlFromConversion,
  getMobileConversionSummary,
  normalizeMobileConversionResults,
  validateMobileConverterInput,
} from '@/lib/mobileConverter'

export default function ConverterPage() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')

  const summary = useMemo(() => getMobileConversionSummary(results), [results])
  const hasConverted = summary.converted > 0

  async function copyText(value, feedback) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyFeedback(feedback)
      window.setTimeout(() => setCopyFeedback(''), 2500)
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.')
    }
  }

  const handleConvert = async () => {
    const validationError = validateMobileConverterInput(input)
    if (validationError) {
      setError(validationError)
      setCopyFeedback('')
      return
    }
    setConverting(true)
    setError('')
    setCopyFeedback('')
    setResults([])
    try {
      const response = await api.convertLinks(input)
      setResults(normalizeMobileConversionResults(response))
    } catch (e) {
      setError(e.message || 'Falha ao converter links. Tente novamente em instantes.')
    } finally {
      setConverting(false)
    }
  }

  const clearAll = () => {
    setInput('')
    setResults([])
    setError('')
    setCopyFeedback('')
  }

  return (
    <MobileShell title="Conversor" active="criar">
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Cole um ou mais links originais</div>
        <div style={{ marginTop: 8, position: 'relative' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Cole um link por linha ou uma mensagem com links..."
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 13,
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              minHeight: 96,
              resize: 'none',
              outline: 'none',
            }}
          />
          {input && (
            <button
              type="button"
              aria-label="Limpar links"
              onClick={clearAll}
              style={{
                position: 'absolute',
                right: 10,
                top: 10,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--bg-soft)',
                border: 'none',
                color: 'var(--ink-soft)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleConvert}
          disabled={converting || !input.trim()}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            background: 'var(--ink)',
            color: 'white',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: converting || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: converting || !input.trim() ? 0.6 : 1,
          }}
        >
          {converting ? 'Convertendo...' : 'Converter links'}
        </button>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', lineHeight: 1.45 }}>{error}</div>}
        {copyFeedback && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', lineHeight: 1.45 }}>{copyFeedback}</div>}
      </div>

      {results.length > 0 && (
        <div style={{ padding: '20px 16px 0', display: 'grid', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', display:'grid', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Resultado</div>
            <div style={{ display: 'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 8 }}>
              {[['Total', summary.total], ['OK', summary.converted], ['Erros', summary.failed]].map(([label, value]) => (
                <div key={label} style={{ padding: 8, borderRadius: 10, background:'var(--bg-soft)', textAlign:'center' }}>
                  <div style={{ fontSize: 10, color:'var(--ink-soft)' }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color:'var(--ink)' }}>{value}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => copyText(getConvertedLinksText(results), `${summary.converted} link(s) convertido(s) copiado(s).`)}
              disabled={!hasConverted}
              style={{ width:'100%', padding:'10px', borderRadius: 999, border:'1px solid var(--line)', background:'var(--ink)', color:'white', fontWeight: 700, opacity: hasConverted ? 1 : 0.5 }}
            >
              Copiar todos convertidos
            </button>
          </div>

          {results.map((item) => (
            <div key={`${item.index}-${item.originalUrl}`} style={{ padding: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', display:'grid', gap: 8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color:'var(--ink)' }}>{item.label}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: item.ok ? 'var(--success)' : 'var(--danger)' }}>{item.ok ? 'convertido' : 'erro'}</span>
              </div>
              <div style={{ fontSize: 10, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Original</div>
              <div style={{ fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--ink-soft)', wordBreak:'break-all' }}>{item.originalUrl || '—'}</div>
              {item.ok ? (
                <>
                  <div style={{ fontSize: 10, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Convertido</div>
                  <div style={{ fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--success)', fontWeight: 700, wordBreak:'break-all' }}>{item.convertedUrl}</div>
                  {item.warning && <div style={{ fontSize: 12, color:'var(--warn)', lineHeight: 1.45 }}>{item.warning}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button type="button" onClick={() => copyText(item.convertedUrl, 'Link convertido copiado.')} style={{ padding:'10px', borderRadius: 999, border:'1px solid var(--line)', background:'var(--surface)', color:'var(--ink)', fontWeight: 700 }}>Copiar este link</button>
                    <Link href={buildMobileOfferUrlFromConversion(item)} style={{ padding:'10px', borderRadius: 999, border:'1px solid var(--accent-strong)', background:'var(--accent-strong)', color:'white', fontWeight: 800, textAlign:'center', textDecoration:'none' }}>Criar oferta</Link>
                  </div>
                </>
              ) : (
                <div style={{ padding: 10, borderRadius: 10, background:tint('--danger', 10), color:'var(--danger)', fontSize: 12, lineHeight: 1.45 }}>{item.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 24 }} />
    </MobileShell>
  )
}
