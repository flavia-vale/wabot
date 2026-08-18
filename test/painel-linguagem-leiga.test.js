// Trava a REDAÇÃO da tela de credenciais em linguagem de gente.
//
// A tela é usada por quem quer divulgar oferta, não por quem sabe o que é
// cookie de sessão. Termos técnicos vazando para rótulo, dica ou aviso já
// fizeram cliente achar que o produto "expõe os dados pessoais" — o texto é
// parte do produto, então tem teste.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AFFILIATE_PLATFORMS, CRED_STATUS } from '../dashboard/lib/painel/affiliatePlatforms.js'

const pageSource = readFileSync(new URL('../dashboard/app/painel/ids-afiliada/page.js', import.meta.url), 'utf8')

// Jargão que NUNCA deve aparecer no que a usuária lê. "cookie" sozinho fica de
// fora da lista porque é o nome próprio da extensão Cookie-Editor, que ela
// precisa instalar — mas nunca como descrição do dado ("cookie de sessão").
const JARGAO_PROIBIDO = [
  /\?tag=/,
  /partner_id/i,
  /amzn\.to/i,
  /meli\.la/i,
  /cookie de sess[ãa]o/i,
  /devtools/i,
  /endpoint|payload|fallback|token de sess[ãa]o/i,
  // SHEIN (specs/012-shein-store-support, FR-007/SC-006).
  /koc_id/i,
  /url_from/i,
  /goods_id/i,
  /aff_id/i,
  /oneLink/i,
  /affiliate_koc/i,
  /GM7/,
  /\btoken\b/i,
  /par[âa]metro/i,
  /query string/i,
  /captcha/i,
]

function textosVisiveis() {
  const textos = []
  for (const plataforma of AFFILIATE_PLATFORMS) {
    textos.push(plataforma.instructions, plataforma.platformWarning)
    for (const campo of plataforma.fields ?? []) {
      textos.push(campo.label, campo.hint, campo.help)
    }
    for (const link of plataforma.actionLinks ?? []) textos.push(link.label)
  }
  for (const status of Object.values(CRED_STATUS)) textos.push(status.label)
  return textos.filter(Boolean)
}

test('nenhum jargão técnico nos textos das lojas', () => {
  for (const texto of textosVisiveis()) {
    for (const proibido of JARGAO_PROIBIDO) {
      assert.doesNotMatch(texto, proibido, `jargão em: "${texto}"`)
    }
  }
})

test('cada loja com código de acesso explica, em uma linha, para que ele serve', () => {
  for (const id of ['mercadolivre', 'amazon']) {
    const plataforma = AFFILIATE_PLATFORMS.find((p) => p.id === id)
    const campoPrincipal = plataforma.fields.find((f) => f.cookieField)
    assert.match(campoPrincipal.hint, /curtinho/i, `${id}: a dica precisa dizer para que serve o código`)
    assert.match(plataforma.platformWarning, /curtinho/i, `${id}: o aviso da loja precisa explicar o ganho do código`)
  }
})

test('o aviso de código vencido não diz que o robô parou (porque não parou)', () => {
  assert.doesNotMatch(pageSource, /gera[çc][ãa]o de ofertas do ML est[áa] pausada/i)
  assert.match(pageSource, /venceu/i, 'fala "venceu", não "sessão expirada"')
  assert.match(pageSource, /continuam saindo/i)
})

test('rótulos de status são compreensíveis sem manual', () => {
  assert.equal(CRED_STATUS.configured.label, 'Pronta para usar')
  assert.equal(CRED_STATUS.incomplete.label, 'Falta preencher')
  assert.equal(CRED_STATUS.pending.label, 'Ainda não cadastrada')
})
