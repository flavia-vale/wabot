import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildRsyncCommand, planAccountMove } from '../src/supervisor/accountMove.js'

const nos = (over = {}) => [
  { nodeId: 'n1', alive: true, running: 40, max: 80, ...(over.n1 ?? {}) },
  { nodeId: 'n2', alive: true, running: 5, max: 40, ...(over.n2 ?? {}) },
]
const row = { nodeId: null, status: 'connected', lifecycle: 'ready' }

test('MN-16: move n1 (nulo) -> n2 vivo e com vaga', () => {
  const p = planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: row, nodes: nos() })
  assert.equal(p.ok, true)
  assert.equal(p.sourceNode, 'n1')
})

test('MN-16: recusa mesmo servidor, destino morto, lotado, sem teto e sem medição', () => {
  assert.match(planAccountMove({ userId: 'u1', targetNode: 'n1', sessionRow: row, nodes: nos() }).errors.join(), /já está no servidor "n1"/)
  assert.match(planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: row, nodes: nos({ n2: { alive: false } }) }).errors.join(), /não está respondendo/)
  assert.match(planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: row, nodes: nos({ n2: { running: 40 } }) }).errors.join(), /lotado \(40\/40\)/)
  assert.match(planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: row, nodes: nos({ n2: { max: null } }) }).errors.join(), /não informou quantas vagas/)
  assert.match(planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: row, nodes: nos({ n2: { running: null } }) }).errors.join(), /não consegui medir/i)
})

test('MN-16: recusa destino desconhecido, id inválido, sem sessão e pareamento em andamento', () => {
  assert.equal(planAccountMove({ userId: 'u1', targetNode: 'n9', sessionRow: row, nodes: nos() }).ok, false)
  assert.equal(planAccountMove({ userId: 'u1', targetNode: 'N:2', sessionRow: row, nodes: nos() }).ok, false)
  assert.equal(planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: null, nodes: nos() }).ok, false)
  assert.match(planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: { nodeId: null, status: 'connecting', lifecycle: 'qr' }, nodes: nos() }).errors.join(), /pareamento/)
})

test('MN-16: origem fora do ar vira AVISO forte (não bloqueia, mas exige certeza)', () => {
  const p = planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: row, nodes: nos({ n1: { alive: false } }) })
  assert.equal(p.ok, true)
  assert.match(p.warnings.join(), /NÃO está ligado em lugar nenhum/)
})

test('MN-16: mensagens em linguagem leiga', () => {
  const p = planAccountMove({ userId: 'u1', targetNode: 'n2', sessionRow: row, nodes: nos({ n2: { running: 40 } }) })
  for (const m of [...p.errors, ...p.warnings]) assert.doesNotMatch(m, /heartbeat|bullmq|redis|shard|worker/i)
})

test('MN-16: comando de cópia puxa da origem para o destino, pasta com barra final', () => {
  assert.equal(buildRsyncCommand({ authDir: '/srv/auth_info/u1/', sourceHost: 'root@10.0.0.1' }), 'rsync -a --checksum --delete root@10.0.0.1:/srv/auth_info/u1/ /srv/auth_info/u1/')
  assert.match(buildRsyncCommand({ authDir: '/x/u1' }), /<usuario@servidor-de-origem>:\/x\/u1\//)
  assert.throws(() => buildRsyncCommand({}), /authDir/)
})

test('MN-16: o script é simulação por padrão, exige --auth-copiado e recusa sem a flag de roteamento', () => {
  const src = readFileSync(new URL('../scripts/mover-conta-no.mjs', import.meta.url), 'utf8')
  assert.match(src, /if \(!aplicar\) \{ console\.log\('\\n\(simulação\)/)
  assert.match(src, /if \(!flag\('auth-copiado'\)\)/)
  assert.match(src, /isNodeRoutingEnabled\(process\.env\)/)
  assert.match(src, /Desfazendo: parando no destino, voltando e religando na origem/)
})
