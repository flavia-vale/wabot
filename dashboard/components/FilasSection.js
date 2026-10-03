'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

function formatDuracao(ms) {
  if (ms == null) return '—'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return h >= 48 ? `${Math.floor(h / 24)} dias` : `${h} h ${min % 60} min`
}

// M5 da auditoria: envios presos em 'sending' por cliente. Em produção a fila é
// em memória (sem DLQ do Redis) — é isto que mede o problema de verdade.
export default function FilasSection({ admin }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const canManage = Array.isArray(admin?.permissions) && admin.permissions.includes('tech:write')

  async function carregarFilas() {
    const r = await api.adminFilas()
    setDados(r)
    setErro('')
  }

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => carregarFilas()).catch((e) => { if (active) setErro(e?.message || 'Não consegui carregar as filas.') })
    return () => { active = false }
  }, [])

  async function reprocessar(linha) {
    if (!window.confirm(`Destravar os ${linha.presos} envio(s) presos de ${linha.name || linha.email || linha.userId}? Eles viram erro e a fila de origem tenta de novo sozinha.`)) return
    const motivo = window.prompt('Motivo (mínimo 5 letras):', '')
    if (!motivo || motivo.trim().length < 5) { setErro('Informe um motivo com pelo menos 5 letras.'); return }
    setOcupado(linha.userId)
    setAviso('')
    try {
      const r = await api.adminFilasReprocessar(linha.userId, motivo.trim())
      setAviso(`${r?.recovered ?? 0} envio(s) destravados.`)
      await carregarFilas()
    } catch (e) {
      setErro(e?.message || 'Não consegui destravar.')
    } finally {
      setOcupado(null)
    }
  }

  const linhas = dados?.linhas ?? []
  return (
    <section id="filas" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 style={{ color: 'var(--ink)' }} className="text-lg font-black">Filas · envios presos</h2>
          <p style={{ color: 'var(--ink-soft)' }} className="text-xs">
            Fila: {dados?.backend === 'bullmq' ? 'BullMQ (Redis)' : 'em memória (sem DLQ neste ambiente)'}
            {dados ? ` · preso = em "enviando" há mais de ${dados.presosDesdeMin} min` : ''}
          </p>
        </div>
        <button type="button" onClick={() => carregarFilas().catch((e) => setErro(e?.message || 'Falha ao atualizar.'))} style={{ background: 'var(--bg-soft)', color: 'var(--ink)' }} className="rounded-xl px-3 py-2 text-sm font-bold">Atualizar</button>
      </div>
      {erro && <p style={{ color: 'var(--danger)' }} className="mt-3 text-sm">{erro}</p>}
      {aviso && <p style={{ color: 'var(--accent-strong)' }} className="mt-3 text-sm">{aviso}</p>}
      {dados && !linhas.length && <p style={{ color: 'var(--ink-soft)' }} className="mt-3 text-sm">Nenhum envio preso. Bom sinal.</p>}
      {linhas.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ color: 'var(--ink)' }}>
            <thead style={{ color: 'var(--ink-soft)' }}>
              <tr><th className="py-1 pr-3">Cliente</th><th className="pr-3">Presos</th><th className="pr-3">O mais antigo</th><th className="pr-3">Último sucesso</th><th /></tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.userId} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="py-2 pr-3"><Link href={`/admin/clientes/${l.userId}`} style={{ color: 'var(--accent-strong)' }}>{l.name || l.email || l.userId}</Link></td>
                  <td className="pr-3">{l.presos}</td>
                  <td className="pr-3">{formatDuracao(l.maisAntigoMs)}</td>
                  <td className="pr-3">{l.ultimoSucessoEm ? formatDate(l.ultimoSucessoEm) : 'nunca'}</td>
                  <td className="text-right">
                    <button type="button" disabled={!canManage || ocupado === l.userId} onClick={() => reprocessar(l)} style={{ background: 'var(--accent-3)', color: 'var(--ink)' }} className="rounded-xl px-3 py-1 text-xs font-bold disabled:opacity-40">Reprocessar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!canManage && <p style={{ color: 'var(--ink-soft)' }} className="mt-2 text-xs">Somente leitura — sem permissão tech:write.</p>}
    </section>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
