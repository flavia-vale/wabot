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
 * Os vínculos vêm de GET /api/groups/:id/targets (api.groupTargets), a MESMA
 * fonte que a tela de destinos em /painel/grupos grava. O endpoint já resolve a
 * semântica de src/core/destinationRouting.js e devolve { postIds, mode }:
 *   - mode 'explicit' → a cliente escolheu esses destinos para a origem.
 *     Lista vazia significa NENHUM destino (a origem não espelha), nunca todos.
 *   - mode 'all'      → origem que nunca teve escolha explícita; o fallback
 *     canônico manda para todos os destinos, e o endpoint já devolve esses ids.
 * Distinguimos os dois na UI porque "escolhi todos" e "nunca escolhi" levam ao
 * mesmo desenho hoje, mas mudam de comportamento quando um destino é apagado
 * (RCA 2026-08-26, documentada em destinationRouting.js). */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader, PainelContentActions } from '../PainelShell'
import { instagramDestinationsFromConnections } from '@/components/InstagramDestinationPicker'
import { hasInstagramStoriesAccess } from '@/lib/planEntitlements'
import { planMirrorCreation, resolveInitialOrigin } from '../../../../src/domain/painel/mirrorWizard.js'

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

/* Linha "envia para / recebe de" de um card. Estados possíveis, todos vindos
 * do backend: carregando, sem vínculo (origem explícita que ficou sem destino
 * — não espelha) e com vínculos. O selo "padrão" marca a origem em modo 'all',
 * que hoje alcança todos os destinos por fallback, e não por escolha. */
function FlowLine({ direction, card, loading }) {
  if (loading) return <div className="pnl-esp-flow">carregando ligações…</div>

  if (card.counterpartCount === 0) {
    return (
      <div className="pnl-esp-flow">
        <strong>
          {direction === 'origin'
            ? 'nenhum destino escolhido — esta origem não está espelhando'
            : 'nenhuma origem envia para este grupo'}
        </strong>
      </div>
    )
  }

  return (
    <div className="pnl-esp-flow">
      {direction === 'origin' ? 'envia para ' : 'recebe de '}
      <strong>{card.counterpartNames}</strong>
      {direction === 'origin' && card.mode === 'all' && (
        <span className="pnl-esp-tag" title="Esta origem nunca teve destinos escolhidos, então o padrão é enviar para todos os destinos cadastrados.">padrão: todos</span>
      )}
    </div>
  )
}

function GroupList({ title, hint, eyebrow, cards, emptyLabel, direction, loading }) {
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
              <FlowLine direction={direction} card={c} loading={loading} />
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

function ConnectionsDiagram({ origens, destinos, destIdsOf, selectedOriginId, onToggleOrigin }) {
  if (origens.length === 0 && destinos.length === 0) {
    return <p className="pnl-empty">Cadastre grupos de origem e destino para ver o mapa de espelhamento.</p>
  }

  const rowCount = Math.max(origens.length, destinos.length, 1)
  const diagramHeight = rowCount * ROW_STEP - ROW_GAP + 8
  const leftEdge = NODE_PCT
  const rightEdge = 100 - NODE_PCT

  // Índice do destino define a altura da curva; só entram os pares que existem
  // de fato em GroupTarget (ou o fallback já resolvido pelo endpoint).
  const destRow = new Map(destinos.map((d, i) => [d.id, i]))

  const paths = []
  origens.forEach((o, oi) => {
    const y1 = oi * ROW_STEP + ROW_H / 2
    const active = selectedOriginId === o.id
    const dim = selectedOriginId && !active
    const color = STROKE_COLORS[oi % STROKE_COLORS.length]
    destIdsOf(o.id).forEach((destId) => {
      const di = destRow.get(destId)
      if (di === undefined) return
      const y2 = di * ROW_STEP + ROW_H / 2
      const c1 = leftEdge + 15, c2 = rightEdge - 15
      paths.push({
        key: `${o.id}-${destId}`,
        d: `M ${leftEdge} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${rightEdge} ${y2}`,
        stroke: dim ? '#c7d3ce' : color,
        width: active ? 2.5 : 1.5,
        opacity: dim ? 0.25 : (selectedOriginId ? 1 : 0.55),
      })
    })
  })

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
                '--node-color': STROKE_COLORS[i % STROKE_COLORS.length],
                borderColor: isSel ? STROKE_COLORS[i % STROKE_COLORS.length] : undefined,
                boxShadow: isSel ? '0 2px 8px rgba(31,45,42,0.12)' : undefined,
              }}
              aria-pressed={isSel}
            >
              <span className="pnl-esp-node-avatar">
                <Avatar name={o.name} gradient={GRADIENTS[i % GRADIENTS.length]} size={34} />
              </span>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <span className="pnl-esp-node-name">{o.name}</span>
                <span className="pnl-esp-node-sub">
                  {destIdsOf(o.id).length === 0 ? 'sem destino' : `envia para ${destIdsOf(o.id).length}`}
                </span>
              </span>
            </button>
          )
        })}

        {destinos.map((d, i) => {
          const y = i * ROW_STEP + ROW_H / 2
          const receivedFrom = origens.filter((o) => destIdsOf(o.id).includes(d.id))
          const connected = selectedOriginId ? destIdsOf(selectedOriginId).includes(d.id) : true
          return (
            <div
              key={d.id}
              className="pnl-esp-node is-dest"
              style={{
                top: y - ROW_H / 2, height: ROW_H, width: `${NODE_PCT}%`,
                '--node-color': STROKE_COLORS[i % STROKE_COLORS.length],
                opacity: selectedOriginId && !connected ? 0.35 : 1,
              }}
            >
              <span style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
                <span className="pnl-esp-node-name">{d.name}</span>
                <span className="pnl-esp-node-sub">
                  {receivedFrom.length === 0 ? 'não recebe' : `recebe de ${receivedFrom.length}`}
                </span>
              </span>
              <span className="pnl-esp-node-avatar">
                <Avatar name={d.name} gradient={GRADIENTS[i % GRADIENTS.length]} size={34} />
              </span>
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
  // { [monitorId]: { postIds: string[], mode: 'explicit' | 'all' } }
  const [links, setLinks] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [switchingMirror, setSwitchingMirror] = useState(false)
  const [tab, setTab] = useState('grupos')
  // `undefined` = a cliente nunca escolheu (a regra destaca a primeira);
  // `null` = ela desmarcou de propósito. Ver `origemDestacada` abaixo.
  const [selectedOriginId, setSelectedOriginId] = useState(undefined)
  const [instagramDestinations, setInstagramDestinations] = useState([])
  const [instagramMirrorTargets, setInstagramMirrorTargets] = useState({})
  const [savingInstagramOrigin, setSavingInstagramOrigin] = useState('')
  // Assistente "Criar novo espelhamento": 'fechado' | 'origem' | 'destinos'
  const [wizardPasso, setWizardPasso] = useState('fechado')
  const [wizardOrigem, setWizardOrigem] = useState(null)
  const [wizardDestinos, setWizardDestinos] = useState([])
  const [wizardSalvando, setWizardSalvando] = useState(false)
  const [wizardOk, setWizardOk] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const [g, s] = await Promise.allSettled([api.groups(), api.logsSummary('today')])
      if (!active) return

      const list = g.status === 'fulfilled' && Array.isArray(g.value) ? g.value : []
      if (g.status === 'fulfilled') setGroups(list)
      else setLoadError('Não foi possível carregar os grupos do espelhamento.')
      if (s.status === 'fulfilled') setSummary(s.value)

      // Um GET por origem: é como /painel/grupos lê os destinos, e não existe
      // rota que traga todos os vínculos de uma vez. São poucas origens por
      // conta; se alguma falhar, avisamos em vez de desenhar ligação errada.
      const monitors = list.filter((x) => x.role === 'monitor')
      const results = await Promise.allSettled(monitors.map((m) => api.groupTargets(m.id)))
      if (!active) return

      const map = {}
      let failed = 0
      monitors.forEach((m, i) => {
        const r = results[i]
        if (r.status === 'fulfilled') {
          map[m.id] = {
            postIds: Array.isArray(r.value?.postIds) ? r.value.postIds : [],
            mode: r.value?.mode === 'all' ? 'all' : 'explicit',
          }
        } else {
          failed += 1
        }
      })
      setLinks(map)
      if (failed > 0) {
        setLoadError(`Não foi possível carregar os destinos de ${failed} ${failed === 1 ? 'origem' : 'origens'}. As ligações mostradas podem estar incompletas.`)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([api.instagramConnections().catch(() => []), api.instagramMirrorTargets().catch(() => []), api.me().catch(() => null)]).then(([connections, targets, me]) => {
      if (!active) return
      setInstagramDestinations(hasInstagramStoriesAccess(me || {}) ? instagramDestinationsFromConnections(connections) : [])
      const mapped = {}
      for (const target of targets) (mapped[target.sourceGroupId] ||= []).push(target.destinationId)
      setInstagramMirrorTargets(mapped)
    })
    return () => { active = false }
  }, [])

  const origens = groups.filter((g) => g.role === 'monitor')
  const destinos = groups.filter((g) => g.role === 'post')
  const linksLoading = links === null

  /* A origem destacada na aba Conexões é DERIVADA no render, nunca gravada por
   * efeito: `setState` dentro de `useEffect` dispara renderização em cascata
   * (regra `react-hooks/set-state-in-effect`) e ainda deixaria um quadro com
   * nada destacado. A aba nascia sem destaque nenhum, e o desenho com todas as
   * linhas ao mesmo tempo não se lê — destacar a primeira entrega a leitura
   * pronta. `null` (ela desmarcou) é respeitado; id que não existe mais cai na
   * primeira em vez de sumir com o desenho. */
  const origemDestacada = selectedOriginId === undefined
    ? resolveInitialOrigin({ origens })
    : selectedOriginId && resolveInitialOrigin({ origens, selecionada: selectedOriginId })

  // Vínculos reais → só destinos que ainda existem entram no desenho (o
  // endpoint pode devolver id de grupo apagado enquanto a lista não recarrega).
  const destById = new Map(destinos.map((d) => [d.id, d]))
  const destsByOrigin = new Map(origens.map((o) => [
    o.id,
    (links?.[o.id]?.postIds ?? []).map((id) => destById.get(id)).filter(Boolean),
  ]))
  const destsOf = (originId) => destsByOrigin.get(originId) ?? []
  const destIdsOf = (originId) => destsOf(originId).map((d) => d.id)

  const originCards = origens.map((o) => {
    const ds = destsOf(o.id)
    return {
      group: o,
      counterpartCount: ds.length,
      counterpartNames: ds.map((d) => d.name).join(', '),
      mode: links?.[o.id]?.mode ?? 'explicit',
    }
  })
  const destCards = destinos.map((d) => {
    const os = origens.filter((o) => destsOf(o.id).some((x) => x.id === d.id))
    return {
      group: d,
      counterpartCount: os.length,
      counterpartNames: os.map((o) => o.name).join(', '),
    }
  })

  const postadosHoje = num(summary?.counts?.success)

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
    setSelectedOriginId(() => (origemDestacada === id ? null : id))
  }


  function abrirAssistente() {
    setWizardOk('')
    setLoadError('')
    setWizardDestinos([])
    setWizardOrigem(null)
    setWizardPasso('origem')
  }

  function fecharAssistente() {
    setWizardPasso('fechado')
    setWizardOrigem(null)
    setWizardDestinos([])
  }

  function escolherOrigem(origem) {
    setWizardOrigem(origem)
    setWizardDestinos([])
    setWizardPasso('destinos')
  }

  function alternarDestino(id) {
    setWizardDestinos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const wizardPlano = wizardOrigem
    ? planMirrorCreation({
      currentPostIds: links?.[wizardOrigem.id]?.postIds ?? [],
      currentMode: links?.[wizardOrigem.id]?.mode ?? 'explicit',
      chosenPostIds: wizardDestinos,
      allPostIds: destinos.map((d) => d.id),
    })
    : null

  async function salvarEspelhamento() {
    if (!wizardOrigem || !wizardPlano?.podeSalvar) return
    setWizardSalvando(true)
    setLoadError('')
    try {
      await api.updateGroupTargets(wizardOrigem.id, wizardPlano.postIds)
      // Recarrega só os vínculos desta origem — o resto da tela não mudou.
      const atualizado = await api.groupTargets(wizardOrigem.id).catch(() => null)
      setLinks((prev) => ({
        ...(prev ?? {}),
        [wizardOrigem.id]: {
          postIds: Array.isArray(atualizado?.postIds) ? atualizado.postIds : wizardPlano.postIds,
          mode: atualizado?.mode === 'all' ? 'all' : 'explicit',
        },
      }))
      const n = wizardPlano.adicionados.length
      setWizardOk(`Pronto: "${wizardOrigem.name}" passa a espelhar para ${n} ${n === 1 ? 'grupo' : 'grupos'}.`)
      setSelectedOriginId(wizardOrigem.id)
      fecharAssistente()
    } catch (err) {
      setLoadError(err.message || 'Não foi possível salvar o espelhamento.')
    } finally {
      setWizardSalvando(false)
    }
  }

  async function toggleInstagramMirror(sourceGroupId, destinationId) {
    const current = instagramMirrorTargets[sourceGroupId] || []
    const next = current.includes(destinationId) ? current.filter((id) => id !== destinationId) : [...current, destinationId]
    setSavingInstagramOrigin(sourceGroupId)
    setLoadError('')
    try {
      await api.instagramMirrorTargetsUpdate(sourceGroupId, next)
      setInstagramMirrorTargets((value) => ({ ...value, [sourceGroupId]: next }))
    } catch (error) { setLoadError(error.message || 'Não foi possível atualizar os destinos Instagram.') }
    finally { setSavingInstagramOrigin('') }
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 1120, margin: '0 auto' }}>
      <PainelContentActions>
        <div className="pnl-toolbar">
          <button type="button" className="pnl-btn is-primary" onClick={abrirAssistente}>
            + Criar novo espelhamento
          </button>
        </div>
      </PainelContentActions>

      {loadError && (
        <div className="pnl-note-box is-error" role="alert">
          <strong style={{ fontWeight: 600 }}>Falha ao carregar</strong>
          <p style={{ marginTop: 4 }}>{loadError}</p>
        </div>
      )}

      {wizardOk && (
        <div className="pnl-note-box is-info" role="status">{wizardOk}</div>
      )}

      {/* Assistente "Criar novo espelhamento" — dois passos: de onde lê, para
        * onde publica. Ele NÃO cadastra grupo nem edita regra de envio: as duas
        * coisas moram em /painel/grupos, e os avisos abaixo levam para lá. */}
      {wizardPasso !== 'fechado' && (
        <section className="pnl-card esp-wizard" aria-label="Criar novo espelhamento">
          <div className="esp-wizard-head">
            <div>
              <div className="pnl-card-title">
                {wizardPasso === 'origem'
                  ? 'Qual grupo ou canal você quer monitorar?'
                  : 'Para qual grupo ou canal você quer que seja enviado?'}
              </div>
              <p className="pnl-card-note" style={{ marginTop: 4 }}>
                {wizardPasso === 'origem'
                  ? 'O robô só lê os links desse grupo — ele não publica nada nele.'
                  : `As ofertas de "${wizardOrigem?.name}" vão para os grupos que você marcar aqui.`}
              </p>
            </div>
            <button type="button" className="pnl-btn" onClick={fecharAssistente}>Cancelar</button>
          </div>

          {wizardPasso === 'origem' && (
            origens.length === 0
              ? <p className="pnl-empty">Você ainda não tem grupo de origem cadastrado.</p>
              : <div className="esp-wizard-opcoes">
                {origens.map((o) => (
                  <button key={o.id} type="button" className="esp-opcao" onClick={() => escolherOrigem(o)}>
                    <Avatar name={o.name} gradient={GRADIENTS[0]} size={32} />
                    <span className="esp-opcao-nome">{o.name}</span>
                  </button>
                ))}
              </div>
          )}

          {wizardPasso === 'destinos' && (
            <>
              {destinos.length === 0
                ? <p className="pnl-empty">Você ainda não tem grupo de destino cadastrado.</p>
                : <div className="esp-wizard-opcoes">
                  {destinos.map((d) => {
                    const marcado = wizardDestinos.includes(d.id)
                    const jaTinha = wizardPlano?.jaVinculados.includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`esp-opcao${marcado ? ' is-on' : ''}`}
                        aria-pressed={marcado}
                        onClick={() => alternarDestino(d.id)}
                      >
                        <Avatar name={d.name} gradient={GRADIENTS[2]} size={32} />
                        <span className="esp-opcao-nome">{d.name}</span>
                        {jaTinha && <span className="esp-opcao-tag">já recebe</span>}
                      </button>
                    )
                  })}
                </div>}

              {/* A origem em modo 'all' envia hoje para TODOS os destinos.
                * Salvar uma escolha explícita a tira desse modo — quem deixa de
                * receber precisa aparecer ANTES de confirmar, não depois. */}
              {wizardPlano?.perdeOEnvioParaTodos.length > 0 && (
                <div className="pnl-note-box is-warn" role="alert" style={{ marginTop: 14 }}>
                  Hoje <strong>{wizardOrigem?.name}</strong> envia para todos os seus grupos de destino porque você nunca escolheu nenhum.
                  Ao salvar esta escolha, ela passa a enviar <strong>só</strong> para os grupos marcados — e estes deixam de receber:{' '}
                  {wizardPlano.perdeOEnvioParaTodos.map((id) => destinos.find((d) => d.id === id)?.name).filter(Boolean).join(', ')}.
                </div>
              )}

              <div className="esp-wizard-acoes">
                <button type="button" className="pnl-btn" onClick={() => setWizardPasso('origem')}>Voltar</button>
                <button
                  type="button"
                  className="pnl-btn is-primary"
                  onClick={salvarEspelhamento}
                  disabled={!wizardPlano?.podeSalvar || wizardSalvando}
                >
                  {wizardSalvando ? 'Salvando…' : 'Criar espelhamento'}
                </button>
              </div>
            </>
          )}

          <div className="esp-wizard-ajuda">
            <p>
              Se o grupo ou canal que você quer espelhar não está aqui,{' '}
              <Link href="/painel/grupos">cadastre ele em Grupos e Canais</Link>.
            </p>
            <p>
              Para mudar como a oferta sai (modelo de mensagem, formato da imagem, marca d&apos;água),{' '}
              <Link href="/painel/grupos">edite os filtros do grupo</Link>.
            </p>
          </div>
        </section>
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

      {instagramDestinations.length > 0 && origens.length > 0 && (
        <section className="pnl-card">
          <div className="pnl-card-title">Espelhar também nos Stories</div>
          <p className="pnl-card-note" style={{ marginTop: 6 }}>Escolha em quais contas cada grupo monitorado também publicará a oferta vertical.</p>
          <div className="pnl-grid" style={{ marginTop: 14 }}>
            {origens.map((origin) => <div className="pnl-subcard" key={origin.id}>
              <strong>{origin.name}</strong>
              <div className="pnl-grid" style={{ marginTop: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                {instagramDestinations.map((destination) => <label className="pnl-check" key={destination.id}>
                  <input type="checkbox" checked={(instagramMirrorTargets[origin.id] || []).includes(destination.id)} onChange={() => toggleInstagramMirror(origin.id, destination.id)} disabled={savingInstagramOrigin === origin.id} />
                  {destination.name}
                </label>)}
              </div>
            </div>)}
          </div>
        </section>
      )}

      {/* "Como funciona", do mockup 06. Recolhido por padrão para quem já
        * entendeu — quem abriu a tela pela primeira vez expande uma vez e não
        * precisa de novo. */}
      <details className="pnl-card esp-passos">
        <summary>Como funciona o espelhamento, em 4 passos</summary>
        <div className="esp-passos-grade">
          {[
            ['Escolha o grupo de origem', 'Um grupo de promoções que você já acompanha. O robô só lê os links de lá.'],
            ['Escolha o grupo de destino', 'O seu grupo, onde o robô vai publicar a oferta.'],
            ['Cadastre suas lojas', 'Sem a sua identificação de afiliada o robô não publica — a comissão iria para outra pessoa.'],
            ['Ligue e pronto', 'Cada link vira uma oferta com o seu código, sozinho.'],
          ].map(([titulo, texto], i) => (
            <div key={titulo} className="esp-passo">
              <span className="esp-passo-n">{i + 1}</span>
              <strong>{titulo}</strong>
              <p>{texto}</p>
            </div>
          ))}
        </div>
      </details>

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
            loading={linksLoading}
          />
          <GroupList
            eyebrow={{ label: '⚡ Destino · publica', style: { color: 'var(--accent-strong)' } }}
            title="Meus grupos de promoção"
            hint="Para onde o bot posta o link já com o seu código de afiliada."
            cards={destCards}
            emptyLabel="Nenhum grupo de destino cadastrado."
            direction="dest"
            loading={linksLoading}
          />
        </div>
      ) : (
        <section className="pnl-card">
          <div className="pnl-note-box is-info" style={{ marginBottom: 18 }}>
            {linksLoading
              ? 'Carregando as ligações entre os seus grupos…'
              : origens.length === 0 || destinos.length === 0
                ? 'Cadastre pelo menos um grupo de origem e um de destino para o espelhamento entrar em ação.'
                : origemDestacada
                  ? `Mostrando para onde "${origens.find((o) => o.id === origemDestacada)?.name}" envia. Clique de novo para limpar.`
                  : 'Clique em um grupo de origem para destacar a ligação com os destinos. Para mudar quem envia para quem, use os destinos de cada origem em Grupos.'}
          </div>
          <ConnectionsDiagram
            origens={origens}
            destinos={destinos}
            destIdsOf={destIdsOf}
            selectedOriginId={origemDestacada}
            onToggleOrigin={toggleOrigin}
          />
        </section>
      )}
    </div>
  )
}
