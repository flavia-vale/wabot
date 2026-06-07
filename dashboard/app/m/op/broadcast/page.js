'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobi, cfgStyles, tint } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'
import { mobileRoutes } from '@/components/mobile/routes'
import { api } from '@/lib/api'

const pageStyles = {
  hint: { fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 },
  destList: { maxHeight: 300, overflowY: 'auto', display: 'grid', gap: 8 },
  destRow: (checked) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 13,
    border: `1px solid ${checked ? tint('--accent', 45, '--line') : 'var(--line)'}`,
    background: checked ? tint('--accent', 10) : 'var(--surface)',
    cursor: 'pointer',
  }),
  preview: { whiteSpace: 'pre-wrap', background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 14, padding: 12, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, minHeight: 70 },
  addBox: { padding: 12, borderRadius: 14, background: tint('--accent', 7), border: `1px solid ${tint('--accent', 24, 'var(--line)')}`, display: 'grid', gap: 8 },
}

function groupKey(group) {
  return group?.waJid || group?.id || ''
}

function isChannelGroup(group) {
  return String(group?.waJid || '').endsWith('@newsletter')
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
  const [selected, setSelected] = useState([])
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    function load() {
      setLoading(true)
      setError('')
      api.groups()
        .then((list) => {
          if (!active) return
          const postGroups = Array.isArray(list) ? list.filter((group) => group.role === 'post') : []
          setGroups(postGroups)
          setSelected((current) => current.filter((jid) => postGroups.some((group) => groupKey(group) === jid)))
        })
        .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar destinos.') })
        .finally(() => { if (active) setLoading(false) })
    }
    load()
    return () => { active = false }
  }, [reloadKey])

  const selectedNames = useMemo(() => groups.filter((group) => selected.includes(groupKey(group))).map((group) => group.name || group.waJid), [groups, selected])

  function toggleDestination(jid) {
    setSelected((current) => current.includes(jid) ? current.filter((item) => item !== jid) : [...current, jid])
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
    return <MobileShell title="Enviar mensagem" active="envios" showBack onBack={() => router.back()}><div style={{ padding: '18px 16px' }}><MobileErrorCard message={error} onRetry={() => setReloadKey((k) => k + 1)} /></div></MobileShell>
  }

  return (
    <MobileShell title="Enviar mensagem" active="envios" showBack onBack={() => router.back()}>
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Broadcast manual</div>
        <div style={cfgStyles.pageTitle}>Enviar agora</div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={pageStyles.hint}>Escreva a mensagem que será enviada exatamente para os destinos selecionados abaixo.</div>
          <label>
            <div style={cfgStyles.label}>Mensagem</div>
            <textarea style={{ ...cfgStyles.field, minHeight: 140, resize: 'vertical' }} value={text} onChange={(event) => setText(event.target.value)} placeholder="Digite a mensagem..." />
          </label>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{text.length} caractere(s)</div>
          <div style={pageStyles.preview}>{text.trim() || 'Prévia da mensagem aparecerá aqui.'}</div>
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Destinos</div>
      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.cardP, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{selected.length} selecionado(s){selectedNames.length ? `: ${selectedNames.slice(0, 2).join(', ')}${selectedNames.length > 2 ? '…' : ''}` : ''}</div>
          <div style={pageStyles.destList}>
            {groups.length === 0 ? (
              <div style={pageStyles.hint}>Nenhum destino cadastrado ainda.</div>
            ) : groups.map((group) => {
              const jid = groupKey(group)
              const checked = selected.includes(jid)
              return (
                <label key={`${group.id}-${jid}`} style={{ ...pageStyles.destRow(checked), minHeight: 44 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleDestination(jid)} style={{ width: 20, height: 20, accentColor: 'var(--accent-strong)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name || jid}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)' }}>{isChannelGroup(group) ? 'canal' : 'grupo'} · {groupParticipants(group) || 'sem contagem'} participantes</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div style={pageStyles.addBox}>
            <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 700 }}>Seu grupo de destino não está aqui? Clique aqui para adicionar</div>
            <button type="button" onClick={() => router.push(mobileRoutes.configGroups)} style={mobi.btn('ghost', true)}>Adicionar grupo de destino</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 16px 24px', display: 'grid', gap: 10 }}>
        <button type="button" onClick={sendNow} disabled={sending || !text.trim() || selected.length === 0} style={{ ...mobi.btn('accent', true), opacity: sending || !text.trim() || selected.length === 0 ? 0.55 : 1 }}>
          {sending ? 'Enviando...' : `Enviar para ${selected.length} destino(s)`}
        </button>
        {feedback && <div style={{ fontSize: 12, color: feedback.includes('Não') || feedback.includes('Selecione') || feedback.includes('Digite') ? 'var(--danger)' : 'var(--success)' }}>{feedback}</div>}
      </div>
    </MobileShell>
  )
}
