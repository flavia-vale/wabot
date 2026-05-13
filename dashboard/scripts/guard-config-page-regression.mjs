import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve(process.cwd(), 'app/dashboard/configuracoes/page.js')
const source = fs.readFileSync(filePath, 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`ERRO: ${message}`)
    process.exit(1)
  }
}

function count(pattern) {
  return (source.match(pattern) || []).length
}

assert(!source.includes('URL_PROTOCOL_RE'), 'URL_PROTOCOL_RE não deve existir; use hasHttpProtocol().')
assert(count(/\bconst\s+DEFAULT_BRANDING_CTA_TEXT\b/g) === 1, 'DEFAULT_BRANDING_CTA_TEXT deve ser declarado apenas uma vez.')
assert(count(/\bconst\s+MAX_BRANDING_CTA_CHARS\b/g) === 1, 'MAX_BRANDING_CTA_CHARS deve ser declarado apenas uma vez.')
assert(count(/\bfunction\s+hasHttpProtocol\b/g) === 1, 'hasHttpProtocol deve existir exatamente uma vez.')

console.log('Guardrail OK: configurações sem regressão de constantes/protocolo.')
