// Modo do token do Mercado Pago (teste x produção). Módulo PURO/testável:
// NÃO importa db, rede nem process.env — quem lê a env é a rota.
//
// RCA 2026-09: token de SANDBOX rodando em produção faz o Mercado Pago recusar
// TODO cartão real, com a mesma tela de "Seu pagamento foi recusado" que uma
// recusa legítima do banco. Sem essa checagem, a diferença entre "o cartão da
// cliente não passou" e "o servidor está com a chave de teste" só aparecia
// abrindo o `.env` no VPS — e o time procurava defeito no cartão da cliente.
//
// O MP prefixa os tokens: `TEST-...` é sandbox e `APP_USR-...` é produção.

const TEST_TOKEN_PREFIX = 'TEST-'
const LIVE_TOKEN_PREFIX = 'APP_USR-'

/**
 * @returns {'missing'|'test'|'live'|'unknown'}
 */
export function classifyMpAccessTokenMode(token) {
  const value = typeof token === 'string' ? token.trim() : ''
  if (!value) return 'missing'
  if (value.startsWith(TEST_TOKEN_PREFIX)) return 'test'
  if (value.startsWith(LIVE_TOKEN_PREFIX)) return 'live'
  return 'unknown'
}

/**
 * Token de teste em produção é erro de configuração, não recusa de cartão.
 * `unknown` NÃO acusa: prefixo novo do MP não pode virar alarme falso — alarme
 * falso recorrente treina a pessoa a ignorar justamente este aviso.
 */
export function isSandboxTokenInProduction({ token, isProduction } = {}) {
  return Boolean(isProduction) && classifyMpAccessTokenMode(token) === 'test'
}

/**
 * Frase para a cliente quando o pagamento é recusado. Linguagem leiga
 * obrigatória: nada de "sandbox", "token", "gateway" na tela.
 */
export const SANDBOX_TOKEN_USER_MESSAGE =
  'O pagamento não pôde ser concluído por uma configuração nossa, não pelo seu cartão. Já estamos avisados — fale com o suporte para liberarmos o seu acesso.'
