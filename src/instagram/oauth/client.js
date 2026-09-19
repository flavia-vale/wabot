export function createInstagramOAuthClient(config, { fetchImpl = fetch } = {}) {
  async function json(url, options) {
    try {
      const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(15_000) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) throw Object.assign(new Error(body.error?.message || `Meta HTTP ${response.status}`), { code: 'META_OAUTH_FAILED', status: response.status, retryable: response.status === 429 || response.status >= 500 || body.error?.is_transient === true })
      return body
    } catch (error) {
      if (error.code === 'META_OAUTH_FAILED') throw error
      throw Object.assign(new Error('Falha de rede ao acessar a Meta'), { code: 'META_OAUTH_NETWORK', retryable: true })
    }
  }
  return Object.freeze({
    exchangeCode(code) {
      return json(config.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, grant_type: 'authorization_code', redirect_uri: config.redirectUri, code }) })
    },
    exchangeLongLived(shortToken) {
      if (config.loginMethod === 'facebook_login') {
        const query = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: config.appId, client_secret: config.appSecret, fb_exchange_token: shortToken })
        return json(`${config.graph}/${config.graphVersion}/oauth/access_token?${query}`)
      }
      const query = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: config.appSecret, access_token: shortToken })
      return json(`${config.graph}/access_token?${query}`)
    },
    async profile(token) {
      if (config.loginMethod === 'facebook_login') {
        const query = new URLSearchParams({ fields: 'id,name,instagram_business_account{id,username,account_type}', access_token: token })
        const pages = await json(`${config.graph}/${config.graphVersion}/me/accounts?${query}`)
        const accounts = (pages.data || []).map(page => page.instagram_business_account).filter(Boolean)
        if (accounts.length !== 1) throw Object.assign(new Error(accounts.length ? 'Mais de uma conta Instagram disponível; use Instagram Login' : 'Nenhuma conta Instagram profissional vinculada'), { code: 'INSTAGRAM_ACCOUNT_SELECTION_REQUIRED' })
        return accounts[0]
      }
      const query = new URLSearchParams({ fields: 'id,user_id,username,account_type', access_token: token })
      return json(`${config.graph}/${config.graphVersion}/me?${query}`)
    },
    refresh(token) {
      if (config.loginMethod === 'facebook_login') return this.exchangeLongLived(token)
      const query = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })
      return json(`${config.graph}/refresh_access_token?${query}`)
    },
  })
}
