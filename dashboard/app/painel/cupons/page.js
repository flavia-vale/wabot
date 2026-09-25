'use client'

/* Cupons de desconto da própria cliente (specs/017-client-coupon-catalog).
 *
 * Tela nova: cadastrar, editar, ligar/desligar e apagar cupons próprios,
 * escopados por cliente. A escolha de QUAL cupom sai em cada oferta é
 * automática (src/core/clientCouponPolicy.js, resolvida no momento do
 * envio) — aqui só existe cadastro, nenhuma pré-visualização de qual cupom
 * "ganharia".
 *
 * Linguagem 100% leiga (FR-026, test/painel-cupons-linguagem.test.js): nada
 * de "platform", "discountType", "enabled", "validUntil" nem "id do cupom"
 * em rótulo, dica, mensagem de recusa ou aviso.
 */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AFFILIATE_PLATFORMS } from '@/lib/painel/affiliatePlatforms'
import { usePainelHeader, PainelContentActions } from '../PainelShell'

const emptyForm = {
  kind: 'code',
  code: '',
  redeemUrl: '',
  platform: AFFILIATE_PLATFORMS[0]?.id ?? '',
  discountType: 'percent',
  discountValue: '',
  label: '',
  validUntil: '',
  minPurchase: '',
  maxDiscount: '',
}

function brl(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Aceita "79", "79,90", "1.299,90" e "79.90" — o jeito que a pessoa digita.
// Vazio = sem condição (null). Texto que não vira número segue como NaN para
// a API recusar com a mensagem leiga.
function reaisToCents(text) {
  const raw = String(text ?? '').replace(/R\$|\s/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

function centsToReaisInput(cents) {
  if (cents == null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

function lojaLabel(platform) {
  return AFFILIATE_PLATFORMS.find((p) => p.id === platform)?.label ?? platform
}

function descontoLabel(coupon) {
  const parts = [coupon.discountType === 'percent'
    ? `${coupon.discountValue}% de desconto`
    : `${brl(coupon.discountValue)} de desconto`]
  if (coupon.discountType === 'percent' && coupon.maxDiscountCents) parts.push(`até ${brl(coupon.maxDiscountCents)}`)
  if (coupon.minPurchaseCents) parts.push(`em compras acima de ${brl(coupon.minPurchaseCents)}`)
  return parts.join(', ')
}

function couponTitle(coupon) {
  return coupon.kind === 'link' ? 'Cupom por link' : coupon.code
}

function validadeLabel(coupon) {
  if (!coupon.validUntil) return 'Sem data para vencer'
  const data = new Date(coupon.validUntil).toLocaleDateString('pt-BR')
  return coupon.expired ? `Venceu em ${data}` : `Vale até ${data}`
}

function toDateInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export default function CuponsPage() {
  usePainelHeader({ title: 'Cupons', subtitle: 'Cadastre os cupons de desconto das suas lojas — a oferta escolhe o melhor sozinha' })

  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [duplicateNotice, setDuplicateNotice] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.coupons()
      setCoupons(res.coupons || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Buscar os cupons ao abrir a tela é sincronizar com um sistema externo (a
  // API) — mesmo padrão e mesma exceção da tela de filas.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setSaveError('')
    setDuplicateNotice(false)
    setShowForm(true)
  }

  function openEdit(c) {
    setEditId(c.id)
    setForm({
      kind: c.kind === 'link' ? 'link' : 'code',
      code: c.code || '',
      redeemUrl: c.redeemUrl || '',
      platform: c.platform,
      discountType: c.discountType,
      discountValue: c.discountType === 'percent' ? String(c.discountValue) : String(c.discountValue / 100),
      label: c.label || '',
      validUntil: toDateInputValue(c.validUntil),
      minPurchase: centsToReaisInput(c.minPurchaseCents),
      maxDiscount: centsToReaisInput(c.maxDiscountCents),
    })
    setSaveError('')
    setDuplicateNotice(false)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    setDuplicateNotice(false)
    try {
      const payload = {
        kind: form.kind,
        code: form.kind === 'code' ? form.code.trim() : '',
        // Opcional no cupom de código (página onde se insere o código);
        // obrigatório no de link. Vazio apaga o que estava salvo.
        redeemUrl: form.redeemUrl.trim() || null,
        platform: form.platform,
        discountType: form.discountType,
        // Na tela, valor em reais entra como "R$" comum (ex.: 20 = R$20,00);
        // a API guarda em centavos.
        discountValue: form.discountType === 'percent'
          ? Number(String(form.discountValue).replace(',', '.'))
          : reaisToCents(form.discountValue),
        minPurchaseCents: reaisToCents(form.minPurchase),
        maxDiscountCents: form.discountType === 'percent' ? reaisToCents(form.maxDiscount) : null,
        // Em edição, vazio precisa APAGAR o que estava salvo (null), não ser
        // ignorado — por isso não usa `undefined` aqui.
        label: form.label.trim() || null,
        validUntil: form.validUntil || null,
      }
      const result = editId ? await api.couponUpdate(editId, payload) : await api.couponCreate(payload)
      if (result?.duplicateWarning) setDuplicateNotice(true)
      setShowForm(false)
      await load()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(c) {
    try {
      await api.couponSetEnabled(c.id, !c.enabled)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(c) {
    try {
      await api.couponDelete(c.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div className="pnl-card" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', color: 'var(--ink-soft)' }}>Carregando…</div>
  }

  return (
    <div className="pnl-grid" style={{ maxWidth: 640, margin: '0 auto' }}>
      <PainelContentActions>
        <button type="button" className="pnl-btn is-primary" onClick={openCreate}>+ Novo cupom</button>
      </PainelContentActions>

      <div className="pnl-note-box">
        Quando uma oferta tiver a variável <code>{'{cupom}'}</code> no modelo da mensagem, o robô escolhe sozinho — na hora de enviar — o cupom da mesma loja que gera mais economia para aquele preço.
      </div>

      {duplicateNotice && (
        <div className="pnl-note-box is-flight">Você já tem um cupom igual para esta loja (mesmo código ou mesmo link). Salvamos mesmo assim — se não era essa a intenção, apague um dos dois.</div>
      )}

      {error && <div className="pnl-note-box is-error" role="alert">{error}</div>}

      {!coupons.length && !showForm && (
        <div className="pnl-card pnl-empty">
          Nenhum cupom cadastrado ainda.<br />
          Cadastre os cupons das suas lojas para usar a variável <code>{'{cupom}'}</code> nas suas ofertas.
        </div>
      )}

      {showForm && (
        <section className="pnl-card pnl-grid">
          <div className="pnl-card-title">{editId ? 'Editar cupom' : 'Novo cupom'}</div>

          <div>
            <label className="pnl-label">Como o cupom é usado?</label>
            <div className="pnl-seg pnl-groups-role-toggle" role="group" aria-label="Como o cupom é usado">
              <button type="button" className={form.kind === 'code' ? 'is-active' : ''} aria-pressed={form.kind === 'code'} onClick={() => setForm((f) => ({ ...f, kind: 'code' }))}>Com código</button>
              <button type="button" className={form.kind === 'link' ? 'is-active' : ''} aria-pressed={form.kind === 'link'} onClick={() => setForm((f) => ({ ...f, kind: 'link' }))}>Por link</button>
            </div>
            <p className="pnl-hint" style={{ marginTop: 4 }}>
              {form.kind === 'code'
                ? 'A pessoa digita o código no carrinho da loja.'
                : 'A pessoa entra no link e resgata o cupom no site da loja, sem digitar nada.'}
            </p>
          </div>

          <div>
            <label className="pnl-label">Em qual loja este cupom vale?</label>
            <select className="pnl-input" value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
              {AFFILIATE_PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {form.kind === 'code' ? (
          <>
          <div>
            <label className="pnl-label">Código do cupom</label>
            <input
              type="text"
              className="pnl-input"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Ex: BEMVINDO10"
            />
            <p className="pnl-hint" style={{ marginTop: 4 }}>Escreva do jeito que a loja te deu, com maiúsculas e minúsculas certinhas.</p>
          </div>

          <div>
            <label className="pnl-label">Link da página para inserir o código (opcional)</label>
            <input
              type="url"
              className="pnl-input"
              value={form.redeemUrl}
              onChange={(e) => setForm((f) => ({ ...f, redeemUrl: e.target.value }))}
              placeholder="Ex: https://s.shopee.com.br/..."
            />
            <p className="pnl-hint" style={{ marginTop: 4 }}>Se preencher, a oferta ganha uma linha a mais: &quot;Insira o código do cupom aqui: link&quot;. Precisa ser um link da loja {lojaLabel(form.platform)}.</p>
          </div>
          </>
          ) : (
          <div>
            <label className="pnl-label">Link de resgate do cupom</label>
            <input
              type="url"
              className="pnl-input"
              value={form.redeemUrl}
              onChange={(e) => setForm((f) => ({ ...f, redeemUrl: e.target.value }))}
              placeholder="Ex: https://s.shopee.com.br/..."
            />
            <p className="pnl-hint" style={{ marginTop: 4 }}>Precisa ser um link da loja {lojaLabel(form.platform)} (vale o link curto da própria loja). Link de outro site não é aceito.</p>
          </div>
          )}

          <div>
            <label className="pnl-label">Tipo de desconto</label>
            <select className="pnl-input" value={form.discountType} onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}>
              <option value="percent">Porcentagem (ex.: 10%)</option>
              <option value="amount">Valor fixo em reais (ex.: R$ 20,00)</option>
            </select>
          </div>

          <div>
            <label className="pnl-label">{form.discountType === 'percent' ? 'Quantos por cento de desconto?' : 'Quanto de desconto, em reais?'}</label>
            <input
              type="number"
              className="pnl-input"
              min={form.discountType === 'percent' ? 1 : 0.01}
              max={form.discountType === 'percent' ? 100 : undefined}
              step={form.discountType === 'percent' ? 1 : 0.01}
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              placeholder={form.discountType === 'percent' ? 'Ex: 10' : 'Ex: 20,00'}
            />
          </div>

          <div>
            <label className="pnl-label">Compra mínima, em reais (opcional)</label>
            <input
              type="text"
              inputMode="decimal"
              className="pnl-input"
              value={form.minPurchase}
              onChange={(e) => setForm((f) => ({ ...f, minPurchase: e.target.value }))}
              placeholder="Ex: 79,00"
            />
            <p className="pnl-hint" style={{ marginTop: 4 }}>Se o produto custar menos que isso, este cupom não entra na oferta. Deixe em branco se não tem compra mínima.</p>
          </div>

          {form.discountType === 'percent' && (
            <div>
              <label className="pnl-label">Desconto máximo, em reais (opcional)</label>
              <input
                type="text"
                inputMode="decimal"
                className="pnl-input"
                value={form.maxDiscount}
                onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                placeholder="Ex: 20,00"
              />
              <p className="pnl-hint" style={{ marginTop: 4 }}>Quando a loja limita o desconto (ex.: 10% até R$ 20,00). Deixe em branco se não tem limite.</p>
            </div>
          )}

          <div>
            <label className="pnl-label">Nome para você achar na lista (opcional)</label>
            <input
              type="text"
              className="pnl-input"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Ex: Cupom de boas-vindas"
            />
          </div>

          <div>
            <label className="pnl-label">Data para vencer (opcional)</label>
            <input
              type="date"
              className="pnl-input"
              value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            />
            <p className="pnl-hint" style={{ marginTop: 4 }}>Deixe em branco se o cupom não tem data para vencer.</p>
          </div>

          {saveError && <div className="pnl-note-box is-error" role="alert">{saveError}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pnl-btn is-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar cupom'}
            </button>
            <button type="button" className="pnl-btn" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button>
          </div>
        </section>
      )}

      {coupons.map((c) => (
        <section key={c.id} className="pnl-card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>{couponTitle(c)}</strong>
              <span className="pnl-hint">{lojaLabel(c.platform)}</span>
              {c.expired && <span className="pnl-badge is-error">Vencido</span>}
              {!c.enabled && <span className="pnl-badge">Desligado</span>}
            </div>
            {c.label && <p className="pnl-hint" style={{ marginTop: 2 }}>{c.label}</p>}
            <p className="pnl-hint" style={{ marginTop: 2 }}>{descontoLabel(c)} · {validadeLabel(c)}</p>
            {c.redeemUrl && (
              <p className="pnl-hint" style={{ marginTop: 2, overflowWrap: 'anywhere' }}>{c.redeemUrl}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" className="pnl-btn" onClick={() => handleToggle(c)}>
              {c.enabled ? 'Desligar' : 'Ligar'}
            </button>
            <button type="button" className="pnl-btn" onClick={() => openEdit(c)}>Editar</button>
            <button type="button" className="pnl-btn" onClick={() => setDeleteTarget(c)}>Apagar</button>
          </div>
        </section>
      ))}

      {deleteTarget && (
        <ConfirmDialog
          open
          title="Apagar cupom"
          message={`Tem certeza que deseja apagar o cupom "${deleteTarget.kind === 'link' ? (deleteTarget.label || 'por link') : deleteTarget.code}"?`}
          confirmLabel="Apagar"
          danger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
