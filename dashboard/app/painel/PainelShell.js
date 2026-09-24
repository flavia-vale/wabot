'use client'

import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { NAV_GROUPS } from './nav'
import SidebarOnboarding from '@/components/SidebarOnboarding'
import { buildNoCredentialBanner } from '../../../src/credentialBlockAlert/message.js'
import { shouldShowNoCredentialBanner } from '../../../src/domain/painel/journeyBanners.js'
import { listProFeaturesInUse, buildProFeaturesNotice } from '../../../src/domain/payments/proFeaturesInUse.js'
import { buildTrialEndingNotice } from '../../../src/domain/painel/trialNotice.js'
import { buildSendPauseNotice } from '@/lib/painel/sendPauseNotice'
import { VIDEO_CADASTRO_ETIQUETAS_URL } from '../../../src/tutorialVideo.js'
import { hasProLikeAccess } from '@/lib/planEntitlements'
import { ProModal } from '@/components/pro/ProGate'

/* Contexto compartilhado: dados de sessão/usuário reusados pelas páginas. O
 * status de sessão (`online`/`phone`) é re-buscado periodicamente e ao focar a
 * aba para não ficar obsoleto (ver refreshSession). Páginas também publicam o
 * título do header aqui via usePainelHeader() e podem forçar uma atualização
 * imediata do status via refreshSession(). Nada disso toca o back end além das
 * rotas já existentes em @/lib/api. */
const PainelContext = createContext(null)

export function usePainel() {
  const ctx = useContext(PainelContext)
  if (!ctx) throw new Error('usePainel deve ser usado dentro de <PainelShell>')
  return ctx
}

export function usePainelHeader(header) {
  const { setHeader } = usePainel()
  const title = header?.title
  const subtitle = header?.subtitle
  useEffect(() => {
    setHeader({ title, subtitle })
  }, [title, subtitle, setHeader])
}

/* Ações contextuais da página ficam no topo do próprio conteúdo. O nome do
 * componente é mantido para preservar a API das telas que já o utilizam. */
export function PainelContentActions({ children }) {
  return <div className="pnl-content-actions">{children}</div>
}

const STAR_ICON = <path d="M12 2.5l2.9 6 6.6.6-5 4.4 1.5 6.5L12 16.9 5.5 20.5 7 14 2 9.6l6.6-.6z" />
const LOCK_ICON = <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>
const CHEVRON_ICON = <path d="M9 18l6-6-6-6" />
const BELL_ICON = <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>
const HELP_ICON = <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" /><path d="M12 17h.01" /></>
const SETTINGS_ICON = <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>
const LOGOUT_ICON = <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>

function formatPlanDate(value, options = { day: '2-digit', month: 'short' }) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', options)
}

function expiredPlanCopy(user) {
  if (!user?.accessExpiresAt) return ''
  const expiresAt = new Date(user.accessExpiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt >= new Date()) return ''
  const dateLabel = formatPlanDate(expiresAt, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const planLabel = user.plan === 'basic' ? 'Basic' : user.plan === 'pro' ? 'Pro' : user.plan === 'trial' ? 'Trial' : (user.plan || 'plano')
  return user.plan === 'trial'
    ? `Seu trial venceu em ${dateLabel}. O bot fica pausado e não envia novas mensagens até a renovação.`
    : `Seu plano ${planLabel} venceu em ${dateLabel}. O bot fica pausado e não envia novas mensagens até a renovação.`
}

function ExpiredPlanBanner({ user }) {
  const copy = expiredPlanCopy(user)
  if (!copy) return null

  return (
    <div className="pnl-note-box is-error pnl-expired-plan-banner" role="alert">
      <div>
        <strong style={{ fontWeight: 600 }}>Plano vencido: seus envios automáticos estão pausados</strong>
        <p style={{ marginTop: 6 }}>{copy}</p>
        <p style={{ marginTop: 6, fontWeight: 600 }}>Escolha um plano e finalize o checkout para reativar sua conta.</p>
      </div>
      <Link href="/painel/plano" className="pnl-btn is-primary" style={{ flexShrink: 0 }}>Reativar plano</Link>
    </div>
  )
}

/* Motivo do encerramento escrito pela admin, mostrado para a CLIENTE.
 * Fica antes de qualquer outro aviso porque explica todos eles: com o acesso
 * encerrado por decisão nossa, a tela de plano vencido sozinha faria a pessoa
 * tentar pagar sem entender o que aconteceu. Só aparece quando existe motivo
 * escrito — sem motivo, nada muda na tela. */
function BlockedReasonBanner({ user }) {
  const motivo = String(user?.blockedReason ?? '').trim()
  if (!motivo) return null

  return (
    <div className="pnl-note-box is-error pnl-expired-plan-banner" role="alert">
      <div>
        <strong style={{ fontWeight: 600 }}>Seu acesso foi encerrado</strong>
        <p style={{ marginTop: 6 }}>{motivo}</p>
        <p style={{ marginTop: 6 }}>
          Seus grupos, suas lojas e suas regras continuam salvos. Se você achar que houve engano, fale com a gente.
        </p>
      </div>
    </div>
  )
}

/* Faixa fina, UMA frase, cor de aviso — nunca vermelho.
 *
 * Vermelho e quatro linhas diziam que algo parou, e nada parou: sem o código de
 * acesso o plano B segue publicando e a comissão continua sendo dela; o que muda
 * é o link ficar mais comprido. Mesma regra da tela de credenciais e do e-mail
 * de código vencido — as três superfícies precisam dizer a MESMA coisa.
 *
 * Vocabulário obrigatório: "código de acesso" e "venceu". Nunca "SSID",
 * "credencial expirada" ou "link de afiliado" (test/painel-aviso-ml-vencido.test.js). */
function ExpiredMlSsidBanner({ expired }) {
  if (!expired) return null

  return (
    <div className="pnl-slim-banner is-warn" role="status">
      <span>
        O código de acesso do Mercado Livre venceu — suas ofertas continuam saindo, só com link mais comprido.
      </span>
      <Link href="/painel/ids-afiliada" className="pnl-slim-banner-cta">Colar código novo</Link>
    </div>
  )
}

/* Sem NENHUMA loja cadastrada o robô recebe as ofertas e não publica nada —
 * e, como o painel fica verde e o histórico diz "ignorado", a cliente conclui
 * que o produto não funciona. O aviso é global (todas as abas) por isso:
 * qualquer tela que ela abra antes de cadastrar está mostrando um robô que não
 * vai enviar. Some sozinho no instante em que existe uma loja cadastrada. */
function NoCredentialBanner({ show }) {
  if (!show) return null
  const copy = buildNoCredentialBanner()

  return (
    <div className="pnl-note-box is-error pnl-expired-plan-banner" role="alert">
      <div>
        <strong style={{ fontWeight: 600 }}>{copy.headline}</strong>
        <p style={{ marginTop: 6 }}>{copy.body}</p>
        <p style={{ marginTop: 6 }}>
          <a href={VIDEO_CADASTRO_ETIQUETAS_URL} target="_blank" rel="noreferrer" style={{ fontWeight: 600, textDecoration: 'underline' }}>
            🎥 {copy.videoLabel}
          </a>
        </p>
      </div>
      <Link href={copy.ctaHref} className="pnl-btn is-primary" style={{ flexShrink: 0 }}>{copy.ctaLabel}</Link>
    </div>
  )
}

/* "O robô está parado esperando o tempo que eu configurei?" (pedido da dona do
 * produto, 2026-09-24). A espera do Anti-banimento — horário de envio, limite
 * diário, intervalo entre envios, pausa por segurança — era invisível fora da
 * aba Envios: a cliente via "conectado", nada saindo, e concluía defeito.
 * Global de propósito (vale em qualquer página) e sempre com o caminho para
 * mudar o tempo. A regra é pura (src/domain/painel/sendPauseStatus.js) e monta
 * o aviso com o que a shell já carrega a cada 20s (grupos com horário efetivo)
 * mais o resumo da fila (`GET /logs/send-pause`). */
function SendPauseBanner({ notice }) {
  if (!notice) return null

  return (
    <div className="pnl-note-box is-warn pnl-expired-plan-banner" role="status" data-testid="robo-esperando-anti-banimento">
      <div>
        <strong style={{ fontWeight: 600 }}>{notice.title}</strong>
        <p style={{ marginTop: 6 }}>{notice.body}</p>
      </div>
      <Link href={notice.ctaHref} className="pnl-btn is-primary" style={{ flexShrink: 0 }}>{notice.ctaLabel}</Link>
    </div>
  )
}

/* Canal parado porque o plano Básico não inclui canais (RCA 2026-09-23).
 * No teste grátis tudo do Pro funciona; a cliente paga o Básico e o canal para
 * de receber EM SILÊNCIO — o grupo ao lado segue normal e ela conclui "paguei e
 * parou". Global de propósito: ela não volta à tela de planos para descobrir.
 * O texto sai da regra pura (src/domain/payments/proFeaturesInUse.js), a mesma
 * da tela de planos, para as duas superfícies dizerem a mesma coisa. */
function ProFeaturesStoppedBanner({ notice }) {
  if (!notice || notice.kind !== 'stopped') return null

  return (
    <div className="pnl-note-box is-warn pnl-expired-plan-banner" role="alert">
      <div>
        <strong style={{ fontWeight: 600 }}>{notice.title}</strong>
        <p style={{ marginTop: 6 }}>{notice.body}</p>
        <p style={{ marginTop: 6, fontWeight: 600 }}>{notice.action}</p>
      </div>
      <Link href="/painel/plano" className="pnl-btn is-primary" style={{ flexShrink: 0 }}>Mudar para o Pro</Link>
    </div>
  )
}

/* Fim do teste com a PROVA do que o robô já fez. Ver o porquê em
 * src/domain/painel/trialNotice.js — o teste acabava em silêncio, e quem paga
 * decide exatamente nesse dia. */
function TrialEndingBanner({ notice }) {
  if (!notice) return null

  return (
    <div className="pnl-note-box pnl-expired-plan-banner" role="status">
      <div>
        <strong style={{ fontWeight: 600 }}>{notice.headline}</strong>
        <p style={{ marginTop: 6 }}>{notice.body}</p>
        {notice.secondaryHref && (
          <p style={{ marginTop: 6 }}>
            <Link href={notice.secondaryHref} style={{ fontWeight: 600, textDecoration: 'underline' }}>{notice.secondaryLabel}</Link>
          </p>
        )}
      </div>
      <Link href={notice.ctaHref} className="pnl-btn is-primary" style={{ flexShrink: 0 }}>{notice.ctaLabel}</Link>
    </div>
  )
}

function planInfo(user) {
  const plan = user?.plan
  const exp = user?.accessExpiresAt ? new Date(user.accessExpiresAt) : null
  const validExp = exp && !Number.isNaN(exp.getTime())
  const expired = validExp && exp < new Date()
  const label = expired
    ? 'Plano vencido'
    : plan === 'pro' ? 'Plano PRO'
      : plan === 'basic' ? 'Plano Basic'
        : plan === 'trial' ? 'Trial'
          : 'Plano e cobrança'
  const dateLabel = validExp ? formatPlanDate(exp) : null
  const sub = expired
    ? 'reative para automatizar'
    : dateLabel ? `renova em ${dateLabel}` : 'gerencie sua assinatura'
  return { expired, label, sub }
}

function initialsOf(name, email) {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function Icon({ path }) {
  return (
    <svg className="pnl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  )
}

function OnlinePill({ online, groupCount }) {
  const state = online === null ? 'is-idle' : online ? 'is-on' : 'is-off'
  const label = online === null
    ? 'verificando…'
    : online
      ? `bot online${groupCount != null ? ` · ${groupCount} grupos` : ''}`
      : 'bot offline'
  return (
    <span className="pnl-online">
      <span className={`pnl-dot ${state}`} aria-hidden="true" />
      {label}
    </span>
  )
}

export default function PainelShell({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [online, setOnline] = useState(null)
  const [phone, setPhone] = useState(null)
  const [groupCount, setGroupCount] = useState(null)
  // Lista completa (com `sendWindow` efetivo por destino) + resumo da fila
  // segurada pelo Anti-banimento — os dois insumos do aviso global de espera.
  const [groupsList, setGroupsList] = useState([])
  const [sendPauseQueued, setSendPauseQueued] = useState(null)
  const [channelCount, setChannelCount] = useState(null)
  const [sessionHealth, setSessionHealth] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [header, setHeader] = useState({ title: 'Painel', subtitle: '' })
  const [mlSsidExpired, setMlSsidExpired] = useState(false)
  const [hasAnyCredential, setHasAnyCredential] = useState(null)
  const [offersPublished, setOffersPublished] = useState(null)
  // Janela "recurso do PRO" (components/pro/ProGate.js). Chave do recurso em
  // lib/planFeatures.js, ou null quando fechada.
  const [proModal, setProModal] = useState(null)

  // Autenticação — mesmo contrato do dashboard atual (api.me → /login no erro).
  useEffect(() => {
    let active = true
    api.me()
      .then((u) => { if (active) { setUser(u); setChecking(false) } })
      .catch(() => { if (active) router.replace('/login') })
    return () => { active = false }
  }, [router])

  // Saúde do SSID de afiliado do Mercado Livre. O endpoint faz UM probe
  // autenticado (e retorna `not_configured`/`no_cookie` sem tocar a rede do ML
  // quando não há credencial). Checamos uma vez aqui no shell — que monta uma
  // única vez para todo o painel (layout) — para exibir o aviso de expiração em
  // TODAS as páginas, igual ao banner de plano vencido. Só alarmamos com
  // `alive === false` (401 = expirado); 403/429/erro de rede ficam
  // indeterminados e não disparam o banner (ver checkMercadoLivreSession).
  useEffect(() => {
    if (checking) return undefined
    let active = true
    api.mercadolivreSession()
      .then((s) => { if (active) setMlSsidExpired(s?.alive === false) })
      .catch(() => { if (active) setMlSsidExpired(false) })
    return () => { active = false }
  }, [checking])

  // Existe ALGUMA loja cadastrada? Uma chamada só, no shell (que monta uma vez
  // para todo o painel), igual ao banner de SSID vencido acima. Enquanto a
  // resposta não chega, `null` mantém o aviso escondido — banner que pisca a
  // cada navegação é pior que banner nenhum. Falha de rede também não alarma:
  // acusar falta de cadastro por causa de um blip mandaria a cliente refazer
  // um cadastro que já existe.
  useEffect(() => {
    if (checking) return undefined
    let active = true
    api.credentials()
      .then((list) => { if (active) setHasAnyCredential(Array.isArray(list) && list.length > 0) })
      .catch(() => { if (active) setHasAnyCredential(null) })
    return () => { active = false }
  }, [checking])

  // Prova de valor do aviso de fim de teste: quantas ofertas o robô já
  // publicou. Só buscamos para quem está em trial — o resto do painel não usa
  // esse número, e uma chamada a mais por navegação sem uso é desperdício.
  const isTrial = user?.plan === 'trial'
  useEffect(() => {
    if (checking || !isTrial) return undefined
    let active = true
    api.logsSummary('30d')
      .then((s) => { if (active) setOffersPublished(Number(s?.success) || 0) })
      .catch(() => { if (active) setOffersPublished(null) })
    return () => { active = false }
  }, [checking, isTrial])

  // Status de sessão + contagem de grupos (compartilhado com a tag do header
  // e a página de espelhamento, que leem `online` deste contexto). Precisa ser
  // re-buscado periodicamente: a página /painel/whatsapp acompanha o status ao
  // vivo (WS+polling), mas o shell não — se ele buscasse só uma vez no mount,
  // ficaria preso em "desconectado" mesmo depois da sessão conectar, gerando a
  // inconsistência entre /painel/whatsapp (conectado) e o resto do painel.
  const refreshSession = useCallback(async () => {
    const [s, g, q] = await Promise.allSettled([api.sessionStatusFast(), api.groups(), api.sendPause()])
    if (s.status === 'fulfilled') {
      setOnline(s.value?.status === 'connected')
      setPhone(s.value?.phone ?? null)
    } else {
      setOnline(false)
    }
    if (g.status === 'fulfilled' && Array.isArray(g.value)) {
      setGroupCount(g.value.length)
      setChannelCount(g.value.filter((group) => group?.kind === 'channel').length)
      setGroupsList(g.value)
    }
    // Falha aqui nunca some com o aviso do horário (que vem dos grupos): só
    // deixa de contar a fila.
    if (q.status === 'fulfilled') setSendPauseQueued(q.value?.queued ?? null)
  }, [])

  const refreshSessionRef = useRef(refreshSession)
  useEffect(() => { refreshSessionRef.current = refreshSession }, [refreshSession])

  useEffect(() => {
    if (checking) return undefined
    let cancelled = false
    const tick = () => { if (!cancelled) refreshSessionRef.current?.() }
    tick()
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      tick()
    }, 20000)
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checking])

  // Saúde da conexão: só sondamos a versão completa do status (com métricas do
  // worker) quando o bot está online. O worker devolve sessionHealth.degraded
  // quando a sessão está conectada mas com decrypt dessincronizado; mantemos o
  // dado no contexto para observabilidade, mas NÃO exibimos mais banner global
  // (a ação que ele sugeria — reconectar — pioraria o re-sync; ver pnl-content).
  useEffect(() => {
    if (!online) return undefined
    let active = true
    let timer = null
    const poll = async () => {
      const s = await api.sessionStatus().catch(() => null)
      if (!active) return
      if (s) setSessionHealth(s.sessionHealth ?? s.metrics?.sessionHealth ?? null)
      timer = setTimeout(poll, 45000)
    }
    poll()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [online])

  async function logout() {
    await api.logout().catch(() => {})
    router.push('/login')
  }

  // O aviso de fim de teste só aparece com a prova de valor já carregada
  // (`offersPublished !== null`): sem ela o texto cairia no ramo "o robô ainda
  // não publicou nada", que é o oposto do que a cliente ativa deveria ler.
  const sendPauseNotice = useMemo(
    () => buildSendPauseNotice({ groups: groupsList, queued: sendPauseQueued, online, now: Date.now() }),
    [groupsList, sendPauseQueued, online],
  )

  const trialNotice = useMemo(
    () => (offersPublished === null
      ? null
      : buildTrialEndingNotice({
        plan: user?.plan,
        accessExpiresAt: user?.accessExpiresAt,
        offersPublished,
      })),
    [user?.plan, user?.accessExpiresAt, offersPublished],
  )

  // Só canais aqui: é o que já vem na lista de grupos, sem chamada nova. A tela
  // de planos mostra o quadro completo (automáticas e filas também).
  const userPlan = user?.plan
  const userAccessExpiresAt = user?.accessExpiresAt
  const proFeaturesNotice = useMemo(() => {
    if (channelCount === null || userPlan !== 'basic') return null
    const exp = userAccessExpiresAt ? new Date(userAccessExpiresAt) : null
    const accessActive = !exp || Number.isNaN(exp.getTime()) ? true : exp > new Date()
    return buildProFeaturesNotice({
      plan: userPlan,
      accessActive,
      items: listProFeaturesInUse({ channelCount }),
    })
  }, [channelCount, userPlan, userAccessExpiresAt])

  // Divisão Basic/PRO (2026-09-23): a MESMA regra do backend (Pro, premium ou
  // teste grátis ativo). Só decide o que a tela mostra — quem trava de verdade
  // é a API (403 FEATURE_REQUIRES_PRO).
  const isPro = hasProLikeAccess({ plan: userPlan, accessExpiresAt: userAccessExpiresAt })
  const openPro = useCallback((feature) => setProModal(feature || 'garimpo'), [])

  const ctxValue = useMemo(
    () => ({ user, online, phone, groupCount, sessionHealth, hasAnyCredential, offersPublished, refreshSession, setHeader, isPro, openPro }),
    [user, online, phone, groupCount, sessionHealth, hasAnyCredential, offersPublished, refreshSession, isPro, openPro],
  )

  if (checking) {
    return (
      <div className="pnl-center" role="status" aria-live="polite">
        <span className="pnl-spin" aria-hidden="true" /> Validando sua sessão…
      </div>
    )
  }

  const isActive = (href) => href === '/painel' ? pathname === '/painel' : pathname.startsWith(href)

  return (
    <PainelContext.Provider value={ctxValue}>
      <div className={`pnl-root${menuOpen ? ' is-menu-open' : ''}`}>
        {menuOpen && <button type="button" aria-label="Fechar menu" className="pnl-overlay" onClick={() => setMenuOpen(false)} />}

        <aside className="pnl-sidebar">
          <Link href="/painel" className="pnl-brand" onClick={() => setMenuOpen(false)}>
            Espelha Grupos
          </Link>
          <nav className="pnl-nav" aria-label="Navegação do painel">
            <SidebarOnboarding userId={user?.id} onNavigate={() => setMenuOpen(false)} />
            {NAV_GROUPS.map((group) => {
              const hasActiveChild = group.items.some((item) => isActive(item.href))
              const renderItem = (item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`pnl-nav-item${isActive(item.href) ? ' is-active' : ''}${item.pro && !isPro ? ' is-pro-locked' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon path={item.icon} />
                  <span>{item.label}</span>
                  {item.pro && !isPro && (
                    <span className="pnl-pro" title="Disponível no plano PRO">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{LOCK_ICON}</svg>PRO
                    </span>
                  )}
                  {item.free && <span className="pnl-free">GRÁTIS</span>}
                </Link>
              )

              if (group.collapsible) {
                const open = openGroups[group.title] ?? (group.defaultOpen || hasActiveChild)
                return (
                  <div key={group.title} className="pnl-nav-group">
                    <button
                      type="button"
                      className={`pnl-nav-toggle${open ? ' is-open' : ''}`}
                      aria-expanded={open}
                      onClick={() => setOpenGroups((s) => ({ ...s, [group.title]: !open }))}
                    >
                      <span>{group.title}</span>
                      <svg className="pnl-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                    {open && group.items.map(renderItem)}
                  </div>
                )
              }

              return (
                <div key={group.title} className="pnl-nav-group">
                  <p className="pnl-nav-title">{group.title}</p>
                  {group.items.map(renderItem)}
                </div>
              )
            })}
          </nav>

          {(() => {
            const pi = planInfo(user)
            if (!pi.expired && !isPro) {
              return (
                <Link href="/painel/plano" className="pnl-plan-upsell" onClick={() => setMenuOpen(false)}>
                  <span className="pnl-plan-upsell-title" style={{ display: 'block' }}>{pi.label}</span>
                  <span className="pnl-plan-upsell-sub" style={{ display: 'block' }}>Desbloqueie canais, ofertas automáticas e filas.</span>
                  <span className="pnl-btn is-pro is-sm">Ver planos</span>
                </Link>
              )
            }
            return (
              <Link href="/painel/plano" className={`pnl-plan${pi.expired ? ' is-expired' : ' is-pro'}`} onClick={() => setMenuOpen(false)}>
                <span className="pnl-plan-ico"><Icon path={pi.expired ? LOCK_ICON : STAR_ICON} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="pnl-plan-title" style={{ display: 'block' }}>{pi.label}</span>
                  <span className="pnl-plan-sub" style={{ display: 'block' }}>{pi.sub}</span>
                </span>
                {pi.expired ? <span className="pnl-plan-cta">Reativar</span> : <Icon path={CHEVRON_ICON} />}
              </Link>
            )
          })()}

          <div className="pnl-usermenu-wrap">
            {userMenuOpen && (
              <>
                <button type="button" aria-label="Fechar menu da conta" className="pnl-usermenu-scrim" onClick={() => setUserMenuOpen(false)} />
                <div className="pnl-usermenu" role="menu">
                  <Link href="/painel/conta" role="menuitem" className="pnl-usermenu-item" onClick={() => { setUserMenuOpen(false); setMenuOpen(false) }}>
                    <Icon path={SETTINGS_ICON} />
                    <span>Minha conta</span>
                  </Link>
                  <button type="button" role="menuitem" className="pnl-usermenu-item is-danger" onClick={logout}>
                    <Icon path={LOGOUT_ICON} />
                    <span>Sair</span>
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              className={`pnl-user${userMenuOpen ? ' is-open' : ''}`}
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              title="Minha conta"
              style={{ background: 'none', border: 'none', borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <span className="pnl-avatar" aria-hidden="true">{initialsOf(user?.name, user?.email)}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="pnl-user-name" style={{ display: 'block' }}>{user?.name || 'Minha conta'}</span>
                <span className="pnl-user-mail" style={{ display: 'block' }}>{user?.email || 'Ver opções'}</span>
              </span>
              <svg className="pnl-user-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </aside>

        <div className="pnl-main">
          <header className="pnl-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" className="pnl-burger" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
                <Icon path={<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>} />
              </button>
              <div>
                <h1>{header.title}</h1>
                {header.subtitle && <div className="pnl-sub">{header.subtitle}</div>}
              </div>
            </div>
            <div className="pnl-header-right">
              <OnlinePill online={online} groupCount={groupCount} />
              <Link href="/painel/tutorial" className="pnl-bell" aria-label="Tutorial e ajuda" title="Tutorial e ajuda">
                <Icon path={HELP_ICON} />
              </Link>
              <button type="button" className="pnl-bell has-dot" aria-label="Notificações" title="Notificações">
                <Icon path={BELL_ICON} />
              </button>
            </div>
          </header>

          <div className="pnl-content">
            {/* Banner global de "conexão instável" removido (2026-06): a única ação
                que ele oferecia era reconectar (QR novo), o que PIORA o estado —
                logo após reconectar há uma rajada esperada de Bad MAC enquanto as
                sender keys dos grupos re-sincronizam, e re-escanear reinicia esse
                ciclo. Como a ação correta não é reconectar, o banner não aparece
                mais. sessionHealth segue exposto no contexto/metrics para
                observabilidade, sem alarmar o usuário com uma ação enganosa. */}
            <BlockedReasonBanner user={user} />
            <ExpiredPlanBanner user={user} />
            <TrialEndingBanner notice={trialNotice} />
            <ProFeaturesStoppedBanner notice={proFeaturesNotice} />
            <SendPauseBanner notice={sendPauseNotice} />
            {/* A loja só é cobrada DEPOIS de conectar o WhatsApp — a mesma
                regra do próximo passo na tela de conexão. Antes disso o robô
                nem foi ligado, e o alarme não corresponde a nada. */}
            <NoCredentialBanner show={shouldShowNoCredentialBanner({ hasAnyCredential, online, phone })} />
            <ExpiredMlSsidBanner expired={mlSsidExpired} />
            {children}
          </div>
        </div>
        {proModal && <ProModal feature={proModal} onClose={() => setProModal(null)} />}
      </div>
    </PainelContext.Provider>
  )
}
