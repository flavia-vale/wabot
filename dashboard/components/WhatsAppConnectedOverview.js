'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { summarizePreset } from '@/lib/preservationPresetSummary'

const FALLBACK = {
  operatingHoursEnabled: true,
  operatingHoursJson: '{"startHour":8,"endHour":22,"tz":"America/Sao_Paulo"}',
  throttleEnabled: true,
  minIntervalSec: 60,
  burstCap: 6,
  burstWindowSec: 3600,
  dailyCap: null,
  queueMaxAgeMin: 300,
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
}

function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 13) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
  return digits ? `+${digits}` : 'Número conectado'
}

/* Resumo SOMENTE-LEITURA do "ritmo dos envios" (preset padrão da
 * Preservação/Anti-banimento) — edição fica só na aba "Ritmo por grupo" do
 * Anti-banimento (dashboard/app/painel/anti-banimento/RitmoPart.js).
 *
 * Até 2026-09-25 este componente tinha o próprio formulário (intervalo,
 * limite diário, horário de descanso, botão "Salvar preferências") editando
 * o mesmo preset em paralelo ao card "Ritmo dos envios"
 * (components/pro/RhythmCard.js) — DOIS formulários editáveis mais um resumo
 * na mesma tela, todos para o mesmo dado (feedback da dona do produto:
 * "ainda está" editável e o botão para o Anti-banimento ficava longe demais
 * para ver). RhythmCard.js foi removido desta página — este componente agora
 * é o único lugar da tela WhatsApp que fala de ritmo, e é só leitura. */
export function WhatsAppConnectedOverview({ phone, plan, onDisconnect, disconnecting }) {
  const isBasic = plan === 'basic'
  const [preset, setPreset] = useState(FALLBACK)
  const [today, setToday] = useState(0)

  useEffect(() => {
    let active = true
    api.logsSummary('today').then((data) => { if (active) setToday(Number(data?.counts?.success) || 0) }).catch(() => {})
    if (!isBasic) {
      api.preservationPresets().then(({ presets = [] }) => {
        if (!active) return
        const selected = presets.find((item) => item.isDefault) || presets[0]
        if (selected) setPreset({ ...FALLBACK, ...selected })
      }).catch(() => {})
    }
    return () => { active = false }
  }, [isBasic])

  const cap = Number(preset.dailyCap) > 0 ? Number(preset.dailyCap) : null
  const progress = cap ? Math.min(100, Math.round((today / cap) * 100)) : 0

  return (
    <div className="wa-overview">
      <section className="wa-connected-bar">
        <span className="wa-mark" aria-hidden="true">↗</span>
        <div><strong>WhatsApp conectado</strong><span>{formatPhone(phone)} · pronto para publicar</span></div>
        <button type="button" onClick={onDisconnect} disabled={disconnecting}>{disconnecting ? 'Desconectando…' : 'Desconectar'}</button>
      </section>

      <section className={`wa-protection-card${isBasic ? ' is-locked' : ''}`}>
        {isBasic && (
          <div className="wa-pro-lock" role="status">
            <span><LockIcon /></span>
            <div><strong>Proteção de envio disponível no plano Pro</strong><p>Controle horários, intervalos e limites para publicar com mais segurança.</p></div>
            <Link href="/painel/plano">Conhecer o Pro</Link>
          </div>
        )}
        <div className="wa-protection-body wa-protection-body-readonly" aria-disabled={isBasic}>
          <div className="wa-metric">
            <label>Publicações hoje</label>
            <p><strong>{today}</strong>{cap ? ` de ${cap}` : ' · sem limite por dia'}</p>
            {cap && <div className="wa-progress"><i style={{ width: `${progress}%` }} /></div>}
            <small>{cap ? 'O limite protege o seu número. Ele zera à meia-noite.' : 'Sem limite diário.'}</small>
          </div>
          {!isBasic && (
            <div className="wa-rhythm-summary">
              <label>Ritmo dos envios</label>
              <p className="pnl-hint">{summarizePreset(preset)}</p>
              <Link href="/painel/anti-banimento?parte=ritmo" className="pnl-btn is-primary">Editar ritmo no Anti-banimento</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
