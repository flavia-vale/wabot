import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fonte = fs.readFileSync(path.join(raiz, 'scripts/diag-busca-shopee.mjs'), 'utf8')

test('o diagnóstico é read-only: não grava, não envia, não mexe em automação', () => {
  for (const proibido of ['.create(', '.update(', '.delete(', '.upsert(', 'sendBroadcast', 'runAutomation']) {
    assert.ok(
      !fonte.includes(proibido),
      `scripts/diag-busca-shopee.mjs não pode usar "${proibido}" — ele só consulta e imprime`,
    )
  }
})

test('usa a MESMA busca do robô em vez de reimplementar a consulta', () => {
  assert.match(fonte, /from '\.\.\/src\/offerAutomation\/shopeeOffers\.js'/)
  assert.match(fonte, /fetchOffers/)
  // Script que remonta o GraphQL passa a discordar do produto em silêncio.
  assert.ok(!fonte.includes('productOfferV2('), 'não montar a query da Shopee aqui')
  assert.ok(!fonte.includes('open-api.affiliate'), 'não falar direto com o endpoint aqui')
  assert.ok(!fonte.includes('createHash'), 'não reimplementar a assinatura da Shopee aqui')
})

test('falha de credencial é impressa, nunca engolida', () => {
  // Lição do diag-assinatura-recusada.mjs: `.catch(() => ...)` transformava
  // erro em "não achei", e a resposta errada virava conclusão.
  assert.ok(!/catch\s*\{\s*creds\s*=\s*null\s*\}/.test(fonte))
  assert.match(fonte, /console\.error\(`\[credencial\]/)
})

test('compara as três listas e as cinco ordens da API', () => {
  for (const valor of ['listType 0', 'listType 1', 'listType 2']) {
    assert.ok(fonte.includes(valor), `falta ${valor} na comparação`)
  }
  for (const valor of ['sortType 1', 'sortType 2', 'sortType 3', 'sortType 4', 'sortType 5']) {
    assert.ok(fonte.includes(valor), `falta ${valor} na comparação`)
  }
})

test('não converte a comissão por palpite', () => {
  // A escala de `commissionRate` (0,15 ou 15) não está verificada em lugar
  // nenhum do repositório — é justamente o que esta medição existe para dizer.
  assert.ok(!/commissionRate\s*\)\s*\*\s*100/.test(fonte))
})
