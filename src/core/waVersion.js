/**
 * Resolução da versão do WhatsApp Web anunciada no handshake do Baileys.
 *
 * RCA 2026-07-28 (todas as sessões, prod E staging, caindo com `failure
 * reason=405`): o Baileys anuncia a versão do WA Web que está no ARQUIVO DO
 * REPOSITÓRIO DELE (`fetchLatestBaileysVersion()` busca
 * `raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json`).
 * Esse arquivo ficou preso em `2.3000.1035194821` — uma build que **não existe**
 * na lista real de versões do WA Web. Quando o WhatsApp expirou a faixa antiga
 * (27/07/2026), o servidor passou a responder `<failure reason="405">` a todo
 * login/registro: nenhuma sessão conecta, nenhum QR nasce, nenhum código de
 * pareamento é aceito. Não é bloqueio de número nem credencial corrompida — é
 * a versão anunciada.
 *
 * Ordem de resolução (primeira que der certo vence):
 *   1. `WA_WEB_VERSION` — pin manual. É o botão de emergência: quando o
 *      WhatsApp cortar a versão de novo, dá pra fixar uma boa no `.env` e
 *      reiniciar, SEM redeploy.
 *   2. Registro público de versões reais do WA Web (wppconnect/wa-version), que
 *      é atualizado de hora em hora a partir do próprio web.whatsapp.com.
 *   3. `fetchLatestBaileysVersion()` — o comportamento histórico, agora como
 *      penúltimo recurso em vez de fonte única.
 *   4. Última versão que funcionou neste processo (cache em memória).
 *
 * Módulo PURO: todo I/O entra por injeção (`fetchRegistry`,
 * `fetchBaileysVersion`), então o teste roda sem rede e sem banco.
 */

/**
 * Código do `<failure reason="405">` do WhatsApp. Não existe no
 * `DisconnectReason` do Baileys — o Baileys repassa o número cru do nó de
 * falha —, então o valor mora aqui junto da lógica de versão, que é a causa
 * observada em campo para esse código.
 */
export const WA_FAILURE_VERSION_REJECTED = 405

export const WA_VERSION_REGISTRY_URL_DEFAULT =
  'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json'

/**
 * Aceita as formas em que a versão aparece na natureza:
 *   "2.3000.1044015310", "2.3000.1044015310-alpha", "[2,3000,1044015310]",
 *   "2, 3000, 1044015310" e o próprio array já parseado.
 * Devolve `[major, minor, patch]` ou `null` quando não dá pra confiar no valor.
 */
export function parseWaVersion(raw) {
  if (Array.isArray(raw)) {
    const nums = raw.map(Number)
    return nums.length === 3 && nums.every(n => Number.isInteger(n) && n >= 0) ? nums : null
  }
  if (typeof raw !== 'string') return null
  // Corta qualquer sufixo de canal ("-alpha", "-beta") antes de ler os números:
  // o WhatsApp só recebe a tripla numérica no handshake.
  const match = raw.trim().match(/(\d+)\D+(\d+)\D+(\d+)/)
  if (!match) return null
  const nums = [Number(match[1]), Number(match[2]), Number(match[3])]
  return nums.every(n => Number.isInteger(n) && n >= 0) ? nums : null
}

/**
 * Escolhe a versão vigente dentro do payload do registro.
 *
 * Prefere `currentVersion`, mas só se ela ainda não expirou segundo a própria
 * lista — o registro carrega `expire` por build, e usar uma build expirada é
 * exatamente o que produz o 405. Se `currentVersion` estiver ausente ou
 * expirada, cai na build não-expirada mais recente por `released`.
 */
export function pickCurrentVersionFromRegistry(payload, { now = Date.now() } = {}) {
  if (!payload || typeof payload !== 'object') return null
  const versions = Array.isArray(payload.versions) ? payload.versions : []

  const isAlive = entry => {
    if (!entry?.expire) return true
    const expireAt = Date.parse(entry.expire)
    return Number.isNaN(expireAt) ? true : expireAt > now
  }

  const current = typeof payload.currentVersion === 'string' ? payload.currentVersion : null
  if (current) {
    const entry = versions.find(v => v?.version === current)
    // Sem entrada correspondente não dá pra checar validade — confiamos no
    // `currentVersion`, que é o que o registro anuncia como vigente.
    if (!entry || isAlive(entry)) return parseWaVersion(current)
  }

  const alive = versions
    .filter(v => typeof v?.version === 'string' && isAlive(v))
    .sort((a, b) => (Date.parse(b?.released || 0) || 0) - (Date.parse(a?.released || 0) || 0))

  return alive.length ? parseWaVersion(alive[0].version) : null
}

/**
 * @param {object} deps
 * @param {string}   [deps.envValue]            valor de `WA_WEB_VERSION`
 * @param {string}   [deps.registryUrl]         URL do registro ('' desliga a fonte)
 * @param {Function} [deps.fetchRegistry]       (url) => Promise<payload JSON>
 * @param {Function} [deps.fetchBaileysVersion] () => Promise<{version:number[]}>
 * @param {number[]} [deps.cached]              última versão boa deste processo
 * @param {object}   [deps.logger]              pino-like (warn)
 * @returns {Promise<{version:number[], source:string}>}
 */
export async function resolveWaWebVersion({
  envValue,
  registryUrl = WA_VERSION_REGISTRY_URL_DEFAULT,
  fetchRegistry,
  fetchBaileysVersion,
  cached = null,
  logger = null,
  now = Date.now(),
} = {}) {
  const pinned = parseWaVersion(envValue)
  if (pinned) return { version: pinned, source: 'env' }
  if (envValue) {
    logger?.warn?.({ envValue }, 'WA_WEB_VERSION inválida — ignorando e seguindo para as outras fontes')
  }

  if (registryUrl && typeof fetchRegistry === 'function') {
    try {
      const payload = await fetchRegistry(registryUrl)
      const fromRegistry = pickCurrentVersionFromRegistry(payload, { now })
      if (fromRegistry) return { version: fromRegistry, source: 'registry' }
      logger?.warn?.({ registryUrl }, 'Registro de versões do WA Web não trouxe versão utilizável')
    } catch (err) {
      logger?.warn?.({ err: err?.message, registryUrl }, 'Falha ao consultar registro de versões do WA Web')
    }
  }

  if (typeof fetchBaileysVersion === 'function') {
    try {
      const { version } = await fetchBaileysVersion()
      const parsed = parseWaVersion(version)
      if (parsed) return { version: parsed, source: 'baileys' }
    } catch (err) {
      logger?.warn?.({ err: err?.message }, 'fetchLatestBaileysVersion falhou')
    }
  }

  const fallback = parseWaVersion(cached)
  if (fallback) return { version: fallback, source: 'cache' }

  throw new Error('Não foi possível resolver a versão do WhatsApp Web (env, registro, Baileys e cache falharam)')
}
