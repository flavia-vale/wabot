// Guarda da ponte comparação -> comercial (plano de melhoria 2026-09-11, item 4).
//
// Medição de 30 dias que motivou esta regra:
//
//   | cluster                    | páginas | visitas | cadastros | visita->cadastro |
//   |----------------------------|--------:|--------:|----------:|-----------------:|
//   | comerciais (/bot-*)        |       7 |     246 |        38 |           15,4%  |
//   | comparação (/alternativas) |       7 |     147 |         0 |            0,0%  |
//
// Mesmo tema, resultados opostos: /alternativas/achadinhos-bot fez 3.400
// impressões, 80 visitas e ZERO cadastro; /bot-achadinhos-whatsapp fez 1.827
// impressões, 130 visitas e 21 cadastros. A comparação tem o volume; a
// comercial tem a conversão. Quem chega comparando ferramenta ainda não
// decidiu comprar — mandá-lo direto ao cadastro pula a etapa que converte.
//
// Por isso toda página de comparação precisa apontar para a página comercial
// que responde à mesma intenção, e esse link não pode voltar a ser a última
// linha de uma lista de rodapé chamada "Outros comparativos".

import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

// O arquivo tem JSX e não pode ser importado pelo Node — lemos a fonte, como
// os outros testes de marketing já fazem.
const fonte = fs.readFileSync(new URL('../dashboard/app/_comparisonContent.js', import.meta.url), 'utf8')

function blocosDeComparacao() {
  const saida = []
  const abertura = /^ {2}'(\/alternativas\/[a-z0-9-]+)': \{$/gm
  const chaves = [...fonte.matchAll(abertura)].map((m) => ({ slug: m[1], inicio: m.index }))
  for (let i = 0; i < chaves.length; i += 1) {
    const fim = i + 1 < chaves.length ? chaves[i + 1].inicio : fonte.length
    saida.push({ slug: chaves[i].slug, bloco: fonte.slice(chaves[i].inicio, fim) })
  }
  return saida
}

function saidaComercial(bloco) {
  const m = bloco.match(/productPage:\s*\{([\s\S]*?)\n {4}\}/)
  if (!m) return null
  const href = m[1].match(/href:\s*'([^']+)'/)
  const note = m[1].match(/note:\s*'([^']*)'/)
  return { href: href?.[1] ?? '', note: note?.[1] ?? '' }
}

const COMPARACOES = blocosDeComparacao()

test('a varredura enxerga as 8 páginas de comparação', () => {
  assert.ok(COMPARACOES.length >= 8, `esperava >= 8 comparações, achei ${COMPARACOES.length}`)
})

test('toda página de comparação aponta para uma página comercial', () => {
  const semSaida = COMPARACOES.filter(({ bloco }) => !saidaComercial(bloco)?.href).map(({ slug }) => slug)
  assert.deepEqual(
    semSaida,
    [],
    'Comparação sem saída para a comercial converte 0%. Adicione `productPage` a:\n  ' + semSaida.join('\n  '),
  )
})

test('a saída aponta para página comercial, nunca para outra comparação', () => {
  const erradas = COMPARACOES.map(({ slug, bloco }) => ({ slug, saida: saidaComercial(bloco) }))
    .filter(({ saida }) => saida?.href?.startsWith('/alternativas/'))
    .map(({ slug, saida }) => `${slug} -> ${saida.href}`)
  assert.deepEqual(erradas, [], 'Mandar de uma comparação para outra não resolve — o destino tem que ser a comercial:\n  ' + erradas.join('\n  '))
})

test('a saída diz o que a pessoa ganha, não só o nome da página', () => {
  const semNota = COMPARACOES.filter(({ bloco }) => !String(saidaComercial(bloco)?.note ?? '').trim()).map(({ slug }) => slug)
  assert.deepEqual(semNota, [], 'Sem a frase concreta o link vira mais um item de lista. Falta `note` em:\n  ' + semNota.join('\n  '))
})

test('a saída NÃO volta para a lista de rodapé "Outros comparativos"', () => {
  // Âncora no JSX do rodapé, não na primeira menção do texto — o comentário
  // acima desta regra também cita o nome da lista.
  const marcador = 'title="Outros comparativos"'
  assert.ok(fonte.includes(marcador), 'a lista de rodapé mudou de nome — reveja esta guarda')
  const rodape = fonte.slice(fonte.indexOf(marcador))
  assert.ok(
    !rodape.includes('page.productPage'),
    'O link para a comercial voltou para a lista de rodapé. Ele precisa de bloco próprio, junto do fechamento — ' +
      'enterrado ali, ele converteu zero em 30 dias.',
  )
})
