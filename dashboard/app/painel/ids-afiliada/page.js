'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'
import { AFFILIATE_PLATFORMS, CRED_STATUS, getPlatformStatus } from '@/lib/painel/affiliatePlatforms'


function PlatformActionLinks({ links }) {
  if (!links?.length) return null

  return (
    <div className="pnl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 14 }}>
      {links.map((link, index) => (
        <a
          key={link.href}
          className={`pnl-btn ${index === 0 ? 'is-primary' : ''}`}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ justifyContent: 'center', textAlign: 'center' }}
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}

function PlatformInfoCard({ platform }) {
  return (
    <div className="pnl-card">
      {platform.instructions && <p className="pnl-card-note" style={{ marginBottom: 12 }}>{platform.instructions}</p>}
      <PlatformActionLinks links={platform.actionLinks} />
    </div>
  )
}

function SessionWarning({ platformId, sessionStatus }) {
  if (!sessionStatus || sessionStatus.alive !== false) return null
  // Shopee é o caso GRAVE: sem chave aceita não há plano B — a oferta não é
  // publicada e as ofertas automáticas param. O texto tranquilizador das outras
  // duas lojas ("continuam saindo") seria mentira aqui e faria a cliente
  // ignorar prejuízo real.
  if (platformId === 'shopee') {
    return (
      <div className="pnl-note-box is-warn" style={{ marginBottom: 12 }} role="alert">
        <strong>A Shopee parou de aceitar sua chave.</strong> Enquanto ela não for aceita, as ofertas da Shopee param de
        sair — as outras lojas seguem normalmente. Gere um App ID e uma chave secreta novos no painel de afiliada da
        Shopee e cole aqui embaixo.
      </div>
    )
  }
  if (platformId === 'amazon') {
    return (
      <div className="pnl-note-box is-warn" style={{ marginBottom: 12 }} role="alert">
        <strong>O código de acesso da Amazon venceu.</strong> Suas ofertas continuam saindo normalmente e a comissão
        continua sendo sua — só que o link fica mais comprido. Para voltar a encurtar, cole um código novo aqui embaixo.
        Se preferir, deixe assim mesmo: nada se perde.
      </div>
    )
  }
  return (
    <div className="pnl-note-box is-warn" style={{ marginBottom: 12 }} role="alert">
      <strong>O código de acesso do Mercado Livre venceu.</strong> Suas ofertas continuam saindo e a comissão continua
      sendo sua — só que o link fica mais comprido e cupons sem produto deixam de ser convertidos. Para voltar ao link
      curto, cole um código novo aqui embaixo.
    </div>
  )
}

// Explica, na tela onde o dado é pedido, o que fazemos com o código de acesso.
// A dúvida "isso expõe meus dados pessoais?" é legítima e não se resolve com
// texto tranquilizador solto: fica junto do campo, com o botão de apagar ao lado.
// Linguagem simples de propósito — quem usa o painel quer divulgar oferta, não
// aprender vocabulário técnico.
function CookiePrivacyDetails({ platform }) {
  // Só faz sentido nas lojas que pedem código de acesso da conta.
  if (!platform.fields?.some((f) => f.cookieField)) return null
  return (
    <details className="pnl-help" style={{ marginBottom: 12 }}>
      <summary>Esse código expõe meus dados pessoais?</summary>
      <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
        <li>Ele serve <strong>só para uma coisa</strong>: montar o link da oferta já com a sua comissão.</li>
        <li>Fica guardado <strong>trancado (criptografado)</strong> e não é repassado para ninguém.</li>
        <li>Não compramos nada, não mudamos nada na sua conta e não lemos suas conversas.</li>
        <li>Você <strong>apaga quando quiser</strong>, no botão lá embaixo. Sair da sua conta na loja também derruba o código na hora.</li>
        <li>Ele é usado só enquanto está válido; quando vence, a gente avisa aqui para você colar um novo.</li>
      </ul>
    </details>
  )
}

function PlatformCard({ platform, initialData, onSave, onDelete, disabled, sessionStatus }) {
  const [draft, setDraft] = useState({})
  const [dirty, setDirty] = useState(false)
  const [visible, setVisible] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type, message, warnings }
  const [fieldErrors, setFieldErrors] = useState({})

  const values = dirty ? draft : (initialData ?? {})
  const status = CRED_STATUS[getPlatformStatus(platform, values)]
  const hasStoredCredential = !!initialData && Object.keys(initialData).length > 0
  const isDisabled = disabled || saving || deleting

  function update(key, value) {
    setFeedback(null)
    setFieldErrors((cur) => ({ ...cur, [key]: '' }))
    setDraft((cur) => ({ ...(dirty ? cur : (initialData ?? {})), [key]: value }))
    setDirty(true)
  }

  async function handleDelete() {
    if (!window.confirm(
      `Apagar os dados da ${platform.label}?\n\nEles saem daqui agora. Suas ofertas dessa loja param de sair até você cadastrar de novo — e cadastrar leva menos de um minuto.`,
    )) return
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
      setDeleting(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    const missing = platform.fields.filter((f) => f.required !== false && !String(values[f.key] ?? '').trim())
    if (missing.length) {
      setFieldErrors(Object.fromEntries(missing.map((f) => [f.key, `${f.label} é obrigatório.`])))
      setFeedback({ type: 'error', message: `Preencha os campos obrigatórios de ${platform.label}.` })
      return
    }
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
      // Código recusado: manter o formulário "sujo" seria confuso, mas limpar o
      // rascunho sem avisar também. O banner vermelho acima é o aviso.
      setDirty(false)
    } catch (err) {
      setFeedback({ type: 'error', message: `${err?.message || 'Não foi possível salvar.'} Verifique os campos e tente novamente.` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="pnl-card" onSubmit={submit}>
      <div className="pnl-card-head">
        <div className="pnl-card-title">{platform.label}</div>
        <span className={`pnl-tag ${status.cls}`}>{status.label}</span>
      </div>
      {platform.instructions && <p className="pnl-card-note" style={{ marginBottom: 12 }}>{platform.instructions}</p>}
      <SessionWarning platformId={platform.id} sessionStatus={sessionStatus} />
      <PlatformActionLinks links={platform.actionLinks} />
      {platform.platformWarning && <div className="pnl-note-box is-warn" style={{ marginBottom: 12 }}>{platform.platformWarning}</div>}

      <CookiePrivacyDetails platform={platform} />

      <div className="pnl-grid" style={{ gap: 12 }}>
        {platform.fields.map((f) => {
          const hidden = f.sensitive && !visible[f.key]
          const id = `${platform.id}-${f.key}`
          return (
            <div key={f.key} className="pnl-field">
              <label className="pnl-label" htmlFor={id}>{f.label}</label>
              <div className="pnl-field-row">
                <input
                  id={id}
                  className="pnl-input"
                  type={hidden ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => update(f.key, e.target.value)}
                  disabled={isDisabled}
                  aria-invalid={!!fieldErrors[f.key]}
                />
                {f.sensitive && (
                  <button
                    type="button"
                    className="pnl-btn pnl-btn-sm"
                    onClick={() => setVisible((cur) => ({ ...cur, [f.key]: !cur[f.key] }))}
                    disabled={isDisabled}
                    aria-label={`${visible[f.key] ? 'Ocultar' : 'Mostrar'} ${f.label}`}
                  >
                    {visible[f.key] ? 'Ocultar' : 'Mostrar'}
                  </button>
                )}
              </div>
              {f.hint && <p className="pnl-hint">{f.hint}</p>}
              {f.help && (
                <details className="pnl-help">
                  <summary>Como encontrar?</summary>
                  <p>{f.help}</p>
                </details>
              )}
              {fieldErrors[f.key] && <p className="pnl-field-error" role="alert">{fieldErrors[f.key]}</p>}
            </div>
          )
        })}
      </div>

      {feedback && (
        <div className={`pnl-note-box is-${feedback.type}`} style={{ marginTop: 14 }} role="status">
          {feedback.message}
          {!!feedback.warnings?.length && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
              {feedback.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <button type="submit" className="pnl-btn is-primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} disabled={isDisabled}>
        {saving ? 'Salvando…' : 'Salvar'}
      </button>

      {hasStoredCredential && (
        <button
          type="button"
          className="pnl-btn"
          style={{ marginTop: 8, width: '100%', justifyContent: 'center', color: 'var(--danger)' }}
          onClick={handleDelete}
          disabled={isDisabled}
        >
          {deleting ? 'Apagando…' : `Apagar meus dados da ${platform.label}`}
        </button>
      )}
    </form>
  )
}

export default function IdsAfiliadaPage() {
  usePainelHeader({ title: 'Minhas credenciais', subtitle: 'Cole o ID de cada plataforma — o bot cuida do resto' })

  const [credMap, setCredMap] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [mlSession, setMlSession] = useState(null)
  const [amazonSession, setAmazonSession] = useState(null)
  const [shopeeSession, setShopeeSession] = useState(null)

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
    <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="pnl-note-box is-info">
        Tudo o que você cola aqui serve só para uma coisa: montar seus links de oferta já com a sua comissão. Fica guardado trancado
        (criptografado) e você apaga quando quiser. Fora daqui, não passe esses dados para ninguém.
      </div>

      {loadError && (
        <div className="pnl-card" style={{ borderColor: 'color-mix(in oklab, var(--danger) 40%, transparent)' }}>
          <p className="pnl-card-title" style={{ color: 'var(--danger)' }}>Falha ao carregar credenciais</p>
          <p className="pnl-card-note">{loadError}</p>
        </div>
      )}

      {loading
        ? [0, 1, 2, 3].map((k) => <div key={k} className="pnl-skel" style={{ height: 160 }} />)
        : AFFILIATE_PLATFORMS.map((p) =>
            p.type === 'info' ? (
              <PlatformInfoCard key={p.id} platform={p} />
            ) : (
              <PlatformCard
                key={p.id}
                platform={p}
                initialData={credMap?.[p.id]}
                onSave={handleSave}
                onDelete={handleDelete}
                disabled={!!loadError}
                sessionStatus={
                  p.id === 'mercadolivre' ? mlSession
                    : p.id === 'amazon' ? amazonSession
                      : p.id === 'shopee' ? shopeeSession : null
                }
              />
            )
          )}
    </div>
  )
}
