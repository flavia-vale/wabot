'use client'
/* Tela "Aplicativos" (feature 017, Fatia 3). Mostra onde as ofertas podem ser
 * publicadas e o passo a passo para ligar o Telegram: a cliente toca num
 * link, escolhe o grupo e torna o robô administrador. Não digita nada, não
 * copia nada (FR-017). Quem decide o que ela pode usar é a API (plano
 * Premium); a tela só mostra o que a API respondeu.
 * Vocabulário travado: "aplicativo", "o robô do Espelha Grupos", "seu grupo".
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { usePainelHeader } from '../PainelShell'

const STATUS_LABEL = {
  disponivel: { cls: 'is-success', label: 'disponível' },
  em_breve: { cls: 'is-skip', label: 'em breve' },
  tela_propria: { cls: 'is-info', label: 'tela própria' },
}

function AppRow({ app }) {
  const tag = STATUS_LABEL[app.status] ?? STATUS_LABEL.em_breve
  const where = app.id === 'whatsapp'
    ? { href: '/painel/whatsapp', text: 'Conexão WhatsApp' }
    : app.status === 'tela_propria'
      ? { href: '/painel/configuracoes', text: 'Stories do Instagram, em Configurações' }
      : null
  return (
    <li className="apps-row">
      <span className="apps-row-name">{app.displayName}</span>
      <span className={`pnl-tag ${tag.cls}`}>{tag.label}</span>
      {where && <Link className="apps-row-link" href={where.href}>{where.text}</Link>}
    </li>
  )
}

function PremiumNeeded() {
  return (
    <div className="pnl-card">
      <p className="pnl-card-title">Publique suas ofertas também no Telegram</p>
      <p className="pnl-card-note">
        Com o plano Premium, as mesmas ofertas que saem no seu WhatsApp vão também para os seus grupos do Telegram,
        com o seu link de afiliado. O plano também libera os Stories do Instagram.
      </p>
      <Link href="/painel/plano" className="pnl-btn is-primary">Ver o plano Premium</Link>
    </div>
  )
}

function TelegramCard({ status, destinations, onToggle, busy }) {
  if (!status.disponivel) {
    return (
      <div className="pnl-card">
        <p className="pnl-card-title">Telegram</p>
        <p className="pnl-card-note">{status.texto}</p>
      </div>
    )
  }
  const list = destinations?.destinos ?? []
  return (
    <div className="pnl-card">
      <div className="pnl-toolbar" style={{ justifyContent: 'space-between' }}>
        <p className="pnl-card-title">Telegram</p>
        <span className={`pnl-tag ${status.desligado ? 'is-skip' : status.pronto ? 'is-success' : 'is-flight'}`}>
          {status.desligado ? 'desligado' : status.pronto ? 'publicando' : 'falta um passo'}
        </span>
      </div>

      <ol className="apps-steps">
        <li>Toque em <b>Adicionar o robô a um grupo</b>. O Telegram abre.</li>
        <li>Escolha <b>o seu grupo</b> do Telegram.</li>
        <li>Confirme o <b>robô do Espelha Grupos</b> como administrador, com permissão de enviar mensagens.</li>
        <li>Volte aqui: o grupo aparece na lista abaixo em alguns segundos.</li>
      </ol>

      <div className="pnl-toolbar">
        <a className="pnl-btn is-primary" href={status.linkAdicionar} target="_blank" rel="noopener noreferrer">Adicionar o robô a um grupo</a>
        <span className="pnl-faint" style={{ fontSize: 12 }}>O robô aparece no Telegram como {status.nomeDoRobo}.</span>
      </div>

      {status.texto && !status.pronto && <p className="pnl-hint">{status.texto}</p>}

      <p className="pnl-card-title" style={{ marginTop: 16 }}>Seus grupos do Telegram</p>
      {list.length === 0
        ? <p className="pnl-hint">{destinations?.texto ?? 'Nenhum grupo ainda.'}</p>
        : (
          <ul className="apps-list">
            {list.map((d) => (
              <li key={d.groupId} className="apps-row">
                <span className="apps-row-name">{d.nome}</span>
                <span className={`pnl-tag ${d.pronto ? 'is-success' : 'is-error'}`}>{d.pronto ? 'pronto' : 'precisa de ajuste'}</span>
                {!d.pronto && d.texto && <span className="apps-row-help">{d.texto}</span>}
              </li>
            ))}
          </ul>
        )}

      <p className="pnl-hint">
        Para escolher quais ofertas vão para cada grupo do Telegram, use Espelhamento, Filas ou Ofertas automáticas,
        do mesmo jeito que você já faz com o WhatsApp.
      </p>

      <button type="button" className={`pnl-btn ${status.desligado ? 'is-primary' : 'is-ghost'}`} onClick={onToggle} disabled={busy}>
        {status.desligado ? 'Ligar o Telegram de novo' : 'Desligar o Telegram'}
      </button>
      {!status.desligado && <p className="pnl-faint" style={{ fontSize: 12 }}>Desligar só pausa o Telegram. Seus grupos continuam cadastrados e o WhatsApp não muda.</p>}
    </div>
  )
}

export default function AppsPanel() {
  usePainelHeader({ title: 'Aplicativos', subtitle: 'Onde suas ofertas são publicadas' })
  const [apps, setApps] = useState(null)
  const [telegram, setTelegram] = useState({ loading: true, locked: false, status: null, destinations: null, error: null })
  const [busy, setBusy] = useState(false)

  const loadTelegram = useCallback(async () => {
    try {
      const [status, destinations] = await Promise.all([
        api.get('/delivery-networks/telegram/status'),
        api.get('/delivery-networks/telegram/destinations'),
      ])
      setTelegram({ loading: false, locked: false, status, destinations, error: null })
    } catch (err) {
      const locked = err?.status === 403 || err?.response?.status === 403
      setTelegram({ loading: false, locked, status: null, destinations: null, error: locked ? null : 'Não foi possível carregar o Telegram agora. Tente de novo em instantes.' })
    }
  }, [])

  useEffect(() => {
    api.get('/delivery-networks').then((r) => setApps(r?.aplicativos ?? [])).catch(() => setApps([]))
    loadTelegram()
  }, [loadTelegram])

  // Enquanto a cliente adiciona o robô no Telegram, a lista se atualiza sozinha.
  useEffect(() => {
    if (!telegram.status?.disponivel) return undefined
    const timer = setInterval(loadTelegram, 15_000)
    return () => clearInterval(timer)
  }, [telegram.status?.disponivel, loadTelegram])

  async function toggle() {
    setBusy(true)
    try {
      await api.post(telegram.status?.desligado ? '/delivery-networks/telegram/enable' : '/delivery-networks/telegram/disable', {})
      await loadTelegram()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pnl-grid">
      <div className="pnl-card">
        <p className="pnl-card-title">Aplicativos</p>
        {apps === null
          ? <div className="pnl-skel" style={{ height: 80 }} />
          : <ul className="apps-list">{apps.map((a) => <AppRow key={a.id} app={a} />)}</ul>}
      </div>

      {telegram.loading
        ? <div className="pnl-skel" style={{ height: 160 }} />
        : telegram.locked
          ? <PremiumNeeded />
          : telegram.error
            ? <div className="pnl-card"><p className="pnl-card-note">{telegram.error}</p></div>
            : <TelegramCard status={telegram.status} destinations={telegram.destinations} onToggle={toggle} busy={busy} />}
    </div>
  )
}
