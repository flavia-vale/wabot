// Primeiro pagamento avulso; renovação automática só depois, começando no
// vencimento. Dado que motiva: 4 assinaturas ativas em 21 checkouts, 9
// recusas do antifraude do MP (27/09/2026) e, separando pela origem da
// cobrança, 8 de 8 contas recusadas na cobrança automática (01/10/2026).
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { decideCheckoutOffer, subscriptionStartDate, hasPaidActiveAccess, canStartSubscription } from '../src/domain/payments/checkoutOffer.js'

const now = new Date('2026-09-27T15:00:00.000Z')
const DAY = 86400000

// Dado (01/10/2026, diag-antifraude-mp --days=30): 8 de 8 contas que tentaram a
// cobrança automática no 1º pagamento foram recusadas pelo antifraude do MP;
// no avulso, 38 aprovadas × 6 recusadas. Não regredir.
test('em teste ou vencida: só o avulso (Pix ou cartão), sem cobrança automática', () => {
  const trial = decideCheckoutOffer({ plan: 'trial', isActive: true, autoRenew: false, accessExpiresAt: new Date(now.getTime() + 3 * DAY), now })
  assert.equal(trial.mode, 'first_payment')
  assert.equal(trial.showAutoRenew, false)
  assert.equal(trial.autoRenewLabel, null)
  assert.match(trial.primaryLabel, /Pix ou cartão/)
  const vencida = decideCheckoutOffer({ plan: 'pro', isActive: false, autoRenew: false, accessExpiresAt: new Date(now.getTime() - DAY), now })
  assert.equal(vencida.mode, 'first_payment')
  assert.equal(vencida.showAutoRenew, false)
})

test('servidor: assinatura só com período pago, começando no vencimento', () => {
  const exp = new Date(now.getTime() + 10 * DAY)
  const ok = canStartSubscription({ plan: 'basic', accessExpiresAt: exp, now })
  assert.equal(ok.allowed, true)
  assert.equal(ok.startDate.getTime(), exp.getTime())
  for (const conta of [
    { plan: 'trial', accessExpiresAt: exp },
    { plan: 'pro', accessExpiresAt: new Date(now.getTime() - DAY) },
    { plan: 'basic', accessExpiresAt: null },
  ]) {
    const r = canStartSubscription({ ...conta, now })
    assert.equal(r.allowed, false)
    assert.equal(r.code, 'SUBSCRIPTION_REQUIRES_PAID_PERIOD')
    assert.match(r.message, /Pix ou cartão/)
  }
})

test('com acesso pago em dia e sem renovação: oferece ligar a automática começando no vencimento', () => {
  const exp = new Date(now.getTime() + 20 * DAY)
  const r = decideCheckoutOffer({ plan: 'basic', isActive: true, autoRenew: false, accessExpiresAt: exp, now })
  assert.equal(r.mode, 'renewal')
  assert.equal(r.showAutoRenew, true)
  assert.equal(r.autoRenewStartsAt.getTime(), exp.getTime())
  assert.match(r.note, /17\/10\/2026/)
  assert.match(r.note, /Nada é cobrado duas vezes/)
})

test('renovação automática já ligada: não oferece de novo', () => {
  const r = decideCheckoutOffer({ plan: 'pro', isActive: true, autoRenew: true, accessExpiresAt: new Date(now.getTime() + 10 * DAY), now })
  assert.equal(r.mode, 'auto_renew_on')
  assert.equal(r.showAutoRenew, false)
})

test('data de início da assinatura = fim do período pago; null sem período pago', () => {
  const exp = new Date(now.getTime() + 5 * DAY)
  assert.equal(subscriptionStartDate({ plan: 'pro', accessExpiresAt: exp, now }).getTime(), exp.getTime())
  assert.equal(subscriptionStartDate({ plan: 'trial', accessExpiresAt: exp, now }), null)
  assert.equal(subscriptionStartDate({ plan: 'pro', accessExpiresAt: new Date(now.getTime() - DAY), now }), null)
  assert.equal(hasPaidActiveAccess({ plan: 'basic', accessExpiresAt: null, now }), false)
})

test('a rota manda a data de início ao Mercado Pago e a tela decide a ordem pela regra', () => {
  const rota = readFileSync(new URL('../src/api/routes/payments.js', import.meta.url), 'utf8')
  assert.match(rota, /start_date/)
  // A trava roda ANTES de qualquer chamada ao MP na rota de assinatura.
  const inicio = rota.indexOf("app.post('/create-subscription'")
  const trava = rota.indexOf('canStartSubscription(', inicio)
  assert.ok(trava > inicio, 'rota de assinatura usa canStartSubscription')
  assert.ok(trava < rota.indexOf('createMercadoPagoSubscription(', inicio), 'trava antes de criar a assinatura no MP')
  assert.ok(trava < rota.indexOf('fetchMercadoPagoSubscriptionSnapshot(', inicio), 'trava antes de consultar o MP')
  const tela = readFileSync(new URL('../dashboard/app/painel/plano/page.js', import.meta.url), 'utf8')
  assert.match(tela, /decideCheckoutOffer/)
  // O botão de cobrança automática só existe quando a regra libera.
  assert.match(tela, /checkoutOffer\.showAutoRenew &&/)
})
