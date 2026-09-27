// Os 3 modelos de automação para afiliadas no WhatsApp e quem cobre cada um.
//
// Origem (PLANO_SEO_GEO_2026-09-27, §3 e B7): a Perplexity classifica o
// mercado em três modelos — espelhador de grupos, garimpo/curadoria automática
// e formatador/divulgador — e é essa taxonomia que as IAs usam para decidir
// quem citar. O Espelha Grupos tem os três, mas nenhuma página dizia isso com
// essa palavra. Este módulo é a fonte única para o hub
// /automacao-whatsapp-afiliados e para a tabela em /bot-afiliados-whatsapp.
//
// Regras que este arquivo obedece:
// - Cada afirmação sobre o NOSSO produto tem a fonte no código, ao lado.
// - Cada afirmação sobre concorrente sai da FICHA em competitors-data.js
//   (positioning, tiers, strengths, weaknesses). Se a ficha não diz, a célula
//   fica "—". Nada é inferido do site do concorrente aqui.
// - Preço de concorrente só com ficha datada: o preço e a data saem da ficha
//   em tempo de render (nunca digitados aqui). `citePrice: false` deixa a
//   célula em "—" mesmo com preço na ficha (decisão da dona do produto para o
//   Shozap em 27/09/2026: o preço dele não é visível na página pública).
import { getCompetitorBySlug } from './competitors-data'
import { formatDatePtBr } from './editorial-content'
import { DEFAULT_LANDING_PLANS, SUPPORTED_STORES } from './marketing-content'

const basicPlan = DEFAULT_LANDING_PLANS.find((plan) => plan.id === 'basic')
const proPlan = DEFAULT_LANDING_PLANS.find((plan) => plan.id === 'pro')

export const BASIC_PRICE_LABEL = `${basicPlan.price} por ${basicPlan.period}`
export const PRO_PRICE_LABEL = `${proPlan.price} por ${proPlan.period}`

/**
 * Os três modelos. `ours` diz o que o Espelha Grupos tem em cada um, com a
 * fonte no código:
 * - espelhador: canUseGroups (Basic e Pro) em src/billing/plans.js
 * - garimpo: canUseOfferAutomations (Pro) + minDiscountPct — só Shopee
 * - formatador: /painel/criar-oferta → POST /api/link-conversion/scrape-offer,
 *   rota só com `authenticate` (sem gate de plano); a fila é que é Pro.
 */
export const AUTOMATION_MODELS = [
  {
    id: 'espelhador',
    name: 'Espelhador de grupos',
    what: 'Acompanha os grupos e canais de ofertas que você já segue e republica cada oferta nos seus, com o link trocado pelo seu código de afiliada.',
    bestFor: 'Quem já acompanha bons grupos de origem e perde tempo copiando e colando oferta por oferta.',
    notIdealFor: 'Quem não segue nenhum grupo de ofertas: sem origem, não há o que espelhar.',
    ours: `Sim, nos planos Basic (${BASIC_PRICE_LABEL}) e Pro (${PRO_PRICE_LABEL}), em ${SUPPORTED_STORES.length} lojas. Canais do WhatsApp como origem e destino só no Pro.`,
  },
  {
    id: 'garimpo',
    name: 'Garimpo automático (curadoria)',
    what: 'O robô procura a oferta sozinho na loja, pelo tema e pelo desconto mínimo que você define, e publica sem depender de grupo de origem.',
    bestFor: 'Quem quer um fluxo constante de ofertas de um tema (perfume, cozinha, bebê) sem acompanhar grupo nenhum.',
    notIdealFor: 'Quem divulga lojas onde a ferramenta não busca: no Espelha Grupos, a busca sozinha é só na Shopee.',
    ours: `Sim, no plano Pro (${PRO_PRICE_LABEL}): ofertas automáticas da Shopee por palavra-chave e desconto mínimo. Nas outras lojas, o robô converte o link que chega dos grupos.`,
  },
  {
    id: 'formatador',
    name: 'Formatador / divulgador',
    what: 'Você cola o link do produto e a ferramenta monta a oferta (título, preço, foto e texto) pronta para publicar nos seus grupos.',
    bestFor: 'Quem escolhe a oferta na mão e quer só ganhar tempo na montagem e no envio.',
    notIdealFor: 'Quem quer que a ferramenta ache a oferta ou repasse o que já circula: formatador sozinho não faz nenhum dos dois.',
    ours: `Sim, nos planos Basic e Pro: "Criar oferta" monta a oferta a partir de um link colado, com envio imediato ou agendado. Fila de envio é do Pro.`,
  },
]

/**
 * O que a FICHA de cada concorrente diz sobre cada modelo. `null` = a ficha
 * não informa (vira "—"). Texto curto, sempre rastreável a um trecho da ficha
 * (citado no comentário).
 */
export const COMPETITOR_MODEL_COVERAGE = [
  {
    slug: 'afilira',
    href: '/alternativas/afilira',
    // positioning: "BUSCA ofertas automaticamente em grupos e nas lojas";
    // weaknesses: "O envio de um grupo específico para outro — o espelhamento —
    // aparece só a partir do Professional, de R$ 97/mês".
    espelhador: 'Sim, a partir do Professional (R$ 97/mês)',
    garimpo: 'Sim, em grupos e nas lojas',
    formatador: null,
    stores: 'Shopee, Amazon, Mercado Livre e Magalu; Awin, Terabyte e SHEIN a partir do Professional',
    freeTrial: null, // a ficha não fala em teste grátis
    entryTier: 'Starter',
  },
  {
    slug: 'achadinho-pro',
    href: '/alternativas/achadinho-pro',
    // positioning: "IA para selecionar produtos e gerar links de Shopee,
    // Mercado Livre e Amazon automaticamente"; tiers: "IA de pesquisa".
    espelhador: null,
    garimpo: 'Sim, IA de pesquisa seleciona produtos',
    formatador: null,
    stores: 'Shopee no Basic; Shopee, Mercado Livre e Amazon no Pro',
    freeTrial: 'A página de preços não indica teste grátis', // weaknesses
    entryTier: 'Basic',
  },
  {
    slug: 'proafiliados-com',
    href: '/alternativas/proafiliados',
    // tiers: "Grupos ilimitados, monitoramento 24/7, 5 plataformas, feed
    // global" — a ficha não diz o que é monitorado nem de onde vem o feed.
    espelhador: null,
    garimpo: null,
    formatador: null,
    stores: '5 plataformas (a ficha não as nomeia)',
    freeTrial: 'Plano grátis permanente, com a tag "proafiliados" nas mensagens', // tiers
    entryTier: 'Grátis',
  },
  {
    slug: 'shozap',
    href: '/alternativas/shozap',
    // tiers: "1 monitoramento de grupos" no Básico.
    espelhador: 'Sim, monitoramento de grupos (1 no plano de entrada)',
    garimpo: null,
    formatador: null,
    stores: 'Shopee no Básico; Mercado Livre e Amazon a partir do Intermediário; SHEIN e Magalu no Elite',
    freeTrial: 'Botão "Começar grátis", sem limites detalhados na tela consultada', // source
    entryTier: 'Básico',
    citePrice: false,
  },
  {
    slug: 'ofertiva',
    href: '/alternativas/ofertiva',
    // tiers: "1 grupo espelhado" (Essencial), 3 (Profissional), 6 (Escala).
    espelhador: 'Sim, com teto: 1, 3 ou 6 grupos espelhados por plano',
    garimpo: null,
    formatador: null,
    stores: 'Shopee, Mercado Livre, Amazon, SHEIN e AliExpress (sem Magalu)',
    freeTrial: 'Garantia de 7 dias', // strengths
    entryTier: 'Essencial',
  },
  {
    slug: 'divulga-links',
    href: '/alternativas/divulgalinks',
    // positioning: "Cria o post a partir do link do produto"; strengths:
    // "Listas de produtos geradas automaticamente por categoria ou
    // palavra-chave"; weaknesses: "não menciona monitorar um grupo de origem e
    // espelhar o que é publicado nele".
    espelhador: 'Não consta na página de planos consultada',
    garimpo: 'Sim, listas por categoria ou palavra-chave',
    formatador: 'Sim, cria o post a partir do link',
    stores: 'AliExpress, Amazon, Awin (algumas lojas), Shopee, Magazine Luiza, Mercado Livre e Natura',
    freeTrial: '7 dias grátis no Starter', // tiers
    entryTier: 'Prime', // o Starter não tem preço na página consultada
  },
  {
    slug: 'lucreshop',
    href: '/alternativas/lucreshop',
    // positioning: "bot de nicho (busca e publica sozinho), espelhamento de
    // grupos, campanhas".
    espelhador: 'Sim, 1 espelhamento no plano de entrada',
    garimpo: 'Sim, bot de nicho busca e publica sozinho',
    formatador: null,
    stores: 'Amazon, Shopee, Mercado Livre e Magalu',
    freeTrial: '3 dias grátis, sem cartão', // tiers
    entryTier: 'Meu Primeiro Grupo',
  },
  {
    slug: 'gigi-bot',
    href: '/alternativas/gigi-bot',
    // tiers: "Conversão automática de links de 9 lojas, texto de disparo
    // customizável por loja, template de story"; "espelhamento de grupos" só
    // no Gigi Prime Bot; autoenvio para WhatsApp só nesse plano.
    espelhador: 'Sim, só no Gigi Prime Bot (plano mais caro)',
    garimpo: null,
    formatador: 'Sim, converte o link e monta o texto de disparo por loja',
    stores: 'Shopee, Mercado Livre, Magalu, AliExpress, Kabum, Terabyte, Natura, SHEIN e Temu; Amazon a partir do 3º plano',
    freeTrial: 'Plano gratuito permanente (sem envio automático para WhatsApp)', // tiers
    entryTier: 'Guru das Promoções Bot',
  },
]

export const OUR_MODEL_COVERAGE = {
  name: 'Espelha Grupos',
  href: '/precos',
  espelhador: 'Sim, Basic e Pro, sem teto de grupos',
  garimpo: 'Sim, Shopee por tema e desconto mínimo (Pro)',
  formatador: 'Sim, "Criar oferta" a partir do link (Basic e Pro)',
  stores: `${SUPPORTED_STORES.length} lojas: ${SUPPORTED_STORES.join(', ')}`,
  freeTrial: '7 dias grátis com o Pro completo, sem cartão',
  entryPrice: `${BASIC_PRICE_LABEL} (Basic)`,
}

/**
 * Monta as linhas da tabela lendo a ficha em tempo de render. Preço e data
 * vêm de `pricingTiers` e `verifiedAt`; se a ficha não tiver o tier, ou se
 * `citePrice` for false, a célula fica "—".
 */
export function buildCompetitorModelRows(slugs = COMPETITOR_MODEL_COVERAGE.map((item) => item.slug)) {
  return slugs.map((slug) => {
    const coverage = COMPETITOR_MODEL_COVERAGE.find((item) => item.slug === slug)
    const ficha = getCompetitorBySlug(slug)
    if (!coverage || !ficha) throw new Error(`Concorrente sem ficha ou sem cobertura de modelo: ${slug}`)
    const tier = ficha.pricingTiers.find((item) => item.name === coverage.entryTier)
    const entryPrice =
      coverage.citePrice === false || !tier
        ? '—'
        : `${tier.price} (${tier.name}, ficha de ${formatDatePtBr(ficha.verifiedAt)})`
    return {
      slug,
      name: ficha.name,
      href: coverage.href,
      espelhador: coverage.espelhador ?? '—',
      garimpo: coverage.garimpo ?? '—',
      formatador: coverage.formatador ?? '—',
      stores: coverage.stores ?? '—',
      freeTrial: coverage.freeTrial ?? '—',
      entryPrice,
      verifiedAt: ficha.verifiedAt,
    }
  })
}
