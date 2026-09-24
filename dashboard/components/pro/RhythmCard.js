'use client'

/* "Ritmo dos envios" na tela do WhatsApp (divisão Basic/PRO, 2026-09-23).
 *
 * Resumo SOMENTE-LEITURA do preset padrão da Preservação/Anti-banimento
 * (PreservationPreset.isDefault) — a edição fica só na aba "Ritmo por grupo"
 * do Anti-banimento (RitmoPart.js).
 *
 * Até 2026-09-24 este card tinha o próprio formulário editando o mesmo
 * preset em paralelo ao Anti-banimento — dois formulários, dois estados
 * locais, sem revalidação cruzada: a cliente podia salvar aqui e ver um
 * valor diferente lá até um reload manual (feedback da dona do produto: se
 * o dado aparece em uma tela, precisa estar linkado com a outra e as duas
 * não podem divergir — a forma mais simples de garantir isso é ter um único
 * lugar que edita). Virou resumo + link direto para o editor.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel } from '@/app/painel/PainelShell'
import { ProLock } from './ProGate'
import { summarizePreset } from '@/lib/preservationPresetSummary'

const EXAMPLE_SUMMARY = 'envia 8h–22h · espera pelo menos 60s entre envios · até 150/dia'

export default function RhythmCard() {
  const { isPro } = usePainel()
  const [preset, setPreset] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isPro) return undefined
    let active = true
    api.preservationPresets()
      .then(data => {
        if (!active) return
        setPreset((data?.presets ?? []).find(p => p.isDefault) ?? null)
      })
      .catch(err => { if (active) setError(err.message) })
    return () => { active = false }
  }, [isPro])

  return (
    <section className="pnl-card" aria-labelledby="rhythm-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 id="rhythm-title" className="pnl-card-title" style={{ margin: 0 }}>Ritmo dos envios</h2>
        <span className="pnl-hint">protege o seu número</span>
      </div>
      <p className="pnl-hint" style={{ margin: '6px 0 14px' }}>
        Vale para todos os grupos e canais que usam o padrão. Quem tem ajuste próprio em{' '}
        <Link href="/painel/anti-banimento?parte=ritmo">Anti-banimento</Link> continua com o ajuste dele.
      </p>
      {!isPro ? (
        <ProLock feature="ritmo">
          <p className="pnl-hint" style={{ margin: 0 }}>{EXAMPLE_SUMMARY}</p>
        </ProLock>
      ) : (
        <>
          <p className="pnl-hint" style={{ margin: 0 }}>
            {error ? error : !preset ? 'Carregando…' : summarizePreset(preset)}
          </p>
          <div style={{ marginTop: 14 }}>
            <Link href="/painel/anti-banimento?parte=ritmo" className="pnl-btn is-primary">
              Editar ritmo no Anti-banimento
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
