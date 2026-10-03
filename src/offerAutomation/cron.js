import db from '../db.js'
import { runAutomation } from './dispatcher.js'
import { isOfferAutomationDue } from './schedule.js'
import { getPlanAccess as getPlanAccessDefault } from '../billing/plans.js'
import { listRunningBots } from '../manager.js'
import { canUseReview, canDeliverReview, reviewFeatureEnabled } from './reviewFlags.js'
import { discoverReviewItems } from './reviewDiscoveryService.js'
import { deliverApprovedReviewItems, recoverReviewItems } from './reviewDeliveryService.js'

const TICK_MS = 60_000

// Cada execução "direct" que NÃO envia precisa deixar rastro com o motivo.
// Até 2026-09-30 o retorno de runAutomation ({ skipped } / { error } /
// { sent }) era descartado aqui: uma automação que rodava a cada 30 min e
// caía em `all_offers_filtered`, `no_offers_found` ou `bot_not_running` não
// escrevia UMA linha no log — do lado de fora, "a automação não executa" e
// não havia por onde começar. Uma linha por execução, sem chave nem texto.
export function describeAutomationResult(result) {
  if (!result || typeof result !== 'object') return 'sem_retorno'
  if (result.skipped) return `pulou=${result.skipped}`
  if (result.error) return `erro=${result.error}`
  const partes = [`enviou=${Number(result.sent) || 0}`]
  if (result.failed) partes.push(`falhou=${result.failed}`)
  if (result.storiesQueued) partes.push(`stories=${result.storiesQueued}`)
  return partes.join(' ')
}

function logAutomationResult(automation, result) {
  const linha = `[offer-cron] automation ${automation.id} user=${automation.userId} keyword="${automation.keyword}" page=${automation.page ?? 1}: ${describeAutomationResult(result)}`
  if (result?.error || (result?.sent === 0 && result?.failed)) console.error(linha)
  else console.log(linha)
}

let running = false

// Automação RAKUTEN que pulou por falta de promoção só volta a ser tentada
// depois deste tempo. Sem isso, rodava todo minuto para sempre (pulo não
// atualiza lastSentAt) — e na Rakuten isso é o estado normal: feed pequeno e
// promoções "indeterminadas" que já saíram. Só Rakuten; Shopee/Awin seguem
// como sempre (revisão 2026-10-03, R7). Memória: 1 número por automação.
export const RAKUTEN_EMPTY_BACKOFF_MS = 15 * 60_000
const RAKUTEN_EMPTY_SKIPS = new Set(['all_offers_filtered', 'no_rakuten_promotions', 'no_rakuten_account'])
const rakutenBackoffUntil = new Map()

export function __resetRakutenBackoff() {
  rakutenBackoffUntil.clear()
}

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
      if (automation.source === 'rakuten' && (rakutenBackoffUntil.get(automation.id) ?? 0) > now.getTime()) continue
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
        const result = await run(automation, { dbOverride: database })
        logAutomationResult(automation, result)
        if (automation.source === 'rakuten') {
          if (RAKUTEN_EMPTY_SKIPS.has(result?.skipped)) rakutenBackoffUntil.set(automation.id, now.getTime() + RAKUTEN_EMPTY_BACKOFF_MS)
          else rakutenBackoffUntil.delete(automation.id)
        }
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
