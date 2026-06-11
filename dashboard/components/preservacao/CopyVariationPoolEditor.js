'use client'
import { useMemo } from 'react'
import { PresetButtons } from './PresetButtons'
import { FeatureToggle } from './FeatureToggle'

const MAX_PER_GROUP = 20

const GROUPS = [
  { key: 'greetings', label: 'Ganchos (vão antes da mensagem)', placeholder: 'Ex: 🚨 COOOOOORRE QUE TÁ ACABANDO!', emptyLabel: '(vazio — sem prefixo)' },
  { key: 'ctas',      label: 'CTAs',                                  placeholder: 'Ex: ⚠️ Preços e estoque podem mudar.', emptyLabel: '(vazio — sem CTA)' },
  { key: 'trailers',  label: 'Convites do grupo (vão depois da mensagem)', placeholder: 'Ex: 📲 Entre no nosso grupo oficial:', emptyLabel: '(vazio — sem convite)' },
]

const PRESETS = [
  {
    label: '🛡️ Conservador',
    tone: 'safe',
    description: 'Sem variações — texto vai puro. Use se ainda está testando copy.',
    values: { greetings: [''], ctas: [''], trailers: [''] },
  },
  {
    label: '⚖️ Médio',
    tone: 'medium',
    description: '3 variações por grupo — bom equilíbrio entre naturalidade e previsibilidade.',
    values: {
      greetings: ['', '🔥 ', '💥 '],
      ctas: ['', '⚠️ Preços e estoque podem mudar.', '⏳ Oferta por tempo limitado.'],
      trailers: ['', '📲 Entre no nosso grupo oficial:', '👥 Vem pro grupo economizar com a gente:'],
    },
  },
  {
    label: '⚡ Leve',
    tone: 'aggressive',
    description: '5 variações por grupo — máxima naturalidade, mais trabalho pra revisar.',
    values: {
      greetings: ['', '🔥 ', '💥 ', '⚡ ', '🚨 '],
      ctas: ['', '⚠️ Preços e estoque podem mudar.', '⏳ Oferta por tempo limitado.', '📝 Produto sujeito a esgotar.', '💥 Aproveite enquanto durar o estoque.'],
      trailers: ['', '📲 Entre no nosso grupo oficial:', '👥 Vem pro grupo economizar com a gente:', '🚀 Receba os melhores achadinhos no grupo:', '🔔 Entre no grupo para ver as promoções primeiro:'],
    },
  },
]

function parsePool(json) {
  try {
    const p = JSON.parse(json || '{}')
    return {
      greetings: Array.isArray(p.greetings) ? p.greetings : [''],
      ctas: Array.isArray(p.ctas) ? p.ctas : [''],
      trailers: Array.isArray(p.trailers) ? p.trailers : [''],
    }
  } catch {
    return { greetings: [''], ctas: [''], trailers: [''] }
  }
}

export function CopyVariationPoolEditor({ value, onChange, disabled, showPresets = true }) {
  const controlsDisabled = disabled || !value.copyVariationEnabled
  const pool = useMemo(() => parsePool(value.copyVariationPoolJson), [value.copyVariationPoolJson])

  const writePool = (next) => onChange({ copyVariationPoolJson: JSON.stringify(next) })

  const setCount = (groupKey, count) => {
    const safe = Math.max(0, Math.min(MAX_PER_GROUP, Number(count) || 0))
    const arr = pool[groupKey].slice(0, safe)
    while (arr.length < safe) arr.push(arr.length === 0 ? '' : '')
    writePool({ ...pool, [groupKey]: arr })
  }

  const setItem = (groupKey, idx, text) => {
    const arr = [...pool[groupKey]]
    arr[idx] = text
    writePool({ ...pool, [groupKey]: arr })
  }

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🎲 Variações de texto</legend>
      <p className="text-xs text-gray-500 mb-3">
        Pedacinhos de texto que o bot intercala em cada envio, pra mensagens nunca saírem 100% iguais. Quanto mais variações, mais natural — deixe uma caixinha vazia em cada grupo pra que às vezes o texto saia sem o complemento.
      </p>
      <FeatureToggle checked={!!value.copyVariationEnabled} onChange={checked => onChange({ copyVariationEnabled: checked })} disabled={disabled} label="Alternar variações de texto" />
      <div className={value.copyVariationEnabled ? '' : 'pointer-events-none opacity-50'} aria-disabled={!value.copyVariationEnabled}>
      {showPresets && <PresetButtons presets={PRESETS} onApply={writePool} disabled={controlsDisabled} hint="aplica o conjunto inteiro" />}

      <div className="space-y-4">
        {GROUPS.map(g => (
          <div key={g.key} className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-semibold text-gray-700">{g.label}</span>
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">Quantas variações?</span>
                <input
                  type="number"
                  min={0}
                  max={MAX_PER_GROUP}
                  value={pool[g.key].length}
                  onChange={e => setCount(g.key, e.target.value)}
                  disabled={controlsDisabled}
                  className="w-16 border rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
                />
              </label>
            </div>
            {pool[g.key].length === 0 && (
              <p className="text-[11px] italic text-gray-400">Nenhuma variação — o bot não vai adicionar nada nesse ponto.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {pool[g.key].map((text, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={text}
                  onChange={e => setItem(g.key, idx, e.target.value)}
                  disabled={controlsDisabled}
                  placeholder={text === '' ? g.emptyLabel : g.placeholder}
                  className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-500 mt-3">
        Máximo de {MAX_PER_GROUP} variações por grupo. Deixar uma caixa em branco é proposital — significa &quot;às vezes não adiciona nada&quot;.
      </p>
      </div>
    </fieldset>
  )
}
