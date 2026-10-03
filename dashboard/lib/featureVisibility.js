/* Telas e ofertas escondidas por enquanto (pedido da dona do produto,
 * 2026-10-03). Só esconde da tela: o backend continua igual.
 *
 * NEXT_PUBLIC_APP_ENV é copiado de APP_ENV no build (next.config.mjs); os
 * scripts de deploy exportam APP_ENV=production (prod) e APP_ENV=staging. */

export const IS_PRODUCTION_BUILD = process.env.NEXT_PUBLIC_APP_ENV === 'production'

// Plano Premium fora do /painel/plano em todos os ambientes.
export const SHOW_PREMIUM_PLAN = false

// Tela Aplicativos (Telegram/Instagram) só fora da produção.
export const SHOW_APPS_SCREEN = !IS_PRODUCTION_BUILD
