import db from '../db.js'
import { runAutomation } from './dispatcher.js'
import { isOfferAutomationDue } from './schedule.js'
import { getPlanAccess as getPlanAccessDefault } from '../billing/plans.js'
import { listRunningBots } from '../manager.js'
import { canUseReview, canDeliverReview, reviewFeatureEnabled } from './reviewFlags.js'
import { discoverReviewItems } from './reviewDiscoveryService.js'
import { deliverApprovedReviewItems, recoverReviewItems } from './reviewDeliveryService.js'

const TICK_MS = 60_000

let running = false

export async function tickOfferAutomations(deps = {}) {
  if (running) return
  running = true
  const database = deps.db ?? db
  const run = deps.runAutomationFn ?? runAutomation
  const getPlanAccess = deps.getPlanAccessFn ?? getPlanAccessDefault
  const listRunningBotsFn = deps.listRunningBotsFn ?? listRunningBots
  try {
    const now = deps.now ? deps.now() : new Date()
    if (reviewFeatureEnabled(deps.env ?? process.env)) {
      try { await recoverReviewItems({ db: database, now: () => now }) } catch (error) { console.error('[offer-cron] review recovery failed:', error.message) }
    }
    const automations = await database.offerAutomation.findMany({
      where: { enabled: true },
      include: { instagramDestinations: { include: { destination: true } } },
    })

    // Curto-circuito: buscamos os bots rodando UMA vez por tick e pulamos
    // automações de usuários sem sessão ativa antes de gastar uma query de
    // plano + uma tentativa de envio que falharia com "Bot não está rodando".
    // Em staging (modo remote, bots geralmente parados) isso eliminava ~N
    // queries+envios falhos por minuto. `null` = checagem indisponível: não
    // curto-circuita e deixa o guard do dispatcher decidir por automação.
    let runningSet = null
    try {
      runningSet = new Set(await listRunningBotsFn())
    } catch (err) {
      console.warn('[offer-cron] listRunningBots indisponível, sem curto-circuito neste tick:', err.message)
    }

    for (const automation of automations) {
      const mode = automation.publicationMode || 'direct'
      if (mode !== 'direct' && mode !== 'review') {
        console.error(`[offer-cron] automation ${automation.id} skipped: publicationMode inválido`)
        continue
      }
      if (mode === 'review') {
        if (!canUseReview(automation.userId, deps.env ?? process.env)) continue
        const { entitlements } = await getPlanAccess(automation.userId, { db: database })
        if (!entitlements.canUseOfferAutomations) {
          console.warn(`[offer-cron] review automation ${automation.id} skipped: plano sem acesso`)
          continue
        }
        if (automation.instagramDestinations?.length && !entitlements.canUseInstagramStories) automation.instagramDestinations = []
        const discoveryDue = isOfferAutomationDue({ ...automation, lastSentAt: automation.lastDiscoveryAt }, now)
        if (discoveryDue) try { await (deps.discoverReviewItemsFn ?? discoverReviewItems)(automation, { db: database, now: () => now, fetchOffersFn: deps.fetchOffersFn }) } catch (error) { console.error(`[offer-cron] review discovery ${automation.id} failed:`, error.message) }
        if (canDeliverReview(automation.userId, deps.env ?? process.env) && isOfferAutomationDue(automation, now)) try { await (deps.deliverApprovedReviewItemsFn ?? deliverApprovedReviewItems)(automation, { ...deps, db: database, now: () => now }) } catch (error) { console.error(`[offer-cron] review delivery ${automation.id} failed:`, error.message) }
        continue
      }
      if (!isOfferAutomationDue(automation, now)) continue
      if (runningSet && !runningSet.has(automation.userId) && !automation.instagramDestinations?.length) continue

      // Ofertas automáticas são feature Pro/Trial ativo. Automações criadas
      // antes de um downgrade (ou com acesso expirado) ficam no banco, mas
      // não executam até o plano voltar a permitir.
      const { entitlements } = await getPlanAccess(automation.userId, { db: database })
      if (!entitlements.canUseOfferAutomations) {
        console.warn(`[offer-cron] automation ${automation.id} skipped: plano do usuário ${automation.userId} não permite ofertas automáticas`)
        continue
      }
      if (automation.instagramDestinations?.length && !entitlements.canUseInstagramStories) {
        console.warn(`[offer-cron] automation ${automation.id}: destinos Instagram ignorados porque o plano não permite Stories`)
        automation.instagramDestinations = []
      }

      try {
        await run(automation, { dbOverride: database })
      } catch (err) {
        console.error(`[offer-cron] automation ${automation.id} failed:`, err.message)
      }
    }
  } finally {
    running = false
  }
}

export function startOfferAutomationCron() {
  const interval = setInterval(() => {
    tickOfferAutomations().catch(err => console.error('[offer-cron] tick error:', err.message))
  }, TICK_MS)
  interval.unref()
  return interval
}
