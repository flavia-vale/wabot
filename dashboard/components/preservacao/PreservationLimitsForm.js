'use client'
import { PresetButtons } from './PresetButtons'

// Ritmo por grupo/canal. Os campos "Máximo de envios na janela" e "Janela de
// rajada" saíram da tela em 2026-09 e nunca mais existiram como piso: desde
// 2026-09-25 (pedido explícito da dona do produto) esse mecanismo foi
// REMOVIDO por completo do sistema, não só escondido — o ritmo de envio é
// governado só pelos três campos abaixo. O liga/desliga dos limites continua
// fixo (sempre ligado): ao salvar, quem usa este formulário sempre manda
// throttleEnabled: true junto (contracts/api-preservation.md).

const FIELDS = [
  {
    key: 'minIntervalSec',
    label: 'Intervalo mínimo entre envios (segundos)',
    hint: 'Esperar pelo menos essa quantidade de segundos entre uma oferta e outra neste grupo. Ex.: 120 = pelo menos 2 minutos de intervalo.',
    min: 1,
    max: 86400,
  },
  {
    key: 'dailyCap',
    label: 'Limite diário (ofertas por dia)',
    hint: 'No máximo essa quantidade de ofertas por dia neste grupo. Vazio = sem limite.',
    min: 1,
    max: 10000,
    nullable: true,
  },
]

// Descarte por idade na fila: se a oferta ficar esperando demais, o preço ou
// o estoque já pode ter mudado — melhor não enviar. Campo em MINUTOS no
// banco (src/core/queueExpiry.js); mostrado em horas na tela, que é como a
// dona do produto pensa o prazo.
const QUEUE_MAX_AGE_FIELD = {
  key: 'queueMaxAgeMin',
  label: 'Descartar oferta que esperou demais',
  hint: 'Se a oferta ficar esperando mais do que esse tempo, não enviar (o preço ou o estoque já pode ter mudado). 0 = nunca descartar.',
  min: 0,
  maxHours: 168, // 7 dias
}

const PRESETS = [
  { label: '🛡️ Bem devagar', tone: 'safe', description: 'Lento e seguro — contas novas ou que levaram aviso.', values: { minIntervalSec: 120, dailyCap: 80, queueMaxAgeMin: 300 } },
  { label: '⚖️ Equilibrado', tone: 'medium', description: 'Bom ritmo padrão para contas já aquecidas.', values: { minIntervalSec: 60, dailyCap: 150, queueMaxAgeMin: 300 } },
  // "Mais rápido" (antigo "Leve"): desde a remoção do piso anti-banimento
  // (2026-09-25) o intervalo mínimo é o único freio — 30s entre envios.
  { label: '⚡ Mais rápido', tone: 'aggressive', description: 'Mais rápido, mais risco. Só use se a conta está estável há semanas.', values: { minIntervalSec: 30, dailyCap: 300, queueMaxAgeMin: 300 } },
]

export function PreservationLimitsForm({ value, onChange, disabled }) {
  const hours = Number.isFinite(value.queueMaxAgeMin) ? Math.round((value.queueMaxAgeMin / 60) * 10) / 10 : ''
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">⏱️ Ritmo deste grupo</legend>
      <p className="text-xs text-gray-500 mb-3">
        Controla a cadência de envio para proteger a conta. Valores seguros já vêm preenchidos.
      </p>
      <PresetButtons
        presets={PRESETS}
        onApply={(patch) => onChange({ throttleEnabled: true, ...patch })}
        disabled={disabled}
        hint="clique pra aplicar um ritmo"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium text-gray-700">{f.label}</span>
            <input type="number" min={f.min} max={f.max}
              value={value[f.key] ?? ''}
              onChange={e => {
                if (f.nullable && e.target.value === '') return onChange({ throttleEnabled: true, [f.key]: null })
                onChange({ throttleEnabled: true, [f.key]: Number(e.target.value) })
              }}
              disabled={disabled}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
            <span className="text-[11px] text-gray-500 mt-1 block">{f.hint}</span>
          </label>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-600">Avançado</summary>
        <label className="mt-2 block max-w-xs">
          <span className="text-xs font-medium text-gray-700">{QUEUE_MAX_AGE_FIELD.label} (horas)</span>
          <input
            type="number"
            min={QUEUE_MAX_AGE_FIELD.min}
            max={QUEUE_MAX_AGE_FIELD.maxHours}
            step="0.5"
            value={hours}
            onChange={e => {
              if (e.target.value === '') return onChange({ throttleEnabled: true, queueMaxAgeMin: 0 })
              onChange({ throttleEnabled: true, queueMaxAgeMin: Math.round(Number(e.target.value) * 60) })
            }}
            disabled={disabled}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
          <span className="text-[11px] text-gray-500 mt-1 block">{QUEUE_MAX_AGE_FIELD.hint} Padrão: 5 horas.</span>
        </label>
      </details>
    </fieldset>
  )
}
