export class InstagramPublishingError extends Error {
  constructor(code, message, { retryable = false, ambiguous = false, status = null } = {}) {
    super(message); this.code = code; this.retryable = retryable; this.ambiguous = ambiguous; this.status = status
  }
}

export function createInstagramPublishingClient(config, accessToken, { fetchImpl = fetch } = {}) {
  const base = `${config.graph}/${config.graphVersion}`
  async function request(path, { method = 'GET', params = {}, ambiguous = false } = {}) {
    const values = new URLSearchParams({ ...params, access_token: accessToken })
    try {
      const response = await fetchImpl(method === 'GET' ? `${base}/${path}?${values}` : `${base}/${path}`, { method, headers: method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : undefined, body: method === 'POST' ? values : undefined, signal: AbortSignal.timeout(20_000) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) throw new InstagramPublishingError('META_PUBLISH_FAILED', String(body.error?.message || `Meta HTTP ${response.status}`).slice(0, 500), { status: response.status, retryable: response.status === 429 || response.status >= 500 || body.error?.is_transient === true, ambiguous })
      return body
    } catch (error) {
      if (error instanceof InstagramPublishingError) throw error
      throw new InstagramPublishingError('META_NETWORK_ERROR', 'Falha de rede com a Meta', { retryable: true, ambiguous })
    }
  }
  return Object.freeze({
    publishingLimit: accountId => request(`${accountId}/content_publishing_limit`, { params: { fields: 'quota_usage,config' } }),
    createContainer: (accountId, imageUrl) => request(`${accountId}/media`, { method: 'POST', params: { media_type: 'STORIES', image_url: imageUrl } }),
    getContainer: id => request(id, { params: { fields: 'id,status_code,status' } }),
    publish: (accountId, creationId) => request(`${accountId}/media_publish`, { method: 'POST', params: { creation_id: creationId }, ambiguous: true }),
  })
}
