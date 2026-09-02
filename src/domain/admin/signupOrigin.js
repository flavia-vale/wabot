/**
 * De onde veio o cadastro — classificação PURA, sem banco.
 *
 * A mesma regra é usada pelo diagnóstico de linha de comando
 * (`scripts/diag-origem-cadastros.mjs`) e pelo painel de funil do admin. Ficar
 * em um lugar só evita a situação clássica de o script e a tela discordarem
 * sobre quantos cadastros vieram de conteúdo.
 *
 * ⚠️ Atribuição é aproximação, não verdade:
 * - "direto" NÃO significa "veio sozinho": quem achou no Google, fechou e
 *   voltou dias depois digitando o endereço aparece como direto, e o SEO fica
 *   sem crédito;
 * - `landing_page` (primeira página da sessão, cookie de primeiro toque) é o
 *   sinal mais honesto — ninguém digita `/blog/...` de cabeça;
 * - o sanitizador de atribuição troca `?` e `=` por `-`, então a query vira
 *   parte do caminho. Cortar em `?` não basta.
 */

function cleanLanding(landing) {
  return String(landing || '')
    .split('?')[0]
    .replace(/-utm[-_].*$/, '')
    .replace(/-source-.*$/, '')
}

/**
 * Marca de IA: ao clicar num link dentro do ChatGPT/Perplexity, a própria
 * ferramenta carimba `utm_source`. É o rastro de origem mais confiável que
 * existe hoje — vale mais que o referenciador.
 */
const AI_MARKS = /utm[-_]source[-_=](chatgpt|openai|perplexity|copilot|claude|gemini)/i

export function detectAiSource(landing) {
  const match = String(landing || '').match(AI_MARKS)
  return match ? match[1].toLowerCase() : null
}

export function classifyLandingPage(landing) {
  const path = cleanLanding(landing)
  if (!path) return 'sem registro'
  if (path.startsWith('/blog/')) return 'CONTEÚDO (blog)'
  if (path.startsWith('/alternativas/')) return 'CONTEÚDO (comparativo)'
  if (path.startsWith('/materiais/') || path.startsWith('/ferramentas/')) return 'CONTEÚDO (ferramenta/material)'
  // Ao adicionar prefixo aqui, conferir contra a lista real de rotas
  // (`dashboard/lib/seo-registry.mjs`), nunca de memória.
  if (/^\/(bot-|anti-ban|faq-antiban|protecao-|programa-de-afiliados|espelhar-|automacao-|automatizar-|padronizar-|postar-|reduzir-|rastrear-|grupo-para-canal|como-funciona|comparativos|melhores-bots|botinho-vs|glossario|conteudos|diagnostico-|benchmarks|estudos-de-caso)/.test(path)) {
    return 'CONTEÚDO (página de busca)'
  }
  if (path === '/') return 'home (ambíguo)'
  if (path.startsWith('/login') || path.startsWith('/cadastro')) return 'direto no cadastro (ambíguo)'
  if (path.startsWith('/r/')) return 'link de indicação'
  return `outro: ${path}`
}

/**
 * Balde de origem para a tela. Poucos baldes de propósito: uma tabela com 40
 * origens diferentes não responde "onde investir".
 *
 * @param {object} metadata metadata já parseado do evento `signup_created`
 * @returns {{ bucket: string, aiSource: string|null, landingClass: string, declared: string }}
 */
export function resolveSignupOrigin(metadata = {}) {
  const landing = metadata?.landing_page ?? null
  const aiSource = detectAiSource(landing)
  const landingClass = classifyLandingPage(landing)
  const declared = String(metadata?.utm_source || metadata?.source || 'direto')

  let bucket
  if (aiSource) bucket = `IA (${aiSource})`
  else if (/^(chatgpt|openai|perplexity|copilot|claude|gemini)/i.test(declared)) bucket = `IA (${declared.split('.')[0].toLowerCase()})`
  else if (landingClass.startsWith('CONTEÚDO')) bucket = 'Conteúdo (busca)'
  else if (landingClass === 'link de indicação' || metadata?.ref) bucket = 'Indicação'
  else if (landingClass === 'sem registro') bucket = 'Sem registro'
  else bucket = 'Direto / ambíguo'

  return { bucket, aiSource, landingClass, declared }
}
