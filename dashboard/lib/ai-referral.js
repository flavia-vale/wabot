// Classificação da origem da visita (de onde a pessoa veio antes de chegar aqui).
//
// Por que existe: até agora o site não registrava origem nenhuma, então não havia
// como responder "alguém está chegando por resposta de IA?". A Cloudflare mostra
// o robô que RASTREOU o site; isso aqui mostra a PESSOA que chegou depois de ler
// uma resposta — que é o que vira lead.
//
// PRIVACIDADE (não regredir): guardamos apenas o HOST do referenciador, nunca a
// URL completa. URL de buscador costuma carregar o termo pesquisado no query
// string, e isso é dado da pessoa, não nosso. Host basta para a métrica e não
// carrega nada identificável.

// Motores de resposta por IA. A pessoa que chega por aqui leu uma resposta
// gerada e clicou na citação.
const AI_ANSWER_HOSTS = [
  ['chatgpt.com', 'chatgpt'],
  ['chat.openai.com', 'chatgpt'],
  ['openai.com', 'chatgpt'],
  ['perplexity.ai', 'perplexity'],
  ['claude.ai', 'claude'],
  ['gemini.google.com', 'gemini'],
  ['bard.google.com', 'gemini'],
  ['copilot.microsoft.com', 'copilot'],
  ['edgeservices.bing.com', 'copilot'],
  ['you.com', 'you'],
  ['phind.com', 'phind'],
  ['duckduckgo.com/aichat', 'duckassist'],
  ['grok.com', 'grok'],
  ['x.ai', 'grok'],
  ['mistral.ai', 'mistral'],
  ['poe.com', 'poe'],
  // Adicionados em 2026-09-18: chegavam como 'other' e sumiam do funil de IA.
  ['meta.ai', 'meta'],
  ['chat.deepseek.com', 'deepseek'],
  ['chat.mistral.ai', 'mistral'],
]

// Busca tradicional. Separado da IA de propósito: são funis diferentes e a
// comparação entre os dois é justamente o que queremos enxergar.
const SEARCH_HOSTS = [
  ['google.', 'google'],
  ['bing.com', 'bing'],
  ['duckduckgo.com', 'duckduckgo'],
  ['search.yahoo.com', 'yahoo'],
  ['yandex.', 'yandex'],
  ['ecosia.org', 'ecosia'],
  ['brave.com', 'brave'],
]

const SOCIAL_HOSTS = [
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['instagram.com', 'instagram'],
  ['facebook.com', 'facebook'],
  ['t.co', 'twitter'],
  ['twitter.com', 'twitter'],
  ['x.com', 'twitter'],
  ['linkedin.com', 'linkedin'],
  ['tiktok.com', 'tiktok'],
  ['reddit.com', 'reddit'],
  ['whatsapp.com', 'whatsapp'],
  ['t.me', 'telegram'],
  ['telegram.me', 'telegram'],
]

export const REFERRER_KIND = {
  AI: 'ai',
  SEARCH: 'search',
  SOCIAL: 'social',
  OTHER: 'other',
  DIRECT: 'direct',
  INTERNAL: 'internal',
}

function normalizeHost(referrer) {
  if (!referrer || typeof referrer !== 'string') return ''
  try {
    const url = new URL(referrer)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    // O caminho entra só para os poucos casos em que o host sozinho não
    // distingue (duckduckgo.com/aichat vs duckduckgo.com). Nunca guardamos ele.
    return `${url.hostname.replace(/^www\./, '')}${url.pathname}`.toLowerCase()
  } catch {
    return ''
  }
}

function matchList(hostWithPath, list) {
  for (const [needle, source] of list) {
    if (hostWithPath.startsWith(needle) || hostWithPath.includes(`.${needle}`) || hostWithPath.includes(needle)) {
      return source
    }
  }
  return ''
}

/**
 * Classifica de onde veio a visita.
 *
 * @param {string} referrer  document.referrer (URL completa — só o host é usado)
 * @param {string} currentHost  hostname do próprio site, para detectar navegação interna
 * @returns {{kind: string, source: string, host: string}}
 */
export function classifyReferrer(referrer, currentHost = '') {
  const hostWithPath = normalizeHost(referrer)
  if (!hostWithPath) return { kind: REFERRER_KIND.DIRECT, source: 'direct', host: '' }

  const host = hostWithPath.split('/')[0]
  const self = String(currentHost || '').replace(/^www\./, '').toLowerCase()
  if (self && host === self) return { kind: REFERRER_KIND.INTERNAL, source: 'internal', host }

  const ai = matchList(hostWithPath, AI_ANSWER_HOSTS)
  if (ai) return { kind: REFERRER_KIND.AI, source: ai, host }

  const search = matchList(hostWithPath, SEARCH_HOSTS)
  if (search) return { kind: REFERRER_KIND.SEARCH, source: search, host }

  const social = matchList(hostWithPath, SOCIAL_HOSTS)
  if (social) return { kind: REFERRER_KIND.SOCIAL, source: social, host }

  return { kind: REFERRER_KIND.OTHER, source: 'other', host }
}

/**
 * Só vale registrar visita que veio de fora. Navegação interna e acesso direto
 * (sem referenciador) não dizem nada sobre descoberta e só inflariam a tabela.
 */
export function shouldTrackReferral(classification) {
  if (!classification) return false
  return classification.kind !== REFERRER_KIND.INTERNAL && classification.kind !== REFERRER_KIND.DIRECT
}
