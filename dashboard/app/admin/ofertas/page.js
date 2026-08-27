'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'

// Visão macro de qualidade de entrega das ofertas.
//
// Por que esta tela existe: até 2026-08 o painel só sabia que o envio "deu
// certo" — e "entreguei ao WhatsApp" não é a mesma coisa que "chegou bonito no
// grupo". Três incidentes seguidos de imagem (foto borrada, foto sumida, texto
// pelado) foram descobertos pela CLIENTE, não por nós. Aqui a pergunta é outra:
// de que jeito as ofertas estão chegando, e quantas perderam a foto no caminho.

const JANELAS = [
  { horas: 6, rotulo: '6h' },
  { horas: 24, rotulo: '24h' },
  { horas: 72, rotulo: '3 dias' },
  { horas: 168, rotulo: '7 dias' },
]

const TOM = {
  ok: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  critical: 'border-red-500/50 bg-red-500/10 text-red-100',
  info: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100',
}

function num(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0))
}

function bytesCurto(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

function Tile({ rotulo, valor, ajuda, tom = 'info' }) {
  return (
    <article className={`rounded-3xl border p-4 shadow-2xl shadow-black/10 backdrop-blur ${TOM[tom] || TOM.info}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-70">{rotulo}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{valor}</p>
      {ajuda && <p className="mt-2 text-xs leading-relaxed opacity-75">{ajuda}</p>}
    </article>
  )
}

function BarraTipo({ item, total }) {
  const largura = total > 0 ? Math.max(2, Math.round((item.quantidade / total) * 100)) : 0
  const ruim = item.kind === 'texto'
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={`font-bold ${ruim ? 'text-red-200' : 'text-slate-200'}`}>{item.rotulo}</span>
        <span className="text-slate-400">{num(item.quantidade)} · {largura}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${ruim ? 'bg-red-400' : 'bg-cyan-400'}`} style={{ width: `${largura}%` }} />
      </div>
    </div>
  )
}

export default function AdminOfertasPage() {
  const [horas, setHoras] = useState(24)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async (janela) => {
    setCarregando(true)
    setErro('')
    try {
      setDados(await api.adminQualidadeEntrega(janela))
    } catch (err) {
      setErro(err?.message || 'Falha ao carregar a visão de entrega')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar(horas) }, [carregar, horas])

  const resumo = dados?.resumo
  const perdas = dados?.origensComPerda ?? []
  const totalTipos = (resumo?.porTipo ?? []).reduce((acc, t) => acc + t.quantidade, 0)

  const tomImagem = resumo?.percentualComImagem === null
    ? 'info'
    : resumo?.percentualComImagem >= 95 ? 'ok' : resumo?.percentualComImagem >= 80 ? 'warn' : 'critical'

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin" className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">← Admin</Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Como as ofertas estão chegando</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Envio marcado como &quot;sucesso&quot; só quer dizer que o WhatsApp aceitou. Aqui dá para ver
              de que jeito a oferta chegou no grupo — e quantas saíram sem imagem tendo imagem na origem.
            </p>
          </div>
          <div className="flex gap-2">
            {JANELAS.map((j) => (
              <button
                key={j.horas}
                type="button"
                onClick={() => setHoras(j.horas)}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${horas === j.horas ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}
              >
                {j.rotulo}
              </button>
            ))}
          </div>
        </header>

        {erro && <Alert type="error">{erro}</Alert>}
        {carregando && <LoadingState />}

        {!carregando && resumo && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile rotulo="Ofertas enviadas" valor={num(resumo.total)} ajuda={`Janela de ${dados.janelaHoras}h`} />
              <Tile
                rotulo="Chegaram com imagem"
                valor={resumo.percentualComImagem === null ? '—' : `${resumo.percentualComImagem}%`}
                ajuda={`${num(resumo.comImagem)} de ${num(resumo.comRegistro)} com registro`}
                tom={tomImagem}
              />
              <Tile
                rotulo="Perderam a foto"
                valor={num(resumo.perderamImagem)}
                ajuda="Saíram só com texto MESMO tendo foto na mensagem de origem — é defeito nosso, não limitação da origem"
                tom={resumo.perderamImagem > 0 ? 'critical' : 'ok'}
              />
              <Tile
                rotulo="Sem registro"
                valor={num(resumo.semRegistro)}
                ajuda="Envios anteriores a esta medição. Ficam de fora do percentual para não mascarar o número."
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
                <h2 className="text-lg font-black text-white">De que jeito saíram</h2>
                <p className="mt-1 text-xs text-slate-400">&quot;Só texto&quot; é o que a cliente enxerga como oferta sem imagem.</p>
                <div className="mt-5 space-y-3">
                  {(resumo.porTipo ?? []).map((t) => <BarraTipo key={t.kind} item={t} total={totalTipos} />)}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
                <h2 className="text-lg font-black text-white">Por loja</h2>
                <p className="mt-1 text-xs text-slate-400">Loja que não entrega a foto do produto aparece aqui antes de virar reclamação.</p>
                <div className="mt-5 space-y-2">
                  {(resumo.porLoja ?? []).map((l) => (
                    <div key={l.loja} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs">
                      <span className="font-bold text-white">{l.loja}</span>
                      <span className="text-slate-400">
                        {num(l.total)} envios · {num(l.comImagem)} com imagem
                        {l.perderamImagem > 0 && <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 font-bold text-red-200">{num(l.perderamImagem)} perderam a foto</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
              <h2 className="text-lg font-black text-white">Onde a foto está se perdendo</h2>
              <p className="mt-1 text-xs text-slate-400">
                Cliente e grupo de origem das ofertas que saíram só com texto tendo foto na origem.
                Miniatura muito pequena na origem (poucos KB) é a causa mais comum.
              </p>
              <div className="mt-5 space-y-2">
                {perdas.length === 0 && (
                  <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                    Nenhuma oferta perdeu a foto nesta janela.
                  </p>
                )}
                {perdas.map((p) => (
                  <div key={`${p.userId}-${p.sourceGroup}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{p.cliente}</span>
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-[11px] font-black text-red-200">{num(p.quantidade)} sem foto</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Origem: {p.origemNome || '(grupo não cadastrado)'} · {p.sourceGroup}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Lojas: {p.lojas.join(', ') || '—'} · imagem na origem entre {bytesCurto(p.menorBytes)} e {bytesCurto(p.maiorBytes)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <p className="text-xs text-slate-500">Gerado em {dados.geradoEm ? new Date(dados.geradoEm).toLocaleString('pt-BR') : '—'}</p>
          </>
        )}
      </div>
    </main>
  )
}
