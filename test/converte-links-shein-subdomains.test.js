import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// T071 (review, 3ª rodada): SUPPORTED_LINK_RE do painel "Converte links"
// ganhou shein.com|onelink.shein.com|shein.top, mas o prefixo do padrão era
// fixo (`(?:www\.)?`) — br.shein.com e m.shein.com (hosts que o próprio
// conversor emite, ver data-model.md §3) não batiam, e o painel mostrava
// "0 links detectados" para um link que o espelhamento converte normalmente.
//
// A página é um componente 'use client' com JSX, então não dá para importar
// direto no runner db-free do Node — extraímos o literal do regex do código
// fonte (mesmo padrão de outros testes estruturais do repo) e avaliamos.

const source = readFileSync(
  new URL('../dashboard/app/painel/converte-links/page.js', import.meta.url),
  'utf8',
)

function extractSupportedLinkRe() {
  const match = source.match(/const SUPPORTED_LINK_RE = (\/.*\/[a-z]*)/)
  assert.ok(match, 'SUPPORTED_LINK_RE não encontrado em converte-links/page.js')
  // eslint-disable-next-line no-new-func
  return new Function(`return ${match[1]}`)()
}

function countSupportedLinks(text) {
  const re = extractSupportedLinkRe()
  const matches = text.match(re)
  return matches?.length ?? 0
}

test('T071: painel "Converte links" conta subdomínios da SHEIN como 1 link detectado', () => {
  for (const url of [
    'https://br.shein.com/vestido-floral-p-485735309.html',
    'https://m.shein.com/br/ark/default?goods_id=485735309',
    'https://onelink.shein.com/14/4v4p6bpzshsx',
    'https://shein.top/14/abc',
    'https://shein.com/algo',
  ]) {
    assert.equal(countSupportedLinks(url), 1, `esperava 1 link detectado para ${url}`)
  }
})

test('T071: painel "Converte links" continua detectando as outras quatro lojas', () => {
  for (const url of [
    'https://www.mercadolivre.com.br/p/MLB123',
    'https://amzn.to/abc123',
    'https://shope.ee/abc',
    'https://www.magazineluiza.com.br/produto/p/123',
  ]) {
    assert.equal(countSupportedLinks(url), 1, `esperava 1 link detectado para ${url}`)
  }
})

test('T071: painel "Converte links" não reconhece domínio sósia da SHEIN', () => {
  assert.equal(countSupportedLinks('https://shein.com.evil.net/a'), 0)
})
