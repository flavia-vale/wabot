#!/usr/bin/env node
import 'dotenv/config'

import { parseMetaPocConfig, runMetaStoryPoc } from '../src/instagram/meta/poc.js'

function safeError(error, accessToken = '') {
  let message = String(error?.message || 'Erro inesperado').replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
  if (accessToken) message = message.split(accessToken).join('[redacted]')
  return {
    ok: false,
    code: error?.code || 'UNEXPECTED_ERROR',
    message,
    status: error?.status ?? null,
    providerCode: error?.providerCode ?? null,
    providerSubcode: error?.providerSubcode ?? null,
    retryable: Boolean(error?.retryable),
  }
}

let config
try {
  config = parseMetaPocConfig()
  const report = await runMetaStoryPoc(config)
  process.stdout.write(`${JSON.stringify({ ok: true, ...report }, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify(safeError(error, config?.accessToken), null, 2)}\n`)
  process.exitCode = 1
}
