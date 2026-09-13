'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'
import {
  AFFILIATE_PLATFORMS,
  COOKIE_EDITOR_URL,
  CRED_STATUS,
  describeInvalidAffiliateValue,
  getPlatformStatus,
  isQuickSetupPlatform,
  quickSetupPlatforms,
} from '@/lib/painel/affiliatePlatforms'

const IconChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const IconSpark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
  </svg>
)

// Uma frase por aviso. O texto inteiro continua a um clique de distância, no
// "Saiba mais" do mesmo cartão — a tela poluída vinha de empilhar três
// parágrafos por loja, não de o conteúdo existir.
//
// Shopee é o caso OPOSTO das outras: sem chave aceita a conversão falha inteira,
// nada é publicado e as ofertas automáticas param junto. O texto tranquilizador
// de "continua saindo" seria mentira aqui e faria a cliente ignorar prejuízo
// real. Não fundir os dois textos.
const SESSION_PROBLEM = {
  shopee: {
    tag: 'Chave recusada',
    sub: 'A Shopee não está aceitando sua chave',
    message:
      'A Shopee parou de aceitar sua chave: as ofertas dessa loja param de sair até você colar um App ID e uma chave secreta novos aqui embaixo.',
  },
  amazon: {
    tag: 'Código venceu',
    sub: 'O código de acesso venceu',
    message:
      'O código de acesso da Amazon venceu: suas ofertas continuam saindo e a comissão continua sua, só o link fica mais comprido até você colar um código novo aqui embaixo.',
  },
  mercadolivre: {
    tag: 'Código venceu',
    sub: 'O código de acesso venceu',
    message:
      'O código de acesso do Mercado Livre venceu: suas ofertas continuam saindo e a comissão continua sua, só o link fica mais comprido (e cupom sem produto deixa de ser convertido) até você colar um código novo aqui embaixo.',
  },
}

function sessionProblemFor(platformId, sessionStatus) {
  if (!sessionStatus || sessionStatus.alive !== false) return null
  return SESSION_PROBLEM[platformId] ?? null
}

// Todo o texto longo da loja num lugar só, recolhido. Antes eram três blocos
// sempre abertos (ganho do código, cuidado de não sair da conta, privacidade) —
// cada um nasceu de um problema real com cliente, então nada aqui pode
// desaparecer; o que muda é só quando aparece.
function PlatformDetails({ platform }) {
  const pedeCodigo = platform.fields?.some((f) => f.cookieField)
  if (!platform.platformWarning && !pedeCodigo) return null

  return (
    <details className="pnl-cred-more">
      <summary>Saiba mais sobre a {platform.label}</summary>
      <div className="pnl-cred-more-body">
        {platform.platformWarning && <p>{platform.platformWarning}</p>}
        {pedeCodigo && (
          <>
            <p className="pnl-cred-more-title">Esse código expõe meus dados pessoais?</p>
            <ul>
              <li>Ele serve <strong>só para uma coisa</strong>: montar o link da oferta já com a sua comissão.</li>
              <li>Fica guardado <strong>trancado (criptografado)</strong> e não é repassado para ninguém.</li>
              <li>Não compramos nada, não mudamos nada na sua conta e não lemos suas conversas.</li>
              <li>Você <strong>apaga quando quiser</strong>, no botão aqui embaixo. Sair da sua conta na loja também derruba o código na hora.</li>
            </ul>
            <p>
              Para copiar o código você precisa de um computador com Google Chrome e da extensão gratuita{' '}
              <a href={COOKIE_EDITOR_URL} target="_blank" rel="noopener noreferrer">Cookie-Editor</a>.
            </p>
          </>
        )}
      </div>
    </details>
  )
}

// O motivo nº 1 de "cadastrei e venceu de novo" (investigação 18/08/2026): sair
// da conta da loja encerra a sessão e derruba o código na hora — confirmado em
// teste controlado (um código válido virou vencido em menos de 4 min após o
// clique em "Sair").
//
// Por isso este é o ÚNICO texto longo que NÃO foi para dentro do "Saiba mais":
// quem lê depois de já ter saído da conta não tem mais conserto senão
// recadastrar. Fechado ele ocupa uma linha; a frase inteira fica a um clique.
function SessionCareLine({ platform }) {
  if (!platform.sessionCareNote) return null
  return (
    <details className="pnl-cred-care">
      <summary>
        <IconLock />
        Não saia da conta da {platform.label} depois de colar — por quê?
      </summary>
      <p>{platform.sessionCareNote}</p>
    </details>
  )
}

function CredentialField({ platform, field, value, onChange, disabled, error, visible, onToggleVisible }) {
  const id = `${platform.id}-${field.key}`
  const hidden = field.sensitive && !visible

  return (
    <div className="pnl-cred-field">
      <label className="pnl-cred-label" htmlFor={id}>
        {field.label}
        {field.recommended && <span className="pnl-cred-rec">recomendado</span>}
      </label>
      <div className="pnl-cred-input-wrap">
        <input
          id={id}
          className={`pnl-input ${field.sensitive ? 'pnl-cred-secret' : ''}`}
          type={hidden ? 'password' : 'text'}
          value={value}
          maxLength={field.maxLength}
          onChange={(e) => onChange(field.key, e.target.value)}
          disabled={disabled}
          aria-invalid={!!error}
        />
        {field.sensitive && (
          <button
            type="button"
            className="pnl-cred-eye"
            onClick={() => onToggleVisible(field.key)}
            disabled={disabled}
            aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${field.label}`}
          >
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
      {field.hint && <p className="pnl-hint">{field.hint}</p>}
      {field.help && (
        <details className="pnl-help">
          <summary>Como encontrar?</summary>
          <p>{field.help}</p>
        </details>
      )}
      {error && <p className="pnl-field-error" role="alert">{error}</p>}
    </div>
  )
}

function StartHereCard({ platforms }) {
  if (!platforms.length) return null
  const nomes = platforms.map((p) => p.label)
  const lista = nomes.length > 1
    ? `${nomes.slice(0, -1).join(', ')} ou ${nomes[nomes.length - 1]}`
    : nomes[0]
  return (
    <div className="pnl-note-box is-warn" role="status">
      <strong>Comece por uma loja só — leva menos de um minuto.</strong>
      <p style={{ margin: '6px 0 0' }}>
        Sem nenhuma loja aqui o robô <strong>não publica nenhuma oferta</strong> — é de propósito, não é defeito: sem a
        sua etiqueta a comissão iria para outra pessoa.
      </p>
      <p style={{ margin: '6px 0 0' }}>
        O caminho curto é {lista}: só a sua etiqueta de afiliada, um campo.
      </p>
    </div>
  )
}

function PlatformCard({ platform, initialData, onSave, onDelete, disabled, sessionStatus, open, onToggleOpen }) {
  const [draft, setDraft] = useState({})
  const [dirty, setDirty] = useState(false)
  const [visible, setVisible] = useState({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type, message, warnings }
  const [fieldErrors, setFieldErrors] = useState({})
  const savingRef = useRef(false)
  const deletingRef = useRef(false)

  const values = dirty ? draft : (initialData ?? {})
  const status = CRED_STATUS[getPlatformStatus(platform, values)]
  const statusKey = getPlatformStatus(platform, values)
  const hasStoredCredential = !!initialData && Object.keys(initialData).length > 0
  const isDisabled = disabled || saving || deleting
  const problem = sessionProblemFor(platform.id, sessionStatus)

  const mainFields = platform.fields.filter((f) => !f.advanced)
  const advancedFields = platform.fields.filter((f) => f.advanced)

  function update(key, value) {
    setFeedback(null)
    setFieldErrors((cur) => ({ ...cur, [key]: '' }))
    setDraft((cur) => ({ ...(dirty ? cur : (initialData ?? {})), [key]: value }))
    setDirty(true)
  }

  function toggleVisible(key) {
    setVisible((cur) => ({ ...cur, [key]: !cur[key] }))
  }

  async function handleDelete() {
    if (deletingRef.current || savingRef.current) return
    if (!window.confirm(
      `Apagar os dados da ${platform.label}?\n\nEles saem daqui agora. Suas ofertas dessa loja param de sair até você cadastrar de novo — e cadastrar leva menos de um minuto.`,
    )) return
    deletingRef.current = true
    setDeleting(true)
    setFeedback(null)
    try {
      const result = await onDelete(platform.id)
      setDraft({})
      setDirty(false)
      setFeedback({ type: 'success', message: result?.message || 'Credencial apagada.' })
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Não foi possível apagar a credencial.' })
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (savingRef.current || deletingRef.current) return
    const missing = platform.fields.filter((f) => f.required !== false && !String(values[f.key] ?? '').trim())
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((f) => [f.key, `${f.label} é obrigatório.`])))
      setFeedback({ type: 'error', message: `Preencha os campos obrigatórios de ${platform.label}.` })
      return
    }
    // Peneira de formato antes de mandar para o servidor (que também recusa —
    // ele é a autoridade). Evita o caso real de colar um LINK no campo do
    // código e o painel responder "Tudo certo!".
    const invalidos = platform.fields
      .map((f) => [f.key, describeInvalidAffiliateValue(platform.id, f.key, values[f.key])])
      .filter(([, mensagem]) => mensagem)
    if (invalidos.length) {
      setFieldErrors(Object.fromEntries(invalidos))
      setFeedback({ type: 'error', message: invalidos[0][1] })
      // Campo escondido atrás de "Mais opções" com erro precisa aparecer,
      // senão o aviso aponta para um campo que a pessoa não está vendo.
      if (invalidos.some(([key]) => advancedFields.some((f) => f.key === key))) setShowAdvanced(true)
      return
    }
    savingRef.current = true
    setSaving(true)
    setFeedback(null)
    try {
      const result = await onSave(platform.id, values)
      const warnings = result?.validation?.warnings || []
      // `messageTone` vem do teste do código feito no momento do save (RCA
      // 2026-08-15): quando a loja recusa o código, o banner precisa ficar
      // VERMELHO ali mesmo. Antes era sempre verde "atualizadas com sucesso" e o
      // cliente saía da tela achando que estava tudo certo. Sem o campo (API
      // antiga), cai no comportamento histórico.
      const tone = result?.messageTone || (warnings.length ? 'warn' : 'success')
      setFeedback({ type: tone, message: result?.message || 'Credenciais atualizadas com sucesso.', warnings })
      setDraft({})
      setDirty(false)
    } catch (err) {
      setFeedback({ type: 'error', message: `${err?.message || 'Não foi possível salvar.'} Verifique os campos e tente novamente.` })
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className={`pnl-cred-card ${problem ? 'is-attention' : ''}`}>
      <button
        type="button"
        className="pnl-cred-head"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-controls={`${platform.id}-body`}
      >
        <span
          className="pnl-cred-badge"
          style={{ background: platform.color, color: platform.badgeInk ? 'var(--ink)' : '#fff' }}
          aria-hidden="true"
        >
          {platform.initials}
        </span>
        <span className="pnl-cred-head-main">
          <span className="pnl-cred-name">
            {platform.label}
            {problem
              ? <span className="pnl-tag is-flight">{problem.tag}</span>
              : (isQuickSetupPlatform(platform) && !hasStoredCredential && <span className="pnl-tag is-info">Mais rápida · 1 campo</span>)}
          </span>
          <span className={`pnl-cred-status is-${statusKey}`}>
            <span className="pnl-cred-dot" aria-hidden="true" />
            {problem ? problem.sub : status.label}
          </span>
        </span>
        <span className={`pnl-cred-chev ${open ? 'is-open' : ''}`} aria-hidden="true"><IconChevron /></span>
      </button>

      <form id={`${platform.id}-body`} className={`pnl-cred-body ${open ? 'is-open' : ''}`} onSubmit={submit}>
        {problem && (
          <div className="pnl-note-box is-warn" style={{ marginBottom: 12 }} role="alert">{problem.message}</div>
        )}

        {platform.instructions && <p className="pnl-cred-onde">{platform.instructions}</p>}

        {!!platform.actionLinks?.length && (
          <div className="pnl-cred-ctas">
            {platform.actionLinks.map((link, index) => (
              <a
                key={link.href}
                className={`pnl-btn ${index === 0 ? 'is-primary' : ''}`}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        {mainFields.map((f) => (
          <CredentialField
            key={f.key}
            platform={platform}
            field={f}
            value={values[f.key] ?? ''}
            onChange={update}
            disabled={isDisabled}
            error={fieldErrors[f.key]}
            visible={!!visible[f.key]}
            onToggleVisible={toggleVisible}
          />
        ))}

        <SessionCareLine platform={platform} />

        {!!advancedFields.length && (
          <>
            <button
              type="button"
              className={`pnl-cred-more-btn ${showAdvanced ? 'is-open' : ''}`}
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <IconChevron />
              {showAdvanced ? 'Ocultar mais opções' : `Mais opções (${advancedFields.length})`}
            </button>
            {showAdvanced && (
              <div className="pnl-cred-advanced">
                {advancedFields.map((f) => (
                  <CredentialField
                    key={f.key}
                    platform={platform}
                    field={f}
                    value={values[f.key] ?? ''}
                    onChange={update}
                    disabled={isDisabled}
                    error={fieldErrors[f.key]}
                    visible={!!visible[f.key]}
                    onToggleVisible={toggleVisible}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <PlatformDetails platform={platform} />

        {feedback && (
          <div className={`pnl-note-box is-${feedback.type}`} style={{ marginTop: 4, marginBottom: 12 }} role="status">
            {feedback.message}
            {!!feedback.warnings?.length && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                {feedback.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
          </div>
        )}

        <button type="submit" className="pnl-btn is-primary pnl-cred-save" disabled={isDisabled}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>

        {hasStoredCredential && (
          <button type="button" className="pnl-cred-delete" onClick={handleDelete} disabled={isDisabled}>
            {deleting ? 'Apagando…' : `Apagar meus dados da ${platform.label}`}
          </button>
        )}
      </form>
    </div>
  )
}

export default function IdsAfiliadaPage() {
  usePainelHeader({ title: 'Minhas credenciais', subtitle: 'IDs de afiliada por loja' })

  const [credMap, setCredMap] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [mlSession, setMlSession] = useState(null)
  const [amazonSession, setAmazonSession] = useState(null)
  const [shopeeSession, setShopeeSession] = useState(null)
  const [openId, setOpenId] = useState(null)

  // Checa a validade do SSID do ML (sessão de afiliado). Só roda quando há
  // cookie cadastrado — o endpoint faz um request autenticado ao ML.
  function refreshMlSession(data) {
    if (!(data?.ssid || data?.cookie)) { setMlSession(null); return }
    api.mercadolivreSession()
      .then((status) => setMlSession(status))
      .catch(() => setMlSession(null))
  }

  // Idem para a Amazon: só checa quando há tag + algum portador de cookie
  // (o cookie completo OU o at-acbbr legado). O endpoint faz um getShortUrl
  // autenticado no SiteStripe.
  function refreshAmazonSession(data) {
    if (!(data?.tag && (data?.cookie || data?.['at-acbbr']))) { setAmazonSession(null); return }
    api.amazonSession()
      .then((status) => setAmazonSession(status))
      .catch(() => setAmazonSession(null))
  }

  // Idem para a Shopee: só checa quando os dois campos estão preenchidos —
  // campo faltando é outro problema, e o cartão já mostra "falta preencher".
  function refreshShopeeSession(data) {
    if (!(data?.appId && data?.secretKey)) { setShopeeSession(null); return }
    api.shopeeSession()
      .then((status) => setShopeeSession(status))
      .catch(() => setShopeeSession(null))
  }

  useEffect(() => {
    let active = true
    api.credentials()
      .then((list) => {
        if (!active) return
        const map = {}
        for (const c of list) map[c.platform] = c.data
        setCredMap(map)
        refreshMlSession(map.mercadolivre)
        refreshAmazonSession(map.amazon)
        refreshShopeeSession(map.shopee)
      })
      .catch((err) => { if (active) setLoadError(err?.message || 'Falha ao carregar credenciais.') })
    return () => { active = false }
  }, [])

  async function handleSave(platform, data) {
    const result = await api.saveCredential(platform, data)
    const savedData = result?.data ?? data
    setCredMap((m) => ({ ...(m || {}), [platform]: savedData }))
    // O save já testa o código e devolve o resultado em `sessionCheck` — usar
    // ele evita uma SEGUNDA sondagem à loja logo em seguida (na Amazon cada
    // sondagem gasta uma rotação de código de acesso). Sem o campo (API antiga),
    // cai no comportamento histórico de re-checar.
    const setter = platform === 'mercadolivre'
      ? setMlSession
      : platform === 'amazon'
        ? setAmazonSession
        : platform === 'shopee' ? setShopeeSession : null
    if (setter && result?.sessionCheck) setter(result.sessionCheck)
    else if (platform === 'mercadolivre') refreshMlSession(savedData)
    else if (platform === 'amazon') refreshAmazonSession(savedData)
    else if (platform === 'shopee') refreshShopeeSession(savedData)
    return result
  }

  async function handleDelete(platform) {
    const result = await api.deleteCredential(platform)
    setCredMap((m) => {
      const next = { ...(m || {}) }
      delete next[platform]
      return next
    })
    if (platform === 'mercadolivre') setMlSession(null)
    if (platform === 'amazon') setAmazonSession(null)
    if (platform === 'shopee') setShopeeSession(null)
    return result
  }

  const loading = credMap === null && !loadError

  return (
    <div className="pnl-cred-page">
      <p className="pnl-cred-lede">Cadastre os dados de afiliada de cada loja — o robô usa para montar seus links já com a sua comissão.</p>

      <div className="pnl-cred-note">
        <IconLock />
        <span>Guardado trancado (criptografado) e usado só para montar seus links. Você apaga quando quiser.</span>
      </div>

      <p className="pnl-cred-tip">
        <IconSpark />
        Comece pela Magalu ou pela SHEIN — só 1 campo, menos de 1 minuto.
      </p>

      {loadError && (
        <div className="pnl-note-box is-error" style={{ marginBottom: 12 }} role="alert">
          Não conseguimos carregar suas credenciais: {loadError}
        </div>
      )}

      {/* `credMap` ainda nulo = carregando ou falhou: não acusar falta de
          cadastro por causa de um blip de rede (mesma regra do NoCredentialBanner). */}
      {credMap !== null && Object.keys(credMap).length === 0 && (
        <StartHereCard platforms={quickSetupPlatforms()} />
      )}

      {loading
        ? [0, 1, 2, 3, 4].map((k) => <div key={k} className="pnl-skel" style={{ height: 72, marginBottom: 10 }} />)
        : AFFILIATE_PLATFORMS.map((p) => (
          <PlatformCard
            key={p.id}
            platform={p}
            initialData={credMap?.[p.id]}
            onSave={handleSave}
            onDelete={handleDelete}
            disabled={!!loadError}
            open={openId === p.id}
            onToggleOpen={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
            sessionStatus={
              p.id === 'mercadolivre' ? mlSession
                : p.id === 'amazon' ? amazonSession
                  : p.id === 'shopee' ? shopeeSession : null
            }
          />
        ))}
    </div>
  )
}
