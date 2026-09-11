import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { findDestinationsWithoutQueue } from '../dashboard/lib/painel/queueCoverage.js'

const PAGE = readFileSync(new URL('../dashboard/app/painel/filas/page.js', import.meta.url), 'utf8')

const grupo = (name, waJid) => ({ id: name, name, waJid, role: 'post' })
const G1 = grupo('Maternidade #1', '1@g.us')
const G2 = grupo('Maternidade #2', '2@g.us')
const G3 = grupo('Essência do Lar', '3@g.us')

test('aponta o grupo de destino que nenhuma fila alcança', () => {
  const fora = findDestinationsWithoutQueue([G1, G2, G3], [{ targetJids: ['1@g.us', '2@g.us'] }])
  assert.deepEqual(fora.map((g) => g.waJid), ['3@g.us'])
})

test('grupo coberto por qualquer uma das filas não é apontado', () => {
  const fora = findDestinationsWithoutQueue([G1, G2, G3], [
    { targetJids: ['1@g.us'] },
    { targetJids: ['2@g.us', '3@g.us'] },
  ])
  assert.deepEqual(fora, [])
})

test('lista de destinos vazia significa TODOS os grupos e zera o aviso', () => {
  // Comportamento legado de Group.targetJids: '[]' = todos os grupos de postagem.
  // Tratar isso como "nenhum destino" acusaria a conta inteira de estar fora.
  const fora = findDestinationsWithoutQueue([G1, G2, G3], [{ targetJids: [] }])
  assert.deepEqual(fora, [])
})

test('fila pausada conta como cobertura (o aviso é sobre configuração, não sobre pausa)', () => {
  const fora = findDestinationsWithoutQueue([G1], [{ enabled: false, targetJids: ['1@g.us'] }])
  assert.deepEqual(fora, [])
})

test('sem fila nenhuma não avisa — a tela já diz que não há fila criada', () => {
  assert.deepEqual(findDestinationsWithoutQueue([G1, G2], []), [])
})

test('entrada ausente ou malformada nunca quebra a tela', () => {
  assert.deepEqual(findDestinationsWithoutQueue(), [])
  assert.deepEqual(findDestinationsWithoutQueue(null, null), [])
  assert.deepEqual(findDestinationsWithoutQueue([G1], [{ targetJids: null }]), [])
  assert.deepEqual(findDestinationsWithoutQueue([{ name: 'sem jid' }], [{ targetJids: ['1@g.us'] }]), [])
})

test('a tela de Filas renderiza o aviso', () => {
  assert.match(PAGE, /findDestinationsWithoutQueue/)
  assert.match(PAGE, /destinationsWithoutQueue\.length > 0/)
})

test('o aviso fala a língua da cliente, sem jargão', () => {
  const trecho = PAGE.slice(PAGE.indexOf('destinationsWithoutQueue.length > 0'), PAGE.indexOf('{showForm &&'))
  for (const jargao of ['targetJids', 'waJid', 'jid', 'queue', 'broadcast', 'payload']) {
    assert.equal(trecho.toLowerCase().includes(jargao.toLowerCase()) && !trecho.includes('destinationsWithoutQueue'), false)
  }
  assert.match(trecho, /não estão em nenhuma fila|não está em nenhuma fila/)
  assert.match(trecho, /edite uma fila e marque o grupo/)
  // Não pode dizer que o grupo está sem receber NADA: o espelhamento continua
  // entregando nele. Foi exatamente essa confusão que gerou o chamado.
  assert.match(trecho, /grupos monitorados/)
})
