const GRAPH_VERSION_RE = /^v\d+\.\d+$/
const GRAPH_BASES = Object.freeze({
  instagram_login: 'https://graph.instagram.com',
  facebook_login: 'https://graph.facebook.com',
})

export const POC_MODE = Object.freeze({ INSPECT: 'inspect', CONTAINER: 'container', PUBLISH: 'publish' })

export class MetaPocError extends Error {
  constructor(code, message, { status = null, providerCode = null, providerSubcode = null, retryable = false } = {}) {
    super(message)
    this.name = 'MetaPocError'
    this.code = code
    this.status = status
    this.providerCode = providerCode
    this.providerSubcode = providerSubcode
    this.retryable = retryable
  }
}

function required(value, name) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new MetaPocError('INVALID_CONFIG', `${name} obrigatório`)
  return normalized
}

function sanitizeProviderError(payload, status) {
  const error = payload?.error || {}
  const providerCode = Number.isFinite(Number(error.code)) ? Number(error.code) : null
  const providerSubcode = Number.isFinite(Number(error.error_subcode)) ? Number(error.error_subcode) : null
  const retryable = status === 429 || status >= 500 || error.is_transient === true
  return new MetaPocError('META_REQUEST_FAILED', String(error.message || `Meta respondeu HTTP ${status}`).slice(0, 500), {
    status, providerCode, providerSubcode, retryable,
  })
}

export function parseMetaPocConfig(env = process.env) {
  const loginMethod = String(env.IG_LOGIN_METHOD || 'instagram_login').trim()
  if (!(loginMethod in GRAPH_BASES)) throw new MetaPocError('INVALID_CONFIG', 'IG_LOGIN_METHOD deve ser instagram_login ou facebook_login')
  const graphVersion = required(env.IG_GRAPH_API_VERSION, 'IG_GRAPH_API_VERSION')
  if (!GRAPH_VERSION_RE.test(graphVersion)) throw new MetaPocError('INVALID_CONFIG', 'IG_GRAPH_API_VERSION deve usar o formato vNN.N')
  const mode = String(env.IG_POC_MODE || POC_MODE.INSPECT).trim()
  if (!Object.values(POC_MODE).includes(mode)) throw new MetaPocError('INVALID_CONFIG', 'IG_POC_MODE deve ser inspect, container ou publish')
  const imageUrl = mode === POC_MODE.INSPECT ? null : required(env.IG_STORY_IMAGE_URL, 'IG_STORY_IMAGE_URL')
  if (imageUrl) {
    try {
      if (new URL(imageUrl).protocol !== 'https:') throw new Error('protocol')
    } catch {
      throw new MetaPocError('INVALID_CONFIG', 'IG_STORY_IMAGE_URL deve ser uma URL HTTPS válida')
    }
  }
  return Object.freeze({
    loginMethod,
    graphBaseUrl: GRAPH_BASES[loginMethod],
    graphVersion,
    instagramAccountId: required(env.IG_ACCOUNT_ID, 'IG_ACCOUNT_ID'),
    accessToken: required(env.IG_ACCESS_TOKEN, 'IG_ACCESS_TOKEN'),
    imageUrl,
    mode,
    pollIntervalMs: Math.max(1_000, Number(env.IG_POC_POLL_INTERVAL_MS) || 10_000),
    pollTimeoutMs: Math.min(5 * 60_000, Math.max(5_000, Number(env.IG_POC_POLL_TIMEOUT_MS) || 5 * 60_000)),
  })
}

export function createMetaPocClient(config, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
  const endpoint = path => `${config.graphBaseUrl}/${config.graphVersion}/${String(path).replace(/^\//, '')}`

  async function request(path, { method = 'GET', params = {} } = {}) {
    const values = new URLSearchParams({ ...params, access_token: config.accessToken })
    const url = method === 'GET' ? `${endpoint(path)}?${values}` : endpoint(path)
    let response
    try {
      response = await fetchImpl(url, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : undefined,
        body: method === 'POST' ? values : undefined,
        signal: AbortSignal.timeout(20_000),
      })
    } catch (error) {
      throw new MetaPocError('META_NETWORK_ERROR', String(error?.message || 'Falha de rede com a Meta').slice(0, 300), { retryable: true })
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.error) throw sanitizeProviderError(payload, response.status)
    return payload
  }

  return Object.freeze({
    inspectAccount: () => request(config.instagramAccountId, { params: { fields: 'id,username,account_type' } }),
    inspectPublishingLimit: () => request(`${config.instagramAccountId}/content_publishing_limit`, { params: { fields: 'quota_usage,config' } }),
    createStoryContainer: () => request(`${config.instagramAccountId}/media`, { method: 'POST', params: { media_type: 'STORIES', image_url: config.imageUrl } }),
    getContainer: id => request(id, { params: { fields: 'id,status_code,status' } }),
    publishContainer: id => request(`${config.instagramAccountId}/media_publish`, { method: 'POST', params: { creation_id: id } }),
    async waitForContainer(id) {
      const deadline = now() + config.pollTimeoutMs
      while (now() <= deadline) {
        const container = await this.getContainer(id)
        if (container.status_code === 'FINISHED') return container
        if (['ERROR', 'EXPIRED', 'PUBLISHED'].includes(container.status_code)) {
          throw new MetaPocError(`CONTAINER_${container.status_code}`, `Container terminou em ${container.status_code}`)
        }
        await sleep(config.pollIntervalMs)
      }
      throw new MetaPocError('CONTAINER_TIMEOUT', 'Container não ficou pronto dentro de 5 minutos', { retryable: true })
    },
  })
}

export async function runMetaStoryPoc(config, dependencies = {}) {
  const client = createMetaPocClient(config, dependencies)
  const report = { mode: config.mode, graphVersion: config.graphVersion, loginMethod: config.loginMethod, account: null, publishingLimit: null, container: null, media: null }
  report.account = await client.inspectAccount()
  report.publishingLimit = await client.inspectPublishingLimit()
  if (config.mode === POC_MODE.INSPECT) return report
  const created = await client.createStoryContainer()
  if (!created?.id) throw new MetaPocError('INVALID_META_RESPONSE', 'Meta não retornou o ID do container')
  report.container = await client.waitForContainer(created.id)
  if (config.mode === POC_MODE.CONTAINER) return report
  report.media = await client.publishContainer(created.id)
  if (!report.media?.id) throw new MetaPocError('INVALID_META_RESPONSE', 'Meta não retornou o ID da mídia publicada')
  return report
}
