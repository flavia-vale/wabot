// Regras do CONTATO ATIVO semanal. Puro, sem banco e sem rede.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  OUTREACH_SEGMENTS,
  classifyOutreachSegment,
  describeOutreachSegment,
} from '../src/domain/admin/outreachSegments.js'

const AGORA = new Date('2026-09-13T12:00:00Z')
const DIA = 24 * 60 * 60 * 1000
const diasAtras = n => new Date(AGORA.getTime() - n * DIA)
const emDias = n => new Date(AGORA.getTime() + n * DIA)

// Conta saudável: acesso longe de vencer, publicando, loja e robô no ar.
const saudavel = {
  status: 'active',
  createdAt: diasAtras(200),
  accessExpiresAt: emDias(25),
  everSent: true,
  lastSentAt: diasAtras(1),
  hasCredential: true,
  waEverConnected: true,
  waConnected: true,
  waSince: diasAtras(30),
}

test('cliente sem motivo nenhum NÃO entra em lista de contato', () => {
  assert.equal(classifyOutreachSegment(saudavel, AGORA), null)
})

test('os cinco grupos pedidos pela dona do produto existem e estão marcados', () => {
  const pedidos = OUTREACH_SEGMENTS.filter(s => s.pedido).map(s => s.id)
  assert.deepEqual(pedidos, [
    'venceu-ate-3d',
    'venceu-4-a-20d',
    'venceu-mais-20d',
    'sem-envio-ate-7d',
    'sem-envio-8-a-20d',
  ])
})

test('as três janelas de vencimento não se sobrepõem', () => {
  const base = { ...saudavel, accessExpiresAt: null }
  const grupoPara = dias => classifyOutreachSegment({ ...base, accessExpiresAt: diasAtras(dias) }, AGORA)
  assert.equal(grupoPara(0.5), 'venceu-ate-3d')
  assert.equal(grupoPara(3), 'venceu-ate-3d')
  assert.equal(grupoPara(4), 'venceu-4-a-20d')
  assert.equal(grupoPara(20), 'venceu-4-a-20d')
  assert.equal(grupoPara(21), 'venceu-mais-20d')
  assert.equal(grupoPara(400), 'venceu-mais-20d')
})

test('quem tem renovação automática ligada não entra em lista de cobrança', () => {
  const vencido = { ...saudavel, accessExpiresAt: diasAtras(2), subscriptionActive: true }
  assert.notEqual(classifyOutreachSegment(vencido, AGORA), 'venceu-ate-3d')

  const vencendo = { ...saudavel, accessExpiresAt: emDias(2), subscriptionActive: true }
  assert.notEqual(classifyOutreachSegment(vencendo, AGORA), 'vence-em-breve')
})

test('conta nova que nunca publicou entra nas janelas de 7 e de 20 dias', () => {
  const nunca = { ...saudavel, everSent: false, lastSentAt: null }
  assert.equal(classifyOutreachSegment({ ...nunca, createdAt: diasAtras(3) }, AGORA), 'sem-envio-ate-7d')
  assert.equal(classifyOutreachSegment({ ...nunca, createdAt: diasAtras(7) }, AGORA), 'sem-envio-ate-7d')
  assert.equal(classifyOutreachSegment({ ...nunca, createdAt: diasAtras(9) }, AGORA), 'sem-envio-8-a-20d')
  assert.equal(classifyOutreachSegment({ ...nunca, createdAt: diasAtras(20) }, AGORA), 'sem-envio-8-a-20d')
  // Passou de 20 dias sem nunca publicar e com o acesso em dia: já foi
  // procurada duas vezes, não vira lista semanal de novo.
  assert.equal(classifyOutreachSegment({ ...nunca, createdAt: diasAtras(40) }, AGORA), null)
})

test('cada cliente entra em UM grupo só — o de maior prioridade', () => {
  // Vencida ontem, robô caído, sem loja e sem nunca ter publicado: um caso só,
  // não quatro mensagens na mesma semana.
  const tudoErrado = {
    status: 'active',
    createdAt: diasAtras(5),
    accessExpiresAt: diasAtras(1),
    everSent: false,
    hasCredential: false,
    waEverConnected: true,
    waConnected: false,
    waSince: diasAtras(10),
  }
  assert.equal(classifyOutreachSegment(tudoErrado, AGORA), 'venceu-ate-3d')
})

test('cobrança recusada vem antes de tudo, mas some quando ela pagou depois', () => {
  const recusada = { ...saudavel, lastRejectedChargeAt: diasAtras(2) }
  assert.equal(classifyOutreachSegment(recusada, AGORA), 'cobranca-recusada')

  const pagouDepois = { ...recusada, lastApprovedPaymentAt: diasAtras(1) }
  assert.equal(classifyOutreachSegment(pagouDepois, AGORA), null)

  const recusaAntiga = { ...saudavel, lastRejectedChargeAt: diasAtras(30) }
  assert.equal(classifyOutreachSegment(recusaAntiga, AGORA), null)
})

test('"ela desligou o robô" NUNCA vira aviso de robô caído', () => {
  const caiu = { ...saudavel, waConnected: false, waSince: diasAtras(4) }
  assert.equal(classifyOutreachSegment(caiu, AGORA), 'robo-caido')

  const desligou = { ...caiu, waStoppedByUser: true }
  assert.notEqual(classifyOutreachSegment(desligou, AGORA), 'robo-caido')
})

test('conta bloqueada nunca entra em lista de contato', () => {
  for (const status of ['banned', 'suspended']) {
    assert.equal(classifyOutreachSegment({ ...saudavel, accessExpiresAt: diasAtras(2), status }, AGORA), null)
  }
})

test('sem loja cadastrada é grupo próprio — o robô não publica nada e nada avisa', () => {
  const semLoja = { ...saudavel, hasCredential: false }
  assert.equal(classifyOutreachSegment(semLoja, AGORA), 'sem-loja')
})

test('quem publicava e parou há uma semana é procurada', () => {
  const parou = { ...saudavel, lastSentAt: diasAtras(9) }
  assert.equal(classifyOutreachSegment(parou, AGORA), 'parou-de-enviar')
})

test('dado ausente não inventa grupo (fail-safe: não procurar)', () => {
  assert.equal(classifyOutreachSegment({ status: 'active' }, AGORA), null)
  assert.equal(classifyOutreachSegment({}, AGORA), null)
})

test('todo grupo explica por que existe e o que dizer', () => {
  for (const s of OUTREACH_SEGMENTS) {
    assert.ok(s.titulo && s.porque && s.acao, `grupo ${s.id} sem texto`)
    assert.equal(describeOutreachSegment(s.id).id, s.id)
  }
})

test('o script é read-only: nenhuma escrita no banco', () => {
  const fonte = readFileSync(new URL('../scripts/contato-ativo-semanal.mjs', import.meta.url), 'utf8')
  for (const escrita of ['.create(', '.update(', '.delete(', '.upsert(', 'sendTemplateEmail', 'sendMail']) {
    assert.ok(!fonte.includes(escrita), `script não pode chamar ${escrita}`)
  }
})
