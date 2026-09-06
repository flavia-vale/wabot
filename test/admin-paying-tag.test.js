import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PAYING_STATUS, resolvePayingStatus, withPayingStatus } from '../src/domain/admin/payingStatus.js'
import { describeDisconnectReason } from '../src/domain/admin/disconnectReason.js'

const AGORA = new Date('2026-09-05T12:00:00Z').getTime()

test('quem nunca teve pagamento aprovado não recebe tag', () => {
  const r = resolvePayingStatus({ everPaid: false, accessExpiresAt: '2027-01-01', now: AGORA })
  assert.equal(r.status, PAYING_STATUS.NEVER)
  assert.equal(r.isPaying, false)
})

test('pagou e o acesso está em dia = Pagante', () => {
  const r = resolvePayingStatus({ everPaid: true, accessExpiresAt: '2026-10-01', now: AGORA })
  assert.equal(r.status, PAYING_STATUS.PAYING)
  assert.equal(r.label, 'Pagante')
})

test('pagou e o acesso venceu = Já foi pagante (não some da tela)', () => {
  const r = resolvePayingStatus({ everPaid: true, accessExpiresAt: '2026-08-01', now: AGORA })
  assert.equal(r.status, PAYING_STATUS.FORMER)
  assert.equal(r.everPaid, true)
  assert.equal(r.isPaying, false)
})

test('pagou e não tem data de validade continua pagante', () => {
  // Acesso liberado sem prazo. Tirar a tag por falta de dado mentiria para
  // menos justamente sobre quem paga.
  assert.equal(resolvePayingStatus({ everPaid: true, accessExpiresAt: null, now: AGORA }).status, PAYING_STATUS.PAYING)
})

test('withPayingStatus preserva a linha e anexa os campos da tela', () => {
  const row = withPayingStatus({ id: 'u1', email: 'a@b.c', accessExpiresAt: '2026-10-01' }, { everPaid: true, now: AGORA })
  assert.equal(row.id, 'u1')
  assert.equal(row.payingStatus, PAYING_STATUS.PAYING)
  assert.equal(row.payingLabel, 'Pagante')
  assert.equal(row.everPaid, true)
})

test('a tag NUNCA sai do campo plan — só de pagamento aprovado', () => {
  // Liberação manual de acesso também escreve `plan`. Se a regra olhasse esse
  // campo, a operação veria verde em quem nunca pagou.
  const row = withPayingStatus({ plan: 'pro', accessExpiresAt: '2026-12-01' }, { everPaid: false, now: AGORA })
  assert.equal(row.payingStatus, PAYING_STATUS.NEVER)
})

test('a tag acompanha a cliente em TODA superfície de sucesso do cliente', () => {
  // Lista e diálogo: onde o nome da cliente aparece, a tag aparece junto.
  // "Ajustar plano" é o caso que mais importa — mexer no plano de quem já pagou
  // não é a mesma coisa que liberar acesso de cortesia.
  const filaCs = readFileSync(new URL('../dashboard/app/admin/sucesso-cliente/page.js', import.meta.url), 'utf8')
  const ocorrencias = filaCs.match(/<PayingTag/g) ?? []
  assert.ok(ocorrencias.length >= 3, `esperava a tag na lista e nos dois diálogos, achei ${ocorrencias.length}`)
  assert.match(filaCs, /contactTarget\.payingStatus/)
  assert.match(filaCs, /accessTarget\.payingStatus/)

  const painel = readFileSync(new URL('../dashboard/app/admin/page.js', import.meta.url), 'utf8')
  // As duas listas da aba "Sucesso do Cliente" do /admin.
  assert.match(painel, /customer\?\.payingStatus/, 'fila proativa sem a tag')
  assert.match(painel, /user\?\.payingStatus/, 'gestão de clientes sem a tag')
})

test('existe um jeito de responder "por que a tag não aparece" sem abrir o banco', () => {
  // A causa mais comum não é a tela: staging tem banco próprio, e sem pagamento
  // aprovado lá ninguém pode receber a tag. O script separa os dois casos.
  const diag = readFileSync(new URL('../scripts/diag-tag-pagante.mjs', import.meta.url), 'utf8')
  assert.match(diag, /status: 'approved'/)
  assert.match(diag, /NÃO É DEFEITO DE TELA/)
  assert.match(diag, /resolvePayingStatus/)
})

test('a regra da tag mora num lugar só', () => {
  const service = readFileSync(new URL('../src/domain/admin/service.js', import.meta.url), 'utf8')
  assert.match(service, /withPayingStatus/, 'as listas do admin precisam usar o módulo, não recalcular a regra')
})

// ------------------------------------------------------------ por que caiu

test('acesso vencido ganha nome próprio, mesmo com código de queda antigo gravado', () => {
  const r = describeDisconnectReason({ owner: 'acesso_vencido', lastDisconnectCode: '401' })
  assert.equal(r.label, 'O acesso venceu')
})

test('401 e 403 não caem no mesmo balde — a ação é oposta', () => {
  const deslogada = describeDisconnectReason({ owner: 'cliente', lastDisconnectCode: '401' })
  const bloqueada = describeDisconnectReason({ owner: 'bloqueio', lastDisconnectCode: '403' })
  assert.notEqual(deslogada.label, bloqueada.label)
  assert.match(deslogada.detail, /QR/)
  assert.match(bloqueada.detail, /outro número/)
})

test('parada sem ninguém tentando diz que um clique resolve', () => {
  const r = describeDisconnectReason({ owner: 'ninguem', lastDisconnectCode: '428' })
  assert.equal(r.label, 'Parada e ninguém tentando')
  assert.equal(r.tone, 'red')
})

test('conta sem sessão nenhuma não vira "caiu"', () => {
  const r = describeDisconnectReason({ hasSession: false })
  assert.equal(r.label, 'Nunca chegou a conectar')
})

test('motivo sem código conhecido ainda é frase, nunca número cru', () => {
  const r = describeDisconnectReason({ owner: null, lastDisconnectCode: '515' })
  assert.equal(r.code, '515')
  assert.doesNotMatch(r.label, /\d/)
})

test('nenhum jargão técnico chega ao rótulo lido pela operação', () => {
  const casos = [
    { owner: 'ninguem', lastDisconnectCode: '428' },
    { owner: 'robo' },
    { owner: 'cliente_desligou' },
    { owner: 'acesso_vencido' },
    { hasSession: false },
    { lastDisconnectCode: '405' },
    { lastDisconnectCode: '440' },
    {},
  ]
  const proibido = /socket|stream|handshake|baileys|lifecycle|session|payload|worker/i
  for (const caso of casos) {
    const r = describeDisconnectReason(caso)
    assert.doesNotMatch(r.label, proibido, `rótulo com jargão: ${r.label}`)
    assert.doesNotMatch(r.detail, proibido, `detalhe com jargão: ${r.detail}`)
  }
})
