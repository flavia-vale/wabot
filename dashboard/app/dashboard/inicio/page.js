'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { ActivationChecklist } from '@/components/ActivationChecklist'

function CheckIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17 19 7"/>
    </svg>
  )
}

function LockIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function ArrowIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  )
}

function StatCard({ label, value, live }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 18, padding: 20,
      opacity: live ? 1 : 0.55,
      transition: 'opacity .5s',
    }}>
      <div style={{
        fontSize: 12, color: 'var(--ink-soft)', marginBottom: 9,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        {!live && <LockIcon />}
        {label}
      </div>
      <div style={{
        fontWeight: 600, fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1,
        color: live ? 'var(--ink)' : 'var(--ink-faint)',
      }}>
        {live ? value : '—'}
      </div>
      <div style={{
        fontSize: 11.5, marginTop: 9, fontWeight: 500,
        color: live ? 'var(--success)' : 'var(--ink-faint)',
      }}>
        {live ? 'pronto para começar' : 'após ativar o bot'}
      </div>
    </div>
  )
}

function MotorCard({ icon, title, isPro, activeSub, inactiveSub, href, live }) {
  return (
    <Link href={live ? href : '#'} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 18, padding: 20, textDecoration: 'none',
      opacity: live ? 1 : 0.55, transition: 'opacity .5s',
      pointerEvents: live ? 'auto' : 'none',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: live
          ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))'
          : 'var(--bg-soft)',
        color: live ? 'var(--accent-strong)' : 'var(--ink-faint)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
          {isPro && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
              padding: '2px 6px', borderRadius: 999,
              background: 'color-mix(in oklab, var(--accent-2) 70%, var(--surface))',
              color: 'var(--ink)', border: '1px solid var(--line)',
            }}>PRO</span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 600,
            color: live ? 'var(--success)' : 'var(--ink-faint)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: live ? 'var(--success)' : 'var(--ink-faint)',
            }} />
            {live ? 'ativo' : 'aguardando'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
          {live ? activeSub : inactiveSub}
        </div>
      </div>
      {live
        ? <ArrowIcon size={16} />
        : <LockIcon size={14} />}
    </Link>
  )
}

export default function InicioPage() {
  const [activated, setActivated] = useState(false)
  const [queue, setQueue] = useState(null)

  useEffect(() => {
    if (!activated) return
    api.dashboardStatus()
      .then(d => setQueue(d?.queue ?? null))
      .catch(() => {})
  }, [activated])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Checklist — some when bot is activated */}
      {!activated && (
        <ActivationChecklist onActivated={() => setActivated(true)} />
      )}

      {/* Bot active banner */}
      {activated && (
        <div style={{
          background: 'var(--ink)', color: 'white',
          borderRadius: 18, padding: 28, marginBottom: 22,
          border: '1px solid var(--ink)',
          position: 'relative', overflow: 'hidden',
          animation: 'ck-fadeup .5s ease both',
        }}>
          <div style={{
            position: 'absolute', right: -40, top: -40,
            width: 220, height: 220, borderRadius: '50%',
            background: 'var(--accent-strong)', filter: 'blur(60px)', opacity: .5,
          }} />
          <div style={{
            position: 'relative', display: 'flex',
            alignItems: 'center', gap: 18, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--accent-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <CheckIcon size={26} />
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em' }}>
                Bot ativo e configurado
              </div>
              <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                O motor está ligado. Assim que a primeira oferta aparecer nos seus grupos, ela é postada aqui automaticamente.
              </div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 13, fontWeight: 600, padding: '8px 14px',
              borderRadius: 999, background: 'rgba(255,255,255,0.1)', color: 'white',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: 'var(--success)',
                boxShadow: '0 0 0 3px rgba(46,160,67,0.35)',
                animation: 'ck-pulse 1.8s ease-in-out infinite',
              }} />
              bot ouvindo seus grupos
            </span>
          </div>
        </div>
      )}

      {/* Motores de automação */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          Motores de automação
        </div>
        {!activated && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <LockIcon /> ligam quando o bot estiver ativo
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <MotorCard
          icon={
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a5 5 0 0 1 5-5h4"/><path d="M7 12l-4-5 5-2"/>
              <path d="M21 17a5 5 0 0 1-5 5h-4"/><path d="M17 12l4 5-5 2"/>
            </svg>
          }
          title="Espelhamento"
          isPro
          activeSub="Repostando ofertas dos grupos que você monitora."
          inactiveSub="Reposta ofertas dos grupos que você monitora."
          href="/dashboard/grupos"
          live={activated}
        />
        <MotorCard
          icon={
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="7"/><path d="M21 21l-4.3-4.3"/>
              <path d="M10.5 6.5 8.5 10.2h3L9.5 13.8"/>
            </svg>
          }
          title="Ofertas automáticas"
          isPro
          activeSub="Garimpando ofertas por tema nas lojas, sozinho."
          inactiveSub="Garimpa ofertas por tema nas lojas, sem grupo de origem."
          href="/dashboard/ofertas-automaticas"
          live={activated}
        />
      </div>

      {/* Prévia do painel */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
          {activated ? 'Seu painel' : 'Prévia do seu painel'}
        </div>
        {!activated && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <LockIcon /> desbloqueia quando o bot estiver ativo
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Postados hoje" value={queue?.successTotal ?? 0} live={activated} />
        <StatCard label="Na fila agora" value={queue?.queueSize ?? 0} live={activated} />
        <StatCard label="Taxa de sucesso" value={queue?.successTotal ? `${Math.round((queue.successTotal / (queue.successTotal + (queue.errorTotal ?? 0))) * 100)}%` : '—'} live={activated} />
        <StatCard label="Latência média" value={queue?.avgLatencyMs ? `${queue.avgLatencyMs}ms` : '0ms'} live={activated} />
      </div>

      {/* Últimos envios */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 18, overflow: 'hidden',
        opacity: activated ? 1 : 0.55, transition: 'opacity .5s',
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Últimos envios</div>
          {activated && (
            <Link href="/dashboard/logs" style={{
              fontSize: 12.5, fontWeight: 600, color: 'var(--accent-strong)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              Ver todos <ArrowIcon size={14} />
            </Link>
          )}
          {!activated && <LockIcon />}
        </div>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, margin: '0 auto 16px',
            background: 'var(--bg-soft)', color: 'var(--ink-faint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              {activated
                ? <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></>
                : <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>}
            </svg>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
            {activated ? 'Aguardando a primeira oferta' : 'Nenhum envio ainda'}
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6, maxWidth: 380, marginInline: 'auto', lineHeight: 1.5 }}>
            {activated
              ? 'O bot está ouvindo seus grupos. O primeiro produto convertido aparece aqui em instantes.'
              : 'Conclua os primeiros passos acima e o bot começa a postar ofertas sozinho.'}
          </p>
        </div>
      </div>
    </div>
  )
}
