// O "dia" do teto de envio começa às 8h de Brasília, não numa janela
// deslizante de 24h. Puro: sem banco, sem rede, sem SMTP.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveDailyWindowStart,
  nextDailyWindowStart,
  resolveDailyResetHour,
  resolveEmailTimeZone,
  describeWindowStart,
} from '../src/email/dailyWindow.js'
import { sentInCurrentWindow, resolveDailyCap } from '../src/email/dispatcher.js'

// Brasília é UTC-3: 8h daqui é 11h UTC.
const OITO_DA_MANHA_UTC = 11

test('depois das 8h, o dia vigente começou hoje às 8h', () => {
  const start = resolveDailyWindowStart(new Date('2026-08-18T18:00:00Z')) // 15h de Brasília
  assert.equal(start.toISOString(), `2026-08-18T${String(OITO_DA_MANHA_UTC).padStart(2, '0')}:00:00.000Z`)
})

test('antes das 8h, o dia vigente ainda é o de ontem', () => {
  const start = resolveDailyWindowStart(new Date('2026-08-18T09:00:00Z')) // 6h de Brasília
  assert.equal(start.toISOString(), '2026-08-17T11:00:00.000Z')
})

test('exatamente às 8h já vale o dia novo', () => {
  const start = resolveDailyWindowStart(new Date('2026-08-18T11:00:00Z'))
  assert.equal(start.toISOString(), '2026-08-18T11:00:00.000Z')

  const umMinutoAntes = resolveDailyWindowStart(new Date('2026-08-18T10:59:00Z'))
  assert.equal(umMinutoAntes.toISOString(), '2026-08-17T11:00:00.000Z')
})

test('a próxima virada é sempre 24h depois do início do dia vigente', () => {
  for (const instante of ['2026-08-18T09:00:00Z', '2026-08-18T11:00:00Z', '2026-08-18T23:30:00Z']) {
    const inicio = resolveDailyWindowStart(new Date(instante))
    const proxima = nextDailyWindowStart(new Date(instante))
    assert.equal(proxima.getTime() - inicio.getTime(), 24 * 60 * 60 * 1000, `errou em ${instante}`)
    assert.ok(proxima.getTime() > new Date(instante).getTime(), `próxima virada no passado em ${instante}`)
  }
})

test('a hora da virada é configurável e cai no padrão quando o valor não presta', () => {
  assert.equal(resolveDailyResetHour({}), 8)
  assert.equal(resolveDailyResetHour({ EMAIL_DAILY_RESET_HOUR: '6' }), 6)
  assert.equal(resolveDailyResetHour({ EMAIL_DAILY_RESET_HOUR: '0' }), 0)
  assert.equal(resolveDailyResetHour({ EMAIL_DAILY_RESET_HOUR: '25' }), 8)
  assert.equal(resolveDailyResetHour({ EMAIL_DAILY_RESET_HOUR: 'manhã' }), 8)

  const seisDaManha = resolveDailyWindowStart(new Date('2026-08-18T12:00:00Z'), { hour: 6 })
  assert.equal(seisDaManha.toISOString(), '2026-08-18T09:00:00.000Z')
})

test('fuso inválido não trava o envio: cai no horário de Brasília', () => {
  const start = resolveDailyWindowStart(new Date('2026-08-18T18:00:00Z'), { timeZone: 'Marte/Olympus' })
  assert.equal(start.toISOString(), '2026-08-18T11:00:00.000Z')
  assert.equal(resolveEmailTimeZone({}), 'America/Sao_Paulo')
})

test('data inválida não quebra: devolve uma janela utilizável', () => {
  const start = resolveDailyWindowStart('não é data')
  assert.ok(start instanceof Date && !Number.isNaN(start.getTime()))
})

test('o teto conta só o que saiu depois da virada das 8h', async () => {
  let filtro = null
  const db = {
    emailSendLog: {
      count: async ({ where }) => {
        filtro = where
        return 7
      },
    },
  }
  const total = await sentInCurrentWindow({ db, now: new Date('2026-08-18T18:00:00Z') })
  assert.equal(total, 7)
  assert.equal(filtro.status, 'sent')
  assert.equal(filtro.createdAt.gte.toISOString(), '2026-08-18T11:00:00.000Z')
})

test('teto diário padrão é 300 e a env manda', () => {
  assert.equal(resolveDailyCap({}), 300)
  assert.equal(resolveDailyCap({ EMAIL_DAILY_CAP: '50' }), 50)
  assert.equal(resolveDailyCap({ EMAIL_DAILY_CAP: '0' }), 0, 'zero desliga o teto')
  assert.equal(resolveDailyCap({ EMAIL_DAILY_CAP: 'muitos' }), 300)
})

test('a etiqueta da virada é legível em português', () => {
  const label = describeWindowStart(new Date('2026-08-19T11:00:00Z'))
  assert.match(label, /19\/08/)
  assert.match(label, /08:00/)
})
