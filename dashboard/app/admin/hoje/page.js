'use client'

// Caixa de entrada "Hoje" (G1 da auditoria do painel): o que precisa da dona
// agora, do mais caro ao mais barato, com o botão da ação ao lado.
// Cada cliente aparece UMA vez (regra em src/domain/admin/inboxPriority.js).
// Cores só por token do design system (docs/design-system/design-system-v2.html).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import { PayingTag } from '@/components/PayingTag'
import { FILTROS_MOTIVO, filtrarPorMotivo, contarPorFiltro, faixaDoMotivo } from '@/lib/admin/inboxFiltros'

const s = {
  page: { maxWidth: 960, margin: '0 auto', padding: 16, color: 'var(--ink)' },
  h1: { margin: 0, fontSize: 19, fontWeight: 900 },
  sub: { margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' },
  section: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 20, marginTop: 16 },
  h2: { margin: 0, fontSize: 15, fontWeight: 800 },
  hint: { margin: '4px 0 12px', fontSize: 12, color: 'var(--ink-soft)' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)' },
  who: { flex: '1 1 260px', minWidth: 0 },
  nome: { fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  email: { fontSize: 12, color: 'var(--ink-soft)', overflowWrap: 'anywhere' },
  motivo: { fontSize: 13, marginTop: 4 },
  porque: { fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 },
  acoes: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  btn: (tom) => ({
    border: `1px solid ${tom === 'primario' ? 'var(--accent-strong)' : 'var(--line-strong)'}`,
    background: tom === 'primario' ? 'var(--accent-strong)' : 'var(--surface)',
    color: tom === 'primario' ? 'var(--surface)' : 'var(--ink)',
    borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit',
  }),
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: (cor) => ({ borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, background: cor, color: 'var(--ink)' }),
  filtro: (ativo) => ({
    border: `1px solid ${ativo ? 'var(--accent-strong)' : 'var(--line-strong)'}`,
    background: ativo ? 'var(--accent-strong)' : 'var(--surface)',
    color: ativo ? 'var(--surface)' : 'var(--ink)',
    borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  }),
  vazio: { fontSize: 13, color: 'var(--ink-soft)', padding: '8px 0' },
  tempo: { fontSize: 12, color: 'var(--danger)', fontWeight: 700 },
  // Faixa de gravidade (DS v2.1, Admin · bloco 4): borda à esquerda + etiqueta com texto.
  faixa: (f) => ({ borderLeft: `4px solid ${f.cor}`, paddingLeft: 12 }),
  sev: (f) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', background: f.fundo, border: `1px solid ${f.cor}` }),
}

function digitosWa(telefone) {
  const d = String(telefone || '').replace(/\D/g, '')
  if (!d || d.includes('*')) return ''
  return d.startsWith('55') ? d : `55${d}`
}

function horas(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const h = ms / 3600_000
  if (h < 1) return `${Math.round(ms / 60_000)} min`
  if (h < 48) return `${Math.round(h)} h`
  return `${Math.round(h / 24)} dias`
}

function Linha({ item, onReconectar, ocupado }) {
  const wa = digitosWa(item.telefone)
  const primaria = item.acoes[0]
  const faixa = faixaDoMotivo(item.motivo)
  return (
    <div style={{ ...s.row, ...s.faixa(faixa) }} data-faixa={faixa.rotulo}>
      <div style={s.who}>
        <div style={s.nome}>
          <span>{item.nome || item.email || 'Cliente'}</span>
          <span style={s.sev(faixa)}>{faixa.rotulo}</span>
          <PayingTag status={item.payingStatus} />
          {item.detalheMs ? <span style={s.tempo}>há {horas(item.detalheMs)}</span> : null}
        </div>
        {item.nome && <div style={s.email}>{item.email}</div>}
        <div style={s.motivo}>{item.titulo}</div>
        <div style={s.porque}>{item.porque}</div>
      </div>
      <div style={s.acoes}>
        {item.acoes.includes('reconectar') && (
          <button type="button" style={s.btn(primaria === 'reconectar' ? 'primario' : 'normal')} disabled={ocupado} onClick={() => onReconectar(item)}>
            {ocupado ? 'Subindo…' : 'Reconectar'}
          </button>
        )}
        {item.acoes.includes('whatsapp') && wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={s.btn(primaria === 'whatsapp' ? 'primario' : 'normal')}>WhatsApp</a>
        )}
        <Link href={`/admin/clientes/${item.userId}`} style={s.btn('normal')}>Ver ficha</Link>
      </div>
    </div>
  )
}

export default function HojePage() {
  const [data, setData] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState('')
  const [reconectando, setReconectando] = useState(null)
  // Filtro por motivo (?motivo=robo|cega|cobranca|vencendo|sem-envio). Lido da URL
  // só depois do primeiro await, pela mesma regra do set-state-in-effect.
  const [motivo, setMotivo] = useState('')

  // Nenhum setState antes do primeiro await: a regra react-hooks/set-state-in-effect
  // do lint do dashboard barra setState síncrono dentro de effect (CI vermelho em 2026-10-02).
  const carregar = useCallback(async () => {
    try {
      const inbox = await api.adminInbox()
      setErro('')
      setData(inbox)
      setMotivo(atual => atual || new URLSearchParams(window.location.search).get('motivo') || '')
    } catch (err) {
      setErro(err.message || 'Não consegui carregar a caixa.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { Promise.resolve().then(carregar) }, [carregar])

  async function reconectar(item) {
    // Ação sobre a conta de uma cliente: nunca sem confirmar (Q4 da auditoria).
    if (!window.confirm(`Subir o robô de ${item.nome || item.email} agora? Se o WhatsApp exigir QR novo, a API recusa e avisa.`)) return
    setReconectando(item.userId)
    setAviso('')
    try {
      const r = await api.adminOnlineReconnect(item.userId)
      setAviso(r?.message || 'Robô iniciado.')
      await carregar()
    } catch (err) {
      setErro(err.message || 'Não consegui subir o robô.')
    } finally {
      setReconectando(null)
    }
  }

  function escolherMotivo(chave) {
    const proximo = chave === motivo ? '' : chave
    setMotivo(proximo)
    const url = new URL(window.location.href)
    if (proximo) url.searchParams.set('motivo', proximo)
    else url.searchParams.delete('motivo')
    window.history.replaceState(null, '', url)
  }

  const todosAgora = data?.agora ?? []
  const todosSemana = data?.semana ?? []
  const agora = filtrarPorMotivo(todosAgora, motivo)
  const semana = filtrarPorMotivo(todosSemana, motivo)
  const contagem = contarPorFiltro([...todosAgora, ...todosSemana])
  const pagantesAgora = todosAgora.filter(i => i.payingStatus === 'pagante').length

  return (
    <main style={s.page}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h1 style={s.h1}>Hoje</h1>
          <p style={s.sub}>O que precisa de você agora, do mais caro ao mais barato. Cada cliente aparece uma vez.</p>
        </div>
        <div style={s.acoes}>
          <button type="button" style={s.btn('normal')} onClick={carregar}>Atualizar</button>
          <Link href="/admin" style={s.btn('normal')}>Voltar</Link>
        </div>
      </header>

      {erro && <Alert type="error">{erro}</Alert>}
      {aviso && <Alert type="success">{aviso}</Alert>}
      {carregando && <LoadingState />}

      {!carregando && data && (
        <>
          <div style={s.chips}>
            <span style={s.chip('var(--accent-3)')}>{pagantesAgora} pagante(s) precisando de ação agora</span>
            <span style={s.chip('var(--bg-soft)')}>{semana.length} conversa(s) para esta semana</span>
            {data.servidor?.enviosPresos > 0 && <Link href="/admin/operacao#filas" style={{ ...s.chip('var(--accent-2)'), textDecoration: 'none' }}>{data.servidor.enviosPresos} envio(s) presos há mais de {data.servidor.presosDesdeMin} min — ver Filas</Link>}
          </div>

          <div style={s.chips} role="group" aria-label="Filtrar por motivo">
            {FILTROS_MOTIVO.map(f => (
              <button key={f.chave} type="button" aria-pressed={motivo === f.chave} onClick={() => escolherMotivo(f.chave)} style={s.filtro(motivo === f.chave)}>
                {f.rotulo} ({contagem[f.chave] ?? 0})
              </button>
            ))}
            {motivo && <button type="button" onClick={() => escolherMotivo(motivo)} style={s.btn('normal')}>Limpar filtro</button>}
          </div>

          <section style={s.section}>
            <h2 style={s.h2}>Agora</h2>
            <p style={s.hint}>Receita parando neste momento: pagante sem robô, sem receber ou com cobrança recusada.</p>
            {agora.length ? agora.map(item => <Linha key={item.userId} item={item} onReconectar={reconectar} ocupado={reconectando === item.userId} />) : <p style={s.vazio}>Nada urgente. Bom sinal.</p>}
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>Esta semana</h2>
            <p style={s.hint}>Quem vale procurar nos próximos dias: vencendo, venceu, nunca publicou, parou de enviar, sem loja.</p>
            {semana.length ? semana.map(item => <Linha key={item.userId} item={item} onReconectar={reconectar} ocupado={reconectando === item.userId} />) : <p style={s.vazio}>Ninguém na lista desta semana.</p>}
          </section>

          {data.limites?.truncado && <p style={s.hint}>A lista olhou só as {data.limites.contas} contas mais novas.</p>}
        </>
      )}
    </main>
  )
}
