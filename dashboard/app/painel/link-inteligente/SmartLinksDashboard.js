'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { usePainel, usePainelHeader } from '../PainelShell'
import { LockedPage } from '@/components/pro/ProGate'

const number = value => new Intl.NumberFormat('pt-BR').format(value)
const publicUrl = path => `${typeof window === 'undefined' ? '' : window.location.origin}${path}`

function SmartLinksPreview() {
  return (
    <div className="pnl-pro-card">
      <strong>espelhagrupos.com.br/g/promo-tech</strong>
      <p className="pnl-hint">3 grupos · 2.140 membros · 312 cliques nos últimos 7 dias</p>
      <div className="pnl-table-wrap">
        <table className="pnl-table">
          <thead><tr><th>Grupo</th><th>Membros</th><th>Cliques 7 dias</th></tr></thead>
          <tbody>
            <tr><td>Ofertas Tech 1</td><td>998</td><td>40</td></tr>
            <tr><td>Ofertas Tech 2</td><td>812</td><td>120</td></tr>
            <tr><td>Ofertas Tech 3</td><td>330</td><td>152</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LinkCard({ link, postGroups, onChanged, onNotice }) {
  const [busy, setBusy] = useState(false)
  const [pickGroup, setPickGroup] = useState('')
  const used = new Set(link.groups.map(g => g.groupId))
  const available = postGroups.filter(g => !used.has(g.id))

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
        <div>
          <div className="pnl-card-title">{link.name}</div>
          <code style={{ wordBreak: 'break-all' }}>{publicUrl(link.path)}</code>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button className="pnl-btn is-sm" disabled={busy} onClick={copy}>Copiar link</button>
          <button className="pnl-btn is-sm" disabled={busy} onClick={() => run(() => api.updateSmartLink(link.id, { enabled: !link.enabled }), link.enabled ? 'Link pausado.' : 'Link ativado.')}>
            {link.enabled ? 'Pausar' : 'Ativar'}
          </button>
          <button className="pnl-btn is-sm is-danger" disabled={busy} onClick={() => { if (window.confirm(`Apagar o link "${link.name}"? Quem já o divulgou verá "link não encontrado". O endereço continua reservado para você.`)) run(() => api.deleteSmartLink(link.id), 'Link apagado.') }}>Apagar</button>
        </div>
      </div>

      <p className="pnl-hint" style={{ margin: '12px 0' }}>
        {link.groups.length} grupos · {number(link.totalSize)} membros · {number(link.clicks7d)} cliques nos últimos 7 dias{link.enabled ? '' : ' · PAUSADO'}
      </p>

      {link.groups.length > 0 && (
        <div className="pnl-table-wrap">
          <table className="pnl-table">
            <thead><tr><th>Grupo</th><th>Membros</th><th>Cliques 7 dias</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {link.groups.map(g => {
                const full = g.size != null && g.size >= link.capPerGroup
                const status = !g.hasInvite ? 'Sem convite' : !g.enabled ? 'Pausado' : full ? 'Lotado' : 'No rodízio'
                return (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>{g.size == null ? <span className="pnl-hint">coletando…</span> : number(g.size)}</td>
                    <td>{number(g.clicks7d)}</td>
                    <td>{status}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="pnl-btn is-sm" disabled={busy} onClick={() => run(() => api.updateSmartLinkGroup(link.id, g.id, { enabled: !g.enabled }))}>{g.enabled ? 'Pausar' : 'Retomar'}</button>{' '}
                      <button className="pnl-btn is-sm" disabled={busy} title="Busca de novo o convite do grupo (use se você o revogou no WhatsApp)" onClick={() => run(() => api.updateSmartLinkGroup(link.id, g.id, { refreshInvite: true }), 'Convite atualizado.')}>Atualizar convite</button>{' '}
                      <button className="pnl-btn is-sm is-danger" disabled={busy} onClick={() => run(() => api.deleteSmartLinkGroup(link.id, g.id), 'Grupo removido do link.')}>Remover</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
      {available.length === 0 && <p className="pnl-hint" style={{ marginTop: 8 }}>Todos os seus grupos de destino já estão neste link (ou você ainda não tem grupos de destino).</p>}
    </section>
  )
}

function SmartLinksLive() {
  const [state, setState] = useState({ loading: true, error: null, links: [], postGroups: [] })
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [{ links }, groups] = await Promise.all([api.smartLinks(), api.groups()])
      const postGroups = (Array.isArray(groups) ? groups : []).filter(g => g.role === 'post' && (g.kind ?? 'group') === 'group')
      setState({ loading: false, error: null, links, postGroups })
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

      <p className="pnl-hint">A contagem de membros é atualizada 1 vez por hora; entre uma atualização e outra, cada clique conta como uma vaga ocupada. Guardamos só quantidades, nunca os números das pessoas.</p>
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
