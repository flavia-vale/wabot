'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'
import { filterDestGroups, selectAllVisible, clearVisible, groupKey, isChannelGroup } from '@/lib/mobileOfferFilters'

const MESSAGE_TEMPLATES = [
  { label: 'Relâmpago', text: '⚡ Oferta relâmpago!\n\nProduto:\nPreço:\nLink:' },
  { label: 'Cupom', text: '🎟️ Cupom disponível!\n\nUse o cupom:\nLink da oferta:' },
  { label: 'Últimas unidades', text: '🔥 Últimas unidades!\n\nGaranta antes que acabe:' },
]

const pageStyles = {
  hint: { fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 },
  chipRow: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 },
  chip: (active = false) => ({
    flexShrink: 0,
    padding: '8px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
    background: active ? 'var(--ink)' : 'var(--surface)',
    color: active ? 'white' : 'var(--ink)',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  }),
  smallBtn: { padding: '8px 10px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' },
  destList: { maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 8 },
  destRow: (checked) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 13,
    border: `1px solid ${checked ? 'color-mix(in oklab, var(--accent) 45%, var(--line))' : 'var(--line)'}`,
    background: checked ? 'color-mix(in oklab, var(--accent) 10%, var(--surface))' : 'var(--surface)',
    cursor: 'pointer',
  }),
  preview: { whiteSpace: 'pre-wrap', background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 14, padding: 12, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, minHeight: 70 },
}

function groupParticipants(group) {
  const value = Number(group.participantsCount ?? group.participants ?? group.memberCount ?? 0)
  return Number.isFinite(value) ? value : 0
}

export default function MobileBroadcastPage() {
  useMobileRoutePerf('m/op/broadcast')
  const router = useRouter()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [minMembers, setMinMembers] = useState('')
  const [includeChannels, setIncludeChannels] = useState(false)
  const [selected, setSelected] = useState([])
  const [topN, setTopN] = useState('10')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true
    api.groups()
      .then((list) => {
        if (!active) return
        const postGroups = Array.isArray(list) ? list.filter((group) => group.role === 'post') : []
        setGroups(postGroups)
        setSelected(postGroups.filter((group) => !isChannelGroup(group)).map(groupKey))
      })
      .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar destinos.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visibleGroups = useMemo(() => {
    const min = Number(minMembers || 0)
    return filterDestGroups(groups, { search, includeChannels }).filter((group) => {
      if (!min) return true
      return groupParticipants(group) >= min
    })
  }, [groups, search, includeChannels, minMembers])

  const selectedNames = useMemo(() => groups.filter((group) => selected.includes(groupKey(group))).map((group) => group.name || group.waJid), [groups, selected])

  function toggleDestination(jid) {
    setSelected((current) => current.includes(jid) ? current.filter((item) => item !== jid) : [...current, jid])
  }

  function applyTopN() {
    const n = Math.max(1, Number(topN) || 1)
    const ranked = [...visibleGroups].sort((a, b) => groupParticipants(b) - groupParticipants(a)).slice(0, n).map(groupKey)
    setSelected((current) => [...new Set([...current, ...ranked])])
  }

  async function sendNow() {
    setFeedback('')
    if (!text.trim()) {
      setFeedback('Digite uma mensagem antes de enviar.')
      return
    }
    if (selected.length === 0) {
      setFeedback('Selecione ao menos um destino.')
      return
    }
    setSending(true)
    try {
      const result = await api.broadcastSend(text.trim(), selected)
      setFeedback(`Enfileirado para ${result?.queued ?? selected.length} destino(s).${result?.rejected ? ` ${result.rejected} rejeitado(s).` : ''}`)
    } catch (err) {
      setFeedback(err.message || 'Não foi possível enviar a mensagem.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <MobileShell title="Enviar mensagem" active="envios" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileLoadingCard label="Carregando destinos..." /></div></MobileShell>
  }

  if (error) {
    return <MobileShell title="Enviar mensagem" active="envios" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} /></div></MobileShell>
  }

  return (
    <MobileShell title="Enviar mensagem" active="envios" showBack onBack={() => router.back()}>
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Broadcast manual</div>
        <div style={cfgStyles.pageTitle}>Enviar agora</div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={pageStyles.hint}>Escreva uma mensagem livre e escolha exatamente quais grupos ou canais vão receber. Para ofertas com scraping, use a tela Criar.</div>
          <div style={pageStyles.chipRow}>
            {MESSAGE_TEMPLATES.map((template) => (
              <button key={template.label} type="button" style={pageStyles.chip(false)} onClick={() => setText(template.text)}>{template.label}</button>
            ))}
          </div>
          <label>
            <div style={cfgStyles.label}>Mensagem</div>
            <textarea style={{ ...cfgStyles.field, minHeight: 130, resize: 'vertical' }} value={text} onChange={(event) => setText(event.target.value)} placeholder="Digite a mensagem..." />
          </label>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{text.length} caractere(s)</div>
          <div style={pageStyles.preview}>{text.trim() || 'Prévia da mensagem aparecerá aqui.'}</div>
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Segmentar destinos</div>
      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <input style={cfgStyles.field} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar grupo/canal" />
            <input style={cfgStyles.field} type="number" min={0} value={minMembers} onChange={(event) => setMinMembers(event.target.value)} placeholder="Mínimo de participantes" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink)' }}>
            <input type="checkbox" checked={includeChannels} onChange={(event) => setIncludeChannels(event.target.checked)} />
            Incluir canais na seleção
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={pageStyles.smallBtn} onClick={() => setSelected(selectAllVisible(selected, visibleGroups))}>Selecionar visíveis ({visibleGroups.length})</button>
            <button type="button" style={pageStyles.smallBtn} onClick={() => setSelected(clearVisible(selected, visibleGroups))}>Limpar visíveis</button>
            <input style={{ ...cfgStyles.field, width: 86, minHeight: 36, padding: '8px 10px' }} type="number" min={1} value={topN} onChange={(event) => setTopN(event.target.value)} />
            <button type="button" style={pageStyles.smallBtn} onClick={applyTopN}>Top N</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{selected.length} selecionado(s){selectedNames.length ? `: ${selectedNames.slice(0, 2).join(', ')}${selectedNames.length > 2 ? '…' : ''}` : ''}</div>
          <div style={pageStyles.destList}>
            {visibleGroups.length === 0 ? (
              <div style={pageStyles.hint}>Nenhum destino com os filtros atuais. Cadastre destinos em Grupos e Canais.</div>
            ) : visibleGroups.map((group) => {
              const jid = groupKey(group)
              const checked = selected.includes(jid)
              return (
                <label key={`${group.id}-${jid}`} style={pageStyles.destRow(checked)}>
                  <input type="checkbox" checked={checked} onChange={() => toggleDestination(jid)} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name || jid}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)' }}>{isChannelGroup(group) ? 'canal' : 'grupo'} · {groupParticipants(group) || 'sem contagem'} participantes</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 16px 24px', display: 'grid', gap: 10 }}>
        <button type="button" onClick={sendNow} disabled={sending || !text.trim() || selected.length === 0} style={{ ...mobi.btn('accent', true), opacity: sending || !text.trim() || selected.length === 0 ? 0.55 : 1 }}>
          {sending ? 'Enviando...' : `Enviar para ${selected.length} destino(s)`}
        </button>
        <button type="button" onClick={() => router.push(mobileRoutes.configGroups)} style={mobi.btn('ghost', true)}>Gerenciar grupos e canais</button>
        {feedback && <div style={{ fontSize: 12, color: feedback.includes('Não') || feedback.includes('Selecione') || feedback.includes('Digite') ? 'var(--danger)' : 'var(--success)' }}>{feedback}</div>}
      </div>
    </MobileShell>
  )
}
