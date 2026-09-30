'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from '../PainelShell'
import { LockedPage } from '@/components/pro/ProGate'

const number = value => new Intl.NumberFormat('pt-BR').format(value)
const publicUrl = path => `${typeof window === 'undefined' ? '' : window.location.origin}${path}`

function SmartLinksPreview() {
  const rows = [['Ofertas Tech 1', 998, 40], ['Ofertas Tech 2', 812, 120], ['Ofertas Tech 3', 330, 152]]
  return (
    <div className="pnl-pro-card">
      <strong>espelhagrupos.com.br/g/promo-tech</strong>
      <p className="pnl-hint">3 grupos · 2.140 membros · 312 cliques nos últimos 7 dias</p>
      <ul className="lk-groups">
        {rows.map(([name, size, clicks]) => (
          <li key={name} className="lk-group">
            <div className="lk-group-head"><span className="lk-group-name">{name}</span><span className="lk-group-num">{number(size)}<span className="pnl-hint"> / 1.000</span></span></div>
            <div className={`occ-bar ${size >= 900 ? 'is-warn' : ''}`}><span style={{ width: `${Math.round(size / 10)}%` }} /></div>
            <span className="pnl-hint">{clicks} cliques em 7 dias</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const barTone = pct => (pct == null ? '' : pct >= 100 ? 'is-full' : pct >= 90 ? 'is-warn' : '')

function groupStatus(g) {
  if (!g.hasInvite) return { text: 'Sem convite', tone: 'is-full' }
  if (!g.enabled) return { text: 'Pausado', tone: '' }
  if (g.size == null) return { text: 'Aguardando contagem', tone: '' }
  if (g.occupancyPct >= 100) return { text: 'Lotado', tone: 'is-full' }
  // A partir de 95% o grupo vira "reserva": só recebe gente se nenhum outro tiver espaço.
  if (g.occupancyPct >= 95) return { text: 'Reserva', tone: 'is-warn' }
  if (g.occupancyPct >= 90) return { text: 'Enchendo', tone: 'is-warn' }
  return { text: 'No rodízio', tone: 'is-ok' }
}

function LinkCard({ link, postGroups, onChanged, onNotice }) {
  const [busy, setBusy] = useState(false)
  const [pickGroup, setPickGroup] = useState('')
  const used = new Set(link.groups.map(g => g.groupId))
  const available = postGroups.filter(g => !used.has(g.id))
  const occ = link.occupancy

  async function run(action, okMessage) {
    setBusy(true)
    try {
      await action()
      if (okMessage) onNotice({ ok: true, text: okMessage })
      await onChanged()
    } catch (err) {
      onNotice({ ok: false, text: err?.message || 'Não foi possível concluir.' })
    } finally {
      setBusy(false)
    }
  }

  const copy = () => run(async () => { await navigator.clipboard.writeText(publicUrl(link.path)) }, 'Link copiado.')

  return (
    <section className="pnl-card" aria-label={link.name}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="pnl-card-title">{link.name}{link.enabled ? '' : ' · PAUSADO'}</div>
          <code style={{ wordBreak: 'break-all' }}>{publicUrl(link.path)}</code>
        </div>
        <div className="lk-actions">
          <button className="pnl-btn is-sm" disabled={busy} onClick={copy}>Copiar link</button>
          <button className="pnl-btn is-sm" disabled={busy} onClick={() => run(() => api.updateSmartLink(link.id, { enabled: !link.enabled }), link.enabled ? 'Link pausado.' : 'Link ativado.')}>
            {link.enabled ? 'Pausar' : 'Ativar'}
          </button>
          <button className="pnl-btn is-sm is-danger" disabled={busy} onClick={() => { if (window.confirm(`Apagar o link "${link.name}"? Quem já o divulgou verá "link não encontrado". O endereço continua reservado para você.`)) run(() => api.deleteSmartLink(link.id), 'Link apagado.') }}>Apagar</button>
        </div>
      </div>

      <div className="lk-clicks" aria-label="Cliques no link">
        <span><strong>{number(link.clicksToday)}</strong> cliques hoje</span>
        <span><strong>{number(link.clicks7d)}</strong> nos últimos 7 dias</span>
        <span><strong>{number(link.totalSize)}</strong> membros nos {link.groups.length} grupos</span>
      </div>
      <p className="pnl-hint" style={{ margin: '6px 0 0' }}>
        Clique não é entrada: nem todo mundo que clica entra no grupo. O rodízio manda para o grupo com menos membros; ao chegar em {Math.floor(link.capPerGroup * 0.95)} membros (95%), o grupo vira reserva e só recebe gente se nenhum outro tiver espaço.
        {occ?.avgPct != null && <> Ocupação média: <strong>{occ.avgPct}%</strong>{occ.remainingSlots != null && <> · {number(occ.remainingSlots)} vagas restantes</>}.</>}
      </p>

      {link.groups.length === 0
        ? <p className="pnl-hint" style={{ marginTop: 12 }}>Nenhum grupo neste link ainda. Adicione abaixo.</p>
        : (
          <ul className="lk-groups" aria-label="Grupos deste link">
            {link.groups.map(g => {
              const status = groupStatus(g)
              return (
                <li key={g.id} className="lk-group">
                  <div className="lk-group-head">
                    <span className="lk-group-name">{g.name}</span>
                    <span className="lk-group-num">
                      {g.size == null ? <span className="pnl-hint">coletando…</span> : <>{number(g.size)}<span className="pnl-hint"> / {number(link.capPerGroup)}</span>{g.occupancyPct != null && <span className="pnl-hint"> ({g.occupancyPct}%)</span>}</>}
                    </span>
                  </div>
                  <div className={`occ-bar ${barTone(g.occupancyPct)}`} role="progressbar" aria-label={`Ocupação de ${g.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, g.occupancyPct ?? 0)}>
                    <span style={{ width: `${Math.min(100, g.occupancyPct ?? 0)}%` }} />
                  </div>
                  <div className="lk-group-foot">
                    <span><span className={`lk-status ${status.tone}`}>{status.text}</span> <span className="pnl-hint">{number(g.clicksToday)} cliques hoje · {number(g.clicks7d)} em 7 dias</span></span>
                    <span className="lk-actions">
                      <button className="pnl-btn is-sm" disabled={busy} onClick={() => run(() => api.updateSmartLinkGroup(link.id, g.id, { enabled: !g.enabled }))}>{g.enabled ? 'Pausar' : 'Retomar'}</button>
                      <button className="pnl-btn is-sm" disabled={busy} title="Busca de novo o convite do grupo (use se você o revogou no WhatsApp)" onClick={() => run(() => api.updateSmartLinkGroup(link.id, g.id, { refreshInvite: true }), 'Convite atualizado.')}>Atualizar convite</button>
                      <button className="pnl-btn is-sm is-danger" disabled={busy} onClick={() => run(() => api.deleteSmartLinkGroup(link.id, g.id), 'Grupo removido do link.')}>Remover</button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, alignItems: 'flex-end' }}>
        <label className="pnl-field" style={{ minWidth: 220 }}>
          <span className="pnl-hint">Adicionar grupo ao rodízio</span>
          <select className="pnl-input" value={pickGroup} onChange={e => setPickGroup(e.target.value)}>
            <option value="">Escolha um grupo…</option>
            {available.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <button className="pnl-btn is-primary is-sm" disabled={busy || !pickGroup} onClick={() => run(async () => { await api.addSmartLinkGroup(link.id, pickGroup); setPickGroup('') }, 'Grupo adicionado.')}>Adicionar</button>
        <label className="pnl-field" style={{ width: 150 }}>
          <span className="pnl-hint">Limite por grupo</span>
          <input key={link.capPerGroup} className="pnl-input" type="number" min="50" max="1024" defaultValue={link.capPerGroup} onBlur={e => { const value = e.target.value; if (value !== String(link.capPerGroup)) run(() => api.updateSmartLink(link.id, { capPerGroup: Number(value) }), 'Limite atualizado.') }} />
        </label>
      </div>
      <fieldset className="lk-notify" style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
        <legend className="pnl-hint" style={{ padding: 0 }}>
          Avisos: você recebe um quando TODOS os grupos passarem de 90% e outro se lotarem.
        </legend>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input type="checkbox" checked={link.notifyEmail} disabled={busy} onChange={e => run(() => api.updateSmartLink(link.id, { notifyEmail: e.target.checked }))} />
          <span>Avisar por e-mail</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <input type="checkbox" checked={link.notifyWhatsapp} disabled={busy} onChange={e => run(() => api.updateSmartLink(link.id, { notifyWhatsapp: e.target.checked }))} />
          <span>Avisar no WhatsApp (mensagem do robô para o seu próprio número)</span>
        </label>
        {link.lastAlert && (
          <p className="pnl-hint" style={{ margin: '6px 0 0' }}>
            Último aviso: {link.lastAlert.kind === 'urgent' ? 'link lotado' : 'grupos quase cheios'}{link.lastAlert.sentAt ? ` em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(link.lastAlert.sentAt))}` : ''}.
          </p>
        )}
      </fieldset>
      {available.length === 0 && <p className="pnl-hint" style={{ marginTop: 8 }}>Todos os seus grupos de destino já estão neste link (ou você ainda não tem grupos de destino).</p>}
    </section>
  )
}

function SmartLinksLive() {
  const [state, setState] = useState({ loading: true, error: null, links: [], postGroups: [], planActive: true })
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [{ links, planActive }, groups] = await Promise.all([api.smartLinks(), api.groups()])
      const postGroups = (Array.isArray(groups) ? groups : []).filter(g => g.role === 'post' && (g.kind ?? 'group') === 'group')
      setState({ loading: false, error: null, links, postGroups, planActive: planActive !== false })
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err?.message || 'Não foi possível carregar os links.' }))
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function create(e) {
    e.preventDefault()
    setCreating(true)
    try {
      await api.createSmartLink(form)
      setForm({ name: '', slug: '' })
      setNotice({ ok: true, text: 'Link criado. Agora adicione os grupos.' })
      await load()
    } catch (err) {
      setNotice({ ok: false, text: err?.message || 'Não foi possível criar o link.' })
    } finally {
      setCreating(false)
    }
  }

  if (state.loading) return <p className="pnl-hint">Carregando…</p>
  if (state.error) return <p className="pnl-hint" role="alert">{state.error}</p>
  return (
    <div className="pnl-pro-page">
      <p className="pnl-hint" style={{ margin: 0 }}>
        🔔 Em breve este recurso será exclusivo do plano <strong>Escala</strong>. Enquanto isso, está liberado para todos do PRO.
      </p>
      {!state.planActive && (
        <div className="pnl-card" role="alert" style={{ borderColor: 'var(--danger-deep)' }}>
          <strong style={{ color: 'var(--danger-deep)' }}>Seu plano venceu: seus links estão parados.</strong>
          <p className="pnl-hint" style={{ margin: '6px 0 10px' }}>Quem clicar em um Link Inteligente agora vê “Link indisponível”. Renove o plano e eles voltam a funcionar em até 10 segundos, com os mesmos endereços.</p>
          <Link className="pnl-btn is-primary is-sm" href="/painel/plano">Renovar meu plano</Link>
        </div>
      )}
      {notice && <p className="pnl-hint" role="status" style={{ color: notice.ok ? 'var(--accent-strong)' : 'var(--danger)', fontWeight: 600 }}>{notice.text}</p>}

      <form className="pnl-card" onSubmit={create}>
        <div className="pnl-card-title">Novo Link Inteligente</div>
        <p className="pnl-hint">Divulgue só este link. Cada pessoa é enviada para o grupo com menos membros e grupo lotado sai do rodízio. O robô precisa ser admin dos grupos.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="pnl-field" style={{ minWidth: 200 }}>
            <span className="pnl-hint">Nome (só para você)</span>
            <input className="pnl-input" value={form.name} maxLength={80} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ofertas Tech" required />
          </label>
          <label className="pnl-field" style={{ minWidth: 240 }}>
            <span className="pnl-hint">Endereço: {typeof window === 'undefined' ? '' : window.location.host}/g/…</span>
            <input className="pnl-input" value={form.slug} maxLength={40} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="promo-tech" required />
          </label>
          <button className="pnl-btn is-primary is-sm" type="submit" disabled={creating}>Criar link</button>
        </div>
      </form>

      {state.links.length === 0
        ? <p className="pnl-hint">Você ainda não tem nenhum link.</p>
        : state.links.map(link => <LinkCard key={link.id} link={link} postGroups={state.postGroups} onChanged={load} onNotice={setNotice} />)}

      <p className="pnl-hint">A contagem de membros é atualizada 1 vez por hora. Guardamos só quantidades, nunca os números das pessoas.</p>
    </div>
  )
}

export default function SmartLinksDashboard() {
  usePainelHeader({ title: 'Link Inteligente', subtitle: 'Um link só, sempre no grupo com mais vaga' })
  const { isPro } = usePainel()
  if (!isPro) {
    return (
      <LockedPage
        feature="rodizio"
        featureLabel="o Link Inteligente"
        steps={[
          { title: 'Crie seu link', desc: 'Escolha o nome do endereço, ex.: /g/promo-tech.' },
          { title: 'Adicione seus grupos', desc: 'O robô (admin) pega o convite de cada um sozinho.' },
          { title: 'Divulgue em qualquer lugar', desc: 'Cada pessoa vai para o grupo mais vazio.' },
        ]}
      >
        <SmartLinksPreview />
      </LockedPage>
    )
  }
  return <SmartLinksLive />
}
