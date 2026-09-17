'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { composeTemplates, loadTemplateStore } from '@/lib/mobileTemplateStore'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { AddChannelModal } from '@/components/AddChannelModal'
import { SelectChannelModal } from '@/components/SelectChannelModal'
import { TypeBadge, FollowBadge, AdminBadge, HealthBadge } from '@/components/ChannelStatusBadges'
import { ChannelHealthPanel } from '@/components/ChannelHealthPanel'
import Link from 'next/link'
import { usePainelHeader, PainelContentActions } from '../PainelShell'

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

const roleLabels = {
  monitor: 'Monitorar (origem)',
  post: 'Postar (destino)',
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

const GRADIENTS = [
  'linear-gradient(135deg,#94A3B8,#475569)',
  'linear-gradient(135deg,#F4D9E0,#E8A488)',
  'linear-gradient(135deg,#C8E6D8,#3E9C7A)',
  'linear-gradient(135deg,#D9CFEA,#7C5CF5)',
]

function groupInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean)
  const raw = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2))
  return raw.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 2) || '#'
}

function GroupAvatar({ name, index }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
        background: GRADIENTS[index % GRADIENTS.length],
      }}
    >{groupInitials(name)}</span>
  )
}

/* ── Inline SVG icons (subset needed for the config panel) ────────────── */
function CfgIcon({ name, size = 17 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'search') return <svg {...p}><circle cx="10" cy="10" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M10.5 6.5 8.5 10.2h3L9.5 13.8"/></svg>
  if (name === 'bolt')   return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
  if (name === 'send')   return <svg {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
  if (name === 'image')  return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg>
  if (name === 'check')  return <svg {...p} strokeWidth={2.8}><path d="M5 12.5 10 17 19 7"/></svg>
  if (name === 'x')      return <svg {...p} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18"/></svg>
  if (name === 'plus')   return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>
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

/* ── Escolha de destinos, direto na tela (sem modal) ─────────────────── */
//
// Antes isso era um modal. Duas coisas ruins: no celular a janelinha cobria a
// tela e escondia o contexto do grupo que estava sendo configurado, e a lista
// abria clicável antes de os destinos chegarem do servidor — quem desmarcasse
// nessa janela tinha a escolha atropelada pela resposta e saía achando que
// tinha salvado (bug relatado pela cliente em 2026-08-29).
//
// Agora a escolha vive dentro do próprio painel do grupo, com o botão de salvar
// ao lado da lista. Invariantes de usabilidade que precisam ficar:
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

      {post.length > 6 && (
        <input
          className="cfg-dest-search"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Procurar destino pelo nome"
          aria-label="Procurar destino pelo nome"
        />
      )}

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
          Sem nenhum marcado, esse grupo envia para <strong>todos</strong> os seus destinos. Para ele parar de enviar, remova o grupo monitorado.
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

/* ── Monitor group config panel (redesigned) ────────────────────────── */
function MonitorGroupConfig({ g, onUpdate, canUseChannels, post, targetsState, targetsHandlers, onSetActionError, templates }) {
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

  const templateValue = (g.templateKey == null || g.templateKey === '') ? '__relay__' : g.templateKey
  const templateApplied = g.templateKey !== null && g.templateKey !== ''

  return (
    <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 16, display: 'grid', gap: 14 }}>

      {/* ── Seção 1: O que o bot captura ── */}
      <CfgSection icon="search" title="O que o bot captura" desc="Quais links viram oferta a partir desse grupo.">

        <CfgRow label="Lojas aceitas" hint="Sem nenhuma marcada, usa as plataformas da configuração global.">
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

        <CfgRow label="Palavras bloqueadas" hint="Ignora mensagens com essas palavras. Soma à lista global.">
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

      {/* ── Seção 2: Como a oferta é publicada ── */}
      <CfgSection icon="bolt" title="Como a oferta é publicada" desc="A aparência da mensagem que sai com o seu código.">

        <CfgRow
          label="Formato da mensagem"
          info='"Manter texto original" converte os links dentro do texto que veio do grupo. Um template reescreve tudo num layout de oferta (um produto por vez).'
          hint={templateApplied ? 'Reescreve num layout de oferta — ideal para um produto só.' : 'Mantém o texto do grupo e só troca os links pelos seus.'}
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

        {/* 2026-08-22: o seletor "Como a oferta aparece" foi REMOVIDO da tela no
            mesmo dia em que voltou. Com a escolha ligada em produção apareceu
            divergência entre o que o painel mostrava e o que saía no grupo, e a
            prioridade passou a ser manter as clientes funcionando. Toda oferta
            sai com a FOTO QUE VEIO NA OFERTA; o modo é único e vem da env
            global (chokepoint em src/billing/groupEntitlements.js). A única
            escolha de formato que a cliente faz é o botão "Ver canal", abaixo.
            Não reintroduzir sem antes fechar aquela investigação. */}
      </CfgSection>

      {/* ── Seção 3: Para onde vai ── */}
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

    </div>
  )
}

export default function GruposPage() {
  usePainelHeader({ title: 'Grupos e canais', subtitle: 'Defina quais grupos o bot escuta e onde ele publica' })

  const [groups, setGroups] = useState([])
  // Precisam ser declarados ANTES dos callbacks de destino: `post` entra na
  // lista de dependências de alguns `useCallback`, e lista de dependências é
  // avaliada na hora — um `const` declarado mais abaixo estoura
  // "Cannot access 'post' before initialization" e a página inteira não abre.
  const monitor = groups.filter((g) => g.role === 'monitor')
  const post = groups.filter((g) => g.role === 'post')
  const [actionError, setActionError] = useState('')
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [waGroups, setWaGroups] = useState(null)
  const [loadingWA, setLoadingWA] = useState(false)
  const [waError, setWaError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addingKey, setAddingKey] = useState('')
  const [savingGroupId, setSavingGroupId] = useState(null)
  const [savedGroupId, setSavedGroupId] = useState(null)
  const [groupErrors, setGroupErrors] = useState({})
  // Um registro por grupo monitorado:
  //   { loading, error, savedIds, mode, draftIds, saving, savedAt }
  // `savedIds` é o que está no servidor; `draftIds` é o que está na tela. A
  // diferença entre os dois é o que faz a tela dizer "alterações não salvas".
  const [targetsState, setTargetsState] = useState({})
  // Cada carregamento ganha um número por grupo: resposta atrasada de um
  // carregamento antigo é descartada em vez de sobrescrever o que a pessoa já
  // marcou (foi assim que a escolha da cliente sumia).
  const targetRequestRef = useRef({})
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [channelButtonGroupId, setChannelButtonGroupId] = useState(null)
  const [tab, setTab] = useState('monitor')
  const [expandedConfigId, setExpandedConfigId] = useState(null)
  const [followStatus, setFollowStatus] = useState({})
  const [adminStatus, setAdminStatus] = useState({})
  const [refreshingAdminId, setRefreshingAdminId] = useState(null)
  const [healthByGroup, setHealthByGroup] = useState({})
  const [expandedHealthId, setExpandedHealthId] = useState(null)
  const [planSubject, setPlanSubject] = useState({ plan: 'trial', accessExpiresAt: null })
  const [templates, setTemplates] = useState([])

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
    Promise.all([api.groups(), api.me(), loadTemplateStore().catch(() => ({}))])
      .then(async ([data, me, templateStore]) => {
        setTemplates(composeTemplates(templateStore))
        setPlanSubject({ plan: me?.plan ?? 'trial', accessExpiresAt: me?.accessExpiresAt ?? null })
        if (!active) return
        setGroups(data)
      })
      .catch((err) => { if (active) setActionError(err.message) })
      .finally(() => { if (active) setLoadingGroups(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const postChannels = groups.filter((g) => g.kind === 'channel' && g.role === 'post')
    if (postChannels.length === 0) return
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

  async function handleChannelCreated(group) {
    setGroups((prev) => [...prev, group])
    if (group.kind === 'channel' && group.role === 'monitor') {
      setFollowStatus((prev) => ({ ...prev, [group.id]: 'pending' }))
      try {
        await api.followChannelNow(group.id)
        setFollowStatus((prev) => ({ ...prev, [group.id]: 'followed' }))
      } catch {
        setFollowStatus((prev) => ({ ...prev, [group.id]: 'error' }))
      }
    }
    if (group.kind === 'channel' && group.role === 'post') {
      refreshAdmin(group)
    }
    setTab(group.role === 'post' ? 'post' : 'monitor')
  }

  async function handleDelete(id) {
    setActionError('')
    try { await api.deleteGroup(id); await load() } catch (err) { setActionError(err.message) }
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
    } catch (err) {
      // O erro nasce AO LADO do campo. Nada de `load()` aqui: recarregar todos
      // os grupos era o que apagava o texto que a pessoa acabou de escrever.
      setWatermarkErrors((prev) => ({ ...prev, [id]: err.message }))
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
    if (!current || current.loading || current.saving || !Array.isArray(current.savedIds)) return
    // Só mandamos ids que ainda existem na lista de destinos da tela. Id de um
    // grupo já apagado faz a rota devolver 400 ("Lista de grupos destino
    // inválida") e a escolha inteira se perde — com cara de "não salvou".
    const idsToSave = (current.draftIds ?? []).filter((id) => post.some((p) => p.id === id))
    patchTargets(groupId, { saving: true, error: '' })
    setActionError('')
    try {
      await api.updateGroupTargets(groupId, idsToSave)
      patchTargets(groupId, {
        saving: false,
        error: '',
        savedIds: idsToSave,
        draftIds: idsToSave,
        mode: idsToSave.length ? 'explicit' : 'all',
        savedAt: Date.now(),
      })
    } catch (err) {
      // O aviso nasce ao lado do botão: o banner do topo da página fica fora da
      // tela no celular, então a falha passava despercebida e a cliente saía
      // achando que tinha salvado.
      patchTargets(groupId, { saving: false, error: err.message })
      setActionError(err.message)
    }
  }, [targetsState, post, patchTargets])

  const targetsHandlers = useMemo(() => ({
    load: loadTargets,
    toggle: toggleTargetDraft,
    setAll: setAllTargetDrafts,
    reset: resetTargetDraft,
    save: saveTargets,
  }), [loadTargets, toggleTargetDraft, setAllTargetDrafts, resetTargetDraft, saveTargets])

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
      await api.addGroup(g.waJid, g.name, role)
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setAddingKey('')
    }
  }

  const current = tab === 'monitor' ? monitor : post
  const existingJidRoles = new Set(groups.map((g) => `${g.waJid}::${g.role}`))

  const canUseChannels = (() => {
    if (planSubject.plan === 'pro') return true
    if (planSubject.plan !== 'trial' || !planSubject.accessExpiresAt) return false
    const expiresAt = new Date(planSubject.accessExpiresAt)
    return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date()
  })()

  function renderPostConfig(g) {
    const destinationImageMode = ['original', 'original_watermark', 'preview', 'preview_watermark'].includes(g.imageMode) ? g.imageMode : 'original'
    const watermarkMode = destinationImageMode === 'original_watermark' || destinationImageMode === 'preview_watermark'
    // Com o botão "Ver canal" ligado, o WhatsApp só aceita o botão em cima de
    // uma foto — o card clicável seria derrubado. Em vez de oferecer uma
    // escolha que não vale, a tela mostra só o que de fato pode sair e diz o
    // porquê. Ao ligar o botão, a API já grava o formato degradado
    // (effectiveDestinationImageMode), então o que aparece aqui é a verdade.
    const temBotaoCanal = Boolean(g.channelButtonJid)
    return (
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 14, display: 'grid', gap: 14 }}>
        <CfgSection icon="image" title="Imagem das ofertas" desc="Escolha como as ofertas aparecem neste destino — a mesma oferta pode sair diferente em cada grupo/canal.">
          <CfgRow
            label="Modo da imagem"
            hint={temBotaoCanal
              ? 'Com o botão "Ver canal" ligado, a oferta sai como foto: o WhatsApp só aceita o botão em cima de uma foto. Para usar o card que abre a loja, remova o botão abaixo.'
              : destinationImageMode === 'preview'
                ? 'Card clicável: tocar na imagem abre o link da oferta.'
                : destinationImageMode === 'preview_watermark'
                  ? 'Card clicável com a sua identificação na imagem: tocar abre o link da oferta.'
                  : watermarkMode
                    ? 'Foto original da oferta, com a identificação deste destino.'
                    : 'Usa a foto que veio na mensagem monitorada.'}
          >
            <select
              className="pnl-input"
              value={destinationImageMode}
              onChange={(e) => {
                const nextMode = e.target.value
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
              <option value="original_watermark">Original com marca d&apos;água</option>
              {!temBotaoCanal && <option value="preview">Preview clicável</option>}
              {!temBotaoCanal && <option value="preview_watermark">Preview com marca d&apos;água</option>}
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
        <div>
          <p className="pnl-label" style={{ marginBottom: 6 }}>Mensagem de boas-vindas</p>
          <textarea
            className="pnl-input"
            style={{ fontFamily: 'inherit', fontSize: 13, minHeight: 64 }}
            rows={2}
            value={g.welcomeMsg ?? ''}
            onChange={(e) => handleUpdateGroup(g.id, { welcomeMsg: e.target.value })}
            placeholder="Mensagem enviada quando alguém entra no grupo (opcional)"
          />
        </div>
        {g.kind !== 'channel' && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <p className="pnl-label" style={{ marginBottom: 6 }}>Botão &quot;Ver canal&quot; ao final das mensagens</p>
            <p className="pnl-hint" style={{ marginTop: 0, marginBottom: 8 }}>
              O botão é a única diferença: <strong>com canal escolhido</strong>, a mensagem leva o botão &quot;Ver canal&quot; no fim; <strong>sem canal</strong>, ela sai igual, só sem o botão. Com canal escolhido, a foto sempre vem da mensagem original (o card clicável não aceita esse botão). Se a oferta de origem não tiver foto, a mensagem sai mesmo assim — só sem imagem e sem o botão (o WhatsApp só aceita esse botão em mensagem com imagem).
            </p>
            {g.channelButtonJid ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--pnl-radius-sm)', padding: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.channelButtonName || 'Canal sem nome'}</div>
                  <div className="pnl-hint" style={{ fontFamily: 'monospace', marginTop: 2 }}>{g.channelButtonJid}</div>
                </div>
                <p className="pnl-hint" style={{ marginTop: 0 }}>
                  Botão ativo: as mensagens deste grupo saem com a foto da oferta e o botão &quot;Ver canal&quot; no fim.
                </p>
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
          </div>
        )}
        {g.kind === 'channel' && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <AdminBadge status={adminStatus[g.id] ?? 'unknown'} onRefresh={() => refreshAdmin(g)} refreshing={refreshingAdminId === g.id} />
              {healthByGroup[g.id] && <HealthBadge status={healthByGroup[g.id].status} />}
              <button type="button" className="pnl-link-btn" onClick={() => setExpandedHealthId(expandedHealthId === g.id ? null : g.id)}>
                {expandedHealthId === g.id ? 'Fechar painel anti-ban' : 'Painel anti-ban'}
              </button>
            </div>
            {expandedHealthId === g.id && (
              <ChannelHealthPanel group={g} initialHealth={healthByGroup[g.id]} onHealthChange={(h) => setHealthByGroup((prev) => ({ ...prev, [g.id]: h }))} />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 820, margin: '0 auto' }}>
      <PainelContentActions>
        <div className="pnl-toolbar">
          <HelpLink topic="como-cadastrar-grupos">Ajuda</HelpLink>
        </div>
      </PainelContentActions>

      <div style={{ display: 'grid', gap: 4, color: 'var(--ink)', fontSize: 14, lineHeight: 1.55 }}>
        <p><strong>Monitorar:</strong> Grupos de promoção que você participa. O bot só lê os links.</p>
        <p><strong>Publicar:</strong> Seus grupos de clientes. O bot posta o link já com o seu código.</p>
      </div>

      {/* Abas Monitorar / Publicar */}
      <div className="pnl-seg pnl-groups-role-toggle" role="tablist" aria-label="Escolher entre monitorar e publicar">
        {[
          { key: 'monitor', icon: '👁', label: 'Monitorar', n: monitor.length },
          { key: 'post', icon: '⚡', label: 'Publicar', n: post.length },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'is-active' : ''}
            onClick={() => { setTab(t.key); setExpandedConfigId(null) }}
          >
            <span className="pnl-groups-role-icon" aria-hidden="true">{t.icon}</span>
            <span className="pnl-groups-role-label">{t.label}</span>
            <span className="pnl-groups-role-count" aria-label={`${t.n} cadastrados`}>{t.n}</span>
          </button>
        ))}
      </div>

      <p className="pnl-card-note" style={{ marginTop: -4 }}>
        {tab === 'monitor'
          ? 'Grupos onde o bot lê mensagens e procura links para converter.'
          : 'Grupos onde o bot publica os links já convertidos.'}
      </p>

      {actionError && <div className="pnl-note-box is-error" role="alert"><strong style={{ fontWeight: 600 }}>Falha ao atualizar grupos</strong><p style={{ marginTop: 4 }}>{actionError}</p></div>}
      {!canUseChannels && (
        <div className="pnl-note-box"><strong style={{ fontWeight: 600 }}>Canais bloqueados no Basic</strong><p style={{ marginTop: 4 }}>Canais já cadastrados ficam preservados. Faça upgrade para o Pro para reativar monitoramento e envio em canais.</p></div>
      )}

      {/* Lista de grupos da aba ativa */}
      <section className="pnl-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loadingGroups ? (
          <p className="pnl-empty" style={{ padding: 24 }}>Carregando grupos configurados…</p>
        ) : current.length === 0 ? (
          <p className="pnl-empty" style={{ padding: 24 }}>
            Nenhum grupo {tab === 'monitor' ? 'para monitorar' : 'para publicar'} configurado.
          </p>
        ) : (
          <ul>
            {current.map((g, i) => {
              const configOpen = expandedConfigId === g.id
              // Destinos mexidos e ainda não salvos precisam aparecer na LINHA
              // do grupo: fechar o painel sem salvar não pode ser silencioso.
              const targetState = targetsState[g.id]
              const targetsDirty = Boolean(targetState && Array.isArray(targetState.savedIds)
                && !sameIdSet(targetState.draftIds ?? [], targetState.savedIds))
              return (
                <li key={g.id} style={{ borderBottom: i === current.length - 1 ? 'none' : '1px solid var(--line)', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <GroupAvatar name={g.name} index={i} />
                    <div style={{ minWidth: 0, flex: 1, wordBreak: 'break-word' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{g.name}</span>
                        <TypeBadge kind={g.kind} />
                        {!canUseChannels && g.kind === 'channel' && <span className="pnl-tag is-flight">Pro</span>}
                        {g.kind === 'channel' && g.role === 'monitor' && <FollowBadge status={followStatus[g.id] ?? 'unknown'} />}
                        {g.kind === 'channel' && g.role === 'post' && healthByGroup[g.id] && <HealthBadge status={healthByGroup[g.id].status} />}
                      </div>
                      <div className="pnl-hint" style={{ marginTop: 2 }}>{g.kind === 'channel' ? 'canal' : 'grupo'} · {g.waJid}</div>
                    </div>
                    <div className="pnl-toolbar" style={{ flexShrink: 0 }}>
                      {targetsDirty && <span className="pnl-tag is-flight" title="Você mexeu nos destinos e ainda não salvou">destinos não salvos</span>}
                      {savingGroupId === g.id && <span className="pnl-hint" style={{ color: 'var(--accent-strong)' }}>salvando…</span>}
                      {savedGroupId === g.id && <span className="pnl-hint" style={{ color: 'var(--success)' }}>salvo</span>}
                      <button type="button" className="pnl-link-btn" aria-expanded={configOpen} onClick={() => setExpandedConfigId(configOpen ? null : g.id)}>
                        {configOpen ? 'Fechar' : 'Filtros'}
                      </button>
                      <button type="button" className="pnl-link-btn" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(g)}>Remover</button>
                    </div>
                  </div>
                  {groupErrors[g.id] && <p className="pnl-hint" style={{ color: 'var(--danger)', marginTop: 6 }}>{groupErrors[g.id]}</p>}
                  {configOpen && tab === 'monitor' && (
                    <MonitorGroupConfig
                      g={g}
                      onUpdate={handleUpdateGroup}
                      canUseChannels={canUseChannels}
                      post={post}
                      targetsState={targetsState}
                      targetsHandlers={targetsHandlers}
                      onSetActionError={setActionError}
                      templates={templates}
                    />
                  )}
                  {configOpen && tab === 'post' && renderPostConfig(g)}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Carregar grupos do WhatsApp */}
      <section className="pnl-card">
        <div className="pnl-card-head">
          <div className="pnl-card-title">Carregar grupos existentes</div>
          <button type="button" className="pnl-btn is-primary" onClick={handleLoadWA} disabled={loadingWA}>
            {loadingWA ? 'Carregando…' : 'Carregar do WhatsApp'}
          </button>
        </div>
        <p className="pnl-card-note">O bot precisa estar conectado para listar os grupos.</p>

        {waError && <div className="pnl-note-box is-error" style={{ marginTop: 12 }} role="alert"><strong style={{ fontWeight: 600 }}>Falha ao carregar grupos do WhatsApp</strong><p style={{ marginTop: 4 }}>{waError} Confirme se o bot está conectado ao WhatsApp e tente novamente.</p></div>}

        {waGroups && waGroups.length === 0 && <p className="pnl-empty">Nenhum grupo encontrado.</p>}

        {waGroups && waGroups.length > 0 && (
          <ul className="pnl-grid" style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
            {waGroups.map((g) => {
              const monitorAlready = existingJidRoles.has(`${g.waJid}::monitor`)
              const postAlready = existingJidRoles.has(`${g.waJid}::post`)
              const bothAlready = monitorAlready && postAlready
              return (
                <li key={g.waJid} className="pnl-subcard" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ minWidth: 0, wordBreak: 'break-word', fontWeight: 500, color: bothAlready ? 'var(--ink-faint)' : 'var(--ink)' }}>
                    {g.name}
                    {bothAlready && <span className="pnl-hint" style={{ marginLeft: 8 }}>(já cadastrado)</span>}
                  </span>
                  {!bothAlready && (
                    <div className="pnl-toolbar" style={{ flexWrap: 'wrap' }}>
                      {!monitorAlready && (
                        <button type="button" className="pnl-btn" onClick={() => handleAddFromWA(g, 'monitor')} disabled={addingKey === `${g.waJid}::monitor`}>
                          👀 {addingKey === `${g.waJid}::monitor` ? 'Adicionando…' : 'Monitorar'}
                        </button>
                      )}
                      {!postAlready && (
                        <button type="button" className="pnl-btn" onClick={() => handleAddFromWA(g, 'post')} disabled={addingKey === `${g.waJid}::post`}>
                          📢 {addingKey === `${g.waJid}::post` ? 'Adicionando…' : 'Postar'}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Adicionar canal existente */}
      <section className="pnl-card">
        <div className="pnl-card-head">
          <div>
            <div className="pnl-card-title">Adicionar canal existente</div>
            <p className="pnl-card-note">Cadastre um canal por link ou escolha um canal que você já segue no WhatsApp.</p>
          </div>
          <button
            type="button"
            className={`pnl-btn ${canUseChannels ? 'is-primary' : ''}`}
            onClick={() => canUseChannels ? setShowChannelModal(true) : setActionError('Canais estão disponíveis no Trial ativo e no plano Pro.')}
          >
            + Adicionar canal {!canUseChannels && '(Pro)'}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Remover "${deleteTarget.name}" de ${roleLabels[deleteTarget.role] ?? 'grupo'}?` : 'Remover grupo'}
        message="O grupo será removido apenas da configuração do bot. O grupo no WhatsApp não será excluído."
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
