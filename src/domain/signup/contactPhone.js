// Normalização do celular informado no cadastro.
//
// Módulo PURO: sem banco, sem rede.
//
// POR QUE EXISTE (medido em 2026-09-09): a função anterior só tirava a
// pontuação e punha `+` na frente. Quem digitava "(11) 95391-5457" virava
// `+11953915457` — que no WhatsApp é a Rússia, não São Paulo. Numa amostra de
// 33 cadastros recentes, **25 números ficaram impossíveis de discar**. Isso
// anula justamente o motivo de o celular ser obrigatório no cadastro: poder
// procurar a cliente quando ela trava na configuração.
//
// A REGRA É POR COMPRIMENTO, NUNCA PELO PREFIXO. Parece natural dizer "se já
// começa com 55, não mexe" — e isso quebra o DDD 55 (Santa Maria e região):
// `5599998888` são 10 dígitos de um número nacional que começa com 55 e
// PRECISA do país na frente. Contar dígitos separa os dois casos sem ambiguidade:
//
//   10 ou 11 dígitos  → nacional sem país (DDD + 8 ou 9 dígitos) → prefixa 55
//   12 ou 13 com 55   → já tem o país → mantém
//   qualquer outro    → número estrangeiro ou fora de padrão → mantém como veio
//
// A última linha é deliberada: não sabemos o plano de numeração do resto do
// mundo, e inventar um país para o número de uma cliente é pior que deixá-lo
// como ela digitou.

/** Código do país que assumimos quando o número vem sem ele. */
export const DEFAULT_COUNTRY_CODE = '55'

/** Comprimentos de um número BRASILEIRO já com o país na frente. */
const BR_WITH_COUNTRY_LENGTHS = new Set([12, 13])
/** Comprimentos de um número brasileiro SEM o país (DDD + 8 ou 9 dígitos). */
const BR_WITHOUT_COUNTRY_LENGTHS = new Set([10, 11])

/**
 * @param {string} rawPhone
 * @param {{ countryCode?: string }} [options]
 * @returns {string|null} `+<dígitos>` ou `null` quando não parece telefone
 */
export function normalizeContactPhone(rawPhone, { countryCode = DEFAULT_COUNTRY_CODE } = {}) {
  const digits = String(rawPhone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length < 10 || digits.length > 15) return null

  if (BR_WITHOUT_COUNTRY_LENGTHS.has(digits.length)) {
    return `+${countryCode}${digits}`
  }
  return `+${digits}`
}

/**
 * O número já gravado precisa de conserto?
 *
 * Usado pela varredura das linhas antigas. Devolve o valor corrigido só quando
 * há o que corrigir — e **nunca** inventa país para número estrangeiro.
 */
export function fixStoredContactPhone(stored, { countryCode = DEFAULT_COUNTRY_CODE } = {}) {
  const digits = String(stored ?? '').replace(/\D/g, '')
  if (!digits) return { changed: false, value: stored ?? null, reason: 'vazio' }
  if (BR_WITH_COUNTRY_LENGTHS.has(digits.length) && digits.startsWith(countryCode)) {
    return { changed: false, value: `+${digits}`, reason: 'ja_tem_pais' }
  }
  if (BR_WITHOUT_COUNTRY_LENGTHS.has(digits.length)) {
    return { changed: true, value: `+${countryCode}${digits}`, reason: 'faltava_o_pais' }
  }
  return { changed: false, value: `+${digits}`, reason: 'fora_do_padrao_brasileiro' }
}
