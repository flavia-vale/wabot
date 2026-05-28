'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { TEMPLATE_OPTIONS } from '@/lib/mobileOfferComposer'
import { getMobileTemplatePresetNotice } from '@/lib/mobileConfigContracts'

const presetBodies = {
  achadinho: '✨ Achadinho do dia\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  relampago: '⚡ Oferta relâmpago\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  tech: '🔌 Achado tech\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
  beleza: '💄 Oferta de beleza\n\n{produto}\n\nDe {preço_de} por *{preço}*\n\n👉 {link}',
}

const presetTemplates = TEMPLATE_OPTIONS.map((template) => ({
  ...template,
  body: presetBodies[template.key] || template.preview,
}))

export default function TemplatesPage() {
  useMobileRoutePerf('m/account/templates')
  const router = useRouter()
  const [selectedKey, setSelectedKey] = useState(presetTemplates[0]?.key || '')
  const selected = presetTemplates.find((template) => template.key === selectedKey) || presetTemplates[0]

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Conta</div>
        <div style={cfgStyles.pageTitle}>Modelos</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        {getMobileTemplatePresetNotice()} Para editar uma mensagem específica, abra <strong>Criar oferta</strong> e ajuste o texto antes de enviar.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {presetTemplates.map((template, index) => (
            <button key={template.key} type="button" onClick={() => setSelectedKey(template.key)} style={cfgStyles.rowButton(index === presetTemplates.length - 1, selectedKey === template.key)}>
              <div style={cfgStyles.rowMain}>
                <div style={cfgStyles.rowTitle}>{template.name}</div>
                <div style={cfgStyles.rowSub}>{template.preview.replace(/\n/g, ' · ')}</div>
              </div>
              <MobileIcon name="arrow" size={14}/>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div style={cfgStyles.cardWrap}>
          <div style={{...cfgStyles.cardP, display:'grid', gap: 12}}>
            <div style={cfgStyles.rowTitle}>{selected.name}</div>
            <pre style={{...cfgStyles.field, margin: 0, whiteSpace:'pre-wrap', fontFamily:"'JetBrains Mono', monospace", fontSize: 12}}>{selected.body}</pre>
            <div style={{display:'flex', gap: 6, flexWrap:'wrap'}}>
              {['{produto}', '{preço}', '{preço_de}', '{link}', '{loja}'].map((variable) => <span key={variable} style={cfgStyles.pill('neutral')}>{variable}</span>)}
            </div>
          </div>
        </div>
      )}

      <div style={{padding:'18px 16px 24px', display:'grid', gap: 8}}>
        <button type="button" onClick={() => router.push(mobileRoutes.offer)} style={{...mobi.btn('accent', true)}}>Usar em uma oferta</button>
      </div>
    </MobileShell>
  )
}
