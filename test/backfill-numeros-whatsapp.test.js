import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { recordPhoneOwnership } from '../src/domain/session/phoneOwnership.js'
import { resolveSharedPhoneStatus } from '../src/domain/admin/sharedPhoneStatus.js'
import { loadSharedPhoneCounts } from '../src/domain/admin/sharedPhoneLoader.js'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = readFileSync(join(raiz, 'scripts', 'backfill-numeros-whatsapp.mjs'), 'utf-8')

// Banco de mentira com o mínimo que o caminho usa.
function bancoFalso() {
  const linhas = new Map()
  return {
    linhas,
    waPhoneOwnership: {
      async upsert({ where, update, create }) {
        const chave = `${where.phone_userId.phone}|${where.phone_userId.userId}`
        if (linhas.has(chave)) linhas.set(chave, { ...linhas.get(chave), ...update })
        else linhas.set(chave, { ...create })
        return linhas.get(chave)
      },
      async findMany({ where, select }) {
        const ids = where?.userId?.in
        const phones = where?.phone?.in
        return [...linhas.values()]
          .filter(l => (ids ? ids.includes(l.userId) : true))
          .filter(l => (phones ? phones.includes(l.phone) : true))
          .map(l => ({ userId: l.userId, phone: l.phone, ...(select?.firstConnectedAt ? { firstConnectedAt: l.firstConnectedAt } : {}) }))
      },
      async groupBy({ where }) {
        const phones = where?.phone?.in ?? []
        return phones.map(phone => ({
          phone,
          _count: { _all: [...linhas.values()].filter(l => l.phone === phone).length },
        }))
      },
    },
  }
}

test('número usado por duas contas vira tag depois do backfill', async () => {
  const db = bancoFalso()

  // O mesmo chip escrito de dois jeitos diferentes nas duas contas.
  await recordPhoneOwnership({ db, userId: 'conta-antiga', phone: '55 73 99999-1111' })
  await recordPhoneOwnership({ db, userId: 'conta-nova', phone: '+5573999991111' })

  const contagens = await loadSharedPhoneCounts(db, ['conta-antiga', 'conta-nova'])
  assert.equal(contagens.get('conta-nova'), 2, 'a normalização precisa juntar os dois formatos')

  const tag = resolveSharedPhoneStatus({ sharedPhoneAccounts: contagens.get('conta-nova') })
  assert.equal(tag.status, 'numero_repetido')
  assert.equal(tag.contas, 2)
})

test('conta sozinha com o número NÃO ganha tag', async () => {
  const db = bancoFalso()
  await recordPhoneOwnership({ db, userId: 'sozinha', phone: '5511999990000' })

  const contagens = await loadSharedPhoneCounts(db, ['sozinha'])
  assert.equal(resolveSharedPhoneStatus({ sharedPhoneAccounts: contagens.get('sozinha') }).status, null)
})

test('reconectar não duplica linha no histórico', async () => {
  const db = bancoFalso()
  await recordPhoneOwnership({ db, userId: 'mesma', phone: '5511999990000' })
  await recordPhoneOwnership({ db, userId: 'mesma', phone: '5511999990000' })
  assert.equal(db.linhas.size, 1)
})

test('o script importa a regra do produto em vez de reescrevê-la', () => {
  // Script que reimplementa a normalização passa a discordar do produto em
  // silêncio, e o histórico fica com dois formatos do mesmo número.
  assert.match(script, /from '\.\.\/src\/domain\/session\/phoneOwnership\.js'/)
  assert.match(script, /normalizeWaPhone/)
  assert.doesNotMatch(script, /waPhoneOwnership\.(create|upsert)\(/, 'a gravação precisa passar por recordPhoneOwnership')
})

test('o script não grava sem --aplicar', () => {
  assert.match(script, /const aplicar = process\.argv\.includes\('--aplicar'\)/)
  assert.match(script, /if \(!aplicar\)[\s\S]{0,200}return/)
})

test('erro do script aparece, nunca vira conclusão errada', () => {
  assert.match(script, /console\.error\('FALHOU:'/)
})
