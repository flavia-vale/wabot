const LOGIN = Object.freeze({
  instagram_login: { auth: 'https://www.instagram.com/oauth/authorize', token: 'https://api.instagram.com/oauth/access_token', graph: 'https://graph.instagram.com', scopes: ['instagram_business_basic', 'instagram_business_content_publish'] },
  facebook_login: { auth: 'https://www.facebook.com/dialog/oauth', token: 'https://graph.facebook.com/oauth/access_token', graph: 'https://graph.facebook.com', scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'] },
})

export function instagramOAuthConfig(env = process.env) {
  const loginMethod = String(env.INSTAGRAM_LOGIN_METHOD || 'instagram_login')
  const provider = LOGIN[loginMethod]
  if (!provider) throw new Error('INSTAGRAM_LOGIN_METHOD inválido')
  const appId = String(env.INSTAGRAM_APP_ID || '').trim()
  const appSecret = String(env.INSTAGRAM_APP_SECRET || '').trim()
  const redirectUri = String(env.INSTAGRAM_REDIRECT_URI || '').trim()
  const graphVersion = String(env.INSTAGRAM_GRAPH_API_VERSION || '').trim()
  if (!appId || !appSecret || !redirectUri || !/^v\d+\.\d+$/.test(graphVersion)) throw new Error('Configuração OAuth do Instagram incompleta')
  if (new URL(redirectUri).protocol !== 'https:' && env.NODE_ENV !== 'test') throw new Error('INSTAGRAM_REDIRECT_URI deve usar HTTPS')
  return Object.freeze({ loginMethod, appId, appSecret, redirectUri, graphVersion, ...provider })
}

export function buildInstagramAuthorizationUrl(config, state) {
  const url = new URL(config.auth)
  url.search = new URLSearchParams({ client_id: config.appId, redirect_uri: config.redirectUri, response_type: 'code', scope: config.scopes.join(','), state }).toString()
  return url.toString()
}
