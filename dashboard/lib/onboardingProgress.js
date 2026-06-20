// Lógica pura de progresso/visibilidade do onboarding (checklist da home,
// página /painel/checklist e card da sidebar). Mantida fora dos componentes
// para ser testável sem DOM e para que checklist e sidebar nunca divirjam.
//
// Regra central (corrige bug 2026-06): o onboarding não é só para o primeiro
// setup. Quando um pré-requisito regride — tipicamente o WhatsApp cai e o bot
// fica offline — a checklist precisa REAPARECER para guiar a reconexão, mesmo
// que o usuário já tenha concluído o onboarding uma vez (flag no localStorage).
// O flag passa a suprimir apenas a repetição da celebração, não a orientação.

export const PREREQ_KEYS = ['waConnected', 'hasMonitorGroup', 'hasPostGroup', 'hasCredentials']

// 4 pré-requisitos + "ativar o bot".
export const TOTAL_STEPS = PREREQ_KEYS.length + 1

export function countCompletedPrereqs(status) {
  if (!status) return 0
  return PREREQ_KEYS.filter((key) => Boolean(status[key])).length
}

// Bot ativo = status carregado E todos os pré-requisitos satisfeitos.
export function isBotActive(status) {
  if (status === null || status === undefined) return false
  return countCompletedPrereqs(status) === PREREQ_KEYS.length
}

// Decide o que renderizar. Retorna uma das views:
// - 'list'      → fluxo normal de onboarding (ainda configurando)
// - 'recovery'  → já concluiu antes, mas algo regrediu (ex.: WhatsApp caiu)
// - 'celebrate' → todos os passos prontos no fluxo fresco (UI mostra a celebração)
// - 'hidden'    → nada a fazer / ainda sem dados
//
// `phase` é o estado interno da máquina de celebração da checklist da home
// ('list' | 'celebrate' | 'hidden'); a sidebar não usa (passa undefined).
export function resolveOnboardingView({ status, doneBefore, persist, phase }) {
  // Páginas dedicadas (persist) sempre mostram a lista.
  if (persist) return 'list'

  // Celebração e fim do fluxo fresco têm precedência sobre tudo.
  if (phase === 'celebrate') return 'celebrate'
  if (phase === 'hidden') return 'hidden'

  if (doneBefore) {
    // Já concluiu antes: só reaparece (recovery) se algo regrediu. Enquanto o
    // status não chegou, fica oculto para não piscar para quem está saudável.
    if (status === null || status === undefined) return 'hidden'
    return isBotActive(status) ? 'hidden' : 'recovery'
  }

  // Fluxo fresco: continua na lista até a UI disparar a celebração.
  return 'list'
}
