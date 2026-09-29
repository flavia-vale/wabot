// Trava a redação da seção Awin (Minhas credenciais) e das mensagens que a
// API devolve para a tela: linguagem de gente, sem nome técnico.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AWIN_COPY, AWIN_RUN_STATUS, AWIN_STATUS } from '../dashboard/lib/painel/awinCopy.js'
import { AWIN_MESSAGES } from '../src/integrations/awin/accountService.js'

const JARGAO = [
  /\btoken\b/i,
  /\bAPI\b/,
  /publisher/i,
  /urlTracking/i,
  /\b40[13]\b/,
  /\b429\b/,
  /endpoint|payload|fallback|bearer|header|cabeçalho/i,
  /\bjoined\b/i,
  /accessToken/i,
]

// Rótulo "OAuth2 Token" é o nome que a Awin usa; fica fora da checagem.
const NOMES_DA_AWIN = new Set(['OAuth2 Token'])

function textos() {
  const out = []
  for (const value of Object.values(AWIN_COPY)) {
    if (NOMES_DA_AWIN.has(value)) continue
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) out.push(...value)
    else if (typeof value === 'function') out.push(String(value('X', 'Y')), String(value({ inserted: 1, updated: 2, expired: 3 })))
  }
  for (const status of Object.values(AWIN_STATUS)) out.push(status.label)
  out.push(...Object.values(AWIN_RUN_STATUS), ...Object.values(AWIN_MESSAGES))
  return out.filter((text) => text && !text.includes('[object'))
}

test('nenhum jargão técnico no que a cliente lê sobre a Awin', () => {
  for (const texto of textos()) {
    for (const proibido of JARGAO) assert.doesNotMatch(texto, proibido, `jargão em: "${texto}"`)
  }
})

test('explica por que uma loja pode não aparecer (inscrição/aprovação na Awin)', () => {
  assert.match(AWIN_COPY.storesHint, /se inscreve/)
  assert.match(AWIN_COPY.storesHint, /aprovada/)
})

test('código vencido fala "venceu"', () => {
  assert.match(AWIN_STATUS.invalid_credential.label, /venceu/)
})

// Decisão da dona do produto (2026-09-29): os campos usam o nome que a Awin
// mostra na tela dela, para a cliente achar o que colar.
test('campos da conta usam os nomes da própria Awin', () => {
  assert.equal(AWIN_COPY.codeField, 'OAuth2 Token')
  assert.equal(AWIN_COPY.publisherField, 'ID/Número da conta AWIN')
  assert.equal(AWIN_COPY.safety, undefined)
})

test('primeira conta Awin já abre com o formulário; botão de adicionar só da 2ª em diante', () => {
  const source = readFileSync(new URL('../dashboard/components/painel/AwinCredentialsCard.js', import.meta.url), 'utf8')
  assert.match(source, /adding \|\| firstAccount/)
  assert.match(source, /list\.length === 0/)
})

test('o componente não escreve texto solto fora do arquivo de textos', () => {
  const source = readFileSync(new URL('../dashboard/components/painel/AwinCredentialsCard.js', import.meta.url), 'utf8')
  // Texto entre tags JSX (>texto<) só pode vir de variável.
  const soltos = [...source.matchAll(/(?<=<\/?[a-zA-Z][^<>]*>)\s*([A-Za-zÀ-ú][^<>{}]{2,}?)\s*(?=<)/g)].map((match) => match[1].trim())
    // Descarta código JS entre um "</x>" e o próximo JSX (ex.: "if (!x) return").
    .filter((text) => !/\breturn\b|[()=;]/.test(text))
  assert.deepEqual(soltos, [])
})

// RCA 2026-09-29: automação Awin sem promoção nova mostrava o texto da
// Shopee ("reduza o desconto mínimo").
test('mensagem de "nada para enviar" da Awin não fala de Shopee nem de desconto', async () => {
  const { AWIN_SKIP_LABELS } = await import('../dashboard/lib/painel/awinCopy.js')
  for (const code of ['all_offers_filtered', 'no_awin_promotions', 'no_awin_account']) {
    const text = AWIN_SKIP_LABELS[code]
    assert.ok(text, `sem texto para ${code}`)
    assert.doesNotMatch(text, /shopee|desconto/i, text)
    for (const proibido of JARGAO) assert.doesNotMatch(text, proibido, text)
  }
  const page = readFileSync(new URL('../dashboard/app/painel/ofertas-automaticas/page.js', import.meta.url), 'utf8')
  assert.match(page, /explainSkip\(result\.skipped, a\.source\)/, 'a tela passa a origem da automação')
  assert.match(page, /source === 'awin' && AWIN_SKIP_LABELS\[code\]/)
})
