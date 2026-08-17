// Regras puras do aviso de "código de acesso venceu" (Mercado Livre / Amazon).
//
// Todas as funções são puras/determinísticas: recebem `now` como parâmetro
// (nunca leem Date.now() internamente) e não fazem I/O — testáveis db-free.
// Espelha o padrão de src/leadNurture/policy.js e sessionPersistencePolicy.js.

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Lojas com sondagem ativa de saúde da credencial (checkMercadoLivreSession /
// checkAmazonSession / checkShopeeSession). Magalu fica de fora: só tem
// etiqueta de afiliada, que não é recusada pela loja.
//
// A Shopee entrou depois (RCA ago/2026). O comentário anterior aqui dizia que
// App ID + chave secreta "não vencem sozinhos" — está ERRADO e foi o que deixou
// a loja sem cobertura: uma conta real passou dias com a chave recusada
// (`Invalid Signature`), com TODA oferta da Shopee sendo descartada e as
// ofertas automáticas paradas, sem nenhum aviso. Não voltar a tirar a Shopee
// desta lista.
export const EXPIRY_ALERT_PLATFORMS = Object.freeze(['mercadolivre', 'amazon', 'shopee'])

export const ALERT_EVENT = 'credential_expiry_alert_sent'

const DEFAULT_COOLDOWN_DAYS = 7

/**
 * Janela mínima entre dois avisos da MESMA loja para o MESMO cliente.
 * Quem ignora o aviso não pode receber e-mail todo dia — o excesso vira spam e
 * treina a pessoa a ignorar justamente o alerta que importa.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number} milissegundos
 */
export function resolveAlertCooldownMs(env = process.env) {
  const raw = Number(env.CREDENTIAL_EXPIRY_ALERT_COOLDOWN_DAYS)
  const days = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_COOLDOWN_DAYS
  return days * MS_PER_DAY
}

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Um e-mail é "real" quando tem formato válido e não é o fallback interno
 * `user_*@sistema.com` usado para contas sem e-mail informado (mesma regra do
 * welcomeEmail/leadNurture — nunca mandar e-mail para endereço fabricado).
 * @param {string} email
 * @returns {boolean}
 */
export function isRealEmail(email) {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase().endsWith('@sistema.com')) return false
  return EMAIL_FORMAT_RE.test(trimmed)
}

/**
 * Conta que não deve receber aviso: banida/suspensa não tem o que resolver no
 * painel.
 * @param {{ status?: string, email?: string }} user
 * @returns {boolean}
 */
export function isAlertableUser(user) {
  if (!user) return false
  if (user.status === 'banned' || user.status === 'suspended') return false
  return isRealEmail(user.email)
}

/**
 * A sondagem confirmou que o código venceu? SOMENTE `alive === false` conta.
 * `alive === null` é indeterminado (rede fora, 403, 429, sondagem ocupada) e
 * NUNCA pode virar aviso — um blip da loja mandaria a cliente recadastrar um
 * código que está vivo.
 * @param {{ configured?: boolean, alive?: boolean|null }|null} probe
 * @returns {boolean}
 */
export function isConfirmedExpired(probe) {
  return Boolean(probe) && probe.configured !== false && probe.alive === false
}

/**
 * Já avisamos essa loja há pouco tempo?
 * @param {{ lastAlertAt?: Date|number|string|null, now: Date|number, cooldownMs: number }} params
 * @returns {boolean}
 */
export function isWithinCooldown({ lastAlertAt, now, cooldownMs }) {
  if (!lastAlertAt) return false
  const last = new Date(lastAlertAt).getTime()
  if (!Number.isFinite(last)) return false
  return new Date(now).getTime() - last < cooldownMs
}

/**
 * Lojas que ainda podem ser SONDADAS nesta passada: as configuradas que não
 * estão em janela de silêncio. Decidir isso ANTES de sondar economiza chamada
 * à loja (e, no caso da Amazon/ML, poupa uma rotação de código de acesso) para
 * quem já foi avisado e ainda não recadastrou.
 * @param {{ platforms: string[], lastAlertByPlatform: Record<string, Date|null>, now: Date|number, cooldownMs: number }} params
 * @returns {string[]}
 */
export function platformsDueForProbe({ platforms = [], lastAlertByPlatform = {}, now, cooldownMs }) {
  return platforms.filter((platform) => (
    EXPIRY_ALERT_PLATFORMS.includes(platform)
    && !isWithinCooldown({ lastAlertAt: lastAlertByPlatform[platform], now, cooldownMs })
  ))
}
