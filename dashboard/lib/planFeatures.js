// Divisão Basic/PRO do painel (2026-09-23). Fonte ÚNICA dos textos que explicam
// cada recurso do PRO na tela. As listas "o que cada plano tem" vêm de
// DEFAULT_LANDING_PLANS — a MESMA lista da página de preços, para painel e
// site nunca discordarem sobre o que o Basic inclui.
import { DEFAULT_LANDING_PLANS } from './marketing-content.js'

export const PRO_FEATURES = Object.freeze({
  canais: { title: 'Espelhamento de canais', desc: 'Além de grupos, o robô também pega ofertas de canais do WhatsApp e publica nos seus canais.' },
  garimpo: { title: 'Ofertas automáticas', desc: 'Diga o tema — “air fryer”, “tênis” — e o robô procura na Shopee, filtra pelo desconto e publica sozinho.' },
  filas: { title: 'Filas de ofertas', desc: 'Junte ofertas numa fila e o robô publica uma de cada vez, no horário e ritmo que você escolher.' },
  marca: { title: 'Sua marca d’água', desc: 'Seu nome no canto de todas as fotos das ofertas.' },
  ritmo: { title: 'Controle de ritmo', desc: 'Horário de descanso, máximo de ofertas por dia e intervalo entre mensagens — para o seu número se comportar como uma pessoa.' },
  variacao: { title: 'Variação do texto', desc: 'O robô alterna ganchos, chamadas e convites para as mensagens não ficarem repetidas.' },
  vercanal: { title: 'Botão “Ver canal”', desc: 'Um botão para o seu canal embaixo de cada oferta publicada.' },
  vendas: { title: 'Painel de vendas Shopee', desc: 'Vendas, comissão por dia e produtos que mais venderam na Shopee, direto no painel, sem abrir outra tela.' },
})

function planFeatures(id) {
  return DEFAULT_LANDING_PLANS.find(plan => plan.id === id)?.features ?? []
}

export const BASIC_FEATURE_LIST = planFeatures('basic')
export const PRO_FEATURE_LIST = planFeatures('pro')
export const BASIC_PLAN_DESC = DEFAULT_LANDING_PLANS.find(plan => plan.id === 'basic')?.desc ?? ''
export const PRO_PLAN_DESC = DEFAULT_LANDING_PLANS.find(plan => plan.id === 'pro')?.desc ?? ''
