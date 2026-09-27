/* Link de indicação nos dois momentos de maior satisfação (2026-09-27).
 *
 * Medido em produção: zero cadastros com `referredBy` na história — o programa
 * existia, mas a cliente só via o link se abrisse /painel/afiliados sozinha.
 * Estes testes travam (1) a regra pura de quando mostrar e o que prometer,
 * (2) que os dois cards estão nas telas certas e (3) que o link tem UM formato
 * só — o mesmo da tela de afiliados. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildAffiliateLink,
  buildReferralInvite,
  buildReferralLink,
  describeCommission,
  shouldShowFirstOfferInvite,
} from '../src/domain/painel/referralInvite.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('o link da afiliada aprovada é o mesmo formato da tela /painel/afiliados (?aff=)', () => {
  assert.equal(buildAffiliateLink('ABC123'), 'https://espelhagrupos.com.br/cadastro?aff=ABC123')
  assert.equal(buildAffiliateLink(''), null)
  assert.equal(buildReferralLink('9f3a2b1c'), 'https://espelhagrupos.com.br/cadastro?ref=9f3a2b1c')
  assert.equal(buildReferralLink(null), null)
})

test('a comissão vem da configuração do programa, nunca escrita à mão', () => {
  const c = describeCommission({ commissionPercent: 25, commissionRecurringPercent: 10, recurringCommissionEnabled: true, commissionHoldDays: 45 })
  assert.match(c.text, /^25% da primeira compra/)
  assert.match(c.text, /10% em cada renovação seguinte/)
  assert.match(c.text, /45 dias depois do pagamento/)

  const semRecorrente = describeCommission({ commissionPercent: 30, recurringCommissionEnabled: false })
  assert.doesNotMatch(semRecorrente.text, /renovação/)

  // Sem resposta da API, cai nos mesmos defaults de src/domain/affiliate/service.js.
  const padrao = describeCommission(undefined)
  assert.equal(padrao.first, 30)
  assert.equal(padrao.recurring, 30)
  assert.equal(padrao.holdDays, 30)
})

test('afiliada aprovada: link ?aff= e a promessa de comissão é afirmada', () => {
  const invite = buildReferralInvite({
    affiliateProfile: { status: 'approved', code: 'FLAVIA1' },
    referralCode: 'deadbeef',
    config: { commissionPercent: 30, commissionRecurringPercent: 30, recurringCommissionEnabled: true, commissionHoldDays: 30 },
  })
  assert.equal(invite.mode, 'affiliate')
  assert.equal(invite.link, 'https://espelhagrupos.com.br/cadastro?aff=FLAVIA1')
  assert.match(invite.promise, /^Você ganha 30% da primeira compra/)
  assert.equal(invite.cta.href, '/painel/afiliados')
})

test('quem não é afiliada aprovada: link da conta (?ref=) e convite para entrar no programa, sem prometer comissão', () => {
  for (const affiliateProfile of [null, { status: 'pending', code: 'X' }, { status: 'rejected', code: 'Y' }]) {
    const invite = buildReferralInvite({ affiliateProfile, referralCode: 'deadbeef', config: { commissionPercent: 30 } })
    assert.equal(invite.mode, 'referral')
    assert.equal(invite.link, 'https://espelhagrupos.com.br/cadastro?ref=deadbeef')
    assert.doesNotMatch(invite.promise, /^Você ganha/)
    assert.match(invite.promise, /30%/)
    assert.equal(invite.cta.href, '/painel/afiliados')
  }
})

test('sem código nenhum, não há card', () => {
  assert.equal(buildReferralInvite({ affiliateProfile: null, referralCode: null }), null)
  assert.equal(buildReferralInvite({}), null)
})

test('o card da 1ª oferta só aparece depois que alguma oferta saiu, e some ao fechar', () => {
  assert.equal(shouldShowFirstOfferInvite({ hasSuccessfulLog: null, dismissed: false }), false, 'carregando: não mostra')
  assert.equal(shouldShowFirstOfferInvite({ hasSuccessfulLog: false, dismissed: false }), false, 'nenhuma oferta ainda')
  assert.equal(shouldShowFirstOfferInvite({ hasSuccessfulLog: true, dismissed: false }), true)
  assert.equal(shouldShowFirstOfferInvite({ hasSuccessfulLog: true, dismissed: true }), false, 'fechou: não volta')
})

test('tela inicial: o card entra logo depois da checklist e usa hasSuccessfulLog da API', () => {
  const page = read('../dashboard/app/painel/page.js')
  const rota = read('../src/api/routes/dashboard.js')
  assert.match(rota, /hasSuccessfulLog: successLogCount > 0/)
  assert.match(page, /setHasSuccessfulLog\(d\?\.hasSuccessfulLog === true\)/)
  const jsx = page.slice(page.indexOf('return ('))
  const checklist = jsx.indexOf('<ActivationChecklist')
  const card = jsx.indexOf('<ReferralInviteCard')
  const stats = jsx.indexOf('className="pv-stats"')
  assert.ok(card > checklist && card < stats, 'o card fica entre a checklist e os números')
  assert.match(page, /shouldShowFirstOfferInvite\(\{ hasSuccessfulLog, dismissed: inviteDismissed \}\)/)
})

test('pagamento confirmado: o card aparece na página de retorno do Mercado Pago', () => {
  const page = read('../dashboard/app/painel/pagamento/sucesso/page.js')
  const payments = read('../src/api/routes/payments.js')
  assert.match(payments, /\/painel\/pagamento\/sucesso/, 'a API precisa continuar devolvendo a cliente para esta página')
  assert.match(page, /<ReferralInviteCard variant="payment" \/>/)
})

test('a tela /painel/afiliados usa a MESMA função de link (um formato só)', () => {
  const page = read('../dashboard/app/painel/afiliados/page.js')
  assert.match(page, /buildAffiliateLink\(profile\.code\)/)
  assert.doesNotMatch(page, /cadastro\?aff=\$\{/)
})

test('o card não inventa cor: só tokens do design system e classes do painel', () => {
  const card = read('../dashboard/components/ReferralInviteCard.js')
  assert.doesNotMatch(card, /#[0-9a-fA-F]{3,6}\b/, 'hex solto no card')
  assert.match(card, /className="pnl-card"/)
  assert.match(card, /api\.affiliateMe\(\)/)
  assert.match(card, /api\.affiliateConfig\(\)/)
})
