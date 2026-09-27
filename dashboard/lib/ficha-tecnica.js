// Ficha técnica CANÔNICA do produto — uma só, derivada das constantes que já
// existem, exibida IDÊNTICA na home, em /precos, no llms.txt e no pricing.md.
//
// Por que existe (medição de IA de 27/09/2026, pergunta "bot para afiliados no
// WhatsApp"): a Perplexity nos listava com "Lojas suportadas: variam" enquanto
// um concorrente aparecia com 12 integrações nomeadas; o Gemini dizia que
// enviamos para "WhatsApp e Telegram" (não há Telegram) e que o Basic é
// "operação manual" (o Basic também espelha sozinho). A IA não achava uma
// lista clara e comparável de recursos e lojas.
//
// Regra: cada linha abaixo só entra se EXISTE no código —
// `src/billing/plans.js` (o que é do Basic e o que é do Pro), os conversores
// em `src/converters/` (lojas e cupom), `src/core/mirrorLinkGuard.js` (não
// publica se a troca de link falhar), `src/offerAutomation/` (tema + desconto
// mínimo). Nunca prometer que não bane. Guarda:
// `test/ficha-tecnica-canonica.test.js`.
//
// Módulo puro (sem JSX, sem React) para o teste em node:test importar direto.

import { BRAND_NAME, DEFAULT_LANDING_PLANS, SUPPORTED_STORES } from './marketing-content.js'

const planoPorId = (id) => DEFAULT_LANDING_PLANS.find((plan) => plan.id === id)
const basic = planoPorId('basic')
const pro = planoPorId('pro')

const listaLojas = `${SUPPORTED_STORES.slice(0, -1).join(', ')} e ${SUPPORTED_STORES[SUPPORTED_STORES.length - 1]}`

/** Frase de definição — a MESMA nos 4 lugares. */
export const FICHA_DEFINICAO = `${BRAND_NAME} é um software web para afiliadas que espelha ofertas de grupos e canais do WhatsApp para os seus grupos, trocando o link pelo seu código de afiliada em ${SUPPORTED_STORES.length} lojas, e (no Pro) busca ofertas da Shopee sozinho.`

/** Rótulo de plano com preço, ex.: "Basic (R$39 / 30 dias)". */
export const rotuloPlano = (plan) => `${plan.name} (${plan.price} / ${plan.period})`

/** Fatos que valem para os dois planos (não são coluna da tabela). */
export const FICHA_FATOS = [
  {
    rotulo: 'Lojas com conversão de link',
    valor: `${SUPPORTED_STORES.length} lojas: ${listaLojas}. Converte também link de cupom, não só de produto.`,
  },
  {
    rotulo: 'Canal de publicação',
    valor: 'Só WhatsApp (grupos e, no Pro, canais). Não envia para Telegram nem para Instagram.',
  },
  {
    rotulo: 'Teste grátis',
    valor: '7 dias com o Pro completo, sem cartão.',
  },
  {
    rotulo: 'Reembolso e cancelamento',
    valor: 'Reembolso integral em até 7 dias corridos depois do pagamento; depois disso, cancela sem multa e usa até o fim do período pago.',
  },
  {
    rotulo: 'Conexão',
    valor: 'Pelo QR Code do WhatsApp; roda no servidor 24 h, sem deixar o celular ligado. Recomendamos um número dedicado. Nenhum software garante que o número não será bloqueado.',
  },
]

export const FICHA_COLUNAS = ['Recurso', rotuloPlano(basic), rotuloPlano(pro)]

/**
 * Linhas "Recurso | Basic | Pro". `true` = Sim, `false` = Não. Cada linha cita
 * a fonte no código para quem for conferir.
 */
export const FICHA_LINHAS = [
  { recurso: 'Espelhamento automático: lê os grupos de origem e publica nos grupos de destino, sem copiar e colar', basic: true, pro: true }, // canUseGroups
  { recurso: `Troca do link pelo seu código de afiliada nas ${SUPPORTED_STORES.length} lojas (inclusive cupom)`, basic: true, pro: true }, // src/converters/*
  { recurso: 'Se a troca do link falhar, a oferta NÃO é publicada (nunca sai o link de outra pessoa)', basic: true, pro: true }, // mirrorLinkGuard
  { recurso: 'Modelo de mensagem: a oferta sai reescrita do seu jeito', basic: true, pro: true }, // DEFAULT_LANDING_PLANS.basic
  { recurso: 'Canais do WhatsApp como origem e destino', basic: false, pro: true }, // canUseChannels
  { recurso: 'Ofertas automáticas da Shopee por tema e desconto mínimo, sem grupo de origem', basic: false, pro: true }, // canUseOfferAutomations + minDiscountPct
  { recurso: 'Filas de envio e controle de ritmo (intervalo, horário de descanso, limite por dia)', basic: false, pro: true }, // canUseOfferQueues + canUseAdvancedPreservation
  { recurso: 'Variação do texto entre os envios', basic: false, pro: true }, // canUseCopyVariation
  { recurso: 'Marca d’água com o seu nome na foto da oferta', basic: false, pro: true }, // canUseWatermark
  { recurso: 'Painel de vendas e comissão da Shopee', basic: false, pro: true }, // canUseShopeeSales
]

export const FICHA_TITULO = 'Ficha técnica'
export const FICHA_NOTA = 'A mesma ficha vale na home, em /precos, no llms.txt e no pricing.md.'

export const simNao = (valor) => (valor === true ? 'Sim' : valor === false ? 'Não' : String(valor))

/**
 * A ficha em Markdown — é este bloco, byte a byte, que o llms.txt e o
 * pricing.md precisam conter (o teste compara com `includes`).
 */
export function renderFichaTecnicaMarkdown() {
  const linhas = [
    `## ${FICHA_TITULO} (canônica — idêntica na home, em /precos, no llms.txt e no pricing.md)`,
    '',
    FICHA_DEFINICAO,
    '',
    ...FICHA_FATOS.map((fato) => `- ${fato.rotulo}: ${fato.valor}`),
    '',
    `| ${FICHA_COLUNAS.join(' | ')} |`,
    `|${FICHA_COLUNAS.map(() => '---').join('|')}|`,
    ...FICHA_LINHAS.map((linha) => `| ${linha.recurso} | ${simNao(linha.basic)} | ${simNao(linha.pro)} |`),
  ]
  return linhas.join('\n')
}
