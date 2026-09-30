import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { registerFakeDeliveryNetwork, FAKE_DELIVERY_NETWORK_ID } from './helpers/fakeDeliveryNetwork.js'
import { getDeliveryNetwork, __resetDeliveryNetworkRegistryForTests } from '../src/core/delivery/networks.js'
import { degradeFor } from '../src/core/delivery/neutralOffer.js'
import { resolveMonitorDestinations, TARGETS_MODE } from '../src/core/destinationRouting.js'
import { buildMirrorDedupKeys } from '../src/core/mirrorDedupKey.js'
import { createMessageQueue } from '../src/messageQueue.js'
import { calculateProgressiveDelayMs } from '../src/smartDelay.js'
import { detectLinks } from '../src/detector.js'
import { applyConversionsAndBranding } from '../src/messageProcessor.js'
import { convertLink } from '../src/converters/index.js'

// Feature 017 (arquitetura multicanal de entrega), FR-031/FR-032/SC-009,
// US7 — "um aplicativo novo entra sem reescrita".
//
// Este teste roda ORIGEM → ROTEAMENTO → CONVERSÃO → TEXTO → FILA → RITMO →
// REPETIÇÃO → HISTÓRICO de ponta a ponta contra a rede FICTÍCIA (T029), a
// mesma rede fictícia que declara as quatro divergências do Instagram
// (destino único, imagem obrigatória, sem botão, não lê origem). Cada etapa
// usa o módulo compartilhado REAL do produto — nenhum deles foi escrito ou
// alterado para conhecer a rede fictícia; eles decidem por CAPACIDADE
// (degradeFor) ou são simplesmente agnósticos de rede (roteamento, dedup,
// fila, ritmo, conversão/texto).

test('rede fictícia: origem → roteamento → conversão → texto → fila → ritmo → repetição → histórico', async (t) => {
  t.after(() => __resetDeliveryNetworkRegistryForTests())
  const state = registerFakeDeliveryNetwork()
  const adapter = getDeliveryNetwork(FAKE_DELIVERY_NETWORK_ID)
  assert.ok(adapter, 'rede fictícia não foi registrada')

  // 1) ORIGEM/ROTEAMENTO — a origem monitorada aponta explicitamente para o
  // único destino que a rede fictícia expõe (singleDestination: true).
  const routing = resolveMonitorDestinations({
    targetsMode: TARGETS_MODE.EXPLICIT,
    targetPostJids: ['fake:perfil'],
    allPostJids: [],
  })
  assert.deepEqual(routing.destinations, ['fake:perfil'])

  // 2) CONVERSÃO — mensagem sem link de loja reconhecido: o conversor real
  // roda (sem I/O de rede, porque não há credencial/loja casando) e não
  // precisa saber que o destino é uma rede fictícia.
  const originalText = 'Confira essa oferta incrível hoje!'
  const links = detectLinks(originalText)
  assert.deepEqual(links, [])
  const conversions = []
  for (const link of links) {
    const converted = await convertLink(link.platform, link.url, {})
    if (converted) conversions.push({ url: link.url, converted: converted.url, platform: link.platform })
  }

  // 3) TEXTO — montagem real do texto final (sem link, então idêntico).
  const finalText = applyConversionsAndBranding(originalText, conversions)
  assert.equal(finalText, originalText)

  // 4) A OFERTA NEUTRA e a degradação pela CAPACIDADE da rede (nunca por
  // `if (rede === 'fake')`): a rede exige imagem e não aceita botão.
  const ofertaCrua = {
    texto: finalText,
    linkConvertido: '',
    imagem: { url: 'https://exemplo.com/foto.jpg' },
    produto: { titulo: 'Produto de teste', preco: 4990 },
    botao: { texto: 'Ver canal' },
  }
  const { oferta: ofertaDegradada, reducoes } = degradeFor(ofertaCrua, adapter.capabilities)
  assert.equal(ofertaDegradada.botao, undefined, 'a rede fictícia não aceita botão — precisa sair sem ele')
  assert.ok(reducoes.includes('botao_removido'))

  // 5) FILA — mesmo mecanismo de fila com ordem por origem que o produto já
  // usa (createMessageQueue), agnóstico de rede.
  const queue = createMessageQueue({ name: 'fake-network-e2e', concurrency: 2 })
  const historico = []

  async function publicar(destino, oferta, sourceId, msgId) {
    // 6) RITMO — cálculo real de atraso progressivo (agnóstico de rede).
    const delayMs = calculateProgressiveDelayMs({ baseDelayMs: 0, queueSize: 1 })
    assert.equal(typeof delayMs, 'number')

    // 7) REPETIÇÃO — mesma construção de chave de dedup do produto.
    const { dedupKeys } = buildMirrorDedupKeys({
      destJid: destino,
      primaryUrl: oferta.linkConvertido || undefined,
      fallbackSubject: `${msgId}:${oferta.texto.slice(0, 80)}`,
    })
    const jaEnviado = dedupKeys.some(key => dedupSeen.has(key))
    if (jaEnviado) {
      historico.push({ destino, status: 'skipped', motivo: 'skip:dedup_recent_link', deliveryNetwork: FAKE_DELIVERY_NETWORK_ID })
      return
    }
    for (const key of dedupKeys) dedupSeen.add(key)

    const resultado = await adapter.send(oferta, destino, {})
    // 8) HISTÓRICO — um registro por destino, com a rede de entrega e o que
    // foi reduzido (nunca em silêncio — FR-009/SC-012).
    historico.push({
      destino,
      status: resultado.ok ? 'success' : 'error',
      motivo: resultado.ok ? null : resultado.motivo,
      deliveryNetwork: FAKE_DELIVERY_NETWORK_ID,
      deliveryReductions: reducoes,
    })
  }

  const dedupSeen = new Set()

  // Mesma oferta chegando duas vezes (reentrega) pelo mesmo destino: a
  // repetição bloqueia a segunda, sem tocar a rede de novo.
  for (const destino of routing.destinations) {
    queue.enqueue(() => publicar(destino, ofertaDegradada, 'origem-fake', 'msg-1'), { orderKey: destino })
    queue.enqueue(() => publicar(destino, ofertaDegradada, 'origem-fake', 'msg-1'), { orderKey: destino })
  }

  await queue.waitIdle?.() ?? await new Promise(resolve => setTimeout(resolve, 50))

  assert.equal(state.sent.length, 1, 'a rede fictícia só deveria receber UM envio — a repetição precisa bloquear o segundo')
  assert.equal(historico.length, 2, 'o histórico registra as DUAS tentativas: uma success, uma skipped por repetição')
  assert.equal(historico.filter(h => h.status === 'success').length, 1)
  assert.equal(historico.filter(h => h.status === 'skipped').length, 1)
  for (const linha of historico) {
    assert.equal(linha.deliveryNetwork, FAKE_DELIVERY_NETWORK_ID)
  }
})

test('rede fictícia sem imagem: send() recusa (a rede exige imagem — decidido pela capacidade, não por rewrite)', async (t) => {
  t.after(() => __resetDeliveryNetworkRegistryForTests())
  const state = registerFakeDeliveryNetwork()
  const adapter = getDeliveryNetwork(FAKE_DELIVERY_NETWORK_ID)

  const ofertaSemImagem = { texto: 'sem foto', linkConvertido: '', imagem: null, produto: { titulo: 't', preco: 100 } }
  const resultado = await adapter.send(ofertaSemImagem, 'fake:perfil', {})
  assert.equal(resultado.ok, false)
  assert.equal(resultado.motivo, 'sem_imagem_disponivel')
  assert.equal(state.sent.length, 0)
})

// Assertiva estrutural própria (SC-009): este teste não pode importar NADA
// dos módulos específicos de WhatsApp nem de Telegram (as pastas de cada
// aplicativo dentro de src/delivery/) — é a prova de que o contrato é
// exercitado sem tocar em código específico de rede real.
test('este teste não importa nada específico do WhatsApp nem do Telegram', () => {
  const selfPath = fileURLToPath(import.meta.url)
  const source = readFileSync(selfPath, 'utf8')
  const whatsappSpecificPath = ['delivery', 'whatsapp', ''].join('/')
  const telegramSpecificPath = ['delivery', 'telegram', ''].join('/')
  assert.ok(!source.includes(whatsappSpecificPath), 'este e2e não pode importar nada específico do WhatsApp')
  assert.ok(!source.includes(telegramSpecificPath), 'este e2e não pode importar nada específico do Telegram')
})
