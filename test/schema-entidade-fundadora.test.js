import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  BRAND_SAME_AS,
  CUPONITO_ABOUT_URL,
  FOUNDER_PERSON_ID_PATH,
  FOUNDER_SAME_AS,
  SISTER_SITES,
} from '../dashboard/lib/marketing-content.js'
import { EDITORIAL_PERSON_AUTHOR_DESCRIPTION } from '../dashboard/lib/editorial-content.js'

const layoutSource = fs.readFileSync(new URL('../dashboard/app/layout.js', import.meta.url), 'utf8')
const quemSomosSource = fs.readFileSync(new URL('../dashboard/app/quem-somos/page.js', import.meta.url), 'utf8')

// O JSON-LD do Cuponito aponta a autoria dos posts e o `founder` de lá para
// <site>/quem-somos#person. Se o `@id` daqui divergir, o Cuponito afirma a
// ligação e este site não confirma — os dois nós viram duas pessoas diferentes
// para o Google e para a IA, que é o problema que o `founder` existe para
// resolver. Foi exatamente o que aconteceu com '#founder' (18/09/2026).
test('o @id da fundadora é o endereço que o Cuponito cita', () => {
  assert.equal(FOUNDER_PERSON_ID_PATH, '/quem-somos#person')
  assert.match(layoutSource, /'@id': `\$\{siteUrl\}\$\{FOUNDER_PERSON_ID_PATH\}`/)
  assert.ok(!layoutSource.includes('${siteUrl}#founder'), 'o @id antigo (#founder) não pode voltar')
})

test('a Organization declara founder apontando para a Person', () => {
  assert.match(layoutSource, /founder: \{/)
  assert.match(layoutSource, /'@type': 'Person'/)
})

// Decisão da dona do produto (18/09/2026): o Cuponito entra nas DUAS pontas —
// no `sameAs` da Organization e no `sameAs` da Person. A ligação principal
// continua sendo a da pessoa; a da Organization é escolha explícita dela.
test('o Cuponito aparece no sameAs da Organization e no da fundadora', () => {
  assert.ok(BRAND_SAME_AS.includes(CUPONITO_ABOUT_URL))
  assert.ok(FOUNDER_SAME_AS.includes(CUPONITO_ABOUT_URL))
  assert.ok(FOUNDER_SAME_AS.includes(`${CUPONITO_ABOUT_URL}#person`))
})

// A MESMA frase nos três sites (aqui, Cuponito e o site de matemática) é o que
// amarra a entidade para a IA. Reescrever "para melhorar o texto" desfaz isso
// em silêncio.
test('a descrição da fundadora é a frase canônica, igual nos três sites', () => {
  assert.equal(
    EDITORIAL_PERSON_AUTHOR_DESCRIPTION,
    'Fundadora do Espelha Grupos, trabalha com tecnologia e opera grupos de ofertas desde 2023.',
  )
})

// Schema não é frase: a IA precisa de texto corrido com link real para citar.
test('/quem-somos cita o Cuponito em texto visível com link real', () => {
  assert.ok(quemSomosSource.includes('SISTER_SITES'), 'a lista de sites-irmãos precisa ser renderizada')
  const cuponito = SISTER_SITES.find((site) => site.name === 'Cuponito')
  assert.ok(cuponito, 'o Cuponito precisa estar em SISTER_SITES')
  assert.match(cuponito.url, /^https:\/\/www\.cuponito\.com\.br\//)
  assert.match(cuponito.description, /cupons de desconto/)
  assert.ok(!quemSomosSource.includes('nofollow'), 'a relação é real e declarada dos dois lados')
})
