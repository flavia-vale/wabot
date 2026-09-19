import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { detectLinks } from '../src/detector.js'

// T071 (review, 3ª rodada): o painel de teste de conversão mostrava
// "0 links detectados" para `br.shein.com`/`m.shein.com` — hosts que o próprio
// conversor emite (data-model.md §3) — porque a tela tinha uma CÓPIA da lista
// de endereços, com prefixo fixo `(?:www\.)?`, e essa cópia divergiu do robô.
//
// Desde 2026-09-19 a tela não tem cópia nenhuma: ela usa `detectLinks`, o mesmo
// detector do espelhamento. A regra deste teste é a mesma de antes — o painel
// reconhece os subdomínios da SHEIN, as outras lojas, e recusa domínio sósia —
// só que agora exercitando o código que de fato roda na tela, em vez de um
// literal de regex extraído do arquivo.

const page = readFileSync(
  new URL('../dashboard/app/painel/converte-links/page.js', import.meta.url),
  'utf8',
)

const contar = (texto) => detectLinks(texto).length

test('T071: painel de teste de conversão conta subdomínios da SHEIN como 1 link detectado', () => {
  for (const url of [
    'https://br.shein.com/vestido-floral-p-485735309.html',
    'https://m.shein.com/br/ark/default?goods_id=485735309',
    'https://onelink.shein.com/14/4v4p6bpzshsx',
    'https://shein.top/14/abc',
    'https://shein.com/algo',
  ]) {
    assert.equal(contar(url), 1, `esperava 1 link detectado para ${url}`)
  }
})

test('T071: painel de teste de conversão continua detectando as outras quatro lojas', () => {
  for (const url of [
    'https://www.mercadolivre.com.br/p/MLB123',
    'https://amzn.to/abc123',
    'https://shope.ee/abc',
    'https://www.magazineluiza.com.br/produto/p/123',
  ]) {
    assert.equal(contar(url), 1, `esperava 1 link detectado para ${url}`)
  }
})

test('T071: painel de teste de conversão não reconhece domínio sósia da SHEIN', () => {
  assert.equal(contar('https://shein.com.evil.net/a'), 0)
})

test('T071: a tela usa o detector do robô, sem manter cópia da lista de endereços', () => {
  // É a cópia que causou o defeito original. Guarda estrutural para ela não
  // voltar por conveniência.
  assert.ok(page.includes('detectLinks'), 'a tela precisa usar detectLinks')
  assert.doesNotMatch(page, /SUPPORTED_LINK_RE/, 'cópia da lista de endereços voltou para a tela')
  assert.doesNotMatch(page, /shein\\.com\|/, 'regex de lojas duplicada voltou para a tela')
})
