import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isRefusalEvidenceConclusive,
  resolveRefusalEvidenceMinCount,
  resolveRefusalEvidenceWindowMs,
} from '../src/credentialExpiry/policy.js'
import { loadRefusalEvidence } from '../src/credentialExpiry/sweep.js'

// RCA 2026-08-20: duas clientes ficaram 4 e 7 dias com o código do Mercado
// Livre recusado (1.697 e 1.042 recusas gravadas) sem UM aviso. O e-mail
// dependia só da sondagem, e a sondagem do ML disputa a trava de credencial com
// o bot — volta `busy`/`null`, que nunca vira aviso. Agora a recusa registrada
// nos envios também confirma. Não regredir.

test('volume de recusa SEM nenhum link curto é conclusivo', () => {
  assert.equal(isRefusalEvidenceConclusive({ refusals: 1697, shortLinks: 0, minRefusals: 20 }), true)
})

test('um único link curto na janela derruba a conclusão', () => {
  // Credencial viva com instabilidade pontual não pode virar "seu código venceu".
  assert.equal(isRefusalEvidenceConclusive({ refusals: 1697, shortLinks: 1, minRefusals: 20 }), false)
})

test('poucas recusas não bastam', () => {
  assert.equal(isRefusalEvidenceConclusive({ refusals: 5, shortLinks: 0, minRefusals: 20 }), false)
})

test('defaults: janela de 24h e 20 recusas', () => {
  assert.equal(resolveRefusalEvidenceWindowMs({}), 24 * 60 * 60 * 1000)
  assert.equal(resolveRefusalEvidenceMinCount({}), 20)
  assert.equal(resolveRefusalEvidenceWindowMs({ CREDENTIAL_REFUSAL_EVIDENCE_WINDOW_HOURS: '6' }), 6 * 60 * 60 * 1000)
  assert.equal(resolveRefusalEvidenceMinCount({ CREDENTIAL_REFUSAL_EVIDENCE_MIN_COUNT: '3' }), 3)
})

test('loja sem marcador conhecido nunca é conclusiva pela evidência', async () => {
  const db = { messageLog: { count: async () => { throw new Error('não deveria consultar') } } }
  const res = await loadRefusalEvidence({ db, userId: 'u1', platform: 'amazon' })
  assert.deepEqual(res, { refusals: 0, shortLinks: 0, conclusive: false })
})

test('conta o que o painel mostra: recusas x links curtos', async () => {
  const queries = []
  const db = {
    messageLog: {
      count: async (args) => {
        queries.push(args.where)
        return args.where.errorMsg ? 40 : 0
      },
    },
  }
  const res = await loadRefusalEvidence({ db, userId: 'u1', platform: 'mercadolivre', env: {} })
  assert.equal(res.refusals, 40)
  assert.equal(res.shortLinks, 0)
  assert.equal(res.conclusive, true)
  assert.match(queries[0].errorMsg.contains, /ml_ssid_expired/)
  assert.match(queries[1].convertedUrl.contains, /meli\.la/)
})

test('banco indisponível não vira aviso (cai para a sondagem)', async () => {
  const db = { messageLog: { count: async () => { throw new Error('db fora') } } }
  const res = await loadRefusalEvidence({ db, userId: 'u1', platform: 'mercadolivre' })
  assert.equal(res.conclusive, false)
})
