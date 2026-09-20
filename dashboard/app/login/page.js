'use client'
import { useState, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { TERMS_VERSION, api } from '@/lib/api'
import { resolvePostAuthRedirect } from '@/lib/onboardingProgress'
import { Alert } from '@/components/Alert'
import { mapAuthError, trackAdsConversion, trackEvent, TRACKING_EVENTS } from '@/lib/analytics'
import { attributionForTracking, readAttributionFromSearchParams, getFirstTouchClickId, getFirstTouchLandingPage } from '@/lib/marketing-attribution'
import { GOOGLE_ADS_SIGNUP_LABEL } from '@/lib/google-ads'
import { SUPPORT_WHATSAPP_URL } from '@/lib/marketing-content'
import { SUPPORT_PHONE_LABEL } from '@/lib/mobilePixUtils'

const LOGIN_BENEFITS = [
  'Conversão automática de links de afiliado',
  'Grupos de WhatsApp organizados por origem e destino',
  'Envio e agendamento de ofertas em menos tempo',
]

const PHONE_ALREADY_REGISTERED_ERROR = 'Este número de telefone já está cadastrado'
const PHONE_RECOVERY_WHATSAPP_URL = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent('Oi! Meu WhatsApp já está cadastrado no Espelha Grupos e preciso recuperar o acesso da minha conta.')}`

function normalizePhoneInput(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 15)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
}


function resolveRegisterLandingPage() {
  if (typeof window === 'undefined') return ''
  try {
    const firstTouch = getFirstTouchLandingPage()
    if (firstTouch) return firstTouch
    return `${window.location.pathname}${window.location.search}`.slice(0, 500)
  } catch {
    return ''
  }
}

function getOrCreateAffiliateVisitorId() {
  if (typeof window === 'undefined') return ''
  try {
    const existing = window.localStorage.getItem('aff_visitor_id')
    if (existing) return existing
    const generated = (window.crypto?.randomUUID?.() || `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`).slice(0, 120)
    window.localStorage.setItem('aff_visitor_id', generated)
    return generated
  } catch {
    return `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`.slice(0, 120)
  }
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const signupAttribution = readAttributionFromSearchParams(searchParams)
  const trackingAttribution = attributionForTracking(signupAttribution)
  const [name, setName] = useState('')
  const [email, setEmail] = useState(() => searchParams.get('email') || '')
  const [password, setPassword] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [isRegister, setIsRegister] = useState(() => searchParams.get('mode') === 'register')
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return ''
    const reason = new URLSearchParams(window.location.search).get('reason')
    const message = sessionStorage.getItem('loginRedirectMessage')
    if (reason === 'session-expired' && message) {
      sessionStorage.removeItem('loginRedirectMessage')
      return message
    }
    return ''
  })
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formStarted, setFormStarted] = useState(false)
  const [affCode, setAffCode] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    if (!isRegister) return
    const fromUrl = searchParams.get('aff')
    if (fromUrl) {
      const visitorId = getOrCreateAffiliateVisitorId()
      const landingPage = `${window.location.pathname}${window.location.search}`.slice(0, 500)
      const persistCode = (hours = 24) => {
        const expires = new Date(Date.now() + hours * 3600 * 1000).toUTCString()
        document.cookie = `aff_code=${fromUrl}; expires=${expires}; path=/; SameSite=Lax`
        document.cookie = `aff_visitor_id=${visitorId}; expires=${expires}; path=/; SameSite=Lax`
        setAffCode(fromUrl)
      }
      api.affiliateConfig()
        // R4: a duração do cookie segue a JANELA DE ATRIBUIÇÃO do servidor
        // (fonte de verdade), para o browser não esquecer o código antes — nem
        // mantê-lo muito depois — da janela em que a venda conta. Fallback para
        // cookieDurationHours e, por fim, 24h.
        .then(cfg => persistCode(cfg?.attributionWindowDays ? cfg.attributionWindowDays * 24 : (cfg?.cookieDurationHours ?? 24)))
        .catch(() => persistCode(24))
      api.affiliateTrack({
        affiliateCode: fromUrl,
        visitorId,
        source: signupAttribution.source || signupAttribution.utm_source || 'affiliate_link',
        medium: signupAttribution.utm_medium || null,
        campaign: signupAttribution.utm_campaign || null,
        landingPage,
      }).catch(() => {})
    } else {
      const match = document.cookie.match(/(?:^|;\s*)aff_code=([^;]+)/)
      if (match) Promise.resolve(decodeURIComponent(match[1])).then(code => setAffCode(code))
    }
    // signupAttribution.* derivam de searchParams (já nas deps); listadas para o
    // exhaustive-deps sem alterar a semântica do efeito.
  }, [isRegister, searchParams, signupAttribution.source, signupAttribution.utm_source, signupAttribution.utm_medium, signupAttribution.utm_campaign])

  function markFormStarted(field) {
    if (formStarted) return
    setFormStarted(true)
    trackEvent(TRACKING_EVENTS.SIGNUP_FORM_STARTED, {
      origin: 'login_page',
      mode: isRegister ? 'register' : 'login',
      first_field: field,
      has_ref: Boolean(ref),
    })
  }

  function blockSubmit(field, message) {
    trackEvent(TRACKING_EVENTS.SIGNUP_SUBMIT_BLOCKED_CLIENT, {
      origin: 'login_page',
      mode: isRegister ? 'register' : 'login',
      field,
    })
    setError(message)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanEmail = email.trim()
    const cleanPhone = normalizePhoneInput(contactPhone)

    if (isRegister) {
      if (!cleanName) return blockSubmit('name', 'Informe seu nome para criar a conta.')
      if (!cleanEmail) return blockSubmit('email', 'Informe seu email para criar a conta e recuperar acesso depois.')
      if (!isValidEmail(cleanEmail)) return blockSubmit('email', 'Confira o formato do email antes de continuar.')
      // Celular é obrigatório de propósito: é por ele que a operação procura a
      // cliente quando ela trava na configuração. A proposta de torná-lo
      // opcional (auditoria de funil §3.4) foi revertida a pedido dela — não
      // reabrir sem pedido explícito.
      if (!cleanPhone || cleanPhone.length < 10) return blockSubmit('contactPhone', 'Informe seu WhatsApp com DDD para o suporte falar com você se algo travar.')
      if (!password) return blockSubmit('password', 'Crie uma senha para acessar o painel depois.')
      if (password.length < 8) return blockSubmit('password', 'Use pelo menos 8 caracteres na senha.')
      if (!termsAccepted) return blockSubmit('termsAccepted', 'Você precisa aceitar os Termos de Uso e declarar ciência dos riscos de automação no WhatsApp para criar a conta.')
    } else {
      if (!cleanEmail) return blockSubmit('email', 'Informe seu email para entrar.')
      if (!isValidEmail(cleanEmail)) return blockSubmit('email', 'Confira o formato do email antes de continuar.')
      if (!password) return blockSubmit('password', 'Informe sua senha para entrar.')
    }

    setLoading(true)
    try {
      trackEvent(TRACKING_EVENTS.AUTH_SUBMIT_ATTEMPT, {
        origin: 'login_page',
        mode: isRegister ? 'register' : 'login',
        has_ref: Boolean(ref),
        ...(isRegister ? trackingAttribution : {}),
      })
      if (isRegister) {
        // gclid guardado na PRIMEIRA visita (cookie first-touch): quase ninguém
        // se cadastra no clique do anúncio, então sem isso a campanha nunca
        // recebe o crédito do cadastro que ela gerou.
        const clickId = getFirstTouchClickId()
        await api.register(cleanName, cleanEmail, password, cleanPhone, { ...signupAttribution, landingPage: resolveRegisterLandingPage(), ...(clickId && { gclid: clickId }), ...(ref && { ref }), ...(affCode && { aff_code: affCode, affiliateVisitorId: getOrCreateAffiliateVisitorId() }), termsAccepted, termsVersion: TERMS_VERSION })
        trackEvent(TRACKING_EVENTS.SIGNUP_SUCCESS, { origin: 'login_page', has_ref: Boolean(ref), ...trackingAttribution })
        // Conversão para o Google Ads. No-op sem NEXT_PUBLIC_GADS_SIGNUP_LABEL.
        // Cadastro é a conversão PRIMÁRIA por volume; o pagamento (que é o que
        // realmente importa) entra depois por importação offline via gclid —
        // ver docs/marketing/PLANO_GOOGLE_ADS_2026-08-04.md.
        trackAdsConversion(GOOGLE_ADS_SIGNUP_LABEL)
      } else {
        await api.login(cleanEmail, password)
        trackEvent(TRACKING_EVENTS.LOGIN_SUCCESS, { origin: 'login_page' })
      }
      let redirectTo = '/painel/checklist'
      if (!isRegister) {
        try {
          const status = await api.dashboardStatus()
          redirectTo = resolvePostAuthRedirect({ status, isRegister: false })
        } catch {
          redirectTo = resolvePostAuthRedirect({ status: null, isRegister: false })
        }
      }
      setSuccess(isRegister
        ? 'Conta criada. Agora vamos conectar seu WhatsApp e validar o primeiro teste guiado.'
        : redirectTo === '/painel'
          ? 'Login realizado. Redirecionando para o painel...'
          : 'Login realizado. Redirecionando para o checklist...')
      setTimeout(() => router.push(redirectTo), 300)
    } catch (err) {
      trackEvent(TRACKING_EVENTS.AUTH_ERROR, {
        origin: 'login_page',
        mode: isRegister ? 'register' : 'login',
        error_type: mapAuthError(err),
        ...(isRegister ? trackingAttribution : {}),
      })
      setError(err?.message || 'Não foi possível concluir a autenticação agora.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    const nextMode = !isRegister
    trackEvent(TRACKING_EVENTS.AUTH_MODE_SWITCH, {
      origin: 'login_page',
      mode: nextMode ? 'register' : 'login',
    })
    setIsRegister(nextMode)
    setError('')
    setSuccess('')
    setContactPhone('')
    setTermsAccepted(false)
    setFormStarted(false)
  }

  const inputClassName = 'h-12 w-full rounded-xl border border-[#cbd9d3] bg-white px-4 text-[15px] text-[#20302b] shadow-[0_1px_0_rgba(20,65,48,0.02)] outline-none transition placeholder:text-[#91a19b] hover:border-[#9cb8ad] focus:border-[#20845f] focus:ring-4 focus:ring-[#20845f]/10'

  return (
    <main className="min-h-screen bg-[#f4f4ef] p-0 text-[#20302b] lg:p-7 xl:p-10">
      <div className="pointer-events-none fixed inset-0 hidden bg-[linear-gradient(rgba(32,48,43,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(32,48,43,.055)_1px,transparent_1px)] bg-[size:132px_132px] lg:block" aria-hidden="true" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-[1456px] overflow-hidden bg-[#f6faf8] shadow-[0_20px_60px_rgba(30,58,48,0.12)] lg:min-h-[calc(100vh-3.5rem)] lg:grid-cols-2 lg:rounded-[4px] xl:min-h-[calc(100vh-5rem)]">
        <aside className="relative hidden overflow-hidden bg-[#238561] px-14 py-12 text-white lg:flex lg:flex-col xl:px-16 xl:py-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute -right-6 -top-6 h-52 w-52 rounded-full border border-white/10" aria-hidden="true" />

          <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80" aria-label="Voltar para a página principal do Espelha Grupos">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm">
              <Image src="/botinho-logo.svg" alt="" width={31} height={31} priority />
            </span>
            <span className="text-xl font-extrabold tracking-[-0.02em]">Espelha Grupos</span>
          </Link>

          <div className="relative z-10 my-auto max-w-[520px] py-12">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/80">Sua operação, no ritmo certo</p>
            <h2 className="max-w-[500px] text-[clamp(2.7rem,4vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.055em]">
              Suas ofertas no WhatsApp, no automático.
            </h2>
            <p className="mt-7 max-w-[490px] text-lg leading-8 text-emerald-50/85">
              Cole um link, receba a mensagem pronta com o seu código ou deixe o robô publicar sozinho nos seus grupos.
            </p>

            <div className="mt-10 max-w-[420px] rotate-[-1deg] rounded-2xl bg-white p-5 text-[#26352f] shadow-[0_18px_45px_rgba(8,53,38,0.2)] transition hover:rotate-0">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-extrabold"><span aria-hidden="true">✨</span> Achadinho do dia</p>
                <span className="rounded-full bg-[#e8f5ef] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#217656]">Pronto para enviar</span>
              </div>
              <p className="mt-5 text-[15px] leading-6">Sandália bege verão — só hoje por <strong>R$ 39,90</strong> com frete grátis!</p>
              <div className="mt-5 flex items-end justify-between gap-4 text-sm">
                <span className="font-medium">s.shopee.com.br/3As9XkLp2</span>
                <span className="shrink-0 text-xs text-[#8b9b95]">agora ✓✓</span>
              </div>
            </div>
          </div>

          <ul className="relative z-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-emerald-50/85">
            <li>✓ Grátis para testar</li>
            <li>✓ Sem cartão</li>
            <li>✓ Cancele quando quiser</li>
          </ul>
        </aside>

        <div className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:min-h-0 lg:px-12 lg:py-12">
          <div className="w-full max-w-[462px]">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Link href="/" className="inline-flex items-center gap-2.5 font-extrabold tracking-tight" aria-label="Voltar para a página principal do Espelha Grupos">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e5f4ed]"><Image src="/botinho-logo.svg" alt="" width={27} height={27} priority /></span>
                Espelha Grupos
              </Link>
              <Link href="/" className="text-sm font-semibold text-[#26785b] hover:underline">Início</Link>
            </div>

            <div className="rounded-[22px] border border-[#d8e2de] bg-white px-6 py-8 shadow-[0_12px_40px_rgba(35,72,58,0.06)] sm:px-10 sm:py-10">
              <header className="mb-7">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#258662]">{isRegister ? 'Comece seu teste grátis' : 'Área da cliente'}</p>
                <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-[#1d2b27]">{isRegister ? 'Criar sua conta' : 'Bem-vinda de volta'}</h1>
                <p className="mt-2 text-[15px] text-[#667871]">{isRegister ? 'Configure seu primeiro envio em poucos minutos.' : 'Entre para continuar de onde parou.'}</p>
              </header>

        {ref && (
          <p className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            Você chegou por um convite. Crie sua conta para receber o benefício de indicação disponível.
          </p>
        )}

        {isRegister && <ul className="mb-6 grid gap-2 text-xs text-[#52665f] sm:grid-cols-2">
          {LOGIN_BENEFITS.map(benefit => (
            <li key={benefit} className="flex gap-2">
              <span aria-hidden="true">✅</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {isRegister && (
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-semibold">Nome completo</label>
              <input
                id="name"
                type="text"
                placeholder="Como podemos te chamar"
                value={name}
                onFocus={() => markFormStarted('name')}
                onChange={e => setName(e.target.value)}
                required={isRegister}
                autoComplete="name"
                className={inputClassName}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onFocus={() => markFormStarted('email')}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClassName}
            />
          </div>
          {isRegister && (
            <>
              <div>
                <label htmlFor="contactPhone" className="mb-2 block text-sm font-semibold">Seu WhatsApp</label>
                <input
                  id="contactPhone"
                  type="tel"
                  inputMode="tel"
                  placeholder="Ex: 5511999999999"
                  value={contactPhone}
                  onFocus={() => markFormStarted('contactPhone')}
                  onChange={e => setContactPhone(normalizePhoneInput(e.target.value))}
                  required={isRegister}
                  minLength={10}
                  maxLength={15}
                  autoComplete="tel"
                  className={inputClassName}
                />
                <p className="mt-1.5 text-[11px] leading-4 text-[#72847d]">
                  É por aqui que a gente te avisa se o robô parar ou se a configuração travar. Não usamos para divulgação.
                </p>
              </div>
              <div>
                <label htmlFor="affCode" className="mb-2 block text-sm font-semibold">Código de indicação <span className="font-normal text-[#71827c]">(opcional)</span></label>
                <input
                  id="affCode"
                  type="text"
                  placeholder="Ex: ABCD1234"
                  value={affCode}
                  onChange={e => setAffCode(e.target.value.trim().toUpperCase())}
                  autoComplete="off"
                  className={`${inputClassName} uppercase`}
                />
              </div>
            </>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label htmlFor="password" className="block text-sm font-semibold">Senha</label>
              {!isRegister && (
                <Link
                  href="/esqueci-senha"
                  className="text-xs font-semibold text-[#26785b] hover:underline"
                >
                  Esqueci minha senha
                </Link>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={password}
                onFocus={() => markFormStarted('password')}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={isRegister ? 8 : undefined}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className={`${inputClassName} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-1 right-1 grid w-11 place-items-center rounded-lg text-[#62736d] hover:bg-[#edf5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20845f]"
              >
                <span className="sr-only">{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.7"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/>{showPassword && <path d="m4 4 16 16"/>}</svg>
              </button>
            </div>
            {isRegister && <p className="mt-1.5 text-[11px] leading-4 text-[#72847d]">Use pelo menos 8 caracteres para reduzir erros no cadastro.</p>}
          </div>

          {error && error === PHONE_ALREADY_REGISTERED_ERROR && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert" aria-live="assertive">
              <p className="font-semibold"><span aria-hidden="true">⚠️</span> {error}</p>
              <p className="mt-1">Para recuperar sua conta envie uma mensagem para nosso suporte: {SUPPORT_PHONE_LABEL}</p>
              <a
                href={PHONE_RECOVERY_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Chamar suporte no WhatsApp
              </a>
            </div>
          )}
          {error && error !== PHONE_ALREADY_REGISTERED_ERROR && <Alert type="error" title="Falha na autenticação" message={error} />}
          {success && <Alert type="success" title="Sucesso" message={success} />}

          {isRegister && (
            <label htmlFor="termsAccepted" className="flex cursor-pointer gap-3 text-xs leading-5 text-[#52665f]">
              <input
                id="termsAccepted"
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                onFocus={() => markFormStarted('termsAccepted')}
                required
                className="mt-1 h-4 w-4 shrink-0 rounded border-[#9db1a9] text-emerald-600 focus:ring-emerald-400"
              />
              <span>
                Li e aceito os <Link href="/termos" className="font-bold underline" target="_blank" rel="noreferrer">Termos de Uso</Link>, incluindo a ciência de risco de bloqueio/banimento do WhatsApp e dos grupos, e a <Link href="/privacidade" className="font-bold underline" target="_blank" rel="noreferrer">Política de Privacidade</Link>.
              </span>
            </label>
          )}

          {!isRegister && (
            <p className="text-xs leading-5 text-[#71827c]">
              Ao entrar, você continua sujeito aos <Link href="/termos" className="font-semibold underline">Termos de Uso</Link> e à <Link href="/privacidade" className="font-semibold underline">Política de Privacidade</Link>.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-[#258662] font-bold text-white shadow-[0_8px_20px_rgba(37,134,98,0.18)] transition hover:-translate-y-0.5 hover:bg-[#1f7657] hover:shadow-[0_10px_24px_rgba(37,134,98,0.24)] disabled:translate-y-0 disabled:opacity-50"
          >
            {loading ? (isRegister ? 'Criando conta...' : 'Entrando...') : isRegister ? 'Criar conta e acessar painel' : 'Entrar no painel'}
          </button>
        </form>

        <button
          onClick={switchMode}
          className="mt-5 w-full text-center text-sm text-[#61736c] hover:underline"
        >
          {isRegister ? <>Já tem uma conta? <strong className="text-[#23795a]">Entrar</strong></> : <>Ainda não tem conta? <strong className="text-[#23795a]">Criar conta grátis</strong></>}
        </button>

        <nav className="mt-7 flex flex-wrap justify-center gap-4 border-t border-[#e5ece9] pt-5 text-xs text-[#71827c]">
          <Link href="/suporte" className="hover:underline">Suporte</Link>
          <Link href="/termos" className="hover:underline">Termos</Link>
          <Link href="/privacidade" className="hover:underline">Privacidade</Link>
        </nav>
            </div>
            <p className="mt-5 text-center text-xs text-[#7a8984]">Automação simples, suporte humano.</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
