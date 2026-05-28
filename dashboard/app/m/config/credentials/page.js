'use client'

import { useEffect, useState } from 'react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { api } from '@/lib/api'

const storeInfo = {
  shopee: { nome: 'Shopee', cor: '#EE4D2D' },
  mercadolivre: { nome: 'Mercado Livre', cor: '#FFE600' },
  amazon: { nome: 'Amazon', cor: '#FF9900' },
  magalu: { nome: 'Magalu', cor: '#0086FF' },
  aliexpress: { nome: 'AliExpress', cor: '#E62E04' },
}

export default function CredentialsPage() {
  useMobileRoutePerf('m/config/credentials')
  const [creds, setCreds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const c = await api.credentials().catch(() => [])
        if (!active) return
        setCreds(Array.isArray(c) ? c : [])
      } catch (e) {
        if (active) setError(e.message || 'Não foi possível carregar as credenciais.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  const lojas = Object.entries(storeInfo).map(([key, store]) => {
    const cred = creds.find(c => c.platform === key || c.platform === store.nome.toLowerCase())
    return {
      nome: store.nome,
      cor: store.cor,
      on: Boolean(cred && cred.value),
      id: cred?.value || '',
    }
  });
  if (loading) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando credenciais..." /></div>
      </MobileShell>
    )
  }
  if (error) {
    return (
      <MobileShell title="Conversor" active="conta">
        <div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Credenciais</div>
      </div>

      <div style={{padding:'12px 20px 0', fontSize: 12, color:'var(--ink-soft)', lineHeight: 1.5}}>
        Cole seu ID de afiliada de cada plataforma. O bot usa esses dados para reescrever os links.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{...cfgStyles.card, overflow:'hidden'}}>
          {lojas.map((l, i, a) => (
            <div key={l.nome} style={{padding:'14px 16px', borderBottom: i < a.length-1 ? '1px solid var(--line)' : 'none'}}>
              <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: l.on ? 10 : 0}}>
                <div style={cfgStyles.storeBadge(l.cor)}>{l.nome.slice(0,2).toUpperCase()}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={cfgStyles.rowTitle}>{l.nome}</div>
                  <div style={cfgStyles.rowSub}>
                    {l.on ? <span style={{color:'var(--success)', fontWeight: 600}}>● ativo</span> : <span>○ não conectado</span>}
                  </div>
                </div>
                {l.on
                  ? <button style={{padding:'6px 12px', borderRadius: 999, background:'transparent', border:'1px solid var(--line)', fontSize: 11.5, fontWeight: 600, color:'var(--ink-soft)', cursor:'pointer'}}>Editar</button>
                  : <button style={{padding:'6px 12px', borderRadius: 999, background:'var(--ink)', color:'white', border:'none', fontSize: 11.5, fontWeight: 600, cursor:'pointer'}}>Conectar</button>}
              </div>
              {l.on && (
                <div style={{fontFamily:"'JetBrains Mono', monospace", fontSize: 11.5, color:'var(--ink-soft)', padding:'8px 12px', background:'var(--bg-soft)', borderRadius: 8, wordBreak:'break-all'}}>
                  {l.id}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{height: 24}}/>
    </MobileShell>
  )
}
