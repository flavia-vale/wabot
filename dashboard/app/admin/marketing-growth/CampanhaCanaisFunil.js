'use client'

// Funil da campanha Canais + Preservação (P1 do backlog pós-P3, 2026-09-29).
//
// Responde três perguntas: qual página trouxe lead, qual botão gerou cadastro
// e qual faixa de risco converte melhor. Dados de
// GET /api/admin/marketing/campanha-canais (só leitura, janela máx. 90 dias).
// Cores só por token do design system (docs/design-system/design-system-v2.html).

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const PERIODOS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']]

const s = {
  section: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, color: 'var(--ink)' },
  h2: { margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--ink)' },
  h3: { margin: '20px 0 8px', fontSize: 14, fontWeight: 800, color: 'var(--ink)' },
  hint: { margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 },
  steps: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 16 },
  step: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 },
  stepLabel: { fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.3 },
  stepValue: { fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginTop: 4, fontVariantNumeric: 'tabular-nums' },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-faint)', background: 'var(--bg-soft)', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderTop: '1px solid var(--line)', color: 'var(--ink)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  tdStrong: { padding: '8px 10px', borderTop: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 700 },
  chip: (ativo) => ({
    border: `1px solid ${ativo ? 'var(--accent-strong)' : 'var(--line-strong)'}`,
    background: ativo ? 'var(--accent-strong)' : 'var(--surface)',
    color: ativo ? 'var(--surface)' : 'var(--ink)',
    borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  }),
  warn: { marginTop: 12, padding: 10, borderRadius: 10, background: 'var(--accent-3)', color: 'var(--ink)', fontSize: 12 },
  error: { marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid var(--danger)', color: 'var(--ink)', fontSize: 12 },
}

const fmtPct = (v) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function Tabela({ colunas, linhas, vazio = 'Nada no período.' }) {
  if (!linhas.length) return <p style={s.hint}>{vazio}</p>
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead><tr>{colunas.map(([, rotulo]) => <th key={rotulo} style={s.th}>{rotulo}</th>)}</tr></thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i}>
              {colunas.map(([chave, rotulo, fmt], j) => (
                <td key={rotulo} style={j === 0 ? s.tdStrong : s.td}>{fmt ? fmt(linha[chave], linha) : linha[chave]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ETAPAS = [
  ['views', 'Visitas'],
  ['ctaClicks', 'Cliques'],
  ['diagnosticViewed', 'Viu diagnóstico'],
  ['diagnosticSubmitted', 'Enviou diagnóstico'],
  ['calculatorClicks', 'Clique calculadora'],
  ['signups', 'Cadastros'],
]

export function CampanhaCanaisFunil() {
  const [dias, setDias] = useState(30)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    const to = new Date()
    const from = new Date(to.getTime() - dias * 864e5)
    api.adminMarketingCampanhaCanais({ from: from.toISOString(), to: to.toISOString() })
      .then((res) => { if (ativo) { setDados(res); setErro('') } })
      .catch((err) => { if (ativo) setErro(err?.message || 'Não foi possível carregar o funil da campanha.') })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [dias])

  return (
    <section style={s.section} aria-labelledby="campanha-canais-title">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 id="campanha-canais-title" style={s.h2}>Campanha Canais + Preservação</h2>
          <p style={s.hint}>
            Página → clique → diagnóstico → calculadora → cadastro, por página e por link de origem (utm_campaign=canais-preservacao).
            As etapas são contagens do período, não a mesma pessoa andando pelo funil.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Período">
          {PERIODOS.map(([valor, rotulo]) => (
            <button key={valor} type="button" style={s.chip(dias === valor)} aria-pressed={dias === valor} onClick={() => { if (valor !== dias) { setCarregando(true); setDias(valor) } }}>{rotulo}</button>
          ))}
        </div>
      </div>

      {erro ? <p style={s.error} role="alert">{erro}</p> : null}
      {carregando && !dados ? <p style={s.hint} aria-live="polite">Carregando…</p> : null}

      {dados ? (
        <>
          <div style={s.steps}>
            {(dados.steps || []).map((step) => (
              <div key={step.key} style={s.step}>
                <div style={s.stepLabel}>{step.label}</div>
                <div style={s.stepValue}>{step.count}</div>
              </div>
            ))}
          </div>
          {dados.truncated ? <p style={s.warn}>A consulta bateu no teto de linhas: os totais podem estar abaixo do real. Use um período menor.</p> : null}

          <h3 style={s.h3}>Qual página trouxe lead?</h3>
          <Tabela
            colunas={[['label', 'Página'], ...ETAPAS, ['ctaRate', 'Clique/visita', fmtPct], ['signupRate', 'Cadastro/visita', fmtPct]]}
            linhas={dados.byPage || []}
          />

          <h3 style={s.h3}>Qual botão gerou cadastro?</h3>
          <p style={s.hint}>Cadastros pelo utm_content do link de cadastro (hero, resultado_alto, p2_signup_…).</p>
          <Tabela colunas={[['key', 'Botão (utm_content)'], ['signups', 'Cadastros']]} linhas={dados.signupsByCta || []} />

          <h3 style={s.h3}>Cliques por botão</h3>
          <Tabela colunas={[['page', 'Página'], ['cta', 'Botão'], ['destination', 'Destino'], ['clicks', 'Cliques']]} linhas={dados.ctaClicks || []} />

          <h3 style={s.h3}>Qual faixa de risco converte melhor?</h3>
          <Tabela
            colunas={[['kind', 'Ferramenta'], ['band', 'Faixa'], ['diagnosticViewed', 'Viu'], ['diagnosticSubmitted', 'Enviou'], ['calculatorClicks', 'Clique calc.'], ['signups', 'Cadastros'], ['signupRate', 'Conversão', fmtPct]]}
            linhas={dados.bands || []}
          />

          <h3 style={s.h3}>Link de origem (UTM de entrada)</h3>
          <Tabela
            colunas={[['utm_source', 'source'], ['utm_campaign', 'utm_campaign'], ['utm_content', 'utm_content'], ...ETAPAS]}
            linhas={dados.byUtm || []}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div>
              <h3 style={s.h3}>Cadastros por perfil (segmento)</h3>
              <Tabela colunas={[['key', 'Segmento'], ['signups', 'Cadastros']]} linhas={dados.segmentos || []} />
            </div>
            <div>
              <h3 style={s.h3}>Cadastros por source</h3>
              <Tabela colunas={[['key', 'Source'], ['signups', 'Cadastros']]} linhas={dados.signupSources || []} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
