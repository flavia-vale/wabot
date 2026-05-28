'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { MobileLoadingCard, MobileErrorCard } from '@/components/mobile/MobileAsyncState'
import { mobileRoutes } from '@/components/mobile/routes'
import { cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const STEPS = [
  {
    key: 'waConnected',
    title: 'WhatsApp conectado',
    ok: 'Número conectado ao bot',
    pending: 'Conecte seu WhatsApp para o bot monitorar e postar ofertas.',
    route: mobileRoutes.configWhatsApp,
  },
  {
    key: 'hasCredentials',
    title: 'Chaves de afiliado',
    ok: 'Credenciais de afiliado configuradas',
    pending: 'Adicione suas chaves para converter links com suas tags.',
    route: mobileRoutes.configCredentials,
  },
  {
    key: 'hasMonitorGroup',
    title: 'Grupo monitorado',
    ok: 'Grupo de origem configurado',
    pending: 'Escolha o grupo onde o bot vai buscar os links originais.',
    route: mobileRoutes.configGroups,
  },
  {
    key: 'hasPostGroup',
    title: 'Grupo de envio',
    ok: 'Grupo de destino configurado',
    pending: 'Escolha onde publicar os links convertidos.',
    route: mobileRoutes.configGroups,
  },
  {
    key: 'hasSuccessfulLog',
    title: 'Primeiro envio validado',
    ok: 'Já existe log de envio com sucesso',
    pending: 'Faça um teste e confirme sucesso nos logs.',
    route: mobileRoutes.espelhar,
  },
]

export default function ChecklistEspelhamentoPage() {
  useMobileRoutePerf('m/checklistespelhamento')
  const router = useRouter()

  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function fetchStatus() {
    setError('')
    setLoading(true)
    api.dashboardStatus()
      .then(setStatus)
      .catch(() => setError('Não foi possível carregar o status. Verifique sua conexão.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let active = true
    api.dashboardStatus()
      .then((data) => { if (active) setStatus(data) })
      .catch(() => { if (active) setError('Não foi possível carregar o status. Verifique sua conexão.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const completedCount = useMemo(
    () => STEPS.filter((s) => status?.[s.key]).length,
    [status],
  )
  const allOk = status && completedCount === STEPS.length
  const nextStep = status ? STEPS.find((s) => !status?.[s.key]) : null

  if (loading) {
    return (
      <MobileShell title="Espelhamento" active="conta">
        <div style={{ padding: '18px 16px' }}>
          <MobileLoadingCard label="Carregando checklist..." />
        </div>
      </MobileShell>
    )
  }

  if (error) {
    return (
      <MobileShell title="Espelhamento" active="conta">
        <div style={{ padding: '18px 16px' }}>
          <MobileErrorCard message={error} />
          <button
            type="button"
            onClick={fetchStatus}
            style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--accent-strong)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Tentar novamente
          </button>
        </div>
      </MobileShell>
    )
  }

  return (
    <MobileShell title="Espelhamento" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Checklist de espelhamento</div>
      </div>

      <div style={{ padding: '0 20px 4px', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        Complete estes passos para deixar o espelhamento pronto e funcionando.
      </div>

      {/* Barra de progresso */}
      <div style={cfgStyles.cardWrap}>
        <div
          style={{
            ...cfgStyles.card,
            padding: 14,
            background: allOk
              ? 'color-mix(in oklab, var(--success) 12%, var(--surface))'
              : 'color-mix(in oklab, #f59e0b 10%, var(--surface))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {allOk ? 'Checklist completo! 🤖' : 'Seu progresso'}
            </div>
            <div style={{ fontSize: 12, color: allOk ? 'var(--success)' : '#b45309', fontWeight: 700 }}>
              {completedCount}/{STEPS.length}
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--bg-soft)', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(completedCount / STEPS.length) * 100}%`,
                height: '100%',
                background: allOk ? 'var(--success)' : '#f59e0b',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {!allOk && nextStep && (
            <button
              type="button"
              onClick={() => router.push(nextStep.route)}
              style={{
                marginTop: 10,
                fontSize: 12,
                fontWeight: 700,
                color: 'white',
                background: 'var(--ink)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Próximo: {nextStep.title}
            </button>
          )}
          {allOk && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => router.push(mobileRoutes.espelhar)}
                style={{ fontSize: 12, fontWeight: 700, color: 'white', background: 'var(--success)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
              >
                Espelhar agora
              </button>
              <button
                type="button"
                onClick={() => router.push(mobileRoutes.logs)}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', background: 'var(--surface)', border: '1px solid var(--success)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
              >
                Ver logs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lista de passos */}
      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.card, overflow: 'hidden' }}>
          {STEPS.map((step, i, arr) => {
            const done = Boolean(status?.[step.key])
            const isCurrent = nextStep?.key === step.key
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => router.push(step.route)}
                style={cfgStyles.rowButton(i === arr.length - 1, isCurrent)}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: done ? 'var(--success)' : isCurrent ? 'var(--ink)' : 'var(--bg-soft)',
                    color: done || isCurrent ? 'white' : 'var(--ink-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {done ? <MobileIcon name="check" size={15} stroke={3} /> : `0${i + 1}`}
                </div>
                <div style={cfgStyles.rowMain}>
                  <div
                    style={{
                      ...cfgStyles.rowTitle,
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? 'var(--ink-soft)' : 'var(--ink)',
                    }}
                  >
                    {step.title}
                  </div>
                  <div style={cfgStyles.rowSub}>
                    {done ? step.ok : step.pending}
                  </div>
                </div>
                {isCurrent && <span style={cfgStyles.pill('success')}>próximo</span>}
                <MobileIcon name="arrow" size={14} />
              </button>
            )
          })}
        </div>
      </div>
    </MobileShell>
  )
}
