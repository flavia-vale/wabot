#!/usr/bin/env node
// Diagnóstico read-only e sanitizado. Não imprime URL, query, tokens, IDs ou
// corpo remoto; serve para comprovar se um sharejump real expõe evidência
// estática consumível pelo resolvedor antes da validação em staging.
import { resolveSheinShortLink } from '../src/converters/shein.js'

const input = process.argv[2]
if (!input) {
  console.error('Uso: node scripts/diag-shein-opaque-evidence.mjs "<oneLink>"')
  process.exitCode = 2
} else {
  const result = await resolveSheinShortLink(input, { returnDetails: true })
  let finalHost = null
  try { finalHost = new URL(result.url).hostname } catch {}
  console.log(JSON.stringify({
    errorCode: result.errorCode,
    evidenceStatus: result.evidence?.status ?? null,
    evidenceGoodsIdPresent: Boolean(result.evidence?.goodsId),
    evidenceGoodsIdLength: result.evidence?.goodsId?.length ?? null,
    finalHost,
  }, null, 2))
}
