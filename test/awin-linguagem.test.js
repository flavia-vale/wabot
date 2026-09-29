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

function textos() {
  const out = []
  for (const value of Object.values(AWIN_COPY)) {
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

test('código vencido fala "venceu", e o texto de segurança diz como cortar o acesso', () => {
  assert.match(AWIN_STATUS.invalid_credential.label, /venceu/)
  assert.match(AWIN_COPY.safety, /cancele o código na própria Awin/)
})

test('o componente não escreve texto solto fora do arquivo de textos', () => {
  const source = readFileSync(new URL('../dashboard/components/painel/AwinCredentialsCard.js', import.meta.url), 'utf8')
  // Texto entre tags JSX (>texto<) só pode vir de variável.
  const soltos = [...source.matchAll(/(?<=<\/?[a-zA-Z][^<>]*>)\s*([A-Za-zÀ-ú][^<>{}]{2,}?)\s*(?=<)/g)].map((match) => match[1].trim())
    // Descarta código JS entre um "</x>" e o próximo JSX (ex.: "if (!x) return").
    .filter((text) => !/\breturn\b|[()=;]/.test(text))
  assert.deepEqual(soltos, [])
})
