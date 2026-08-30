import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveOfferAppearance } from '../src/core/imageModePolicy.js'

const worker = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// "Como a oferta aparece" é decidido pelo GRUPO DE DESTINO, e só por ele —
// venha a oferta de espelhamento, de fila, de oferta automática, de
// agendamento ou de broadcast manual.
//
// A escolha por fila (e a escolha única das ofertas automáticas) chegou a
// existir nesta branch e foi retirada antes de ir ao ar: como o caminho de
// broadcast não lia o formato do destino, a fila sobrepunha o grupo EM
// SILÊNCIO — a pessoa marcava "card" no grupo, a oferta saía como foto e não
// havia erro em lugar nenhum.

test('a receita de envio leva o formato do GRUPO DE DESTINO', () => {
  assert.match(worker, /const broadcastPostDetail = \(await getConfig\(\)\)\.groups\.postDetails\.find\(g => g\.waJid === jid\)/)
  assert.match(worker, /appearance: resolveOfferAppearance\(broadcastPostDetail, \{ hasChannelButton: !!broadcastChannelForward \}\)/)
})

// Deixar a agendada de fora faria o MESMO grupo se comportar diferente
// conforme a esteira que enviou — exatamente a incoerência que este ajuste
// existe para acabar.
test('a mensagem agendada segue a mesma regra do broadcast', () => {
  assert.match(worker, /appearance: resolveOfferAppearance\(scheduledPostDetail, \{ hasChannelButton: !!scheduledChannelForward \}\)/)
})

test('todo caminho de receita resolve o formato pelo destino, nenhum inventa o seu', () => {
  const chamadas = worker.split('buildBroadcastImageRecipe(').length - 1
  // 1 declaração + os call sites; cada call site precisa levar a aparência.
  const comAparencia = worker.split('appearance: resolveOfferAppearance(').length - 1
  assert.equal(comAparencia, chamadas - 1, 'todo call site precisa levar o formato do destino')
})

// A fila e as ofertas automáticas NÃO podem ter formato próprio: seria a
// segunda configuração para a mesma decisão, e uma sobreporia a outra.
test('fila e ofertas automáticas não guardam formato próprio', () => {
  for (const arquivo of ['../src/offerQueue/dispatcher.js', '../src/offerAutomation/dispatcher.js', '../src/api/routes/offerQueue.js', '../src/api/routes/offerAutomation.js']) {
    const src = readFileSync(new URL(arquivo, import.meta.url), 'utf8')
    assert.doesNotMatch(src, /imageMode|watermark/i, `${arquivo} não pode ter formato próprio — quem decide é o grupo de destino`)
  }
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
  const blocoFila = schema.slice(schema.indexOf('model OfferQueue {'), schema.indexOf('model OfferQueueItem {'))
  assert.doesNotMatch(blocoFila, /imageMode|watermark/i, 'OfferQueue não pode guardar formato próprio')
  const blocoConfig = schema.slice(schema.indexOf('model BotConfig {'), schema.indexOf('model FollowLog {'))
  assert.doesNotMatch(blocoConfig, /automationImageMode|automationWatermark/i, 'BotConfig não pode guardar formato das automáticas')
})

// As telas de fila e de automáticas dizem ONDE o formato é escolhido — sem
// isso a pessoa procura a configuração e não acha.
test('as telas de fila e de automáticas apontam para os grupos', () => {
  for (const arquivo of ['../dashboard/app/painel/filas/page.js', '../dashboard/app/painel/ofertas-automaticas/page.js']) {
    const page = readFileSync(new URL(arquivo, import.meta.url), 'utf8')
    assert.match(page, /Como a oferta aparece/, `${arquivo} precisa dizer onde o formato é escolhido`)
    assert.match(page, /painel\/grupos/, `${arquivo} precisa levar a pessoa até os grupos`)
  }
})

// REGRESSÃO: a escolha é resolvida ao montar a receita e resolvida DE NOVO no
// dequeue. Como a saída tem outro formato da entrada, a segunda passada não
// achava `imageMode`, caía em 'original' e a escolha sumia INTEIRA — sem erro
// em lugar nenhum, que é o pior jeito de falhar.
test('resolver o formato duas vezes dá o mesmo resultado', () => {
  const destinos = [
    { imageMode: 'preview_watermark', watermarkText: 'Ofertas da Ana', watermarkColor: 'black' },
    { imageMode: 'original_watermark', watermarkText: 'Achadinhos', watermarkColor: null },
    { imageMode: 'preview' },
    undefined,
  ]
  for (const destino of destinos) {
    const primeira = resolveOfferAppearance(destino)
    assert.deepEqual(resolveOfferAppearance(primeira), primeira, `mudou ao resolver de novo: ${JSON.stringify(destino)}`)
  }
})

test('destino sem formato salvo mantém a foto da oferta', () => {
  assert.deepEqual(resolveOfferAppearance(undefined), { mode: 'original', baseMode: 'original', watermark: null })
  assert.deepEqual(resolveOfferAppearance({ imageMode: 'fetch' }), { mode: 'original', baseMode: 'original', watermark: null })
})
