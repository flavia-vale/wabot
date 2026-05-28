'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileIcon } from '@/components/mobile/MobileIcons'
import { cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

export default function TutorialPage() {
  useMobileRoutePerf('m/help/tutorial')

  const passos = [
    { n: '01', t: 'Como conectar seu WhatsApp', m: '2 min · vídeo', done: true },
    { n: '02', t: 'Adicionar grupos para monitorar', m: '1 min · vídeo', done: true },
    { n: '03', t: 'Cadastrar IDs de afiliada', m: '3 min · texto', done: true },
    { n: '04', t: 'Criar sua primeira regra', m: '4 min · vídeo', done: false, current: true },
    { n: '05', t: 'Personalizar mensagens promocionais', m: '3 min · texto', done: false },
    { n: '06', t: 'Entender o painel de logs', m: '2 min · vídeo', done: false },
  ]

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Tutorial</div>
      </div>

      <div style={{ padding: '12px 20px 0', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        6 passos para você dominar o BOTinho. Cada um leva menos de 5 minutos.
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.card, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Seu progresso</div>
            <div style={{ fontSize: 12, color: 'var(--accent-strong)', fontWeight: 600 }}>3/6</div>
          </div>
          <div style={{ height: 6, background: 'var(--bg-soft)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: '50%', height: '100%', background: 'var(--accent-strong)' }} />
          </div>
        </div>
      </div>

      <div style={cfgStyles.cardWrap}>
        <div style={{ ...cfgStyles.card, overflow: 'hidden' }}>
          {passos.map((p, i, a) => (
            <div
              key={p.n}
              style={{
                ...cfgStyles.row(i === a.length - 1),
                background: p.current ? 'color-mix(in oklab, var(--accent) 12%, var(--surface))' : 'transparent',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: p.done ? 'var(--success)' : p.current ? 'var(--ink)' : 'var(--bg-soft)',
                  color: p.done || p.current ? 'white' : 'var(--ink-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: 12,
                  fontFamily: p.done || p.current ? 'inherit' : "'JetBrains Mono', monospace",
                  flexShrink: 0,
                }}
              >
                {p.done ? <MobileIcon name="check" size={15} stroke={3} /> : p.n}
              </div>
              <div style={cfgStyles.rowMain}>
                <div
                  style={{
                    ...cfgStyles.rowTitle,
                    textDecoration: p.done ? 'line-through' : 'none',
                    color: p.done ? 'var(--ink-soft)' : 'var(--ink)',
                  }}
                >
                  {p.t}
                </div>
                <div style={cfgStyles.rowSub}>{p.m}</div>
              </div>
              {p.current && <span style={cfgStyles.pill('success')}>continuar</span>}
              <MobileIcon name="arrow" size={14} />
            </div>
          ))}
        </div>
      </div>

      <div style={cfgStyles.sectionLabel}>Precisa de ajuda?</div>
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ ...cfgStyles.card, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'color-mix(in oklab, var(--success) 18%, var(--surface))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)',
              flexShrink: 0,
            }}
          >
            <MobileIcon name="whatsapp" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Falar com a gente</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>resposta em minutos · seg–sex 8h–20h</div>
          </div>
          <MobileIcon name="arrow" size={14} />
        </div>
      </div>
    </MobileShell>
  )
}
