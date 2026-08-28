import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DELIVERY_KIND, entregouComImagem, ofertaPerdeuImagem } from '../src/core/deliveryKind.js'
import { agruparPerdasPorOrigem, carregarVisaoEntrega, resumirEntregas } from '../src/ops/deliveryQuality.js'

// A visão existe porque "envio com sucesso" só diz que o WhatsApp aceitou a
// mensagem — não diz se ela chegou com foto, com card ou como texto pelado.
// Três incidentes seguidos de imagem foram descobertos pela cliente, não por
// nós, justamente por causa desse buraco.

const linha = (over = {}) => ({ userId: 'u1', platform: 'shopee', sourceGroup: 'g1', destGroup: 'd1', ...over })

test('conta as ofertas por jeito de entrega', () => {
  const r = resumirEntregas([
    linha({ deliveryKind: DELIVERY_KIND.FOTO, originImageBytes: 40000 }),
    linha({ deliveryKind: DELIVERY_KIND.CARD_LOJA, originImageBytes: 500 }),
    linha({ deliveryKind: DELIVERY_KIND.TEXTO, originImageBytes: 500 }),
  ])
  assert.equal(r.total, 3)
  assert.equal(r.comImagem, 2)
  assert.equal(r.perderamImagem, 1)
  assert.equal(r.percentualComImagem, 66.7)
})

test('linha sem registro não entra no percentual (não mascara o indicador)', () => {
  const r = resumirEntregas([
    linha({ deliveryKind: DELIVERY_KIND.FOTO, originImageBytes: 40000 }),
    linha({ deliveryKind: null }),
    linha({ deliveryKind: null }),
  ])
  assert.equal(r.total, 3)
  assert.equal(r.semRegistro, 2)
  assert.equal(r.comRegistro, 1)
  assert.equal(r.percentualComImagem, 100, 'o percentual olha só o que tem registro')
})

test('só conta como perda quando a origem TINHA imagem', () => {
  assert.equal(ofertaPerdeuImagem({ deliveryKind: DELIVERY_KIND.TEXTO, originImageBytes: 500 }), true)
  assert.equal(ofertaPerdeuImagem({ deliveryKind: DELIVERY_KIND.TEXTO, originImageBytes: 0 }), false, 'origem sem foto não é defeito nosso')
  assert.equal(ofertaPerdeuImagem({ deliveryKind: DELIVERY_KIND.TEXTO }), false, 'sem registro não vira alarme')
  assert.equal(ofertaPerdeuImagem({ deliveryKind: DELIVERY_KIND.CARD_ORIGEM, originImageBytes: 500 }), false, 'card com foto não é perda')
})

test('card com a foto da origem conta como entrega COM imagem', () => {
  assert.equal(entregouComImagem(DELIVERY_KIND.CARD_ORIGEM), true)
  assert.equal(entregouComImagem(DELIVERY_KIND.CARD_BANNER), true)
  assert.equal(entregouComImagem(DELIVERY_KIND.TEXTO), false)
  assert.equal(entregouComImagem(null), false)
})

test('agrupa as perdas por cliente e grupo de ORIGEM (é a origem que estraga)', () => {
  const perdas = agruparPerdasPorOrigem([
    linha({ deliveryKind: DELIVERY_KIND.TEXTO, originImageBytes: 332, sourceGroup: 'gio@g.us' }),
    linha({ deliveryKind: DELIVERY_KIND.TEXTO, originImageBytes: 654, sourceGroup: 'gio@g.us' }),
    linha({ deliveryKind: DELIVERY_KIND.TEXTO, originImageBytes: 500, sourceGroup: 'outra@g.us' }),
    linha({ deliveryKind: DELIVERY_KIND.FOTO, originImageBytes: 40000, sourceGroup: 'gio@g.us' }),
  ])
  assert.equal(perdas.length, 2)
  assert.equal(perdas[0].sourceGroup, 'gio@g.us')
  assert.equal(perdas[0].quantidade, 2)
  assert.equal(perdas[0].menorBytes, 332)
  assert.equal(perdas[0].maiorBytes, 654)
})

test('carregador resolve nomes só do que a tela mostra', async () => {
  const consultas = []
  const dbFake = {
    messageLog: {
      findMany: async (args) => {
        consultas.push(args)
        return [
          linha({ deliveryKind: DELIVERY_KIND.TEXTO, originImageBytes: 400 }),
          linha({ deliveryKind: DELIVERY_KIND.FOTO, originImageBytes: 40000 }),
        ]
      },
    },
    user: { findMany: async () => [{ id: 'u1', name: 'Cliente', email: 'cliente@x.com' }] },
    group: { findMany: async () => [{ waJid: 'g1', name: 'Ofertas da Gio' }] },
  }
  const visao = await carregarVisaoEntrega({ db: dbFake, horas: 6 })
  assert.equal(visao.janelaHoras, 6)
  assert.equal(visao.resumo.perderamImagem, 1)
  assert.equal(visao.origensComPerda[0].cliente, 'cliente@x.com')
  assert.equal(visao.origensComPerda[0].origemNome, 'Ofertas da Gio')
  assert.equal(consultas[0].where.status, 'success')
})

// Guardas estruturais: sem o worker gravando, a tela mostra zero para sempre.
const workerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('o worker registra COMO a oferta saiu em todos os caminhos de montagem', () => {
  assert.equal(
    (workerSource.match(/deliveryInfo\.kind = /g) || []).length,
    4,
    'preview, fallback sem imagem, relay e imagem/texto — os quatro precisam marcar',
  )
  assert.match(workerSource, /deliveryInfo\.originImageBytes = origem\?\.buffer\?\.length \?\? 0/, 'precisa medir a imagem da mensagem de origem')
  assert.match(workerSource, /\.\.\.\(entrega\.kind \? \{ deliveryKind: entrega\.kind \} : \{\}\)/, 'precisa persistir no MessageLog')
})

// O import sumiu num merge (2026-08-28): duas mudanças adicionaram uma linha na
// MESMA posição do bloco de imports, o merge ficou com uma só, e o `main` foi
// para produção com `DELIVERY_KIND is not defined` — ReferenceError em TODO
// caminho de montagem de mensagem, ou seja, espelhamento inteiro quebrado. O
// `no-undef` do CI pegou, mas o merge aconteceu com o CI vermelho.
test('DELIVERY_KIND é importado onde é usado', () => {
  assert.match(
    workerSource,
    /import \{[^}]*DELIVERY_KIND[^}]*\} from '\.\/core\/deliveryKind\.js'/,
    'sem esse import o worker lança ReferenceError em todo envio espelhado',
  )
})

test('a fonte da foto do card não entra no urlInfo (proto do WhatsApp)', () => {
  assert.match(workerSource, /onFonteDaFoto/, 'a fonte vai por callback')
  assert.ok(!/_fotoDaOrigem/.test(workerSource), 'campo estranho no urlInfo é risco — ver RCA do title no PR #1186')
})
