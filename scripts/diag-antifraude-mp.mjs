#!/usr/bin/env node
// Recusa por suspeita (`rejected_high_risk` / `cc_rejected_high_risk`) no
// pagamento AVULSO — read-only. Procura a causa do NOSSO lado.
//
//   cd ~/wabot && node scripts/diag-antifraude-mp.mjs [<email>] [--days=30]
//
// Por que existe (01/10/2026): cliente recusado 3x em Pix, 2x em cartão. Pix
// não tem banco nem cartão para recusar — a nota de risco sai do Mercado Pago,
// e ele pesa a COMPRADORA, a VENDEDORA (nossa conta) e a INTEGRAÇÃO (como
// chamamos). A medição de 30/09 já mostrava 9 contas recusadas na 1ª
// tentativa. Este script junta os três lados:
//
//   [1] nossa conta vendedora no MP (`/users/me`): tipo, situação, se pode
//       vender, reputação, data de cadastro;
//   [2] a aplicação dona da chave (`/applications/:id`): site, escopos;
//   [3] todos os pagamentos da janela por tipo × origem × meio × situação ×
//       motivo, a cobrança automática à parte e o avulso por dia;
//   [4] aprovado × suspeita CAMPO A CAMPO no avulso — o campo que separa os
//       dois grupos é o suspeito;
//   [5] (com <email>) cada pagamento da conta + a preferência que o MP
//       guardou para ele (o que de fato chegou lá).
//
// Não imprime chave nem e-mail completo (mascarado).
import 'dotenv/config'
import db from '../src/db.js'

const args = process.argv.slice(2)
const dias = Math.max(1, Number((args.find(a => a.startsWith('--days=')) || '').split('=')[1] || 30))
const alvo = args.find(a => !a.startsWith('--')) || null
const TOKEN = String(process.env.MP_ACCESS_TOKEN || '').trim()

function mascarar(email) {
  const s = String(email || '')
  const [u, d] = s.split('@')
  if (!d) return s ? `${s.slice(0, 2)}***` : '—'
  return `${u.slice(0, 2)}***@${d}`
}

async function mpGet(caminho) {
  try {
    const r = await fetch(`https://api.mercadopago.com${caminho}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(15000),
    })
    const corpo = await r.json().catch(() => null)
    if (!r.ok) return { ok: false, motivo: `MP respondeu ${r.status} ${corpo?.message || ''}`.trim(), corpo }
    return { ok: true, corpo }
  } catch (err) {
    return { ok: false, motivo: String(err?.message || err).slice(0, 140) }
  }
}

const SUSPEITA = new Set(['rejected_high_risk', 'cc_rejected_high_risk'])
const tem = v => v !== undefined && v !== null && String(v).trim() !== ''

if (!TOKEN) {
  console.log('MP_ACCESS_TOKEN não configurado neste ambiente.')
  process.exit(1)
}
console.log(`Chave: ${TOKEN.startsWith('TEST-') ? 'TESTE' : 'produção'} · janela: ${dias} dia(s)`)

// ---- [1] conta vendedora -------------------------------------------------
console.log('\n[1] Nossa conta vendedora (/users/me)')
const me = await mpGet('/users/me')
if (!me.ok) {
  console.log(`    não deu para consultar (${me.motivo})`)
} else {
  const u = me.corpo || {}
  const st = u.status || {}
  console.log(`    id=${u.id} site=${u.site_id} país=${u.country_id} tipo=${u.user_type} cadastro=${String(u.registration_date || '').slice(0, 10)}`)
  console.log(`    documento=${u.identification?.type || '—'} empresa=${u.company?.corporate_name ? 'sim' : 'não'} pessoa=${u.entity_type || '—'}`)
  console.log(`    situação=${st.site_status} vender=${st.sell?.allow}${st.sell?.codes?.length ? ` (${st.sell.codes.join(',')})` : ''} comprar=${st.buy?.allow} faturamento=${st.billing?.allow}`)
  console.log(`    email_confirmado=${st.confirmed_email} conta_mp=${st.mercadopago_account_type || '—'} tc_aceito=${st.mercadopago_tc_accepted ?? '—'} restrições=${JSON.stringify(st.immediate_payment || st.restrictions || null)}`)
  console.log(`    reputação=${u.seller_reputation?.level_id || '—'} experiência=${u.seller_experience || '—'} tags=${(u.tags || []).join(',') || '—'}`)
  if (u.company?.brand_name) console.log(`    marca=${u.company.brand_name}`)
}

// ---- [2] aplicação -------------------------------------------------------
console.log('\n[2] Aplicação dona da chave')
const appId = TOKEN.split('-')[1]
if (!/^\d+$/.test(appId || '')) {
  console.log('    formato da chave não traz o id da aplicação')
} else {
  const app = await mpGet(`/applications/${appId}`)
  if (!app.ok) console.log(`    não deu para consultar (${app.motivo})`)
  else {
    const a = app.corpo || {}
    console.log(`    id=${a.id} nome=${a.name || '—'} site=${a.site_id || '—'} url=${a.url || '—'} ativa=${a.active ?? a.status ?? '—'}`)
    console.log(`    escopos=${(a.scopes || []).join(',') || '—'} redirect=${(a.redirect_uri ? 'sim' : 'não')} certificada=${a.certification_status || a.certified || '—'}`)
  }
}

// ---- [3] pagamentos da janela --------------------------------------------
console.log('\n[3] Pagamentos da janela (todos)')
const pagamentos = []
for (let offset = 0; offset < 1000; offset += 100) {
  const r = await mpGet(`/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=NOW-${dias}DAYS&end_date=NOW&limit=100&offset=${offset}`)
  if (!r.ok) { console.log(`    busca falhou (${r.motivo})`); break }
  const lote = r.corpo?.results || []
  pagamentos.push(...lote)
  if (lote.length < 100) break
}
console.log(`    ${pagamentos.length} pagamento(s)`)
const porGrupo = new Map()
for (const p of pagamentos) {
  // `point_of_interaction.type` é o que separa avulso (CHECKOUT) da 1ª cobrança
  // da assinatura (SUBSCRIPTIONS): as duas chegam como `regular_payment`.
  const k = `${p.operation_type} | ${p.point_of_interaction?.type || '—'} | ${p.payment_method_id} | ${p.status} | ${p.status_detail}`
  porGrupo.set(k, (porGrupo.get(k) || 0) + 1)
}
for (const [k, n] of [...porGrupo].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${k}`)

// Avulso de verdade = Checkout Pro. A 1ª cobrança da assinatura também vem como
// `regular_payment`; misturar as duas fez o RCA de 30/09 culpar o avulso.
const avulso = pagamentos.filter(p => p.operation_type === 'regular_payment' && p.point_of_interaction?.type !== 'SUBSCRIPTIONS')
const assinatura = pagamentos.filter(p => p.point_of_interaction?.type === 'SUBSCRIPTIONS')
console.log(`\n    Cobrança automática (SUBSCRIPTIONS): aprovadas=${assinatura.filter(p => p.status === 'approved').length} suspeita=${assinatura.filter(p => SUSPEITA.has(p.status_detail)).length} total=${assinatura.length}`)
console.log('\n    Avulso por dia (aprovado / suspeita / outra recusa / pendente):')
const porDia = new Map()
for (const p of avulso) {
  const d = String(p.date_created).slice(0, 10)
  const c = porDia.get(d) || [0, 0, 0, 0]
  if (p.status === 'approved') c[0]++
  else if (SUSPEITA.has(p.status_detail)) c[1]++
  else if (p.status === 'rejected') c[2]++
  else c[3]++
  porDia.set(d, c)
}
for (const [d, c] of [...porDia].sort()) console.log(`    ${d}  ${c.join(' / ')}`)

// ---- [4] aprovado × suspeita campo a campo ------------------------------
const usuarios = new Map()
async function contaDe(ref) {
  if (!ref) return null
  if (!usuarios.has(ref)) {
    usuarios.set(ref, await db.user.findUnique({ where: { id: String(ref) }, select: { email: true, createdAt: true, name: true, contactPhone: true } }).catch(() => null))
  }
  return usuarios.get(ref)
}

async function sinais(p) {
  const conta = await contaDe(p.external_reference)
  const idadeDias = conta?.createdAt ? Math.floor((new Date(p.date_created) - new Date(conta.createdAt)) / 86400000) : null
  const ai = p.additional_info || {}
  return {
    'conta existe no nosso banco': !!conta,
    'conta criada há < 2 dias': idadeDias !== null && idadeDias < 2,
    'pagador logado no MP (payer.id)': tem(p.payer?.id),
    'payer.type': p.payer?.type || '—',
    'e-mail do pagador = e-mail da conta': !!(conta?.email && p.payer?.email && conta.email.toLowerCase() === String(p.payer.email).toLowerCase()),
    'CPF do pagador presente': tem(p.payer?.identification?.number),
    'nome em additional_info.payer': tem(ai.payer?.first_name),
    'telefone em additional_info.payer': tem(ai.payer?.phone?.number),
    'item com category_id': tem(ai.items?.[0]?.category_id),
    'IP do comprador (additional_info.ip_address)': tem(ai.ip_address),
    'binary_mode': !!p.binary_mode,
    'statement_descriptor': p.statement_descriptor || '—',
    'point_of_interaction.type': p.point_of_interaction?.type || '—',
    'tem metadata.plan': tem(p.metadata?.plan),
    'valor': p.transaction_amount,
    'live_mode': p.live_mode,
  }
}

console.log('\n[4] Avulso: aprovado × suspeita, campo a campo (% de pagamentos com o sinal)')
const aprovados = avulso.filter(p => p.status === 'approved')
const suspeitos = avulso.filter(p => SUSPEITA.has(p.status_detail))
console.log(`    aprovados=${aprovados.length} suspeita=${suspeitos.length}`)
async function perfil(lista) {
  const acc = {}
  for (const p of lista) {
    const s = await sinais(p)
    for (const [k, v] of Object.entries(s)) {
      acc[k] ||= new Map()
      const chave = typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)
      acc[k].set(chave, (acc[k].get(chave) || 0) + 1)
    }
  }
  return acc
}
const pa = await perfil(aprovados)
const ps = await perfil(suspeitos)
const fmtPerfil = (m, total) => !m ? '—' : [...m].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([v, n]) => `${v}:${Math.round(100 * n / Math.max(1, total))}%`).join(' ')
for (const k of Object.keys({ ...pa, ...ps })) {
  console.log(`    ${k.padEnd(44)} APROV ${fmtPerfil(pa[k], aprovados.length).padEnd(34)} SUSP ${fmtPerfil(ps[k], suspeitos.length)}`)
}

// Contas: quantas foram recusadas e quantas pagaram depois.
const contasSusp = new Set(suspeitos.map(p => p.external_reference).filter(Boolean))
const contasPagas = new Set(aprovados.map(p => p.external_reference).filter(Boolean))
console.log(`    contas com suspeita=${contasSusp.size}, dessas pagaram depois=${[...contasSusp].filter(c => contasPagas.has(c)).length}`)

// ---- [5] conta alvo -----------------------------------------------------
if (alvo) {
  console.log(`\n[5] Conta ${mascarar(alvo)}`)
  const u = await db.user.findFirst({ where: { email: alvo }, select: { id: true, createdAt: true, name: true, contactPhone: true, email: true } })
  if (!u) {
    console.log('    sem conta com esse e-mail')
  } else {
    console.log(`    conta criada ${u.createdAt.toISOString().slice(0, 16)} nome=${u.name ? `"${u.name}"` : '—'} telefone=${u.contactPhone ? 'sim' : 'não'}`)
    const r = await mpGet(`/v1/payments/search?sort=date_created&criteria=desc&limit=10&external_reference=${encodeURIComponent(u.id)}`)
    for (const p of r.corpo?.results || []) {
      console.log(`\n    ${String(p.date_created).slice(0, 16)} ${p.payment_method_id} ${p.status} ${p.status_detail} R$${p.transaction_amount} op=${p.operation_type}`)
      console.log(`      pagador: logado=${tem(p.payer?.id)} email=${mascarar(p.payer?.email)} CPF=${tem(p.payer?.identification?.number)} tipo=${p.payer?.type || '—'}`)
      const s = await sinais(p)
      console.log(`      ${Object.entries(s).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
      if (p.order?.id) {
        const mo = await mpGet(`/merchant_orders/${p.order.id}`)
        const prefId = mo.corpo?.preference_id
        if (prefId) {
          const pref = await mpGet(`/checkout/preferences/${prefId}`)
          const pr = pref.corpo || {}
          console.log(`      preferência ${prefId}: payer=${JSON.stringify({ ...(pr.payer || {}), email: mascarar(pr.payer?.email) })}`)
          console.log(`        item=${JSON.stringify((pr.items || []).map(i => ({ id: i.id, title: i.title, category_id: i.category_id, unit_price: i.unit_price })))}`)
          console.log(`        notification_url=${pr.notification_url || '—'} back_url=${pr.back_urls?.success || '—'} binary_mode=${pr.binary_mode} purpose=${pr.purpose || '—'} excluded=${JSON.stringify(pr.payment_methods?.excluded_payment_types || [])} marketplace=${pr.marketplace || '—'} criado=${String(pr.date_created || '').slice(0, 16)}`)
        } else {
          console.log(`      preferência: não achada (${mo.motivo || 'sem preference_id'})`)
        }
      }
    }
  }
}

process.exit(0)
