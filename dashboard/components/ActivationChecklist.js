'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const ONBOARDING_DONE_KEY = 'wb_onboarding_done'

function getOnboardingDone() {
  try { return localStorage.getItem(ONBOARDING_DONE_KEY) === '1' } catch { return false }
}

function setOnboardingDone() {
  try { localStorage.setItem(ONBOARDING_DONE_KEY, '1') } catch { /* ignore */ }
}

function Icon({ name, size = 20, stroke = 1.6 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (name) {
    case 'whatsapp': return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.1 4.9A10 10 0 0 0 4.5 18.5L3 22l3.6-1.4a10 10 0 0 0 14.7-8.7c0-2.7-1-5.2-2.8-7zM12 20.2a8.3 8.3 0 0 1-4.2-1.1l-.3-.2-2.7 1 1-2.6-.2-.3a8.3 8.3 0 1 1 6.4 3.2zm4.6-6.2c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1c-.2.1-.3.2-.5 0a6.7 6.7 0 0 1-3.4-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.4 3 3 0 0 0-1 2.3c0 1.4 1 2.7 1.2 2.9.2.2 2 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/>
      </svg>
    )
    case 'mirror': return (
      <svg {...p}><path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/><path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/></svg>
    )
    case 'send': return (
      <svg {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
    )
    case 'link': return (
      <svg {...p}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 1 0 11 21l1.5-1.5"/></svg>
    )
    case 'bolt': return (
      <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>
    )
    case 'check': return (
      <svg {...p}><path d="M5 12.5 10 17 19 7"/></svg>
    )
    case 'arrow': return (
      <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    )
    case 'clock': return (
      <svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>
    )
    case 'sparkles': return (
      <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6 6 2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>
    )
    case 'lock': return (
      <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    )
    default: return null
  }
}

const STEPS = [
  {
    key: 'waConnected',
    iconName: 'whatsapp',
    n: 1,
    title: 'Conectar o WhatsApp',
    desc: 'Escaneie o QR code para vincular sua conta ao bot.',
    cta: 'Conectar',
    done: 'WhatsApp conectado',
    href: '/dashboard',
  },
  {
    key: 'hasMonitorGroup',
    iconName: 'mirror',
    n: 2,
    title: 'Adicionar grupo de monitoramento',
    desc: 'De onde o bot vai espelhar as ofertas que aparecem.',
    cta: 'Adicionar grupo',
    done: '1 grupo monitorado',
    href: '/dashboard/grupos',
  },
  {
    key: 'hasPostGroup',
    iconName: 'send',
    n: 3,
    title: 'Adicionar grupo de destino',
    desc: 'Para onde o bot vai postar as ofertas convertidas.',
    cta: 'Adicionar grupo',
    done: '1 grupo de destino',
    href: '/dashboard/grupos',
  },
  {
    key: 'hasCredentials',
    iconName: 'link',
    n: 4,
    title: 'Cadastrar suas IDs de afiliada',
    desc: 'Para que toda comissão das vendas fique com você.',
    cta: 'Cadastrar IDs',
    done: 'IDs cadastradas',
    href: '/dashboard/credenciais',
  },
]

const TOTAL_STEPS = STEPS.length + 1

function StepMarker({ state, n }) {
  const isDone = state === 'done'
  const isActive = state === 'active'
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 11, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700,
      background: isDone ? 'var(--accent-strong)' : isActive ? 'var(--ink)' : 'var(--bg-soft)',
      color: isDone || isActive ? 'white' : 'var(--ink-faint)',
      border: state === 'pending' ? '1px solid var(--line-strong)' : '1px solid transparent',
      transition: 'background .25s, color .25s',
    }}>
      {isDone
        ? <span style={{ display: 'flex', animation: 'ck-pop .35s cubic-bezier(.2,1.4,.4,1) both' }}><Icon name="check" size={18} stroke={2.8} /></span>
        : n}
    </div>
  )
}

function DoneChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, fontWeight: 600, color: 'var(--success)',
      padding: '5px 10px', borderRadius: 999,
      background: 'color-mix(in oklab, var(--success) 13%, var(--surface))',
      border: '1px solid color-mix(in oklab, var(--success) 30%, var(--line))',
    }}>
      <Icon name="check" size={13} stroke={3} /> feito
    </span>
  )
}

function StepCta({ href, label, isActive }) {
  return (
    <a href={href} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: isActive ? '9px 16px' : '8px 14px',
      borderRadius: 999,
      fontSize: 13, fontWeight: 600,
      border: '1px solid ' + (isActive ? 'transparent' : 'var(--line-strong)'),
      background: isActive ? 'var(--ink)' : 'transparent',
      color: isActive ? 'white' : 'var(--ink)',
      textDecoration: 'none',
      opacity: isActive ? 1 : 0.85,
    }}>
      {label} <Icon name="arrow" size={15} />
    </a>
  )
}

function CelebrationBanner() {
  return (
    <div style={{
      background: 'var(--ink)', border: '1px solid var(--ink)',
      borderRadius: 20, overflow: 'hidden', marginBottom: 22,
      animation: 'ck-celebrate .5s cubic-bezier(.2,.8,.25,1) both',
    }}>
      <div style={{ position: 'relative', overflow: 'hidden', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--accent-strong) 55%, transparent), transparent 60%)',
        }} />
        {[...Array(7)].map((_, i) => (
          <span key={i} style={{
            position: 'absolute', top: '18%', left: `${12 + i * 12}%`,
            color: 'var(--accent-2)', opacity: 0,
            animation: `ck-spark 1.4s ${0.1 + i * 0.12}s ease-out infinite`,
          }}>
            <Icon name="sparkles" size={14 + (i % 3) * 4} />
          </span>
        ))}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%', margin: '0 auto 20px',
            background: 'var(--accent-strong)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            boxShadow: '0 0 0 10px color-mix(in oklab, var(--accent-strong) 25%, transparent)',
            animation: 'ck-pop .5s cubic-bezier(.2,1.4,.4,1) both',
          }}>
            <Icon name="check" size={38} stroke={2.6} />
          </div>
          <div style={{ fontSize: 36, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em', fontWeight: 600 }}>
            Seu bot está ativo! 🎉
          </div>
          <p style={{ maxWidth: 460, margin: '14px auto 0', fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.72)' }}>
            Tudo pronto. O motor já está ouvindo seus grupos — assim que uma oferta aparecer, ela é convertida e postada sozinha.
          </p>
        </div>
      </div>
    </div>
  )
}

export function ActivationChecklist({ onActivated }) {
  const [status, setStatus] = useState(null)
  const [phase, setPhase] = useState(() => {
    if (typeof window !== 'undefined' && getOnboardingDone()) return 'hidden'
    return 'list'
  })

  useEffect(() => {
    if (phase === 'hidden') {
      onActivated?.()
      return
    }
    let cancelled = false
    const poll = () =>
      api.dashboardStatus()
        .then(data => { if (!cancelled) setStatus(data) })
        .catch(() => {})
    poll()
    const id = setInterval(poll, 10_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [phase, onActivated])

  const completedSet = new Set(STEPS.filter(s => status?.[s.key]).map(s => s.key))
  const count = completedSet.size
  const prereqsDone = count === STEPS.length
  const botActive = prereqsDone && status !== null
  const displayCount = botActive ? TOTAL_STEPS : count
  const pct = Math.round((displayCount / TOTAL_STEPS) * 100)
  const nextKey = STEPS.find(s => !completedSet.has(s.key))?.key

  useEffect(() => {
    if (botActive && phase === 'list') {
      const t = setTimeout(() => setPhase('celebrate'), 420)
      return () => clearTimeout(t)
    }
  }, [botActive, phase])

  useEffect(() => {
    if (phase === 'celebrate') {
      const t = setTimeout(() => {
        setOnboardingDone()
        setPhase('hidden')
        onActivated?.()
      }, 2800)
      return () => clearTimeout(t)
    }
  }, [phase, onActivated])

  if (phase === 'hidden') return null
  if (phase === 'celebrate') return <CelebrationBanner />

  const timeLabel = count === 0
    ? '≈ 4 min para terminar'
    : botActive
    ? 'Tudo pronto!'
    : `faltam ${TOTAL_STEPS - displayCount} ${TOTAL_STEPS - displayCount === 1 ? 'passo' : 'passos'}`

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 20, padding: 0, overflow: 'hidden',
      boxShadow: '0 12px 30px -12px color-mix(in oklab, var(--accent-strong) 20%, transparent)',
      marginBottom: 22,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap',
        padding: '24px 28px 22px',
        borderBottom: '1px solid var(--line)',
        background: 'color-mix(in oklab, var(--accent) 8%, var(--surface))',
      }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 11,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'var(--accent-strong)',
          }}>
            <Icon name="sparkles" size={13} /> Primeiros passos
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
            Vamos colocar seu bot no ar
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 7, lineHeight: 1.5, maxWidth: 440 }}>
            Conclua os passos abaixo. Cada um se marca sozinho assim que detectamos a ação — você só precisa fazer.
          </p>
        </div>
        <div style={{ flex: '0 0 190px', minWidth: 170 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--accent-strong)', fontSize: 17 }}>{displayCount}</span>
              <span style={{ color: 'var(--ink-soft)' }}> de {TOTAL_STEPS} concluídos</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)' }}>{pct}%</span>
          </div>
          <div style={{ height: 9, borderRadius: 999, background: 'var(--bg-soft)', overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 999,
              background: 'linear-gradient(90deg, var(--accent-strong), var(--accent))',
              transition: 'width .45s cubic-bezier(.2,.8,.25,1)',
            }} />
          </div>
          <div style={{
            fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 9,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="clock" size={12} /> {timeLabel}
          </div>
        </div>
      </div>

      {/* Steps 1–4 */}
      {STEPS.map((s, i) => {
        const isDone = completedSet.has(s.key)
        const isActive = !isDone && s.key === nextKey
        const state = isDone ? 'done' : isActive ? 'active' : 'pending'
        return (
          <div key={s.key} style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center', gap: 16,
            padding: '17px 28px',
            borderBottom: '1px solid var(--line)',
            background: isActive ? 'color-mix(in oklab, var(--accent) 9%, var(--surface))' : 'transparent',
            transition: 'background .25s',
          }}>
            <StepMarker state={state} n={s.n} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', color: isDone ? 'var(--ink-faint)' : 'var(--accent-strong)' }}>
                  <Icon name={s.iconName} size={16} />
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: isDone ? 'var(--ink-soft)' : 'var(--ink)' }}>
                  {s.title}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3, lineHeight: 1.45, margin: '3px 0 0' }}>
                {isDone
                  ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>{s.done}</span>
                  : s.desc}
              </p>
            </div>
            <div style={{ justifySelf: 'end' }}>
              {isDone ? <DoneChip /> : <StepCta href={s.href} label={s.cta} isActive={isActive} />}
            </div>
          </div>
        )
      })}

      {/* Step 5: Ativar (auto-computed) */}
      {(() => {
        const isDone = botActive
        const isActive = !isDone && count === STEPS.length
        const state = isDone ? 'done' : isActive ? 'active' : 'pending'
        return (
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center', gap: 16,
            padding: '17px 28px',
            background: isActive ? 'color-mix(in oklab, var(--accent) 9%, var(--surface))' : 'transparent',
            transition: 'background .25s',
          }}>
            <StepMarker state={state} n={5} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', color: isDone ? 'var(--ink-faint)' : 'var(--accent-strong)' }}>
                  <Icon name="bolt" size={16} />
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: isDone ? 'var(--ink-soft)' : 'var(--ink)' }}>
                  Ativar o bot
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3, lineHeight: 1.45, margin: '3px 0 0' }}>
                {isDone
                  ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>Bot ativado</span>
                  : 'Com tudo pronto, o motor liga sozinho e começa a postar.'}
              </p>
            </div>
            <div style={{ justifySelf: 'end' }}>
              {isDone ? (
                <DoneChip />
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)',
                  padding: '8px 14px', borderRadius: 999,
                  border: '1px solid var(--line)',
                }}>
                  <Icon name="lock" size={13} stroke={2} /> Aguardando passos anteriores
                </span>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

