import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { isQueueClearedLog, QUEUE_CLEARED_ERROR_MSG, clearUserQueuedSendLogs } from '../src/jobs/stuckSendLogs.js'

// RCA 2026-10-01: "Limpar ofertas da fila" (aba Envios) só marcava a linha
// como skip:queue_cleared no banco. O job continuava na fila do robô, saía
// mesmo assim e voltava a aparecer como "enviando". Agora o robô lê a linha
// antes de enviar e antes de re-enfileirar, e descarta o job removido.

const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

function fnBody(name) {
  const start = src.indexOf(`async function ${name}(`)
  assert.notEqual(start, -1, `${name} não encontrada`)
  const next = src.indexOf('\nasync function ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

test('isQueueClearedLog: só a linha removida pela cliente conta como cancelada', () => {
  assert.equal(QUEUE_CLEARED_ERROR_MSG, 'skip:queue_cleared')
  assert.equal(isQueueClearedLog({ status: 'skipped', errorMsg: 'skip:queue_cleared' }), true)
  assert.equal(isQueueClearedLog({ status: 'queued', errorMsg: 'Esperando o intervalo entre destinos que você definiu no Anti-banimento.' }), false)
  assert.equal(isQueueClearedLog({ status: 'sending', errorMsg: null }), false)
  assert.equal(isQueueClearedLog({ status: 'skipped', errorMsg: 'skip:outside_send_window' }), false)
  assert.equal(isQueueClearedLog(null), false)
})

test('clearUserQueuedSendLogs grava exatamente a marca que o robô reconhece', async () => {
  let data = null
  const db = { messageLog: { updateMany: async (args) => { data = args.data; return { count: 3 } } } }
  const out = await clearUserQueuedSendLogs({ db, userId: 'u1', now: () => new Date(0) })
  assert.equal(out.cleared, 3)
  assert.equal(isQueueClearedLog(data), true)
})

test('processSendJob confere se a oferta foi removida ANTES de marcar "enviando" e de enviar', () => {
  const body = fnBody('processSendJob')
  const idxCheck = body.indexOf('isQueueClearedLog(current)')
  const idxSending = body.indexOf("status: 'sending'")
  assert.notEqual(idxCheck, -1, 'processSendJob precisa checar isQueueClearedLog')
  assert.ok(idxCheck < idxSending, 'a checagem precisa vir antes de marcar a linha como sending')
  assert.match(body.slice(idxCheck, idxSending), /finishSendJob\(job, \{ ok: false, error: 'queue_cleared' \}\)[\s\S]*return/)
})

test('deferSendJob não re-enfileira oferta removida durante o processamento', () => {
  const body = fnBody('deferSendJob')
  assert.match(body, /updateMany\(\{\s*where: \{ id: job\.logId, status: \{ in: \['queued', 'sending'\] \} \}/)
  const idxGuard = body.indexOf('requeued.count === 0')
  const idxEnqueue = body.indexOf('sendBackend.enqueue(')
  assert.ok(idxGuard !== -1 && idxGuard < idxEnqueue, 'guarda precisa vir antes do re-enfileiramento')
})
