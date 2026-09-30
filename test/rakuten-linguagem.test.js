// Trava a redação da seção Rakuten (Minhas credenciais) e das mensagens que
// a API devolve para a tela: linguagem de gente, sem nome técnico. Os três
// nomes de campo (SID, Client ID, Client Secret) são os que a própria Rakuten
// mostra — ficam de fora da checagem, como o "OAuth2 Token" da Awin.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RAKUTEN_COPY, RAKUTEN_RUN_STATUS, RAKUTEN_SKIP_LABELS, RAKUTEN_STATUS } from '../dashboard/lib/painel/rakutenCopy.js'
import { RAKUTEN_MESSAGES } from '../src/integrations/rakuten/accountService.js'

const JARGAO = [
  /\btoken\b/i,
  /\bAPI\b/,
  /publisher/i,
  /clickurl|linksynergy/i,
  /\b40[013]\b/,
  /\b429\b/,
  /endpoint|payload|fallback|bearer|header|cabeçalho|scope|oauth/i,
  /invalid_client|invalid_token/i,
]

const NOMES_DA_RAKUTEN = new Set(['SID', 'Client ID', 'Client Secret'])

function textos() {
  const out = []
  for (const value of Object.values(RAKUTEN_COPY)) {
    if (NOMES_DA_RAKUTEN.has(value)) continue
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) out.push(...value)
    else if (typeof value === 'function') out.push(String(value('X', 'Y')), String(value({ inserted: 1, updated: 2, expired: 3 })))
  }
  for (const status of Object.values(RAKUTEN_STATUS)) out.push(status.label)
  out.push(...Object.values(RAKUTEN_RUN_STATUS), ...Object.values(RAKUTEN_MESSAGES), ...Object.values(RAKUTEN_SKIP_LABELS))
  return out.filter((text) => text && !text.includes('[object'))
}

test('nenhum jargão técnico no que a cliente lê sobre a Rakuten', () => {
  for (const texto of textos()) {
    for (const proibido of JARGAO) assert.doesNotMatch(texto, proibido, `jargão em: "${texto}"`)
  }
})

test('passo a passo diz onde achar cada dado (SID abaixo do nome; LOGIN no portal)', () => {
  const passos = RAKUTEN_COPY.steps.join(' ')
  assert.match(passos, /SID/)
  assert.match(passos, /abaixo do seu nome/)
  assert.match(passos, /LOGIN/)
  assert.match(passos, /Client ID e o Client Secret/)
  assert.match(RAKUTEN_COPY.storesHint, /aprovada/)
})

test('dados recusados pedem para conferir os três (a Rakuten não diz qual está errado)', () => {
  assert.match(RAKUTEN_MESSAGES.auth, /SID/)
  assert.match(RAKUTEN_MESSAGES.auth, /Client ID/)
  assert.match(RAKUTEN_MESSAGES.auth, /Client Secret/)
})

test('tela de ofertas automáticas usa os textos da Rakuten para automação Rakuten (nunca o da Shopee)', () => {
  const page = readFileSync(new URL('../dashboard/app/painel/ofertas-automaticas/page.js', import.meta.url), 'utf8')
  assert.match(page, /source === 'rakuten' && RAKUTEN_SKIP_LABELS\[code\]/)
  assert.match(page, /<option value="rakuten">/)
  assert.match(RAKUTEN_SKIP_LABELS.all_offers_filtered, /já foram enviadas/)
  assert.doesNotMatch(RAKUTEN_SKIP_LABELS.all_offers_filtered, /Shopee|desconto mínimo/)
})
