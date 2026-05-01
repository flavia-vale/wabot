import axios from 'axios'
import crypto from 'crypto'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'

function buildAuth(appId, secretKey, payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const sig = crypto
    .createHash('sha256')
    .update(`${appId}${timestamp}${payload}${secretKey}`)
    .digest('hex')
  return {
    header: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${sig}`,
    timestamp,
  }
}

export async function convert(url, creds) {
  const { appId, secretKey } = creds
  const body = {
    query: `mutation {
      generateShortLink(input: { originUrl: "${url}", subIds: [""] }) {
        shortLink
      }
    }`,
  }
  const payload = JSON.stringify(body)
  const { header } = buildAuth(appId, secretKey, payload)

  try {
    const { data } = await axios.post(ENDPOINT, body, {
      headers: {
        Authorization: header,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    })

    const link = data?.data?.generateShortLink?.shortLink
    if (!link) {
      const err = data?.errors?.[0]?.message
      throw new Error(err || 'Resposta inesperada')
    }
    return link
  } catch (err) {
    throw new Error(`Shopee converter: ${err.message}`)
  }
}
