// Acesso dos robôs de IA ao site — classificação PURA (sem rede, sem banco).
//
// Por que existe (RCA 2026-09-18): o `robots.txt` do site estava limpo
// (`Allow: /`, Managed robots.txt da Cloudflare desligado desde 2026-08-04) e a
// checagem mensal do AGENTS.md só olhava esse arquivo. Mesmo assim o site
// devolvia **403 para GPTBot e ClaudeBot** e 200 para OAI-SearchBot,
// ChatGPT-User e PerplexityBot — bloqueio feito no WAF da Cloudflare (a
// categoria "AI crawlers de treino", ligada por padrão para domínios novos), que
// nenhuma leitura de robots.txt enxerga. A checagem certa é pedir a página com
// o User-Agent de cada robô e olhar o status.
//
// O PAPEL de cada robô é o que decide a gravidade, não o nome do dono:
//  - `busca`  → alimenta o índice que a IA consulta ao responder (OAI-SearchBot
//               para o ChatGPT com busca, PerplexityBot, Googlebot/bingbot).
//               Bloqueado = a IA não consegue ler o site na hora de responder:
//               deixa de citar. É o único caso que reprova.
//  - `clique` → o robô que abre a página quando a PESSOA clica na citação
//               (ChatGPT-User, Claude-User, Perplexity-User). Bloqueado = a
//               citação existe mas o clique dá erro. Também reprova.
//  - `treino` → alimenta o próximo modelo (GPTBot, ClaudeBot, Google-Extended).
//               Bloqueado = o modelo não aprende a marca no treino; NÃO impede a
//               citação por busca. É decisão de negócio (privacidade × alcance),
//               então só avisa — nunca reprova sozinho.
//
// Fail-safe em todo caminho: sem medição confiável (rede fora, status 5xx,
// site fora do ar no controle) NÃO se afirma bloqueio. Alarme falso recorrente
// treina a pessoa a ignorar justamente este aviso.
//
// ⚠️ Limite do método: a requisição sai do NOSSO IP, não do IP do dono do robô.
// Regras da Cloudflare que checam "bot verificado" (IP + UA) podem tratar um
// UA emprestado de forma diferente do robô real. Por isso a leitura compara
// SEMPRE com um navegador comum do mesmo IP: dois UAs do mesmo IP recebendo
// 200 e 403 provam regra por categoria de UA; um 200 não prova que o robô real
// passa. A conclusão forte é o 403, nunca o 200.

export const BOT_ROLES = Object.freeze({ SEARCH: 'busca', CLICK: 'clique', TRAINING: 'treino' })

// User-Agents oficiais (formato publicado por cada dono). Não remover os três
// da OpenAI nem o PerplexityBot: são os que o placar de citação depende.
export const AI_BOT_PROFILES = Object.freeze([
  { name: 'OAI-SearchBot', owner: 'OpenAI — busca do ChatGPT', role: BOT_ROLES.SEARCH, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot' },
  { name: 'ChatGPT-User', owner: 'OpenAI — clique na citação', role: BOT_ROLES.CLICK, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot' },
  { name: 'GPTBot', owner: 'OpenAI — treino do modelo', role: BOT_ROLES.TRAINING, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot' },
  { name: 'PerplexityBot', owner: 'Perplexity — índice', role: BOT_ROLES.SEARCH, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' },
  { name: 'Perplexity-User', owner: 'Perplexity — clique na citação', role: BOT_ROLES.CLICK, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)' },
  { name: 'Claude-SearchBot', owner: 'Anthropic — busca do Claude', role: BOT_ROLES.SEARCH, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com/claude-searchbot)' },
  { name: 'Claude-User', owner: 'Anthropic — clique na citação', role: BOT_ROLES.CLICK, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +https://www.anthropic.com/claude-user)' },
  { name: 'ClaudeBot', owner: 'Anthropic — treino do modelo', role: BOT_ROLES.TRAINING, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
  { name: 'Googlebot', owner: 'Google — índice (Gemini e AI Overviews leem daqui)', role: BOT_ROLES.SEARCH, userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: 'Google-Extended', owner: 'Google — treino do Gemini', role: BOT_ROLES.TRAINING, userAgent: 'Mozilla/5.0 (compatible; Google-Extended/1.0; +https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)' },
  { name: 'bingbot', owner: 'Microsoft — índice do Bing (ChatGPT com busca e Copilot consultam)', role: BOT_ROLES.SEARCH, userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36' },
  { name: 'DuckAssistBot', owner: 'DuckDuckGo — respostas por IA', role: BOT_ROLES.SEARCH, userAgent: 'Mozilla/5.0 (compatible; DuckAssistBot/1.0; +http://duckduckgo.com/duckassistbot)' },
  { name: 'Applebot', owner: 'Apple — Siri e Spotlight', role: BOT_ROLES.SEARCH, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko; compatible; Applebot/0.1; +http://www.apple.com/go/applebot)' },
  { name: 'meta-externalagent', owner: 'Meta — treino (Llama, Meta AI)', role: BOT_ROLES.TRAINING, userAgent: 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)' },
  // Amazonbot alimenta Alexa e treino da Amazon; nenhuma das superfícies que o
  // placar mede (ChatGPT, Gemini, Perplexity, AI Overviews) depende dele — por
  // isso entra como informativo, não como reprovação.
  { name: 'Amazonbot', owner: 'Amazon — Alexa e treino (informativo)', role: BOT_ROLES.TRAINING, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/600.2.5 (KHTML, like Gecko) Version/8.0.2 Safari/600.2.5 (Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)' },
  { name: 'MistralAI-User', owner: 'Mistral — clique na citação', role: BOT_ROLES.CLICK, userAgent: 'Mozilla/5.0 (compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)' },
  { name: 'CCBot', owner: 'Common Crawl — base de treino de vários modelos', role: BOT_ROLES.TRAINING, userAgent: 'CCBot/2.0 (https://commoncrawl.org/faq/)' },
  { name: 'Bytespider', owner: 'ByteDance — treino', role: BOT_ROLES.TRAINING, userAgent: 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)' },
])

// Navegador comum: é o controle. Se ELE não passa, o site está fora do ar (ou
// barrando todo mundo) e nenhuma conclusão sobre robô vale.
export const CONTROL_PROFILE = Object.freeze({
  name: 'Navegador comum (controle)',
  owner: 'controle',
  role: 'controle',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
})

export const ACCESS_VERDICTS = Object.freeze({
  OK: 'ok',
  SEARCH_BLOCKED: 'busca_bloqueada',
  TRAINING_BLOCKED: 'treino_bloqueado',
  SITE_DOWN: 'site_fora',
  NO_DATA: 'sem_medicao',
})

function isBlockedStatus(status) {
  return status === 401 || status === 403
}

function isOkStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 400
}

/**
 * @param {{ control: { status: number|null }, bots: Array<{ name: string, role: string, status: number|null, owner?: string }> }} input
 * @param {{ trainingBlocks?: boolean }} [opts] trainingBlocks=true faz bloqueio de treino reprovar também (decisão de quem chama)
 */
export function classifyBotAccess({ control, bots = [] } = {}, { trainingBlocks = false } = {}) {
  const controlStatus = control?.status ?? null
  const result = {
    verdict: ACCESS_VERDICTS.OK,
    controlStatus,
    blockedSearch: [],
    blockedClick: [],
    blockedTraining: [],
    throttled: [],
    unmeasured: [],
    passed: [],
  }

  if (!Number.isInteger(controlStatus)) {
    result.verdict = ACCESS_VERDICTS.NO_DATA
    return result
  }
  if (!isOkStatus(controlStatus)) {
    result.verdict = ACCESS_VERDICTS.SITE_DOWN
    return result
  }

  for (const bot of bots) {
    const status = bot?.status ?? null
    const entry = { name: bot.name, role: bot.role, status, owner: bot.owner ?? '' }
    if (!Number.isInteger(status) || status >= 500) {
      result.unmeasured.push(entry)
      continue
    }
    if (status === 429) {
      result.throttled.push(entry)
      continue
    }
    if (isBlockedStatus(status)) {
      if (bot.role === BOT_ROLES.SEARCH) result.blockedSearch.push(entry)
      else if (bot.role === BOT_ROLES.CLICK) result.blockedClick.push(entry)
      else if (bot.role === BOT_ROLES.TRAINING) result.blockedTraining.push(entry)
      else result.unmeasured.push(entry)
      continue
    }
    result.passed.push(entry)
  }

  if (result.blockedSearch.length || result.blockedClick.length) {
    result.verdict = ACCESS_VERDICTS.SEARCH_BLOCKED
  } else if (result.blockedTraining.length) {
    result.verdict = trainingBlocks ? ACCESS_VERDICTS.SEARCH_BLOCKED : ACCESS_VERDICTS.TRAINING_BLOCKED
  } else if (!result.passed.length && result.unmeasured.length) {
    result.verdict = ACCESS_VERDICTS.NO_DATA
  }

  return result
}

// Texto leigo, sem jargão de WAF/UA, para o terminal e para o relatório mensal.
export function describeAccessVerdict(verdict) {
  switch (verdict) {
    case ACCESS_VERDICTS.OK:
      return 'Todos os robôs de IA conseguem ler o site.'
    case ACCESS_VERDICTS.SEARCH_BLOCKED:
      return 'Um robô que a IA usa para LER o site na hora de responder (ou para abrir a citação) está barrado. Enquanto isso durar, essa IA deixa de citar o Espelha Grupos.'
    case ACCESS_VERDICTS.TRAINING_BLOCKED:
      return 'Os robôs de BUSCA passam (a IA consegue citar), mas os robôs de TREINO estão barrados: o próximo modelo não aprende a marca. É uma escolha, não um defeito — decidir na Cloudflare.'
    case ACCESS_VERDICTS.SITE_DOWN:
      return 'O próprio navegador comum não conseguiu abrir o site — não dá para concluir nada sobre robô. Conferir o site primeiro.'
    default:
      return 'Não deu para medir (rede fora ou respostas de erro do servidor). Nenhum bloqueio afirmado.'
  }
}
