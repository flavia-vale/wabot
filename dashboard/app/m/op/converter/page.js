'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MobileShell } from '@/components/mobile/MobileShell'
import { api } from '@/lib/api'

export default function ConverterPage() {
  const [input, setInput] = useState('')
  const [converted, setConverted] = useState('')
  const [converting, setConverting] = useState(false)

  const handleConvert = async () => {
    if (!input.trim()) return
    setConverting(true)
    try {
      const result = await api.convertLinks(input)
      const links = result?.results || []
      if (links.length > 0) {
        setConverted(links[0]?.convertedUrl || links[0]?.originalUrl || input)
      }
    } catch (e) {
      console.error('Conversion failed:', e)
    } finally {
      setConverting(false)
    }
  }

  const handleCopyConverted = () => {
    if (converted) navigator.clipboard.writeText(converted)
  }

  const isEmpty = !converted

  return (
    <MobileShell title="Conversor" active="criar">
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Cole o link original</div>
        <div style={{ marginTop: 8, position: 'relative' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Cole seu link aqui..."
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 13,
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              minHeight: 80,
              resize: 'none',
              outline: 'none',
            }}
          />
          {input && (
            <button
              onClick={() => { setInput(''); setConverted('') }}
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
          {converting ? 'Convertendo...' : 'Converter'}
        </button>
      </div>

      {!isEmpty && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✓ Link convertido</div>
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              fontSize: 12,
              color: 'var(--ink)',
              fontFamily: "'JetBrains Mono', monospace",
              wordBreak: 'break-all',
            }}
          >
            {converted}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={handleCopyConverted}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copiar
            </button>
            <Link
              href="/m/op/offer"
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                background: 'var(--accent-strong)',
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Criar oferta
            </Link>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </MobileShell>
  )
}
