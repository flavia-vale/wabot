'use client'

/* Espelhamento — TELA ÚNICA (2026-09-19).
 *
 * Esta tela absorveu a antiga /painel/grupos. O princípio é "ver no nível 1,
 * configurar no nível 2": a lista e o mapa mostram o FLUXO (de onde o robô pega
 * e para onde publica); toda configuração vive num painel lateral que abre ao
 * clicar no card do grupo. Nada de formulário aberto dentro da lista — era isso
 * que fazia a tela antiga crescer sem fim e sumir para baixo no celular.
 *
 * Nenhum backend novo. As chamadas são exatamente as que as duas telas já
 * faziam:
 *   - api.groups()               → origem (role:'monitor') e destino (role:'post')
 *   - api.groupTargets(id)       → vínculos de cada origem
 *   - api.updateGroupTargets(id) → grava a escolha de destinos
 *   - api.updateGroup(id, data)  → demais campos do grupo
 *   - api.addGroup / api.deleteGroup / api.sessionWAGroups
 *   - api.logsSummary('today')   → números factuais do dia
 *   - estado "ligado" → reflete a sessão WhatsApp conectada (usePainel.online);
 *     NÃO existe flag própria no backend — o bot espelha enquanto a sessão roda.
 *
 * Vínculos (fonte única desta tela): `targetsState`. O mesmo registro alimenta
 * os cards, o mapa de conexões e a escolha de destinos do painel lateral — por
 * isso salvar no painel atualiza a lista e o mapa atrás dele na hora, sem
 * recarregar a página. O endpoint já resolve a semântica de
 * src/core/destinationRouting.js e devolve { postIds, mode }:
 *   - mode 'explicit' → a cliente escolheu esses destinos para a origem.
 *     Lista vazia significa NENHUM destino (a origem não espelha), nunca todos.
 *   - mode 'all'      → origem que nunca teve escolha explícita; o fallback
 *     canônico manda para todos os destinos, e o endpoint já devolve esses ids.
 * Os dois levam ao mesmo desenho hoje, mas mudam de comportamento quando um
 * destino é apagado (RCA 2026-08-26) — por isso o selo "padrão: todos".
 *
 * Linguagem: a tela diz "origem" e "destino". Nunca monitor, post, jid,
 * imageMode, template key, relay ou preview.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { AddChannelModal } from '@/components/AddChannelModal'
import { SelectChannelModal } from '@/components/SelectChannelModal'
import { TypeBadge, FollowBadge, AdminBadge, HealthBadge } from '@/components/ChannelStatusBadges'
import { ChannelHealthPanel } from '@/components/ChannelHealthPanel'
import { usePainel, usePainelHeader, PainelContentActions } from '../PainelShell'
import { ProLock } from '@/components/pro/ProGate'
import { instagramDestinationsFromConnections } from '@/components/InstagramDestinationPicker'
import { hasInstagramStoriesAccess, hasProLikeAccess } from '@/lib/planEntitlements'
import { AFFILIATE_PLATFORMS } from '@/lib/painel/affiliatePlatforms'
import { buildMirrorCards, planMirrorCreation, resolveInitialOrigin } from '../../../../src/domain/painel/mirrorWizard.js'
import { describeSendPause } from '@/lib/painel/sendPauseNotice'

// Espelha WATERMARK_MAX_CHARS de src/core/destinationWatermark.js (a tela não
// importa aquele módulo: ele carrega `sharp`). test/watermark-limite-caracteres.test.js
// falha se os números divergirem.
const WATERMARK_TEXT_MAX_CHARS = 25
// Quanto tempo a confirmação de "marca salva" fica na tela.
const WATERMARK_SAVED_FEEDBACK_MS = 4000
// Espelha WATERMARK_SIZES / as posições aceitas em
// src/core/destinationWatermark.js (a tela não importa aquele módulo).
const WATERMARK_SIZES = ['small', 'medium', 'large']
const WATERMARK_POSITIONS = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
const RELAY_FOOTER_MAX_CHARS = 1000
// Quanto tempo o "Salvo" do rodapé do painel lateral fica na tela.

const roleLabels = {
  monitor: 'origem',
  post: 'destino',
}

const ALL_PLATFORMS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'magazineluiza', label: 'Magazine Luiza' },
  { id: 'shein', label: 'SHEIN' },
  { id: 'aliexpress', label: 'AliExpress' },
]

const NO_LINK_SCOPE_OPTIONS = [
  { id: 'ALL', label: 'Tudo (texto, mídia, áudio, sticker, documentos)' },
  { id: 'TEXT_ONLY', label: 'Só texto' },
  { id: 'TEXT_IMAGE_WITH_CAPTION', label: 'Texto + imagem com legenda' },
]

const ORIGIN_TABS = [
  { key: 'destinos', label: 'Destinos' },
  { key: 'captura', label: 'Captura' },
  { key: 'publicacao', label: 'Publicação' },
]

/* A aba "Anti-ban" saiu a pedido da dona do produto (2026-09-19): para um GRUPO
 * ela era uma frase e um link para outra tela, e aba que não configura nada é
 * só mais um lugar para procurar. A saúde do CANAL, que é configuração de
 * verdade, foi para "Mensagens" — junto do resto que só existe em canal. */
const DEST_TABS = [
  { key: 'imagem', label: 'Imagem' },
  { key: 'mensagens', label: 'Mensagens' },
]

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

function gradientFor(index) {
  return GRADIENTS[index % GRADIENTS.length]
}

/* ── Inline SVG icons (subset needed for the config panel) ────────────── */
function CfgIcon({ name, size = 17 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'search') return <svg {...p}><circle cx="10" cy="10" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M10.5 6.5 8.5 10.2h3L9.5 13.8"/></svg>
  if (name === 'bolt')   return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
  if (name === 'send')   return <svg {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
  if (name === 'image')  return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg>
  if (name === 'shield') return <svg {...p}><path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3z"/></svg>
  if (name === 'chat')   return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  if (name === 'users')  return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  if (name === 'gear')   return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  if (name === 'check')  return <svg {...p} strokeWidth={2.8}><path d="M5 12.5 10 17 19 7"/></svg>
  if (name === 'x')      return <svg {...p} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18"/></svg>
  if (name === 'plus')   return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
  if (name === 'arrow')  return <svg {...p}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
  if (name === 'chevron') return <svg {...p}><path d="m9 6 6 6-6 6"/></svg>
  return null
}

/* ── "?" popover for long help text ──────────────────────────────────── */
function InfoDot({ children }) {
  return (
    <span className="cfg-info" style={{ display: 'inline-flex' }}>
      <span style={{
        width: 16, height: 16, borderRadius: '50%', cursor: 'help',
        border: '1.5px solid var(--ink-faint)', color: 'var(--ink-faint)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
      }}>?</span>
      <span className="cfg-pop" style={{
        position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
        width: 280, padding: '12px 14px', zIndex: 30,
        background: 'var(--ink)', color: 'rgba(255,255,255,0.92)', borderRadius: 12,
        fontSize: 12, lineHeight: 1.55, fontWeight: 400,
        boxShadow: '0 18px 40px -16px rgba(0,0,0,0.45)',
        opacity: 0, visibility: 'hidden', pointerEvents: 'none',
      }}>{children}</span>
    </span>
  )
}

/* ── Section wrapper ─────────────────────────────────────────────────── */
function CfgSection({ icon, title, desc, children }) {
  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <div className="cfg-section-icon"><CfgIcon name={icon} /></div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
          {desc && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{desc}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

/* ── Row (label left / control right) ───────────────────────────────── */
function CfgRow({ label, hint, info, last, extra, children }) {
  return (
    <div className={`cfg-row${extra ? ' ' + extra : ''}`} style={last ? { borderBottom: 'none' } : undefined}>
      <div>
        <div className="cfg-row-label">{label}{info && <InfoDot>{info}</InfoDot>}</div>
        {hint && <div className="cfg-row-hint">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function RelayFooterField({ group, onUpdate }) {
  const savedValue = group.relayFooterText ?? ''
  const [draft, setDraft] = useState(savedValue)
  const [status, setStatus] = useState('idle')

  const changed = draft !== savedValue

  async function save() {
    setStatus('saving')
    const ok = await onUpdate(group.id, { relayFooterText: draft })
    setStatus(ok ? 'saved' : 'error')
  }

  return (
    <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-soft, #f8fafc)' }}>
      <label htmlFor={`relay-footer-${group.id}`} style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink)' }}>
        Adicionar texto ao final da mensagem <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(opcional)</span>
      </label>
      <p style={{ margin: '4px 0 10px', fontSize: 12, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
        O texto será incluído depois de toda mensagem espelhada deste grupo. Deixe em branco para não adicionar nada.
      </p>
      <textarea
        id={`relay-footer-${group.id}`}
        className="pnl-input"
        rows={4}
        maxLength={RELAY_FOOTER_MAX_CHARS}
        value={draft}
        onChange={(event) => { setDraft(event.target.value); setStatus('idle') }}
        placeholder="Ex.: Entre no nosso grupo VIP para receber mais ofertas!"
        style={{ width: '100%', resize: 'vertical', lineHeight: 1.5 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{draft.length}/{RELAY_FOOTER_MAX_CHARS}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status === 'saved' && <span role="status" style={{ fontSize: 12, color: 'var(--success, #15803d)' }}>Texto salvo</span>}
          {status === 'error' && <span role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>Não foi possível salvar</span>}
          <button type="button" className="pnl-btn pnl-btn-primary" disabled={!changed || status === 'saving'} onClick={save}>
            {status === 'saving' ? 'Salvando…' : 'Salvar texto'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Keyword tag input ───────────────────────────────────────────────── */
function KeywordTagInput({ keywords, draft, onDraftChange, onAdd, onRemove }) {
  return (
    <div className="cfg-keyword-box">
      {keywords.map((kw) => (
        <span key={kw} className="cfg-keyword-pill">
          {kw}
          <button type="button" className="cfg-keyword-pill-rm" onClick={() => onRemove(kw)} aria-label={`Remover "${kw}"`}>
            <CfgIcon name="x" size={12} />
          </button>
        </span>
      ))}
      <input
        className="cfg-keyword-input"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); onAdd() }
          if (e.key === 'Backspace' && !draft && keywords.length > 0) onRemove(keywords[keywords.length - 1])
        }}
        placeholder={keywords.length ? 'adicionar…' : 'ex: usado, recondicionado'}
      />
    </div>
  )
}

function sameIdSet(a = [], b = []) {
  if (a.length !== b.length) return false
  const set = new Set(b)
  return a.every((id) => set.has(id))
}

/* ── Escolha de destinos, dentro do painel lateral da origem ─────────── */
//
// Antes isso era um modal. Duas coisas ruins: no celular a janelinha cobria a
// tela e escondia o contexto do grupo que estava sendo configurado, e a lista
// abria clicável antes de os destinos chegarem do servidor — quem desmarcasse
// nessa janela tinha a escolha atropelada pela resposta e saía achando que
// tinha salvado (bug relatado pela cliente em 2026-08-29).
//
// Hoje a escolha vive na primeira aba do painel do grupo, com o botão de salvar
// ao lado da lista (o rodapé do painel salva a mesma coisa). Invariantes de
// usabilidade que precisam ficar:
//  - nada é clicável enquanto a lista não chega (não existe clique perdido);
//  - o que está na tela e ainda não foi salvo aparece como "não salvo", com
//    "Desfazer" ao lado — a pessoa nunca fica em dúvida se gravou;
//  - o aviso de erro nasce ao lado do botão, não num banner longe no topo.
function DestinationPicker({ groupId, post, state, onLoad, onToggle, onSetAll, onSave, onReset }) {
  const [filter, setFilter] = useState('')

  useEffect(() => { onLoad(groupId) }, [groupId, onLoad])

  const ready = Array.isArray(state?.savedIds)
  const draft = state?.draftIds ?? []
  const saving = Boolean(state?.saving)
  const dirty = ready && !sameIdSet(draft, state.savedIds)
  const justSaved = Boolean(state?.savedAt) && !dirty

  if (post.length === 0) {
    return <p className="pnl-hint" style={{ color: 'var(--warn, #b45309)' }}>Cadastre ao menos um grupo de destino para escolher para onde esse grupo envia.</p>
  }
  if (!ready) {
    return (
      <p className="pnl-hint" aria-live="polite">
        {state?.error ? state.error : 'Carregando os destinos deste grupo…'}
      </p>
    )
  }

  const term = filter.trim().toLowerCase()
  const visible = term ? post.filter((gr) => gr.name.toLowerCase().includes(term)) : post
  const allChecked = draft.length === post.length

  return (
    <div className="cfg-dest-picker">
      <div className="cfg-dest-bar">
        <span className="cfg-dest-count">
          {draft.length === 0
            ? 'Nenhum marcado'
            : `${draft.length} de ${post.length} ${post.length === 1 ? 'destino' : 'destinos'}`}
        </span>
        <button type="button" className="pnl-link-btn" onClick={() => onSetAll(groupId, !allChecked)}>
          {allChecked ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>

      <input
        className="cfg-dest-search"
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Procurar destino pelo nome"
        aria-label="Procurar destino pelo nome"
      />

      <div className="cfg-dest-list" role="group" aria-label="Grupos de destino">
        {visible.length === 0 && <p className="pnl-hint" style={{ padding: '4px 2px' }}>Nenhum destino com esse nome.</p>}
        {visible.map((gr) => {
          const checked = draft.includes(gr.id)
          return (
            <label key={gr.id} className={`cfg-dest-option${checked ? ' is-on' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(groupId, gr.id)} />
              <span className="cfg-dest-name">{gr.name}</span>
              <span className="cfg-dest-kind">{gr.kind === 'channel' ? 'canal' : 'grupo'}</span>
            </label>
          )
        })}
      </div>

      {draft.length === 0 && (
        <p className="cfg-inline-warn" style={{ marginTop: 0 }}>
          Sem nenhum marcado, esse grupo <strong>não envia para lugar nenhum</strong> depois que você salvar. Marque ao menos um destino para ele voltar a enviar.
        </p>
      )}

      <div className="cfg-dest-actions">
        <span className={`cfg-dest-status${dirty ? ' is-dirty' : ''}${justSaved ? ' is-saved' : ''}`} aria-live="polite">
          {state?.error
            ? state.error
            : dirty
              ? 'Alterações ainda não salvas'
              : justSaved
                ? 'Destinos salvos'
                : 'Tudo salvo'}
        </span>
        {dirty && (
          <button type="button" className="pnl-btn" onClick={() => onReset(groupId)} disabled={saving}>Desfazer</button>
        )}
        <button type="button" className="pnl-btn is-primary" onClick={() => onSave(groupId)} disabled={saving || !dirty}>
          {saving ? 'Salvando…' : 'Salvar destinos'}
        </button>
      </div>
    </div>
  )
}

/* ── Texto da marca d'água: rascunho local + salvar explícito ───────── */
//
// Bug relatado pela cliente (2026-08-29): "a página parece estar atualizando
// quando eu começo a escrever o texto da marca d'água".
//
// O campo salvava sozinho enquanto ela digitava (debounce de 500ms). Três
// efeitos, todos no meio da digitação: (1) cada pausa disparava um PUT, que
// mexia em `savingGroupId`/`savedGroupId` e repintava a linha do grupo; (2) o
// PUT recarrega a config do worker a cada vez; (3) — o pior — se o PUT falhasse,
// `handleUpdateGroup` chamava `load()`, que recarrega TODOS os grupos e
// substitui o estado: o texto pela metade era apagado e voltava o valor antigo.
// Digitar virava uma briga com a tela.
//
// Agora o que se digita é rascunho LOCAL. Nada vai ao servidor até o clique em
// Salvar. Mesmo padrão já usado no DestinationPicker: estado explícito de "não
// salvo", Desfazer ao lado, e o erro nascendo junto do botão em vez de um banner
// no topo (que no celular fica fora da tela).
function WatermarkTextField({ group, maxChars, draft, saving, savedAt, error, onDraftChange, onSave, onReset }) {
  const saved = group.watermarkText ?? ''
  const value = draft ?? saved
  const dirty = value !== saved
  const justSaved = Boolean(savedAt) && !dirty
  const used = [...value].length

  function handleSave() {
    if (!dirty || saving) return
    onSave(group.id, value)
  }

  return (
    <div className="cfg-dest-picker">
      <input
        className="pnl-input"
        value={value}
        maxLength={maxChars}
        placeholder="Ex.: Achadinhos da Maria"
        aria-label="Texto da marca d'água"
        onChange={(e) => {
          // [...string] conta codepoints (não UTF-16 code units), igual ao
          // limite do servidor e do renderizador — os três não podem divergir.
          onDraftChange(group.id, [...e.target.value].slice(0, maxChars).join(''))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleSave() }
        }}
      />
      <div className="cfg-dest-actions">
        <span className={`cfg-dest-status${dirty ? ' is-dirty' : ''}`}>
          {dirty ? `Não salvo · ${used}/${maxChars}` : `${used}/${maxChars} caracteres`}
        </span>
        {dirty && (
          <button type="button" className="pnl-btn" onClick={() => onReset(group.id)} disabled={saving}>Desfazer</button>
        )}
        <button type="button" className="pnl-btn is-primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Salvando…' : 'Salvar marca'}
        </button>
      </div>

      {/* Resposta ao clique em Salvar. Antes o resultado era uma troca de texto
          de 12px na mesma linha do contador de caracteres — a cliente clicava e
          não percebia se tinha salvado. Agora é um aviso com ícone, cor de
          fundo e uma frase inteira, que aparece com animação: dá para ver com o
          canto do olho, no celular, sem procurar.

          `role="alert"` no erro (o leitor de tela interrompe e anuncia) e
          `role="status"` no sucesso (anuncia sem interromper). */}
      {(saving || justSaved || error) && (
        <p
          className={`cfg-save-feedback${error ? ' is-error' : justSaved ? ' is-ok' : ' is-busy'} cfg-fadeup`}
          role={error ? 'alert' : 'status'}
          aria-live={error ? 'assertive' : 'polite'}
        >
          {!saving && <CfgIcon name={error ? 'x' : 'check'} size={14} />}
          <span>
            {saving
              ? 'Salvando a marca…'
              : error
                ? `Não deu para salvar: ${error}`
                : 'Marca salva neste destino'}
          </span>
        </p>
      )}
    </div>
  )
}

/* ── Monitor group config panel — conteúdo do painel lateral da ORIGEM ─
 *
 * Três abas, na ordem em que a pergunta aparece: para onde envia → o que
 * captura → como publica. A escolha de imagem NUNCA mora aqui: ela é do
 * destino (ver renderPostConfig). Guarda em test/image-mode-policy.test.js.
 */
function MonitorGroupConfig({ g, tab, onUpdate, canUseChannels, post, targetsState, targetsHandlers, onSetActionError, templates, defaultTemplateKey, targetsHint, plano, instagram }) {
  const [draft, setDraft] = useState('')

  const keywords = (g.blockedKeywords || '').split(',').map((s) => s.trim()).filter(Boolean)

  function addKeyword() {
    const v = draft.trim().replace(/,$/, '')
    if (v && !keywords.includes(v)) onUpdate(g.id, { blockedKeywords: [...keywords, v].join(',') })
    setDraft('')
  }

  function removeKeyword(kw) {
    onUpdate(g.id, { blockedKeywords: keywords.filter((k) => k !== kw).join(',') })
  }

  function togglePlatform(platformId) {
    const current = g.allowedPlatforms
      ? g.allowedPlatforms.split(',').filter(Boolean)
      : ALL_PLATFORMS.map((p) => p.id)
    const next = current.includes(platformId)
      ? current.filter((p) => p !== platformId)
      : [...current, platformId]
    onUpdate(g.id, { allowedPlatforms: next.join(',') })
  }

  const encaminhar = (g.forwardMode ?? 'LINK_ONLY') === 'ALLOW_NO_LINK'

  // Três estados de `templateKey`, iguais aos do robô (src/bot-worker.js, na
  // resolução de `effectiveTemplateKey`): `null` HERDA o modelo padrão global,
  // `''` é "manter texto original" explícito, e uma chave é o modelo fixo do
  // grupo.
  //
  // A tela tratava `null` e `''` como a mesma coisa e mostrava "Manter texto
  // original convertido" nos dois. Para quem tem um modelo padrão global, isso
  // era mentira: o robô aplicava o modelo, e a tela ainda oferecia o campo de
  // texto adicional — que o robô ignora quando há modelo. A cliente escrevia,
  // salvava, lia "Texto salvo" e nada saía na oferta.
  const inheritsDefault = g.templateKey == null
  // O robô herda a chave CRUA: se o modelo padrão foi apagado depois de
  // escolhido, ele ainda conta como "tem modelo" e o complemento segue
  // descartado. Espelhar a chave crua (e não só as que ainda existem na lista)
  // é o que impede a tela de voltar a prometer o complemento onde ele não vale.
  const effectiveTemplateKey = inheritsDefault ? (defaultTemplateKey || '') : g.templateKey
  const templateApplied = effectiveTemplateKey !== ''
  // Já o <select> só pode exibir opção que existe; modelo padrão apagado cai
  // no relay na CAIXA, sem mexer em `templateApplied` acima.
  const templateValue = templateApplied && templates.some((t) => t.key === effectiveTemplateKey)
    ? effectiveTemplateKey
    : '__relay__'

  const targetsMode = targetsState[g.id]?.mode

  if (tab === 'destinos') {
    const nomeDoDestino = (id) => post.find((d) => d.id === id)?.name
    return (
      <>
        {targetsHint && (
          <div className="pnl-note-box is-info">
            Escolha para onde ele envia. Sem escolha, ele envia para todos os seus destinos.
          </div>
        )}
        {!targetsHint && targetsMode === 'all' && (
          <div className="pnl-note-box">
            Hoje esta origem usa o <strong>padrão: todos</strong> — ela envia para todos os seus
            destinos porque nenhum foi escolhido ainda. Marque os que você quer e salve.
          </div>
        )}

        <CfgSection icon="send" title="Para onde esse grupo envia" desc="Marque os destinos que recebem as ofertas desse grupo e salve.">
          <div className="cfg-dest-block">
            <DestinationPicker
              groupId={g.id}
              post={post}
              state={targetsState[g.id]}
              onLoad={targetsHandlers.load}
              onToggle={targetsHandlers.toggle}
              onSetAll={targetsHandlers.setAll}
              onSave={targetsHandlers.save}
              onReset={targetsHandlers.reset}
            />
          </div>
        </CfgSection>

        {/* Os três avisos abaixo vieram do antigo assistente "Criar novo
            espelhamento" (2026-09-19). Ele saiu de cena quando a escolha de
            destinos virou a primeira aba deste painel — mas o que ele
            protegia continua valendo, e é aqui que precisa aparecer: ANTES de
            salvar, nunca depois, com destino que parou de receber. */}

        {/* A origem em modo 'all' envia hoje para TODOS os destinos. Salvar uma
            escolha explícita a tira desse modo (RCA 2026-08-26). */}
        {plano?.perdeOEnvioParaTodos?.length > 0 && (
          <div className="pnl-note-box is-error" role="alert">
            Hoje <strong>{g.name}</strong> envia para todos os seus grupos de destino porque você nunca escolheu nenhum.
            Ao salvar esta escolha, ela passa a enviar <strong>só</strong> para os grupos marcados — e estes deixam de receber:{' '}
            {plano.perdeOEnvioParaTodos.map(nomeDoDestino).filter(Boolean).join(', ')}.
          </div>
        )}

        {/* Desmarcar tudo é como a cliente desliga o espelhamento daquela
            origem. Salvar isso calado a deixaria sem envio sem saber; barrar
            tiraria o controle dela. Então avisa. */}
        {plano?.ficaSemDestino && (
          <div className="pnl-note-box is-error" role="alert">
            Sem nenhum grupo marcado, <strong>{g.name}</strong> para de publicar em qualquer lugar.
            Marque pelo menos um grupo, ou salve assim mesmo se é isso que você quer.
          </div>
        )}

        {plano?.removidos?.length > 0 && (
          <div className="pnl-note-box" role="alert">
            Estes grupos deixam de receber as ofertas de <strong>{g.name}</strong>:{' '}
            {plano.removidos.map(nomeDoDestino).filter(Boolean).join(', ')}.
          </div>
        )}

        {instagram?.destinos?.length > 0 && (
          <CfgSection icon="image" title="Espelhar também nos Stories" desc="As ofertas deste grupo também viram Story nas contas marcadas.">
            <div className="cfg-dest-block">
              <div className="cfg-dest-list" role="group" aria-label="Contas do Instagram">
                {instagram.destinos.map((destino) => {
                  const marcado = (instagram.escolhidos[g.id] || []).includes(destino.id)
                  return (
                    <label key={destino.id} className={`cfg-dest-option${marcado ? ' is-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={instagram.salvando === g.id}
                        onChange={() => instagram.onToggle(g.id, destino.id)}
                      />
                      <span className="cfg-dest-name">{destino.name}</span>
                      <span className="cfg-dest-kind">Instagram</span>
                    </label>
                  )
                })}
              </div>
              <p className="pnl-hint" style={{ margin: 0 }}>
                Esta escolha salva sozinha, na hora de marcar.
              </p>
            </div>
          </CfgSection>
        )}
      </>
    )
  }

  if (tab === 'captura') {
    return (
      <CfgSection icon="search" title="O que o robô captura" desc="Quais links viram oferta a partir desse grupo.">

        <CfgRow label="Lojas aceitas" hint="Sem nenhuma marcada, usa as lojas da configuração geral.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_PLATFORMS.map((platform) => {
              const selected = new Set((g.allowedPlatforms || '').split(',').filter(Boolean))
              const on = g.allowedPlatforms ? selected.has(platform.id) : true
              return (
                <button
                  key={platform.id}
                  type="button"
                  className={`cfg-platform-chip${on ? ' is-on' : ''}`}
                  onClick={() => togglePlatform(platform.id)}
                >
                  <span style={{ display: 'flex', opacity: on ? 1 : 0.3 }}><CfgIcon name="check" size={13} /></span>
                  {platform.label}
                </button>
              )
            })}
          </div>
        </CfgRow>

        <CfgRow label="Palavras bloqueadas" hint="Ignora mensagens com essas palavras. Soma à lista geral.">
          <KeywordTagInput
            keywords={keywords}
            draft={draft}
            onDraftChange={setDraft}
            onAdd={addKeyword}
            onRemove={removeKeyword}
          />
        </CfgRow>

        <CfgRow
          label="Encaminhar mensagens sem link"
          hint="Repassa também posts que não têm link de produto."
          last
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <button
              type="button"
              role="switch"
              aria-checked={encaminhar}
              disabled={!canUseChannels}
              className={`pnl-switch${encaminhar ? ' is-on' : ''}`}
              onClick={() => {
                if (!encaminhar && !canUseChannels) {
                  onSetActionError('O Módulo de Preservação Avançada está disponível no Trial ativo e no plano Pro.')
                  return
                }
                onUpdate(g.id, encaminhar
                  ? { forwardMode: 'LINK_ONLY' }
                  : { forwardMode: 'ALLOW_NO_LINK', noLinkScope: g.noLinkScope ?? 'TEXT_ONLY' }
                )
              }}
            ><span /></button>
            <div style={{ paddingTop: 3 }}>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                {!canUseChannels && <span style={{ color: '#b5742a', fontWeight: 600 }}>(Pro) </span>}
                {encaminhar ? 'Ligado' : 'Desligado'}
              </span>
              {encaminhar && (
                <>
                  <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 2 }}>Pode aumentar bastante o volume de mensagens.</div>
                  <select
                    className="pnl-input"
                    style={{ marginTop: 10 }}
                    value={g.noLinkScope ?? 'TEXT_ONLY'}
                    onChange={(e) => onUpdate(g.id, { forwardMode: 'ALLOW_NO_LINK', noLinkScope: e.target.value })}
                  >
                    {NO_LINK_SCOPE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </>
              )}
            </div>
          </div>
        </CfgRow>
      </CfgSection>
    )
  }

  return (
    <CfgSection icon="bolt" title="Como a oferta é publicada" desc="A aparência da mensagem que sai com o seu link.">

      <CfgRow
        label="Formato da mensagem"
        info='"Manter texto original" converte os links dentro do texto que veio do grupo. Um template reescreve tudo num layout de oferta (um produto por vez).'
        hint={
          templateApplied
            ? `Reescreve num layout de oferta — ideal para um produto só.${inheritsDefault ? ' Este grupo está usando o modelo padrão que você escolheu em Mensagens.' : ''}`
            : 'Mantém o texto do grupo e só troca os links pelos seus.'
        }
      >
        <select
          className="pnl-input"
          value={templateValue}
          onChange={(e) => {
            const v = e.target.value
            onUpdate(g.id, { templateKey: v === '__relay__' ? '' : v })
          }}
        >
          <option value="__relay__">Manter texto original convertido</option>
          {templates.map((t) => <option key={t.key} value={t.key}>Template: {t.name}</option>)}
        </select>
        {/* `templateApplied`, nunca `templateValue`: com modelo padrão apagado a
            caixa cai no relay mas o robô ainda descarta o complemento. */}
        {!templateApplied && <RelayFooterField group={g} onUpdate={onUpdate} />}
        <Link
          href="/painel/mensagens"
          style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, color: 'var(--accent-strong)', textDecoration: 'none' }}
        >
          Criar ou editar templates →
        </Link>
      </CfgRow>

      <CfgRow
        label="Link principal quando há vários"
        info={<>
          Define qual produto vira a referência principal quando a mensagem espelhada traz mais de um link.<br />
          Com template, esse é o link usado para montar a oferta de um produto só. Sem template, o texto original continua com todos os links convertidos, mas esta escolha orienta a imagem/dados principais e os registros do envio.
        </>}
        hint={templateApplied
          ? 'O template usa esse link para buscar título, preço e imagem do produto principal.'
          : 'Útil em ofertas espelhadas com vários links: todos continuam no texto, mas a imagem/dados principais seguem esta escolha.'}
        extra="cfg-fadeup"
        last
      >
        <select
          className="pnl-input"
          value={g.primaryLinkTarget ?? ''}
          onChange={(e) => onUpdate(g.id, { primaryLinkTarget: e.target.value })}
        >
          <option value="">Primeiro link (padrão)</option>
          <option value="first">Primeiro link da mensagem</option>
          <option value="last">Último link da mensagem</option>
        </select>
      </CfgRow>

      {/* 2026-08-22: o seletor "Como a oferta aparece" foi REMOVIDO da tela da
          origem. Quem escolhe como a oferta aparece é o DESTINO — a mesma
          oferta pode sair diferente em cada grupo/canal. Não reintroduzir aqui:
          guarda em test/image-mode-policy.test.js. */}
    </CfgSection>
  )
}

/* ── Nível 1: linha de fluxo do card ─────────────────────────────────
 * Estados possíveis, todos vindos do backend: carregando, sem vínculo (origem
 * explícita que ficou sem destino — não espelha) e com vínculos. O selo
 * "padrão: todos" marca a origem em modo 'all', que hoje alcança todos os
 * destinos por fallback, e não por escolha. */
function FlowLine({ direction, card, loading }) {
  // <span> e não <div>: esta linha vive DENTRO do <button> do card, e botão
  // não aceita conteúdo de bloco. O `display:block` vem do CSS.
  if (loading) return <span className="pnl-esp-flow">carregando ligações…</span>

  if (card.counterpartCount === 0) {
    return (
      <span className="pnl-esp-flow">
        <strong>
          {direction === 'origin'
            ? 'nenhum destino escolhido — esta origem não está espelhando'
            : 'nenhuma origem envia para este grupo'}
        </strong>
      </span>
    )
  }

  return (
    <span className="pnl-esp-flow">
      {direction === 'origin' ? 'envia para ' : 'recebe de '}
      <strong>{card.counterpartNames}</strong>
    </span>
  )
}

/* Card do nível 1. O card INTEIRO abre o painel lateral; a engrenagem à direita
 * é a mesma ação, só que explícita (deixa óbvio que dá para configurar). */
function GroupCard({ card, index, direction, loading, selected, dirty, saving, saved, onOpen, canUseChannels }) {
  const g = card.group
  return (
    <li className={`pnl-esp-card${selected ? ' is-selected' : ''}`}>
      <button type="button" className="pnl-esp-card-hit" onClick={() => onOpen(g.id)} aria-label={`Configurar ${g.name}`}>
        <Avatar name={g.name} gradient={gradientFor(index)} />
        <span className="pnl-esp-card-main">
          <span className="pnl-esp-card-title">
            <span className="pnl-esp-card-name">{g.name}</span>
            <TypeBadge kind={g.kind} />
            {!canUseChannels && g.kind === 'channel' && <span className="pnl-tag is-flight">Pro</span>}
            {direction === 'origin' && card.mode === 'all' && card.counterpartCount > 0 && (
              <span className="pnl-esp-tag" title="Esta origem nunca teve destinos escolhidos, então o padrão é enviar para todos os destinos cadastrados.">padrão: todos</span>
            )}
            {dirty && <span className="pnl-tag is-flight" title="Você mexeu nos destinos e ainda não salvou">destinos não salvos</span>}
            {saving && <span className="pnl-hint" style={{ color: 'var(--accent-strong)' }}>salvando…</span>}
            {saved && <span className="pnl-hint" style={{ color: 'var(--success)' }}>salvo</span>}
          </span>
          <FlowLine direction={direction} card={card} loading={loading} />
          {direction === 'origin' && (
            <span className="pnl-esp-card-meta">
              {/* Número só quando foi medido: as métricas do dia cobrem as 5
                * origens com mais movimento, e escrever "0" para as demais
                * diria que nada saiu quando na verdade não foi medido. */}
              {card.enviadasHoje !== null && (
                <span>{card.enviadasHoje} {card.enviadasHoje === 1 ? 'oferta repostada' : 'ofertas repostadas'} hoje</span>
              )}
              <span className={`pnl-esp-choice${card.usesTemplate ? ' is-template' : ''}`}>
                {card.messageModeLabel}
              </span>
            </span>
          )}
          {direction === 'dest' && (
            <span className="pnl-esp-card-meta">
              <span className="pnl-esp-choice">Imagem: {card.imageModeLabel}</span>
            </span>
          )}
        </span>
        {/* Sinal de "aqui abre configuração" para o celular, onde a engrenagem
          * some (ver painel.css). Fica DENTRO do botão de propósito: assim não
          * vira um segundo alvo de toque disputando os mesmos pixels. */}
        <span className="pnl-esp-card-chevron" aria-hidden="true">
          <CfgIcon name="chevron" size={18} />
        </span>
      </button>
      <span className={`pnl-esp-pill ${direction === 'origin' ? 'is-origin' : 'is-dest'}`} aria-hidden="true">
        {direction === 'origin' ? `${card.counterpartCount}→` : `←${card.counterpartCount}`}
      </span>
      <button type="button" className="pnl-esp-gear" onClick={() => onOpen(g.id)} aria-label={`Configurar ${g.name}`} title="Configurar">
        <CfgIcon name="gear" size={16} />
      </button>
    </li>
  )
}

function GroupColumn({ title, hint, eyebrow, cards, emptyLabel, direction, loadingOf, selectedId, dirtyOf, savingId, savedId, onOpen, onAdd, canUseChannels, hidden }) {
  return (
    <section className={`pnl-card pnl-esp-col${hidden ? ' is-hidden-mobile' : ''}`}>
      <div className="pnl-esp-col-head">
        <div style={{ minWidth: 0 }}>
          <div className="pnl-eyebrow" style={eyebrow.style}>{eyebrow.label}</div>
          <div className="pnl-card-title" style={{ marginTop: 6 }}>{title}</div>
          <p className="pnl-card-note">{hint}</p>
        </div>
        <button type="button" className="pnl-btn" onClick={onAdd}>
          <CfgIcon name="plus" size={14} /> Adicionar
        </button>
      </div>
      {cards.length === 0 ? (
        <p className="pnl-empty">{emptyLabel}</p>
      ) : (
        <ul className="pnl-grid" style={{ marginTop: 12 }}>
          {cards.map((c, i) => (
            <GroupCard
              key={c.group.id}
              card={c}
              index={i}
              direction={direction}
              loading={loadingOf(c.group.id)}
              selected={selectedId === c.group.id}
              dirty={dirtyOf(c.group.id)}
              saving={savingId === c.group.id}
              saved={savedId === c.group.id}
              onOpen={onOpen}
              canUseChannels={canUseChannels}
            />
          ))}
        </ul>
      )}
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
                <Avatar name={o.name} gradient={gradientFor(i)} size={34} />
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
                <Avatar name={d.name} gradient={gradientFor(i)} size={34} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Nível 2: painel lateral ─────────────────────────────────────────
 * Gaveta à direita no computador; folha de tela cheia no celular. O rodapé é
 * fixo: Salvar (só ativo quando há mudança pendente), a resposta do salvar e a
 * ação destrutiva de remover o grupo. O erro nasce DENTRO do painel, acima do
 * rodapé — banner na página de trás fica escondido pela gaveta. */
function GroupDrawer({ group, index, direction, flowLabel, tabs, tab, onTab, saving, error, onSave, onClose, onDelete, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="pnl-drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className="pnl-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${group.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pnl-drawer-head">
          <Avatar name={group.name} gradient={gradientFor(index)} size={44} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pnl-drawer-title">
              <span className="pnl-drawer-name">{group.name}</span>
              <TypeBadge kind={group.kind} />
            </div>
            <div className="pnl-drawer-flow">{direction === 'origin' ? 'origem' : 'destino'} · {flowLabel}</div>
          </div>
          <button type="button" className="pnl-drawer-close" onClick={onClose} aria-label="Fechar">
            <CfgIcon name="x" size={16} />
          </button>
        </header>

        <div className="pnl-drawer-tabs" role="tablist" aria-label="Configurações deste grupo">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? 'is-active' : ''}
              onClick={() => onTab(t.key)}
            >{t.label}</button>
          ))}
        </div>

        <div className="pnl-drawer-body">{children}</div>

        {error && (
          <p className="pnl-drawer-error" role="alert">{error}</p>
        )}

        <footer className="pnl-drawer-foot">
          <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={onDelete}>
            Excluir grupo
          </button>
          <span style={{ flex: 1 }} />
          {saving && <span className="pnl-hint" style={{ color: 'var(--accent-strong)' }}>salvando…</span>}
          {/* Este é o "pronto" da gaveta: salva o que estiver pendente e FECHA.
            * Desligado quando nada mudou ele parecia clicável (o `.pnl-btn` não
            * tinha cara de desligado) e não fazia nada — a cliente clicava e a
            * janela ficava aberta. Só fica desligado enquanto está salvando. */}
          <button type="button" className="pnl-btn is-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

/* ── Modal "Adicionar" ───────────────────────────────────────────────
 * Duas portas: escolher um grupo que a cliente já participa (lista do WhatsApp)
 * ou cadastrar um canal. O papel (origem/destino) já vem preenchido pela coluna
 * de onde o botão foi clicado, e pode ser trocado aqui. */
function AddGroupModal({
  open, role, onRole, onClose, canUseChannels,
  waGroups, loadingWA, waError, onLoadWA, existingJidRoles, addingKey, onAddFromWA, onAddChannel,
}) {
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const term = filter.trim().toLowerCase()
  const list = (waGroups ?? []).filter((g) => !term || g.name.toLowerCase().includes(term))

  return (
    <div className="pnl-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="pnl-modal pnl-esp-add"
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar grupo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho preso e corpo rolando: com a lista de grupos do WhatsApp
          * inteira aqui dentro, o título e o "fechar" saíam da tela e no
          * celular ficavam atrás da barra de endereço do navegador. */}
        <div className="pnl-esp-add-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>Adicionar grupo</h3>
            <p>Escolha de onde ele vem e qual o papel dele.</p>
          </div>
          <button type="button" className="pnl-drawer-close" onClick={onClose} aria-label="Fechar">
            <CfgIcon name="x" size={16} />
          </button>
        </div>

        <div className="pnl-esp-add-body">
        <div style={{ marginTop: 0 }}>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Papel</p>
          {/* Classe própria: estes dois rótulos são longos e, na régua de
            * `.pnl-seg`, em 375px o "Destino" nascia fora da tela — a pessoa
            * não via que havia uma segunda opção. No celular eles viram duas
            * linhas inteiras (ver painel.css). */}
          <div className="pnl-seg pnl-esp-add-role" role="tablist" aria-label="Papel do grupo">
            <button type="button" role="tab" aria-selected={role === 'monitor'} className={role === 'monitor' ? 'is-active' : ''} onClick={() => onRole('monitor')}>
              Origem · o robô pega ofertas
            </button>
            <button type="button" role="tab" aria-selected={role === 'post'} className={role === 'post' ? 'is-active' : ''} onClick={() => onRole('post')}>
              Destino · o robô publica
            </button>
          </div>
        </div>

        <div className="pnl-esp-add-cards">
          <button type="button" className="pnl-esp-add-card is-on" onClick={onLoadWA} disabled={loadingWA}>
            <span className="cfg-section-icon"><CfgIcon name="users" size={20} /></span>
            <span style={{ fontWeight: 600 }}>Escolher um grupo que já estou</span>
            <span className="pnl-hint">
              {loadingWA ? 'Carregando os seus grupos…' : 'Lista os grupos do seu WhatsApp. Precisa do robô conectado.'}
            </span>
          </button>
          <button
            type="button"
            className="pnl-esp-add-card"
            onClick={onAddChannel}
            style={canUseChannels ? undefined : { opacity: 0.7 }}
          >
            <span className="cfg-section-icon"><CfgIcon name="chat" size={20} /></span>
            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              Adicionar canal {!canUseChannels && <span className="pnl-tag is-flight">Pro</span>}
            </span>
            <span className="pnl-hint">
              {canUseChannels ? 'Por link ou um canal que você já segue.' : 'Canais bloqueados no Basic.'}
            </span>
          </button>
        </div>

        {waError && (
          <div className="pnl-note-box is-error" style={{ marginTop: 14 }} role="alert">
            <strong style={{ fontWeight: 600 }}>Falha ao carregar os grupos do WhatsApp</strong>
            <p style={{ marginTop: 4 }}>{waError} Confirme se o robô está conectado ao WhatsApp e tente novamente.</p>
          </div>
        )}

        {waGroups && (
          <>
            <input
              className="cfg-dest-search"
              style={{ marginTop: 14 }}
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Procurar grupo pelo nome"
              aria-label="Procurar grupo pelo nome"
            />
            <ul className="pnl-esp-add-list">
              {list.length === 0 && <li className="pnl-hint" style={{ padding: 12 }}>Nenhum grupo com esse nome.</li>}
              {list.map((g) => {
                const key = `${g.waJid}::${role}`
                const already = existingJidRoles.has(key)
                return (
                  <li key={g.waJid} className="pnl-esp-add-row">
                    <span className="pnl-esp-add-name">{g.name}</span>
                    {already ? (
                      <span className="pnl-hint">já cadastrado</span>
                    ) : (
                      <button type="button" className="pnl-btn is-primary" onClick={() => onAddFromWA(g, role)} disabled={addingKey === key}>
                        {addingKey === key ? 'Adicionando…' : `Adicionar como ${role === 'monitor' ? 'origem' : 'destino'}`}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {role === 'monitor' && (
          <p className="pnl-hint" style={{ marginTop: 12 }}>
            Depois de adicionar, escolha para onde ele envia. Sem escolha, ele envia para todos os seus destinos.
          </p>
        )}
        </div>
      </div>
    </div>
  )
}

export default function EspelhamentoPage() {
  usePainelHeader({
    title: 'Espelhamento',
    subtitle: 'De quais grupos o robô pega ofertas e onde ele publica com o seu link',
  })
  const { online, refreshSession, openPro } = usePainel()

  const [groups, setGroups] = useState([])
  // Precisam ser declarados ANTES dos callbacks de destino: `post` entra na
  // lista de dependências de alguns `useCallback`, e lista de dependências é
  // avaliada na hora — um `const` declarado mais abaixo estoura
  // "Cannot access 'post' before initialization" e a página inteira não abre.
  const monitor = groups.filter((g) => g.role === 'monitor')
  const post = groups.filter((g) => g.role === 'post')

  const [loadingGroups, setLoadingGroups] = useState(true)
  const [actionError, setActionError] = useState('')
  const [summary, setSummary] = useState(null)
  const [switchingMirror, setSwitchingMirror] = useState(false)

  const [mobileCol, setMobileCol] = useState('origem')
  // `undefined` = a cliente nunca escolheu (a regra destaca a primeira);
  // `null` = ela desmarcou de propósito. Ver `origemDestacada` abaixo.
  const [selectedOriginId, setSelectedOriginId] = useState(undefined)
  const [instagramDestinations, setInstagramDestinations] = useState([])
  const [instagramMirrorTargets, setInstagramMirrorTargets] = useState({})
  const [savingInstagramOrigin, setSavingInstagramOrigin] = useState('')

  // Painel lateral (nível 2). `drawerId` é o grupo aberto; `drawerHint` liga o
  // recado de primeira escolha de destinos logo depois de cadastrar a origem.
  const [drawerId, setDrawerId] = useState(null)
  const [drawerTab, setDrawerTab] = useState('destinos')
  const [drawerHint, setDrawerHint] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(null)

  const [savingGroupId, setSavingGroupId] = useState(null)
  const [savedGroupId, setSavedGroupId] = useState(null)
  const [groupErrors, setGroupErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Um registro por grupo de origem:
  //   { loading, error, savedIds, mode, draftIds, saving, savedAt }
  // `savedIds` é o que está no servidor; `draftIds` é o que está na tela. A
  // diferença entre os dois é o que faz a tela dizer "alterações não salvas".
  // É também a fonte única dos cards e do mapa: salvar aqui atualiza os dois
  // atrás do painel, sem recarregar nada.
  const [targetsState, setTargetsState] = useState({})
  // Cada carregamento ganha um número por grupo: resposta atrasada de um
  // carregamento antigo é descartada em vez de sobrescrever o que a pessoa já
  // marcou (foi assim que a escolha da cliente sumia).
  const targetRequestRef = useRef({})

  const [addModal, setAddModal] = useState(null)
  const [waGroups, setWaGroups] = useState(null)
  const [loadingWA, setLoadingWA] = useState(false)
  const [waError, setWaError] = useState('')
  const [addingKey, setAddingKey] = useState('')

  const [showChannelModal, setShowChannelModal] = useState(false)
  const [channelButtonGroupId, setChannelButtonGroupId] = useState(null)
  const [followStatus, setFollowStatus] = useState({})
  const [adminStatus, setAdminStatus] = useState({})
  const [refreshingAdminId, setRefreshingAdminId] = useState(null)
  const [healthByGroup, setHealthByGroup] = useState({})
  const [planSubject, setPlanSubject] = useState({ plan: 'trial', accessExpiresAt: null })
  const [templates, setTemplates] = useState([])
  // Modelo padrão global (BotConfig.mirrorTemplateKeyDefault). Sem ele a tela não
  // tem como saber o que um grupo com templateKey nulo realmente publica.
  const [defaultTemplateKey, setDefaultTemplateKey] = useState('')

  async function load() {
    setLoadingGroups(true)
    setActionError('')
    try {
      const list = await api.groups()
      setGroups(list)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setLoadingGroups(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoadingGroups(true)
    Promise.all([api.groups(), api.me(), loadTemplateStore().catch(() => ({})), api.getConfig().catch(() => null)])
      .then(([data, me, templateStore, config]) => {
        if (!active) return
        setTemplates(composeTemplates(templateStore))
        setDefaultTemplateKey(config?.mirrorTemplateKeyDefault || '')
        setPlanSubject({ plan: me?.plan ?? 'trial', accessExpiresAt: me?.accessExpiresAt ?? null })
        setGroups(data)
      })
      .catch((err) => { if (active) setActionError(err.message) })
      .finally(() => { if (active) setLoadingGroups(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    api.logsSummary('today')
      .then((s) => { if (active) setSummary(s) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      api.instagramConnections().catch(() => []),
      api.instagramMirrorTargets().catch(() => []),
      api.me().catch(() => null),
    ]).then(([connections, targets, me]) => {
      if (!active) return
      setInstagramDestinations(hasInstagramStoriesAccess(me || {}) ? instagramDestinationsFromConnections(connections) : [])
      const mapped = {}
      for (const target of targets) (mapped[target.sourceGroupId] ||= []).push(target.destinationId)
      setInstagramMirrorTargets(mapped)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const postChannels = groups.filter((g) => g.kind === 'channel' && g.role === 'post')
    if (postChannels.length === 0) return undefined
    Promise.all(postChannels.map(async (g) => {
      try {
        const h = await api.channelHealth(g.id)
        return [g.id, h]
      } catch { return [g.id, null] }
    })).then((entries) => {
      if (!active) return
      setHealthByGroup((prev) => {
        const next = { ...prev }
        for (const [id, h] of entries) if (h) next[id] = h
        return next
      })
    })
    return () => { active = false }
  }, [groups])

  async function refreshAdmin(group) {
    setRefreshingAdminId(group.id)
    try {
      const data = await api.refreshChannelAdmin(group.id)
      setAdminStatus((prev) => ({ ...prev, [group.id]: data.isViewerOwner ? 'owner' : 'not-owner' }))
    } catch {
      setAdminStatus((prev) => ({ ...prev, [group.id]: 'error' }))
    } finally {
      setRefreshingAdminId(null)
    }
  }

  async function handleDelete(id) {
    setActionError('')
    try {
      await api.deleteGroup(id)
      if (drawerId === id) setDrawerId(null)
      await load()
    } catch (err) { setActionError(err.message) }
  }

  async function handleUpdateGroup(id, data) {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...data } : g))
    setSavingGroupId(id)
    setSavedGroupId(null)
    setGroupErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      await api.updateGroup(id, data)
      setSavedGroupId(id)
      window.setTimeout(() => setSavedGroupId((current) => current === id ? null : current), 1500)
      return true
    } catch (err) {
      setGroupErrors((prev) => ({ ...prev, [id]: err.message }))
      setActionError(err.message)
      await load()
      return false
    } finally {
      setSavingGroupId((current) => current === id ? null : current)
    }
  }

  // Rascunho local do texto da marca d'água, por grupo. Ver WatermarkTextField:
  // digitar NÃO salva; só o botão Salvar grava.
  const [watermarkDrafts, setWatermarkDrafts] = useState({})
  const [watermarkSaving, setWatermarkSaving] = useState({})
  const [watermarkSavedAt, setWatermarkSavedAt] = useState({})
  const [watermarkErrors, setWatermarkErrors] = useState({})

  const watermarkSavedTimers = useRef({})
  useEffect(() => {
    const timers = watermarkSavedTimers.current
    return () => { for (const timer of Object.values(timers)) clearTimeout(timer) }
  }, [])

  const setWatermarkDraft = useCallback((id, value) => {
    setWatermarkDrafts((prev) => ({ ...prev, [id]: value }))
    setWatermarkErrors((prev) => (prev[id] ? { ...prev, [id]: '' } : prev))
  }, [])

  const resetWatermarkDraft = useCallback((id) => {
    setWatermarkDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setWatermarkErrors((prev) => (prev[id] ? { ...prev, [id]: '' } : prev))
  }, [])

  const saveWatermarkText = useCallback(async (id, value) => {
    setWatermarkSaving((prev) => ({ ...prev, [id]: true }))
    setWatermarkErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      const updated = await api.updateGroup(id, { watermarkText: value })
      // O servidor normaliza (colapsa espaços, apara pontas). Adotamos o valor
      // DELE como verdade e limpamos o rascunho — assim o campo passa a mostrar
      // exatamente o que ficou gravado, sem divergir do banco em silêncio.
      setGroups((prev) => prev.map((g) => g.id === id ? { ...g, watermarkText: updated?.watermarkText ?? value } : g))
      resetWatermarkDraft(id)
      setWatermarkSavedAt((prev) => ({ ...prev, [id]: Date.now() }))
      // A confirmação some sozinha depois de alguns segundos. Aviso de sucesso
      // que fica para sempre na tela deixa de ser aviso: na próxima visita a
      // pessoa lê "Marca salva" sem ter salvado nada agora.
      clearTimeout(watermarkSavedTimers.current[id])
      watermarkSavedTimers.current[id] = setTimeout(() => {
        setWatermarkSavedAt((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }, WATERMARK_SAVED_FEEDBACK_MS)
      return true
    } catch (err) {
      // O erro nasce AO LADO do campo. Nada de `load()` aqui: recarregar todos
      // os grupos era o que apagava o texto que a pessoa acabou de escrever.
      setWatermarkErrors((prev) => ({ ...prev, [id]: err.message }))
      return false
    } finally {
      setWatermarkSaving((prev) => ({ ...prev, [id]: false }))
    }
  }, [resetWatermarkDraft])

  // Bug relatado por cliente (2026-08-29): ela desmarcava um destino, salvava, e
  // ao reabrir ele estava marcado de novo — e continuava recebendo oferta.
  //
  // Causa: a lista de destinos ficava clicável enquanto o GET ainda estava em
  // vôo (celular em 4G leva segundos). Quem desmarcasse nesse intervalo tinha a
  // escolha ATROPELADA pela resposta, que remarcava tudo; o botão de salvar
  // gravava a lista da resposta, não a escolha dela.
  //
  // As travas que impedem a volta do bug: a lista só vira clicável depois que a
  // resposta chega (não há janela para clique perdido) e resposta de um
  // carregamento antigo é descartada pelo número da requisição.
  const patchTargets = useCallback((groupId, patch) => {
    setTargetsState((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] ?? {}), ...patch } }))
  }, [])

  const loadTargets = useCallback(async (groupId, { force = false } = {}) => {
    let skip = false
    setTargetsState((prev) => {
      const current = prev[groupId]
      // Já carregado (ou carregando): não refaz o GET a cada vez que a pessoa
      // abre e fecha o painel — e, principalmente, não joga fora uma escolha
      // que ela fez e ainda não salvou.
      if (!force && current && (current.loading || Array.isArray(current.savedIds))) skip = true
      return prev
    })
    if (skip) return
    const requestId = (targetRequestRef.current[groupId] ?? 0) + 1
    targetRequestRef.current[groupId] = requestId
    patchTargets(groupId, { loading: true, error: '' })
    try {
      const data = await api.groupTargets(groupId)
      if (targetRequestRef.current[groupId] !== requestId) return
      const ids = data.postIds ?? []
      patchTargets(groupId, { loading: false, error: '', savedIds: ids, draftIds: ids, mode: data.mode ?? 'explicit' })
    } catch (err) {
      if (targetRequestRef.current[groupId] !== requestId) return
      patchTargets(groupId, { loading: false, error: err.message })
    }
  }, [patchTargets])

  const toggleTargetDraft = useCallback((groupId, postId) => {
    setTargetsState((prev) => {
      const current = prev[groupId]
      // Sem lista carregada não há o que marcar: ignorar aqui é a mesma trava
      // que evita o clique perdido.
      if (!current || !Array.isArray(current.savedIds)) return prev
      const draft = current.draftIds ?? []
      const next = draft.includes(postId) ? draft.filter((id) => id !== postId) : [...draft, postId]
      return { ...prev, [groupId]: { ...current, draftIds: next, savedAt: null } }
    })
  }, [])

  const setAllTargetDrafts = useCallback((groupId, checked) => {
    setTargetsState((prev) => {
      const current = prev[groupId]
      if (!current || !Array.isArray(current.savedIds)) return prev
      return { ...prev, [groupId]: { ...current, draftIds: checked ? post.map((p) => p.id) : [], savedAt: null } }
    })
  }, [post])

  const resetTargetDraft = useCallback((groupId) => {
    setTargetsState((prev) => {
      const current = prev[groupId]
      if (!current || !Array.isArray(current.savedIds)) return prev
      return { ...prev, [groupId]: { ...current, draftIds: current.savedIds, savedAt: null, error: '' } }
    })
  }, [])

  const saveTargets = useCallback(async (groupId) => {
    const current = targetsState[groupId]
    // Devolve `true` quando gravou e `false` quando falhou: o "Salvar" da
    // gaveta só fecha com `true` — fechar por cima de um erro esconderia que
    // nada foi para o servidor.
    if (!current || current.loading || current.saving || !Array.isArray(current.savedIds)) return false
    // Só mandamos ids que ainda existem na lista de destinos da tela. Id de um
    // grupo já apagado faz a rota devolver 400 ("Lista de grupos destino
    // inválida") e a escolha inteira se perde — com cara de "não salvou".
    const escolhidos = (current.draftIds ?? []).filter((id) => post.some((p) => p.id === id))
    // Quem decide o que vai para o endpoint é a regra pura, nunca a lista crua
    // da tela: aqui o painel está EDITANDO (abre com os destinos atuais
    // marcados), então desmarcar é remoção deliberada e vale exatamente o que
    // ficou marcado. Era o que o antigo assistente fazia em modo 'editar'.
    const idsToSave = planMirrorCreation({
      currentPostIds: current.savedIds ?? [],
      currentMode: current.mode ?? 'explicit',
      chosenPostIds: escolhidos,
      allPostIds: post.map((p) => p.id),
      modo: 'editar',
    }).postIds
    patchTargets(groupId, { saving: true, error: '' })
    setActionError('')
    try {
      await api.updateGroupTargets(groupId, idsToSave)
      patchTargets(groupId, {
        saving: false,
        error: '',
        savedIds: idsToSave,
        draftIds: idsToSave,
        // Salvar é sempre escolha explícita, inclusive vazia: desmarcar tudo
        // quer dizer "não mande para ninguém", e não o fallback de todos.
        mode: 'explicit',
        savedAt: Date.now(),
      })
      return true
    } catch (err) {
      // O aviso nasce ao lado do botão: o banner do topo da página fica fora da
      // tela no celular, então a falha passava despercebida e a cliente saía
      // achando que tinha salvado.
      patchTargets(groupId, { saving: false, error: err.message })
      setActionError(err.message)
      return false
    }
  }, [targetsState, post, patchTargets])

  const targetsHandlers = useMemo(() => ({
    load: loadTargets,
    toggle: toggleTargetDraft,
    setAll: setAllTargetDrafts,
    reset: resetTargetDraft,
    save: saveTargets,
  }), [loadTargets, toggleTargetDraft, setAllTargetDrafts, resetTargetDraft, saveTargets])

  // Os vínculos de TODAS as origens são carregados assim que a lista chega: é o
  // que alimenta os cards e o mapa. O painel lateral reaproveita o mesmo
  // registro (loadTargets não refaz o GET), então abrir a gaveta não custa rede.
  useEffect(() => {
    for (const g of monitor) loadTargets(g.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, loadTargets])

  // Mesma regra do backend (Pro, premium ou teste ativo). A cópia local antiga
  // esquecia o premium e travava canais que a API libera.
  const canUseChannels = hasProLikeAccess(planSubject)

  const existingJidRoles = new Set(groups.map((g) => `${g.waJid}::${g.role}`))

  // Vínculos reais → só destinos que ainda existem entram no desenho (o
  // endpoint pode devolver id de grupo apagado enquanto a lista não recarrega).
  const destById = new Map(post.map((d) => [d.id, d]))
  const destsOf = (originId) => (targetsState[originId]?.savedIds ?? [])
    .map((id) => destById.get(id))
    .filter(Boolean)
  const destIdsOf = (originId) => destsOf(originId).map((d) => d.id)
  const targetsReady = (originId) => Array.isArray(targetsState[originId]?.savedIds)
  const targetsLoading = (originId) => !targetsReady(originId) && !targetsState[originId]?.error

  function targetsDirtyFor(groupId) {
    const targetState = targetsState[groupId]
    // Destinos mexidos e ainda não salvos precisam aparecer no CARD: fechar o
    // painel sem salvar não pode ser silencioso.
    const targetsDirty = Boolean(targetState && Array.isArray(targetState.savedIds)
      && !sameIdSet(targetState.draftIds ?? [], targetState.savedIds))
    return targetsDirty
  }

  function watermarkDirtyFor(groupId) {
    const g = groups.find((x) => x.id === groupId)
    if (!g) return false
    const draft = watermarkDrafts[groupId]
    return draft !== undefined && draft !== (g.watermarkText ?? '')
  }

  /* ── Conteúdo do painel lateral do DESTINO ───────────────────────────
   * Aqui (e só aqui) mora a escolha de como a oferta aparece: a mesma oferta
   * pode sair diferente em cada grupo/canal. Guarda em
   * test/image-mode-policy.test.js. */
  function renderPostConfig(g, tab) {
    const destinationImageMode = ['original', 'original_watermark', 'preview', 'preview_watermark'].includes(g.imageMode) ? g.imageMode : 'original'
    const watermarkMode = destinationImageMode === 'original_watermark' || destinationImageMode === 'preview_watermark'
    // Com o botão "Ver canal" ligado, o WhatsApp só aceita o botão em cima de
    // uma foto — o card clicável seria derrubado. Em vez de oferecer uma
    // escolha que não vale, a tela mostra só o que de fato pode sair e diz o
    // porquê. Ao ligar o botão, a API já grava o formato degradado, então o que
    // aparece aqui é a verdade.
    const temBotaoCanal = Boolean(g.channelButtonJid)
    // Divisão Basic/PRO (2026-09-23): marca d'água e botão "Ver canal" são do
    // PRO. Mesma regra de canais (Pro, premium ou teste ativo).
    const temPro = canUseChannels

    if (tab === 'imagem') {
      return (
        <CfgSection icon="image" title="Como a oferta aparece aqui" desc="A mesma oferta pode sair diferente em cada grupo ou canal.">
          <CfgRow
            label="Modo da imagem"
            hint={temBotaoCanal
              ? 'Com o botão "Ver canal" ligado, a oferta sai como foto: o WhatsApp só aceita o botão em cima de uma foto. Para usar o card que abre a loja, remova o botão na aba Mensagens.'
              : destinationImageMode === 'preview'
                ? 'Card clicável: tocar na imagem abre o link da oferta.'
                : destinationImageMode === 'preview_watermark'
                  ? 'Card clicável com a sua identificação na imagem: tocar abre o link da oferta.'
                  : watermarkMode
                    ? 'Foto original da oferta, com a identificação deste destino.'
                    : 'Usa a foto que veio na mensagem de origem.'}
          >
            <select
              className="pnl-input"
              value={destinationImageMode}
              onChange={(e) => {
                const nextMode = e.target.value
                if (!temPro && ['original_watermark', 'preview_watermark'].includes(nextMode)) {
                  openPro('marca')
                  return
                }
                handleUpdateGroup(g.id, {
                  imageMode: nextMode,
                  // Ao ligar a marca pela 1ª vez sem texto salvo, sugere o
                  // nome do próprio destino — a pessoa pode trocar depois.
                  ...(['original_watermark', 'preview_watermark'].includes(nextMode) && ![...(g.watermarkText ?? '')].join('').trim()
                    ? { watermarkText: [...String(g.name ?? '').trim()].slice(0, WATERMARK_TEXT_MAX_CHARS).join('') }
                    : {}),
                })
              }}
            >
              <option value="original">Original</option>
              <option value="original_watermark">Original com marca d&apos;água{temPro ? '' : ' · 🔒 PRO'}</option>
              {!temBotaoCanal && <option value="preview">Preview clicável</option>}
              {!temBotaoCanal && <option value="preview_watermark">Preview com marca d&apos;água{temPro ? '' : ' · 🔒 PRO'}</option>}
            </select>
          </CfgRow>
          {watermarkMode && (
            <CfgRow
              label="Texto da marca d&apos;água"
              hint="Escreva o texto todo e clique em Salvar. Aparece no meio da foto, apenas neste destino."
              extra="cfg-fadeup"
            >
              <WatermarkTextField
                group={g}
                maxChars={WATERMARK_TEXT_MAX_CHARS}
                draft={watermarkDrafts[g.id]}
                saving={Boolean(watermarkSaving[g.id])}
                savedAt={watermarkSavedAt[g.id]}
                error={watermarkErrors[g.id]}
                onDraftChange={setWatermarkDraft}
                onSave={saveWatermarkText}
                onReset={resetWatermarkDraft}
              />
            </CfgRow>
          )}
          {watermarkMode && (
            <CfgRow
              label="Cor da marca d&apos;água"
              hint="As duas aparecem em qualquer foto (a marca tem contorno). Escolha a que combina melhor com as suas fotos."
              extra="cfg-fadeup"
            >
              <select
                className="pnl-input"
                value={g.watermarkColor === 'black' ? 'black' : 'white'}
                onChange={(e) => handleUpdateGroup(g.id, { watermarkColor: e.target.value })}
              >
                <option value="white">Branca</option>
                <option value="black">Preta</option>
              </select>
            </CfgRow>
          )}
          {watermarkMode && (
            <CfgRow
              label="Tamanho da marca d&apos;água"
              hint="Média é o tamanho de sempre. Pequena chama menos atenção; grande fica mais fácil de ler na miniatura."
              extra="cfg-fadeup"
            >
              <select
                className="pnl-input"
                value={WATERMARK_SIZES.includes(g.watermarkSize) ? g.watermarkSize : 'medium'}
                onChange={(e) => handleUpdateGroup(g.id, { watermarkSize: e.target.value })}
              >
                <option value="small">Pequena</option>
                <option value="medium">Média</option>
                <option value="large">Grande</option>
              </select>
            </CfgRow>
          )}
          {watermarkMode && (
            <CfgRow
              label="Posição da marca d&apos;água"
              hint="Centro é a posição de sempre. Nos cantos, a marca sai menor e não cobre o meio da foto."
              last
              extra="cfg-fadeup"
            >
              <select
                className="pnl-input"
                value={WATERMARK_POSITIONS.includes(g.watermarkPosition) ? g.watermarkPosition : 'center'}
                onChange={(e) => handleUpdateGroup(g.id, { watermarkPosition: e.target.value })}
              >
                <option value="center">Centro</option>
                <option value="top-right">Canto superior direito</option>
                <option value="top-left">Canto superior esquerdo</option>
                <option value="bottom-right">Canto inferior direito</option>
                <option value="bottom-left">Canto inferior esquerdo</option>
              </select>
            </CfgRow>
          )}
        </CfgSection>
      )
    }

    if (tab === 'mensagens') {
      return (
        <>
          <CfgSection icon="chat" title="Mensagens deste destino" desc="O recado de boas-vindas e o botão que leva ao seu canal.">
          <CfgRow label="Mensagem de boas-vindas" hint="Enviada quando alguém entra no grupo (opcional). Salva ao sair do campo.">
            {/* `defaultValue` + `onBlur`: salvar a cada tecla faria a tela se
                repintar no meio da digitação — exatamente a briga com o campo
                que a cliente relatou na marca d'água (RCA 2026-08-29). A `key`
                garante que trocar de grupo recarrega o texto certo. */}
            <textarea
              key={g.id}
              className="pnl-input"
              style={{ fontFamily: 'inherit', fontSize: 13, minHeight: 72, width: '100%' }}
              rows={3}
              defaultValue={g.welcomeMsg ?? ''}
              onBlur={(e) => {
                if ((e.target.value ?? '') !== (g.welcomeMsg ?? '')) handleUpdateGroup(g.id, { welcomeMsg: e.target.value })
              }}
              placeholder="Mensagem enviada quando alguém entra no grupo (opcional)"
            />
          </CfgRow>

          {g.kind !== 'channel' ? (
            <CfgRow
              label={'Botão "Ver canal" no fim das ofertas'}
              hint={'Com canal escolhido, a mensagem leva o botão "Ver canal" no fim e a foto sempre vem da mensagem de origem. Sem canal, ela sai igual, só sem o botão. Se a oferta de origem não tiver foto, a mensagem sai mesmo assim — só sem imagem e sem o botão.'}
              last
            >
              <ProLock feature="vercanal" locked={!temPro}>
              {g.channelButtonJid ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--pnl-radius-sm)', padding: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{g.channelButtonName || 'Canal sem nome'}</div>
                    <div className="pnl-hint" style={{ marginTop: 2 }}>canal escolhido</div>
                  </div>
                  <div className="pnl-toolbar">
                    <button type="button" className="pnl-btn" onClick={() => setChannelButtonGroupId(g.id)}>Trocar canal</button>
                    <button type="button" className="pnl-btn" onClick={() => handleUpdateGroup(g.id, { channelButtonJid: '', channelButtonName: '' })}>Remover botão</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="pnl-btn is-primary" onClick={() => setChannelButtonGroupId(g.id)}>
                  Escolher canal do botão
                </button>
              )}
              </ProLock>
            </CfgRow>
          ) : (
            <CfgRow label={'Botão "Ver canal"'} hint="Disponível só em grupos — este destino já é um canal." last>
              <span className="pnl-hint">—</span>
            </CfgRow>
          )}
          </CfgSection>

          {/* Saúde deste destino: veio da antiga aba "Anti-ban" (removida
              2026-09-19 — para um GRUPO era só uma frase e um link). O ritmo
              de envio (rajada/intervalo/horário) mora inteiro no Anti-banimento
              agora (specs/018-unificar-protecao-anti-ban); aqui fica só o
              atalho, mais — só em CANAL, que é configuração de verdade — o
              status de admin/saúde do canal em si (não duplicar esse controle
              de edição para grupo, que não tem admin de canal). */}
          {g.kind === 'channel' ? (
            <CfgSection icon="shield" title="Saúde deste destino" desc="Os limites que protegem o seu número de ser bloqueado.">
              <div style={{ padding: '14px 20px', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <AdminBadge status={adminStatus[g.id] ?? 'unknown'} onRefresh={() => refreshAdmin(g)} refreshing={refreshingAdminId === g.id} />
                  {healthByGroup[g.id] && <HealthBadge status={healthByGroup[g.id].status} />}
                </div>
                <ChannelHealthPanel
                  group={g}
                  initialHealth={healthByGroup[g.id]}
                  onHealthChange={(h) => setHealthByGroup((prev) => ({ ...prev, [g.id]: h }))}
                />
                <Link href={`/painel/anti-banimento?parte=ritmo&destino=${g.id}`} className="pnl-link-btn">Ajustar no Anti-banimento PRO →</Link>
              </div>
            </CfgSection>
          ) : (
            <CfgSection icon="shield" title="Saúde deste destino" desc="Os limites que protegem o seu número de ser bloqueado.">
              <div style={{ padding: '14px 20px', display: 'grid', gap: 10 }}>
                <p className="pnl-hint" style={{ margin: 0 }}>
                  O ritmo de envio deste grupo (quantas ofertas por dia, quanto tempo entre uma e outra,
                  horário de funcionamento) fica no Anti-banimento, que vale para todos os destinos.
                </p>
                <Link href={`/painel/anti-banimento?parte=ritmo&destino=${g.id}`} className="pnl-link-btn">Ajustar no Anti-banimento PRO →</Link>
              </div>
            </CfgSection>
          )}
        </>
      )
    }

    return null
  }

  /* ── Cartões do nível 1 ─────────────────────────────────────────── */
  // Os vínculos no formato que a regra pura espera. `targetsState` é a fonte
  // única: salvar no painel atualiza cartão e mapa sem recarregar nada.
  const links = Object.fromEntries(monitor.map((o) => [o.id, {
    postIds: targetsState[o.id]?.savedIds ?? [],
    mode: targetsState[o.id]?.mode ?? 'explicit',
  }]))

  const espelhos = buildMirrorCards({
    origens: monitor,
    destinos: post,
    links,
    topSources: Array.isArray(summary?.topSources) ? summary.topSources : [],
    todasAsLojas: AFFILIATE_PLATFORMS.map((p) => p.id),
  })

  const originCards = espelhos.map((card) => ({
    group: card.origem,
    counterpartCount: card.destinos.length,
    counterpartNames: card.destinos.map((d) => d.name).join(', '),
    mode: card.modo,
    enviadasHoje: card.enviadasHoje,
    usesTemplate: (card.origem.templateKey == null ? defaultTemplateKey : card.origem.templateKey) !== '',
    messageModeLabel: (() => {
      const key = card.origem.templateKey == null ? defaultTemplateKey : card.origem.templateKey
      if (!key) return 'Mensagem original'
      const name = templates.find((template) => template.key === key)?.name
      return name ? `Template: ${name}` : 'Com template'
    })(),
  }))

  /* A origem destacada no mapa de conexões é DERIVADA no render, nunca gravada por
   * efeito: `setState` dentro de `useEffect` dispara renderização em cascata
   * (regra `react-hooks/set-state-in-effect`) e ainda deixaria um quadro com
   * nada destacado. A aba nascia sem destaque nenhum, e o desenho com todas as
   * linhas ao mesmo tempo não se lê — destacar a primeira entrega a leitura
   * pronta. `null` (ela desmarcou) é respeitado; id que não existe mais cai na
   * primeira em vez de sumir com o desenho. */
  const origemDestacada = selectedOriginId === undefined
    ? resolveInitialOrigin({ origens: monitor })
    : selectedOriginId && resolveInitialOrigin({ origens: monitor, selecionada: selectedOriginId })
  const destCards = post.map((d) => {
    const os = monitor.filter((o) => destsOf(o.id).some((x) => x.id === d.id))
    return {
      group: d,
      counterpartCount: os.length,
      counterpartNames: os.map((o) => o.name).join(', '),
      imageModeLabel: ({
        original: 'original',
        original_watermark: 'original com marca d’água',
        preview: 'card da oferta',
        preview_watermark: 'card com marca d’água',
      })[d.imageMode] || 'original',
    }
  })

  const targetsFailed = monitor.filter((o) => targetsState[o.id]?.error).length

  const drawerGroup = groups.find((g) => g.id === drawerId) ?? null
  const drawerIsOrigin = drawerGroup?.role === 'monitor'
  const drawerDirty = drawerGroup
    ? (drawerIsOrigin ? targetsDirtyFor(drawerGroup.id) : watermarkDirtyFor(drawerGroup.id))
    : false
  const drawerSaving = drawerGroup
    ? Boolean(targetsState[drawerGroup.id]?.saving || watermarkSaving[drawerGroup.id] || savingGroupId === drawerGroup.id)
    : false
  const drawerError = drawerGroup
    ? (drawerIsOrigin ? targetsState[drawerGroup.id]?.error : watermarkErrors[drawerGroup.id]) || groupErrors[drawerGroup.id] || ''
    : ''
  // O que aconteceria se ela salvasse agora — é daqui que saem os avisos da
  // aba Destinos (quem deixa de receber, "fica sem destino").
  const drawerPlano = drawerGroup && drawerIsOrigin && Array.isArray(targetsState[drawerGroup.id]?.savedIds)
    ? planMirrorCreation({
      currentPostIds: targetsState[drawerGroup.id].savedIds,
      currentMode: targetsState[drawerGroup.id].mode ?? 'explicit',
      chosenPostIds: (targetsState[drawerGroup.id].draftIds ?? []).filter((id) => post.some((p) => p.id === id)),
      allPostIds: post.map((p) => p.id),
      modo: 'editar',
    })
    : null

  // A aba guardada pode não existir mais (a "Anti-ban" saiu em 2026-09-19).
  // Sem isto o painel abriria em branco em vez de cair na primeira aba.
  const drawerTabs = drawerIsOrigin ? ORIGIN_TABS : DEST_TABS
  const drawerTabSafe = drawerTabs.some((t) => t.key === drawerTab) ? drawerTab : drawerTabs[0].key

  const drawerIndex = drawerGroup
    ? (drawerIsOrigin ? monitor : post).findIndex((g) => g.id === drawerGroup.id)
    : 0
  const drawerFlow = drawerGroup
    ? (drawerIsOrigin
      ? (destsOf(drawerGroup.id).length === 0
        ? 'nenhum destino escolhido'
        : `envia para ${destsOf(drawerGroup.id).length} ${destsOf(drawerGroup.id).length === 1 ? 'destino' : 'destinos'}`)
      : (() => {
        const n = monitor.filter((o) => destIdsOf(o.id).includes(drawerGroup.id)).length
        return n === 0 ? 'nenhuma origem envia para cá' : `recebe de ${n} ${n === 1 ? 'origem' : 'origens'}`
      })())
    : ''

  function openDrawerFor(id, role, tab, hint = false) {
    setDrawerId(id)
    setDrawerTab(tab ?? (role === 'monitor' ? 'destinos' : 'imagem'))
    setDrawerHint(Boolean(hint))
  }

  function requestCloseDrawer() {
    if (drawerDirty && drawerGroup) { setConfirmDiscard({ id: drawerGroup.id }); return }
    setDrawerId(null)
  }

  function discardAndClose() {
    const id = confirmDiscard?.id
    if (id) { resetTargetDraft(id); resetWatermarkDraft(id) }
    setConfirmDiscard(null)
    setDrawerId(null)
  }

  // Salvar o que ficou de rascunho e FECHAR. Os demais campos do painel já
  // gravam sozinhos (modo da imagem, boas-vindas ao sair do campo, botão do
  // canal), então com nada pendente este botão é só o "pronto" — fechar é o
  // que a cliente espera dele, e não fazer nada foi o defeito relatado.
  // A gaveta só continua aberta quando o salvamento FALHA: aí o erro precisa
  // ser lido, e fechar por cima dele esconderia que nada foi gravado.
  async function handleDrawerSave() {
    if (!drawerGroup) return
    const id = drawerGroup.id
    if (drawerIsOrigin) {
      if (targetsDirtyFor(id)) {
        const ok = await saveTargets(id)
        if (ok === false) return
      }
    } else if (watermarkDirtyFor(id)) {
      const ok = await saveWatermarkText(id, watermarkDrafts[id])
      if (ok === false) return
    }
    setDrawerId(null)
  }

  async function handleLoadWA() {
    setLoadingWA(true)
    setWaError('')
    setWaGroups(null)
    try {
      const list = await api.sessionWAGroups()
      setWaGroups(list.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setWaError(err.message)
    } finally {
      setLoadingWA(false)
    }
  }

  async function handleAddFromWA(g, role) {
    const key = `${g.waJid}::${role}`
    setAddingKey(key)
    setActionError('')
    try {
      const created = await api.addGroup(g.waJid, g.name, role)
      await load()
      setAddModal(null)
      // Origem recém-cadastrada abre direto na escolha de destinos, com o
      // recado de que sem escolha ela envia para todos.
      if (created?.id) openDrawerFor(created.id, role, role === 'monitor' ? 'destinos' : 'imagem', role === 'monitor')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setAddingKey('')
    }
  }

  async function handleChannelCreated(group) {
    setGroups((prev) => [...prev, group])
    setAddModal(null)
    if (group.kind === 'channel' && group.role === 'monitor') {
      setFollowStatus((prev) => ({ ...prev, [group.id]: 'pending' }))
      try {
        await api.followChannelNow(group.id)
        setFollowStatus((prev) => ({ ...prev, [group.id]: 'followed' }))
      } catch {
        setFollowStatus((prev) => ({ ...prev, [group.id]: 'error' }))
      }
    }
    if (group.kind === 'channel' && group.role === 'post') refreshAdmin(group)
    openDrawerFor(group.id, group.role, group.role === 'monitor' ? 'destinos' : 'imagem', group.role === 'monitor')
  }

  async function toggleInstagramMirror(sourceGroupId, destinationId) {
    const current = instagramMirrorTargets[sourceGroupId] || []
    const next = current.includes(destinationId) ? current.filter((id) => id !== destinationId) : [...current, destinationId]
    setSavingInstagramOrigin(sourceGroupId)
    setActionError('')
    try {
      await api.instagramMirrorTargetsUpdate(sourceGroupId, next)
      setInstagramMirrorTargets((value) => ({ ...value, [sourceGroupId]: next }))
    } catch (error) {
      setActionError(error.message || 'Não foi possível atualizar os destinos Instagram.')
    } finally { setSavingInstagramOrigin('') }
  }

  async function toggleMirroring() {
    setSwitchingMirror(true)
    setActionError('')
    try {
      if (online) await api.sessionStop()
      else await api.sessionStart()
      await refreshSession()
    } catch (err) {
      setActionError(err.message || 'Não foi possível atualizar o espelhamento.')
    } finally {
      setSwitchingMirror(false)
    }
  }

  const postadosHoje = num(summary?.counts?.success)
  const lastSendLabel = summary?.lastSendAt
    ? new Date(summary.lastSendAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  const nothingYet = !loadingGroups && monitor.length === 0 && post.length === 0
  // RCA 2026-09-24: sem isto a tela dizia "Espelhamento ligado" enquanto todos
  // os destinos estavam fora do horário de envio e nada ia sair até de manhã.
  const sendPause = online ? describeSendPause(post, Date.now()) : null

  return (
    <div className="pnl-grid" style={{ maxWidth: 1120, margin: '0 auto' }}>
      <PainelContentActions><HelpLink topic="como-cadastrar-grupos">Ajuda</HelpLink></PainelContentActions>

      {actionError && (
        <div className="pnl-note-box is-error" role="alert">
          <strong style={{ fontWeight: 600 }}>Algo não deu certo</strong>
          <p style={{ marginTop: 4 }}>{actionError}</p>
        </div>
      )}

      {targetsFailed > 0 && (
        <div className="pnl-note-box is-error" role="alert">
          Não foi possível carregar os destinos de {targetsFailed} {targetsFailed === 1 ? 'origem' : 'origens'}.
          As ligações mostradas podem estar incompletas.
        </div>
      )}

      {!canUseChannels && (
        <div className="pnl-note-box">
          <strong style={{ fontWeight: 600 }}>Canais bloqueados no Basic</strong>
          <p style={{ marginTop: 4 }}>Canais já cadastrados ficam preservados. Faça upgrade para o Pro para reativar monitoramento e envio em canais.</p>
        </div>
      )}

      {/* Controle mestre — reflete a conexão WhatsApp (não há flag própria) */}
      <section className="pnl-master pnl-master-compact">
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
                ? `${monitor.length} ${monitor.length === 1 ? 'origem' : 'origens'}`
                : 'robô desconectado'}
            </span>
          </div>
          <div className="pnl-master-sub">
            {online
              ? (lastSendLabel ? `${postadosHoje} repostados hoje · último envio ${lastSendLabel}` : `${postadosHoje} repostados hoje`)
              : 'conecte o WhatsApp para o robô voltar a pegar e publicar ofertas'}
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
          <Link href="/painel/whatsapp" className="pnl-btn">Conexão WhatsApp</Link>
        </div>
      </section>

      {sendPause && (
        <div className="pnl-note-box is-warn" role="status" data-testid="envio-pausado-horario">
          <strong style={{ fontWeight: 600 }}>{sendPause.title}</strong>
          <p style={{ marginTop: 4 }}>
            {sendPause.detail}{' '}
            <Link href="/painel/anti-banimento?parte=ritmo" className="pnl-link-btn">Ajustar horário no Anti-banimento →</Link>
          </p>
        </div>
      )}

      {nothingYet ? (
        <section className="pnl-card" style={{ textAlign: 'center', padding: '34px 20px' }}>
          <div className="pnl-card-title">Nenhum grupo ainda</div>
          <p className="pnl-card-note" style={{ maxWidth: 460, margin: '6px auto 0' }}>
            Origem é de onde o robô pega as ofertas; destino é onde ele publica com o seu link.
          </p>
          <div className="pnl-toolbar" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button type="button" className="pnl-btn is-primary" onClick={() => setAddModal({ role: 'monitor' })}>+ Adicionar grupo de origem</button>
            <button type="button" className="pnl-btn" onClick={() => setAddModal({ role: 'post' })}>+ Adicionar grupo de destino</button>
          </div>
        </section>
      ) : (
        <>
          {/* "Como funciona" — recolhido por padrão para quem já entendeu. */}
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

          <div className="pnl-esp-add-primary">
            <button type="button" className="pnl-btn is-primary" onClick={() => setAddModal({ role: 'monitor' })}>+ ADICIONAR NOVO ESPELHAMENTO</button>
          </div>

              {/* No celular as duas colunas viram uma lista só */}
              <div className="pnl-seg pnl-esp-mobile-switch" role="tablist" aria-label="Ver origens ou destinos">
                <button type="button" role="tab" aria-selected={mobileCol === 'origem'} className={mobileCol === 'origem' ? 'is-active' : ''} onClick={() => setMobileCol('origem')}>
                  Origens ({monitor.length})
                </button>
                <button type="button" role="tab" aria-selected={mobileCol === 'destino'} className={mobileCol === 'destino' ? 'is-active' : ''} onClick={() => setMobileCol('destino')}>
                  Destinos ({post.length})
                </button>
              </div>

              {loadingGroups ? (
                <p className="pnl-empty">Carregando os seus grupos…</p>
              ) : (
                <div className="pnl-grid pnl-esp-cols">
                  <GroupColumn
                    eyebrow={{ label: '👁 Origem · o robô pega ofertas', style: {} }}
                    title="Grupos que monitoro"
                    hint="De onde o robô pega as promoções. Ele só lê os links."
                    cards={originCards}
                    emptyLabel="Nenhum grupo de origem cadastrado."
                    direction="origin"
                    loadingOf={targetsLoading}
                    selectedId={drawerId}
                    dirtyOf={targetsDirtyFor}
                    savingId={savingGroupId}
                    savedId={savedGroupId}
                    onOpen={(id) => openDrawerFor(id, 'monitor')}
                    onAdd={() => setAddModal({ role: 'monitor' })}
                    canUseChannels={canUseChannels}
                    hidden={mobileCol !== 'origem'}
                  />
                  <GroupColumn
                    eyebrow={{ label: '⚡ Destino · o robô publica', style: { color: 'var(--accent-strong)' } }}
                    title="Meus grupos de promoção"
                    hint="Para onde o robô publica a oferta já com o seu link."
                    cards={destCards}
                    emptyLabel="Nenhum grupo de destino cadastrado."
                    direction="dest"
                    loadingOf={() => false}
                    selectedId={drawerId}
                    dirtyOf={watermarkDirtyFor}
                    savingId={savingGroupId}
                    savedId={savedGroupId}
                    onOpen={(id) => openDrawerFor(id, 'post')}
                    onAdd={() => setAddModal({ role: 'post' })}
                    canUseChannels={canUseChannels}
                    hidden={mobileCol !== 'destino'}
                  />
                </div>
              )}
          <section className="pnl-card pnl-esp-connections">
              <div className="pnl-card-title" style={{ marginBottom: 12 }}>Conexões do espelhamento</div>
              <div className="pnl-note-box is-info" style={{ marginBottom: 18 }}>
                {monitor.length === 0 || post.length === 0
                  ? 'Cadastre pelo menos um grupo de origem e um de destino para o espelhamento entrar em ação.'
                  : origemDestacada
                    ? `Mostrando para onde "${monitor.find((o) => o.id === origemDestacada)?.name}" envia. Clique de novo para limpar.`
                    : 'Clique em um grupo de origem para destacar a ligação com os destinos.'}
              </div>
              <ConnectionsDiagram
                origens={monitor}
                destinos={post}
                destIdsOf={destIdsOf}
                selectedOriginId={origemDestacada}
                onToggleOrigin={(id) => setSelectedOriginId(() => (origemDestacada === id ? null : id))}
              />
              {origemDestacada && (
                <div className="pnl-esp-map-action">
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                    Editar para onde &quot;{monitor.find((o) => o.id === origemDestacada)?.name}&quot; envia
                  </span>
                  <button type="button" className="pnl-btn is-primary" onClick={() => openDrawerFor(origemDestacada, 'monitor', 'destinos')}>
                    Abrir destinos <CfgIcon name="arrow" size={14} />
                  </button>
                </div>
              )}
          </section>
        </>
      )}

      {drawerGroup && (
        <GroupDrawer
          group={drawerGroup}
          index={drawerIndex < 0 ? 0 : drawerIndex}
          direction={drawerIsOrigin ? 'origin' : 'dest'}
          flowLabel={drawerFlow}
          tabs={drawerTabs}
          tab={drawerTabSafe}
          onTab={setDrawerTab}
          saving={drawerSaving}
          error={drawerError}
          onSave={handleDrawerSave}
          onClose={requestCloseDrawer}
          onDelete={() => setDeleteTarget(drawerGroup)}
        >
          {drawerIsOrigin ? (
            <MonitorGroupConfig
              g={drawerGroup}
              tab={drawerTabSafe}
              onUpdate={handleUpdateGroup}
              canUseChannels={canUseChannels}
              post={post}
              targetsState={targetsState}
              targetsHandlers={targetsHandlers}
              onSetActionError={setActionError}
              templates={templates}
              defaultTemplateKey={defaultTemplateKey}
              targetsHint={drawerHint && drawerTabSafe === 'destinos'}
              plano={drawerPlano}
              instagram={{
                destinos: instagramDestinations,
                escolhidos: instagramMirrorTargets,
                salvando: savingInstagramOrigin,
                onToggle: toggleInstagramMirror,
              }}
            />
          ) : renderPostConfig(drawerGroup, drawerTabSafe)}
          {drawerGroup.kind === 'channel' && drawerIsOrigin && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <FollowBadge status={followStatus[drawerGroup.id] ?? 'unknown'} />
            </div>
          )}
        </GroupDrawer>
      )}

      <AddGroupModal
        open={Boolean(addModal)}
        role={addModal?.role ?? 'monitor'}
        onRole={(role) => setAddModal({ role })}
        onClose={() => setAddModal(null)}
        canUseChannels={canUseChannels}
        waGroups={waGroups}
        loadingWA={loadingWA}
        waError={waError}
        onLoadWA={handleLoadWA}
        existingJidRoles={existingJidRoles}
        addingKey={addingKey}
        onAddFromWA={handleAddFromWA}
        onAddChannel={() => {
          if (!canUseChannels) {
            setActionError('Canais estão disponíveis no Trial ativo e no plano Pro.')
            return
          }
          setShowChannelModal(true)
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDiscard)}
        title="Descartar alterações?"
        message="O que você mudou aqui ainda não foi salvo."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        danger
        onCancel={() => setConfirmDiscard(null)}
        onConfirm={discardAndClose}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Remover "${deleteTarget.name}" de ${roleLabels[deleteTarget.role] ?? 'grupo'}?` : 'Remover grupo'}
        message="O grupo será removido apenas da configuração do robô. O grupo no WhatsApp não será excluído."
        confirmLabel="Remover"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => { const target = deleteTarget; setDeleteTarget(null); if (target?.id) await handleDelete(target.id) }}
      />

      <AddChannelModal open={showChannelModal} onClose={() => setShowChannelModal(false)} onCreated={handleChannelCreated} />

      <SelectChannelModal
        open={channelButtonGroupId !== null}
        onClose={() => setChannelButtonGroupId(null)}
        onSelect={({ jid, name }) => {
          if (channelButtonGroupId) handleUpdateGroup(channelButtonGroupId, { channelButtonJid: jid, channelButtonName: name })
        }}
      />
    </div>
  )
}
