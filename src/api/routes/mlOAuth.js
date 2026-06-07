import db from '../../db.js'

function buildMlAuthUrl(clientId, state, redirectUri) {
  const authUrl = new URL('https://auth.mercadolivre.com.br/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  return authUrl.toString()
}

export async function mlOAuthRoutes(app) {
  app.get('/ml-oauth/start-url', { onRequest: [app.authenticate] }, async (req, reply) => {
    const clientId = process.env.ML_CLIENT_ID
    if (!clientId) return reply.code(503).send({ error: 'ML_CLIENT_ID não configurado' })

    const state = app.jwt.sign({ userId: req.user.sub, p: 'ml_oauth' }, { expiresIn: '10m' })
    const redirectUri = `${process.env.DASHBOARD_URL}/api/auth/ml-oauth/callback`
    return { url: buildMlAuthUrl(clientId, state, redirectUri) }
  })

  app.get('/ml-oauth/start', { onRequest: [app.authenticate] }, async (req, reply) => {
    const clientId = process.env.ML_CLIENT_ID
    if (!clientId) return reply.code(503).send({ error: 'ML_CLIENT_ID não configurado' })

    const state = app.jwt.sign({ userId: req.user.sub, p: 'ml_oauth' }, { expiresIn: '10m' })
    const redirectUri = `${process.env.DASHBOARD_URL}/api/auth/ml-oauth/callback`
    return reply.redirect(buildMlAuthUrl(clientId, state, redirectUri))
  })

  app.get('/ml-oauth/callback', async (req, reply) => {
    const { code, state, error: oauthError } = req.query
    const errorRedirect = `${process.env.DASHBOARD_URL || ''}/m/config/credentials?ml_oauth=error`

    if (oauthError || !code || !state) return reply.redirect(errorRedirect)

    const clientId = process.env.ML_CLIENT_ID
    const clientSecret = process.env.ML_CLIENT_SECRET
    if (!clientId || !clientSecret) return reply.redirect(errorRedirect)

    let statePayload
    try {
      statePayload = app.jwt.verify(state)
    } catch {
      return reply.redirect(errorRedirect)
    }

    if (statePayload?.p !== 'ml_oauth' || !statePayload?.userId) return reply.redirect(errorRedirect)

    const redirectUri = `${process.env.DASHBOARD_URL}/api/auth/ml-oauth/callback`
    let tokenData
    try {
      const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }).toString(),
        signal: AbortSignal.timeout(10000),
      })
      if (!tokenRes.ok) return reply.redirect(errorRedirect)
      tokenData = await tokenRes.json().catch(() => null)
    } catch {
      return reply.redirect(errorRedirect)
    }

    if (!tokenData?.access_token) return reply.redirect(errorRedirect)

    const { access_token: oauthAccessToken, refresh_token: oauthRefreshToken, expires_in: expiresIn } = tokenData
    const oauthTokenExpiry = Date.now() + (Number(expiresIn) - 300) * 1000
    const userId = statePayload.userId

    try {
      const existing = await db.credential.findUnique({
        where: { userId_platform: { userId, platform: 'mercadolivre' } },
      })
      const existingData = existing?.data ? (() => { try { return JSON.parse(existing.data) } catch { return {} } })() : {}
      const mergedData = { ...existingData, oauthAccessToken, oauthRefreshToken, oauthTokenExpiry }

      await db.credential.upsert({
        where: { userId_platform: { userId, platform: 'mercadolivre' } },
        create: { userId, platform: 'mercadolivre', data: JSON.stringify(mergedData) },
        update: { data: JSON.stringify(mergedData) },
      })
    } catch {
      return reply.redirect(errorRedirect)
    }

    return reply.redirect(`${process.env.DASHBOARD_URL || ''}/m/config/credentials?ml_oauth=success`)
  })
}
