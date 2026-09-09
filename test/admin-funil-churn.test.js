// E1/E2 do plano de ativação de 2026-09-08 — separar "nunca ativou" de
// "ativou e largou".
//
// Na medição de 60 dias, 52 contas tiveram envio real e só 19 seguiam
// conectadas. As outras 33 viram o robô funcionando e hoje estão fora — e o
// funil as contava junto com quem está usando agora e não comprou. As duas
// conversas são opostas: "por que você não comprou" e "por que você parou de
// usar".
//
// Puro: sem banco, sem rede.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildActivationFunnel,
  classifyStallReason,
  describeStallReason,
  STALL_REASONS,
} from '../src/domain/admin/funnel.js'

const entregou = {
  triedPairing: true,
  connected: true,
  hasCredential: true,
  hasSourceGroup: true,
  hasDestGroup: true,
  attempted: true,
  delivered: true,
  checkout: false,
  paid: false,
}

test('quem entregou e continua conectada segue no motivo de sempre', () => {
  assert.equal(classifyStallReason({ ...entregou, stillConnected: true }), 'sent_no_checkout')
})

test('entregou, desligou por escolha → é decisão, não defeito', () => {
  const motivo = classifyStallReason({ ...entregou, stillConnected: false, stoppedByUser: true })
  assert.equal(motivo, 'activated_then_stopped')
  assert.match(describeStallReason(motivo).hint, /decisão/)
})

test('entregou e a conexão caiu → é confiabilidade, não preço', () => {
  const motivo = classifyStallReason({ ...entregou, stillConnected: false, stoppedByUser: false })
  assert.equal(motivo, 'activated_then_dropped')
  assert.match(describeStallReason(motivo).hint, /confiabilidade/)
})

test('sem saber se está conectada, NÃO acusa churn', () => {
  // Consulta que falhou ou chamada antiga: dado faltando não pode virar
  // acusação de que a cliente largou o produto.
  assert.equal(classifyStallReason({ ...entregou }), 'sent_no_checkout')
  assert.equal(classifyStallReason({ ...entregou, stillConnected: undefined }), 'sent_no_checkout')
  assert.equal(classifyStallReason({ ...entregou, stillConnected: null }), 'sent_no_checkout')
})

test('quem pagou continua sem motivo nenhum', () => {
  assert.equal(classifyStallReason({ ...entregou, paid: true, stillConnected: false }), null)
})

test('quem nunca entregou não vira churn', () => {
  // Desconectada e sem nunca ter publicado nada é outro problema — e vem antes
  // na ordem, porque é o primeiro obstáculo que ela encontrou.
  const motivo = classifyStallReason({
    ...entregou, delivered: false, attempted: false, hasCredential: false, stillConnected: false,
  })
  assert.equal(motivo, 'no_credential')
})

test('os dois motivos novos estão no catálogo, com o que fazer', () => {
  const chaves = STALL_REASONS.map((r) => r.key)
  for (const chave of ['activated_then_stopped', 'activated_then_dropped']) {
    assert.ok(chaves.includes(chave), `${chave} fora do catálogo`)
    const r = describeStallReason(chave)
    assert.ok(r.label && r.hint, chave)
  }
})

test('a tela fala em linguagem de gente', () => {
  for (const chave of ['activated_then_stopped', 'activated_then_dropped', 'sent_no_checkout']) {
    const r = describeStallReason(chave)
    const texto = `${r.label} ${r.hint}`.toLowerCase()
    for (const jargao of ['churn', 'coorte', 'wasession', 'analyticsevent', 'funil de conversão']) {
      assert.ok(!texto.includes(jargao), `"${jargao}" em ${chave}`)
    }
  }
})

// --- O funil montado ----------------------------------------------------------

const users = [
  { id: 'a', createdAt: new Date('2026-09-01T10:00:00Z'), name: 'Ana', email: 'a@x.com' },
  { id: 'b', createdAt: new Date('2026-09-01T10:00:00Z'), name: 'Bia', email: 'b@x.com' },
  { id: 'c', createdAt: new Date('2026-09-01T10:00:00Z'), name: 'Cida', email: 'c@x.com' },
]
const entrega = new Map(users.map((u) => [u.id, new Date('2026-09-02T10:00:00Z')]))

test('o funil separa as três situações', () => {
  const resultado = buildActivationFunnel({
    users,
    connectedUserIds: new Set(['a', 'b', 'c']),
    firstDeliveryByUserId: entrega,
    triedPairingUserIds: new Set(['a', 'b', 'c']),
    credentialUserIds: new Set(['a', 'b', 'c']),
    sourceGroupUserIds: new Set(['a', 'b', 'c']),
    destGroupUserIds: new Set(['a', 'b', 'c']),
    attemptedUserIds: new Set(['a', 'b', 'c']),
    stillConnectedUserIds: new Set(['a']),
    stoppedByUserIds: new Set(['b']),
  })
  const porChave = Object.fromEntries(resultado.stalls.map((s) => [s.key, s.count]))
  assert.equal(porChave.sent_no_checkout, 1, 'a continua usando')
  assert.equal(porChave.activated_then_stopped, 1, 'b desligou por escolha')
  assert.equal(porChave.activated_then_dropped, 1, 'c caiu')
})

test('sem a foto de quem está conectada, o funil não inventa churn', () => {
  // Conjunto vazio = não sabemos. Antes de existir essa informação, todas caíam
  // em `sent_no_checkout` — é esse o comportamento que precisa ser preservado.
  const resultado = buildActivationFunnel({
    users,
    connectedUserIds: new Set(['a', 'b', 'c']),
    firstDeliveryByUserId: entrega,
    triedPairingUserIds: new Set(['a', 'b', 'c']),
    credentialUserIds: new Set(['a', 'b', 'c']),
    sourceGroupUserIds: new Set(['a', 'b', 'c']),
    destGroupUserIds: new Set(['a', 'b', 'c']),
    attemptedUserIds: new Set(['a', 'b', 'c']),
  })
  const porChave = Object.fromEntries(resultado.stalls.map((s) => [s.key, s.count]))
  assert.equal(porChave.sent_no_checkout, 3)
  assert.equal(porChave.activated_then_dropped, undefined)
})

test('a lista de quem contatar continua curta e sem telefone', () => {
  const muitos = Array.from({ length: 30 }, (_, i) => ({
    id: `u${i}`, createdAt: new Date('2026-09-01T10:00:00Z'), name: `N${i}`, email: `u${i}@x.com`,
  }))
  const resultado = buildActivationFunnel({
    users: muitos,
    connectedUserIds: new Set(muitos.map((u) => u.id)),
    firstDeliveryByUserId: new Map(muitos.map((u) => [u.id, new Date('2026-09-02T10:00:00Z')])),
    triedPairingUserIds: new Set(muitos.map((u) => u.id)),
    credentialUserIds: new Set(muitos.map((u) => u.id)),
    sourceGroupUserIds: new Set(muitos.map((u) => u.id)),
    destGroupUserIds: new Set(muitos.map((u) => u.id)),
    attemptedUserIds: new Set(muitos.map((u) => u.id)),
    stillConnectedUserIds: new Set(['u0']),
  })
  const caidos = resultado.stalls.find((s) => s.key === 'activated_then_dropped')
  assert.equal(caidos.count, 29)
  assert.equal(caidos.people.length, 8, 'a lista existe para começar a conversa, não para virar exportação')
  for (const p of caidos.people) assert.ok(!('phone' in p))
})
