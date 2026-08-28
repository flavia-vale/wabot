import axios from 'axios'
import crypto from 'node:crypto'
import { conversionReportQuery } from './report.js'

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql'
export class ShopeeSalesError extends Error {
  constructor(code, message, retryable = false) { super(message); this.code = code; this.retryable = retryable }
}

function authorization(appId, secretKey, payload, now = Date.now()) {
  const timestamp = Math.floor(now / 1000)
  const signature = crypto.createHash('sha256').update(`${appId}${timestamp}${payload}${secretKey}`).digest('hex')
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
}

export function createShopeeSalesClient({ http = axios, timeout = 15000, maxPages = 20, maxRecords = 5000 } = {}) {
  async function request(credentials, query) {
    const body = { query }; const payload = JSON.stringify(body)
    try {
      const { data } = await http.post(ENDPOINT, body, { timeout, headers: { Authorization: authorization(credentials.appId, credentials.secretKey, payload), 'Content-Type': 'application/json' } })
      if (data?.errors?.length) {
        const rejected = data.errors.some(e => /auth|credential|signature|unauthor/i.test(e?.message || ''))
        throw new ShopeeSalesError(rejected ? 'SHOPEE_CREDENTIAL_REJECTED' : 'SHOPEE_UNAVAILABLE', rejected ? 'A Shopee recusou as credenciais.' : 'A Shopee não conseguiu gerar o relatório.', !rejected)
      }
      if (!data?.data?.conversionReport) throw new ShopeeSalesError('SHOPEE_REPORT_INCOMPLETE', 'A Shopee retornou um relatório incompleto.', true)
      return data.data.conversionReport
    } catch (error) {
      if (error instanceof ShopeeSalesError) throw error
      const rejected = [401, 403].includes(error?.response?.status)
      throw new ShopeeSalesError(rejected ? 'SHOPEE_CREDENTIAL_REJECTED' : 'SHOPEE_UNAVAILABLE', rejected ? 'A Shopee recusou as credenciais.' : 'A Shopee está indisponível no momento.', !rejected)
    }
  }
  return {
    async readWindow(credentials, window) {
      const rows = []; let scrollId
      for (let page = 0; page < maxPages; page++) {
        const report = await request(credentials, conversionReportQuery({ ...window, scrollId }))
        if (!Array.isArray(report.nodes)) throw new ShopeeSalesError('SHOPEE_REPORT_INCOMPLETE', 'A Shopee retornou dados incompletos.', true)
        rows.push(...report.nodes)
        if (rows.length > maxRecords) throw new ShopeeSalesError('SHOPEE_REPORT_INCOMPLETE', 'O relatório excedeu o limite seguro.', true)
        if (!report.pageInfo?.hasNextPage) return rows
        if (!report.pageInfo.scrollId || report.pageInfo.scrollId === scrollId) break
        scrollId = report.pageInfo.scrollId
      }
      throw new ShopeeSalesError('SHOPEE_REPORT_INCOMPLETE', 'Não foi possível ler todas as páginas do relatório.', true)
    },
  }
}
