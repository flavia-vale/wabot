// Guarda da ligação de entidade entre espelhagrupos.com.br e cuponito.com.br
// (2026-09-18).
//
// Os dois sites são da mesma fundadora. O Cuponito já publicava, do lado dele,
// `"founder": { "@id": "https://espelhagrupos.com.br/quem-somos#person" }` — um
// `@id` que apontava para cá e AQUI NÃO EXISTIA. Afirmação de um lado só não
// liga entidade nenhuma: o Google e as IAs liam os dois produtos como coisas
// sem relação. O que fecha a ligação é este lado confirmar.
//
// Três peças, e nenhuma substitui a outra:
//   1. o Cuponito no `sameAs` da Organization;
//   2. `founder` + o nó `Person` com o `@id` EXATO que o Cuponito referencia;
//   3. um link visível, no HTML entregue pelo servidor, sem depender de JS.
//
// ⚠️ O `@id` e a `description` são literais que valem por serem IDÊNTICOS em
// três domínios. Qualquer variação (com www, com barra no fim, outro fragmento,
// frase "melhorada") quebra a ligação EM SILÊNCIO — nada falha, nada avisa, só
// deixa de funcionar. É por isso que este teste compara caractere por caractere.

import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const raiz = new URL('..', import.meta.url).pathname
const ler = (rel) => readFileSync(path.join(raiz, rel), 'utf8')

const ID_FUNDADORA = 'https://espelhagrupos.com.br/quem-somos#person'
const DESCRICAO_FUNDADORA =
  'Fundadora do Espelha Grupos, trabalha com tecnologia e opera grupos de ofertas desde 2023.'
const CUPONITO_SOBRE = 'https://www.cuponito.com.br/quem-somos'

test('o @id da fundadora é o literal exato que o Cuponito referencia', () => {
  const fonte = ler('dashboard/lib/marketing-content.js')
  assert.ok(
    fonte.includes(`'${ID_FUNDADORA}'`),
    `BRAND_FOUNDER_ID precisa ser exatamente ${ID_FUNDADORA} — com www, com barra no fim ou com outro fragmento, o Cuponito deixa de casar e ninguém fica sabendo`,
  )
})

test('a descrição da fundadora é a MESMA frase publicada nos outros domínios', () => {
  const fonte = ler('dashboard/lib/marketing-content.js')
  assert.ok(
    fonte.includes(DESCRICAO_FUNDADORA),
    'a frase é publicada idêntica no Cuponito e no site de matemática da mesma autora — é a repetição exata que amarra a entidade; não reescrever',
  )
})

test('o Cuponito está no sameAs da marca, sem derrubar os perfis que já estavam lá', () => {
  const fonte = ler('dashboard/lib/marketing-content.js')
  const bloco = fonte.match(/export const BRAND_SAME_AS = \[([\s\S]*?)\]/)
  assert.ok(bloco, 'BRAND_SAME_AS sumiu')
  assert.match(bloco[1], /BRAND_CUPONITO_ABOUT_URL/)
  assert.match(bloco[1], /SUPPORT_WHATSAPP_URL/)
  assert.match(bloco[1], /BRAND_YOUTUBE_URL/)
  assert.ok(
    fonte.includes(`'${CUPONITO_SOBRE}'`) || fonte.includes("BRAND_CUPONITO_URL}/quem-somos"),
    `o sameAs precisa apontar para ${CUPONITO_SOBRE}`,
  )
})

test('a Organization declara founder e existe um nó Person com esse mesmo @id', () => {
  const layout = ler('dashboard/app/layout.js')
  assert.match(
    layout,
    /founder: \{ '@id': BRAND_FOUNDER_ID \}/,
    'a Organization precisa declarar founder — sem ele o Person fica solto no grafo',
  )
  assert.match(layout, /'@type': 'Person'/, 'o nó Person da fundadora sumiu do schema')
  assert.match(layout, /'@id': BRAND_FOUNDER_ID/, 'o Person precisa carregar o @id que o Cuponito referencia')
  assert.match(layout, /BRAND_CUPONITO_ABOUT_URL/, 'o sameAs do Person precisa apontar para o Cuponito')
})

test('a página quem-somos tem link real para o Cuponito, sem nofollow', () => {
  const pagina = ler('dashboard/app/quem-somos/page.js')
  const link = pagina.match(/<a\s[^>]*href="https:\/\/(?:www\.)?cuponito\.com\.br[^"]*"[^>]*>/)
  assert.ok(link, 'o link visível para o Cuponito sumiu da página — schema não é frase: a IA precisa de texto corrido com link')
  assert.ok(
    !/nofollow/.test(link[0]),
    'é produto da mesma dona, não anúncio pago — nofollow aqui enfraquece justamente a ligação que o link existe para afirmar',
  )
  assert.ok(
    !/<Link[^>]*href="https:\/\/(?:www\.)?cuponito/.test(pagina),
    'link externo vai em <a> normal; next/link para fora do site não é o caminho',
  )
})

// O que o Google e as IAs de fato leem é o HTML construído. Sem `.next` o
// arquivo PULA (mesma convenção de test/admin-capacity-page.test.js); a CI
// constrói, então lá ele roda.
const BUILD = path.join(raiz, 'dashboard/.next/server/app')
const temBuild = existsSync(BUILD)

test('no HTML construído: schema parseia, Person aparece e o link está lá', { skip: temBuild ? false : 'sem dashboard/.next construído' }, () => {
  const arquivo = readdirSync(BUILD).includes('quem-somos.html')
    ? path.join(BUILD, 'quem-somos.html')
    : path.join(BUILD, 'quem-somos', 'index.html')
  assert.ok(existsSync(arquivo), 'quem-somos não foi construído como HTML estático')
  const html = readFileSync(arquivo, 'utf8')

  const blocos = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  assert.ok(blocos.length > 0, 'a página perdeu todo o JSON-LD')
  // Schema quebrado é pior que schema ausente: o parse é parte da guarda.
  const nos = blocos.map(([, cru]) => JSON.parse(cru.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')))

  const pessoa = nos.find((no) => no['@type'] === 'Person')
  assert.ok(pessoa, 'o nó Person não chegou ao HTML')
  assert.equal(pessoa['@id'], ID_FUNDADORA)
  assert.equal(pessoa.description, DESCRICAO_FUNDADORA)

  const org = nos.find((no) => no['@type'] === 'Organization')
  assert.ok(org, 'a Organization não chegou ao HTML')
  assert.equal(org.founder?.['@id'], ID_FUNDADORA)
  assert.ok(org.sameAs.includes(CUPONITO_SOBRE), 'o Cuponito não chegou ao sameAs')

  assert.match(html, /<a\s[^>]*href="https:\/\/(?:www\.)?cuponito\.com\.br/, 'o link visível não está no HTML do servidor')
})
