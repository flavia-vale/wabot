'use client'

/* Espelhamento — versão Menta desktop do recurso PRO. Mesma lógica e fontes de
 * dados do fluxo canônico de espelhamento:
 *   - api.groups()       → origem (role:'monitor') e destino (role:'post')
 *   - api.logsSummary('today') → métricas factuais do dia
 *   - estado "ligado"    → reflete a sessão WhatsApp conectada (usePainel.online);
 *     NÃO há flag própria no backend — o bot espelha enquanto a sessão roda.
 *
 * É a visão de ESPELHO (origem → destino), distinta de /grupos (cadastro dos
 * grupos). Editar/Adicionar levam ao /painel/grupos; o controle leva à conexão
 * WhatsApp. Nenhuma lógica de backend nova — só leitura derivada do que existe.
 *
 * Aba "Conexões": o backend não tem tabela de pares origem→destino (ver
 * src/api/routes/broadcastTargets.js resolveTargetJids) — toda origem
 * monitorada publica em todo destino cadastrado do mesmo usuário. O diagrama
 * e os textos "envia para/recebe de" refletem exatamente essa malha completa;
 * não inventam uma seleção por par que não existe hoje no produto. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader, PainelContentActions } from '../PainelShell'

const GRADIENTS = [
  'linear-gradient(135deg,#94A3B8,#475569)',
  'linear-gradient(135deg,#F4D9E0,#E8A488)',
  'linear-gradient(135deg,#C8E6D8,#3E9C7A)',
  'linear-gradient(135deg,#D9CFEA,#7C5CF5)',
]
// Mesmos tons das GRADIENTS acima, em cor sólida (traços de SVG não aceitam
// gradiente), pareados pelo mesmo índice para a linha bater com o avatar.
const STROKE_COLORS = ['#475569', '#E8A488', '#3E9C7A', '#7C5CF5']

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)
  return raw.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 2) || '#'
}

function Avatar({ name, gradient, size = 38 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size <= 34 ? 12.5 : 13, fontWeight: 700, color: '#fff', background: gradient,
      }}
    >{initials(name)}</span>
  )
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0
}

function GroupList({ title, hint, eyebrow, cards, emptyLabel, direction }) {
  return (
    <section className="pnl-card">
      <div className="pnl-eyebrow" style={eyebrow.style}>{eyebrow.label}</div>
      <div className="pnl-card-title" style={{ marginTop: 6 }}>{title}</div>
      <p className="pnl-card-note">{hint}</p>
      {cards.length === 0 ? (
        <p className="pnl-empty">{emptyLabel}</p>
      ) : (
        <ul className="pnl-grid" style={{ marginTop: 12 }}>
          {cards.map((c, i) => (
            <li key={c.group.id} className="pnl-subcard">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={c.group.name} gradient={GRADIENTS[i % GRADIENTS.length]} />
                <div style={{ minWidth: 0, flex: 1, wordBreak: 'break-word' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.group.name}</div>
                  <div className="pnl-hint" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} aria-hidden="true" />
                    {c.group.kind === 'channel' ? 'Canal WhatsApp' : 'Grupo WhatsApp'}
                  </div>
                </div>
                <span className={`pnl-esp-pill ${direction === 'origin' ? 'is-origin' : 'is-dest'}`}>
                  {direction === 'origin' ? `${c.counterpartCount}→` : `←${c.counterpartCount}`}
                </span>
              </div>
              <div className="pnl-esp-flow">
                {direction === 'origin' ? 'envia para ' : 'recebe de '}
                <strong>{c.counterpartNames || (direction === 'origin' ? 'nenhum destino cadastrado ainda' : 'nenhuma origem cadastrada ainda')}</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/painel/grupos" className="pnl-link-btn" style={{ display: 'inline-block', marginTop: 12 }}>
        + Adicionar grupo
      </Link>
    </section>
  )
}

const ROW_H = 60
const ROW_GAP = 16
const ROW_STEP = ROW_H + ROW_GAP
const NODE_PCT = 42

function ConnectionsDiagram({ origens, destinos, hasFullMesh, selectedOriginId, onToggleOrigin }) {
  if (origens.length === 0 && destinos.length === 0) {
    return <p className="pnl-empty">Cadastre grupos de origem e destino para ver o mapa de espelhamento.</p>
  }

  const rowCount = Math.max(origens.length, destinos.length, 1)
  const diagramHeight = rowCount * ROW_STEP - ROW_GAP + 8
  const leftEdge = NODE_PCT
  const rightEdge = 100 - NODE_PCT

  const paths = []
  if (hasFullMesh) {
    origens.forEach((o, oi) => {
      const y1 = oi * ROW_STEP + ROW_H / 2
      const active = selectedOriginId === o.id
      const dim = selectedOriginId && !active
      const color = STROKE_COLORS[oi % STROKE_COLORS.length]
      destinos.forEach((d, di) => {
        const y2 = di * ROW_STEP + ROW_H / 2
        const c1 = leftEdge + 15, c2 = rightEdge - 15
        paths.push({
          key: `${o.id}-${d.id}`,
          d: `M ${leftEdge} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${rightEdge} ${y2}`,
          stroke: dim ? '#c7d3ce' : color,
          width: active ? 2.5 : 1.5,
          opacity: dim ? 0.25 : (selectedOriginId ? 1 : 0.55),
        })
      })
    })
  }

  return (
    <div className="pnl-esp-diagram-scroll">
      <div className="pnl-esp-diagram" style={{ height: diagramHeight }}>
        <svg width="100%" height={diagramHeight} viewBox={`0 0 100 ${diagramHeight}`} preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.width} strokeOpacity={p.opacity} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {origens.map((o, i) => {
          const y = i * ROW_STEP + ROW_H / 2
          const isSel = selectedOriginId === o.id
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggleOrigin(o.id)}
              className="pnl-esp-node is-origin"
              style={{
                top: y - ROW_H / 2, height: ROW_H, width: `${NODE_PCT}%`,
                borderColor: isSel ? STROKE_COLORS[i % STROKE_COLORS.length] : undefined,
                boxShadow: isSel ? '0 2px 8px rgba(31,45,42,0.12)' : undefined,
              }}
              aria-pressed={isSel}
            >
              <Avatar name={o.name} gradient={GRADIENTS[i % GRADIENTS.length]} size={34} />
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span className="pnl-esp-node-name" style={{ display: 'block' }}>{o.name}</span>
                <span className="pnl-esp-node-sub">envia para {destinos.length}</span>
              </span>
            </button>
          )
        })}

        {destinos.map((d, i) => {
          const y = i * ROW_STEP + ROW_H / 2
          const connected = selectedOriginId ? hasFullMesh : true
          return (
            <div
              key={d.id}
              className="pnl-esp-node is-dest"
              style={{
                top: y - ROW_H / 2, height: ROW_H, width: `${NODE_PCT}%`,
                opacity: selectedOriginId && !connected ? 0.35 : 1,
              }}
            >
              <span style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
                <span className="pnl-esp-node-name" style={{ display: 'block' }}>{d.name}</span>
                <span className="pnl-esp-node-sub">recebe de {origens.length}</span>
              </span>
              <Avatar name={d.name} gradient={GRADIENTS[i % GRADIENTS.length]} size={34} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function EspelhamentoPage() {
  usePainelHeader({ title: 'Espelhamento', subtitle: 'Monitora grupos de promoção e reposta com o seu link' })
  const { online, refreshSession } = usePainel()

  const [groups, setGroups] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [switchingMirror, setSwitchingMirror] = useState(false)
  const [tab, setTab] = useState('grupos')
  const [selectedOriginId, setSelectedOriginId] = useState(null)

  useEffect(() => {
    let active = true
    Promise.allSettled([api.groups(), api.logsSummary('today')]).then(([g, s]) => {
      if (!active) return
      if (g.status === 'fulfilled' && Array.isArray(g.value)) setGroups(g.value)
      else setLoadError('Não foi possível carregar os grupos do espelhamento.')
      if (s.status === 'fulfilled') setSummary(s.value)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const origens = groups.filter((g) => g.role === 'monitor')
  const destinos = groups.filter((g) => g.role === 'post')
  const hasFullMesh = origens.length > 0 && destinos.length > 0
  const destNamesJoined = destinos.map((d) => d.name).join(', ')
  const originNamesJoined = origens.map((o) => o.name).join(', ')

  const originCards = origens.map((o) => ({
    group: o,
    counterpartCount: hasFullMesh ? destinos.length : 0,
    counterpartNames: hasFullMesh ? destNamesJoined : '',
  }))
  const destCards = destinos.map((d) => ({
    group: d,
    counterpartCount: hasFullMesh ? origens.length : 0,
    counterpartNames: hasFullMesh ? originNamesJoined : '',
  }))

  const c = summary?.counts
  const postadosHoje = num(c?.success)
  const errosHoje = num(c?.timeoutTotal) + num(c?.errorOther)
  const vistosHoje = c
    ? num(c.success) + num(c.skippedDedup) + num(c.skippedConfig) + num(c.timeoutTotal) + num(c.errorOther) + num(c.inFlight)
    : 0

  const lastSendLabel = summary?.lastSendAt
    ? new Date(summary.lastSendAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  async function toggleMirroring() {
    setSwitchingMirror(true)
    setLoadError('')
    try {
      if (online) await api.sessionStop()
      else await api.sessionStart()
      await refreshSession()
    } catch (err) {
      setLoadError(err.message || 'Não foi possível atualizar o espelhamento.')
    } finally {
      setSwitchingMirror(false)
    }
  }

  function toggleOrigin(id) {
    setSelectedOriginId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 1120, margin: '0 auto' }}>
      <PainelContentActions>
        <div className="pnl-toolbar">
          <Link href="/painel/grupos" className="pnl-btn is-primary">+ Novo espelho</Link>
        </div>
      </PainelContentActions>

      {loadError && (
        <div className="pnl-note-box is-error" role="alert">
          <strong style={{ fontWeight: 600 }}>Falha ao carregar</strong>
          <p style={{ marginTop: 4 }}>{loadError}</p>
        </div>
      )}

      {/* Controle mestre — reflete a conexão WhatsApp (não há flag própria) */}
      <section className="pnl-master">
        <div className="pnl-master-ico">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a5 5 0 0 1 5-5h4" /><path d="M7 12l-4-5 5-2" />
            <path d="M21 17a5 5 0 0 1-5 5h-4" /><path d="M17 12l4 5-5 2" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="pnl-master-title">{online ? 'Espelhamento ligado' : 'Espelhamento pausado'}</span>
            <span className="pnl-master-status">
              <span className={`pnl-dot ${online ? 'is-on' : 'is-idle'}`} aria-hidden="true" />
              {online
                ? `monitorando ${origens.length} ${origens.length === 1 ? 'grupo' : 'grupos'}`
                : 'bot desconectado'}
            </span>
          </div>
          <div className="pnl-master-sub">
            {online
              ? (lastSendLabel ? `${postadosHoje} repostados hoje · último envio ${lastSendLabel}` : `${postadosHoje} repostados hoje`)
              : 'conecte o WhatsApp para o bot voltar a monitorar e repostar'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="pnl-btn is-primary"
            onClick={toggleMirroring}
            disabled={switchingMirror || online === null}
          >
            {switchingMirror ? 'Atualizando…' : online ? 'Desativar todos' : 'Ativar todos'}
          </button>
          <Link href="/painel/whatsapp" className="pnl-btn">Conexão</Link>
        </div>
      </section>

      {/* Stats factuais do dia */}
      <div className="pnl-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="pnl-kpi">
          <div className="pnl-kpi-label">Repostados hoje</div>
          <div className="pnl-kpi-num">{loading ? '…' : postadosHoje}</div>
          <div className="pnl-kpi-foot">nos seus grupos de destino</div>
        </div>
        <div className="pnl-kpi">
          <div className="pnl-kpi-label">Vistos hoje</div>
          <div className="pnl-kpi-num">{loading ? '…' : vistosHoje}</div>
          <div className="pnl-kpi-foot">links detectados nas origens</div>
        </div>
        <div className="pnl-kpi">
          <div className="pnl-kpi-label">Erros hoje</div>
          <div className="pnl-kpi-num" style={{ color: errosHoje > 0 ? 'var(--danger)' : undefined }}>{loading ? '…' : errosHoje}</div>
          <div className="pnl-kpi-foot">{errosHoje > 0 ? 'ver em Envios' : 'tudo certo'}</div>
        </div>
      </div>

      {/* Abas Grupos / Conexões */}
      <div className="pnl-seg" role="tablist" aria-label="Ver como listas ou como mapa de conexões" style={{ justifySelf: 'start' }}>
        <button type="button" role="tab" aria-selected={tab === 'grupos'} className={tab === 'grupos' ? 'is-active' : ''} onClick={() => setTab('grupos')}>
          Grupos
        </button>
        <button type="button" role="tab" aria-selected={tab === 'conexoes'} className={tab === 'conexoes' ? 'is-active' : ''} onClick={() => setTab('conexoes')}>
          Conexões
        </button>
      </div>

      {tab === 'grupos' ? (
        <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <GroupList
            eyebrow={{ label: '👁 Origem · monitora', style: {} }}
            title="Grupos que monitoro"
            hint="De onde o bot captura as promoções. Ele só lê os links."
            cards={originCards}
            emptyLabel="Nenhum grupo de origem cadastrado."
            direction="origin"
          />
          <GroupList
            eyebrow={{ label: '⚡ Destino · publica', style: { color: 'var(--accent-strong)' } }}
            title="Meus grupos de promoção"
            hint="Para onde o bot posta o link já com o seu código de afiliada."
            cards={destCards}
            emptyLabel="Nenhum grupo de destino cadastrado."
            direction="dest"
          />
        </div>
      ) : (
        <section className="pnl-card">
          <div className="pnl-note-box is-info" style={{ marginBottom: 18 }}>
            {origens.length === 0 || destinos.length === 0
              ? 'Cadastre pelo menos um grupo de origem e um de destino para o espelhamento entrar em ação.'
              : selectedOriginId
                ? `Mostrando para onde "${origens.find((o) => o.id === selectedOriginId)?.name}" envia. Clique de novo para limpar.`
                : 'Clique em um grupo de origem para destacar a ligação com os destinos.'}
          </div>
          <ConnectionsDiagram
            origens={origens}
            destinos={destinos}
            hasFullMesh={hasFullMesh}
            selectedOriginId={selectedOriginId}
            onToggleOrigin={toggleOrigin}
          />
        </section>
      )}
    </div>
  )
}
