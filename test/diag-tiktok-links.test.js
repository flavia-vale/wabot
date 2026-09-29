import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  anonymizeUser,
  buildTiktokReport,
  classifyTiktokUrl,
  extractTiktokShapes,
  printTiktokReport,
} from '../scripts/diag-tiktok-links.mjs'

test('classifica produto, vídeo, link curto e vitrine sem confundir host falso', () => {
  assert.equal(classifyTiktokUrl('https://www.tiktok.com/view/product/123?x=1'), 'produto')
  assert.equal(classifyTiktokUrl('https://www.tiktok.com/@loja/video/456'), 'video')
  assert.equal(classifyTiktokUrl('https://vt.tiktok.com/ZS123/'), 'curto_ambiguo')
  assert.equal(classifyTiktokUrl('https://shop.tiktok.com/mall/campanha'), 'vitrine_campanha')
  assert.equal(classifyTiktokUrl('https://tiktok.com.evil.net/view/product/123'), null)
})

test('extrai apenas formatos e não expõe URL ou ID de produto', () => {
  const row = {
    originalUrl: 'https://www.tiktok.com/view/product/segredo-123?affiliate=terceiro',
    convertedUrl: '',
    messageText: 'veja também https://vm.tiktok.com/segredo-curto/',
  }
  assert.deepEqual(extractTiktokShapes(row), ['produto', 'curto_ambiguo'])
  assert.match(anonymizeUser('user-real'), /^conta-[a-f0-9]{8}$/)
  assert.doesNotMatch(anonymizeUser('user-real'), /user-real/)
})

test('separa demanda agregada da amostra incompleta do MessageLog', async () => {
  const db = {
    analyticsEvent: { findMany: async () => [
      { metadata: JSON.stringify({ domain: 'tiktok.com', day: '2026-09-28', count: 12 }) },
      { metadata: JSON.stringify({ domain: 'temu.com', day: '2026-09-28', count: 99 }) },
    ] },
    messageLog: {
      count: async () => 50,
      findMany: async () => [{
        userId: 'u1',
        originalUrl: 'https://www.tiktok.com/view/product/123',
        convertedUrl: '',
        messageText: '',
        sentAt: new Date('2026-09-28T12:00:00Z'),
      }],
    },
  }
  const report = await buildTiktokReport(db, { now: Date.parse('2026-09-29T12:00:00Z') })
  assert.equal(report.demandTotal, 12)
  assert.equal(report.unsupportedTotal, 111)
  assert.equal(report.coverage, 'tiktok_observado')
  assert.equal(report.observableRows, 1)
  assert.equal(report.byKind.get('produto'), 1)

  const lines = []
  printTiktokReport(report, (line) => lines.push(line))
  const output = lines.join('\n')
  assert.match(output, /Demanda registrada \(tiktok\.com\): 12/)
  assert.match(output, /Amostra observável.*não é o total/)
  assert.doesNotMatch(output, /\/view\/product\/123/)
})

test('zero só é conclusivo quando outra loja prova que a telemetria funcionou', async () => {
  const makeDb = ({ events, messages }) => ({
    analyticsEvent: { findMany: async () => events },
    messageLog: { findMany: async () => [], count: async () => messages },
  })
  const otherStore = [{ metadata: JSON.stringify({ domain: 'temu.com', day: '2026-09-28', count: 3 }) }]
  const provenZero = await buildTiktokReport(makeDb({ events: otherStore, messages: 20 }))
  assert.equal(provenZero.coverage, 'zero_tiktok_com_telemetria')

  const missingTelemetry = await buildTiktokReport(makeDb({ events: [], messages: 20 }))
  assert.equal(missingTelemetry.coverage, 'inconclusivo_sem_telemetria')
  const lines = []
  printTiktokReport(missingTelemetry, line => lines.push(line))
  assert.match(lines.join('\n'), /INCONCLUSIVA.*nenhuma telemetria/)

  const noActivity = await buildTiktokReport(makeDb({ events: [], messages: 0 }))
  assert.equal(noActivity.coverage, 'inconclusivo_sem_atividade')
})

test('diagnóstico é read-only', () => {
  const source = readFileSync(new URL('../scripts/diag-tiktok-links.mjs', import.meta.url), 'utf8')
  for (const forbidden of [
    'analyticsEvent.create', 'analyticsEvent.update', 'analyticsEvent.delete',
    'messageLog.create', 'messageLog.update', 'messageLog.delete',
    'sendMessage', 'sendMail',
  ]) {
    assert.ok(!source.includes(forbidden), `diagnóstico não pode conter ${forbidden}`)
  }
})
