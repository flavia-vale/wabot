import test from 'node:test'
import assert from 'node:assert/strict'
import { scanPidLog, verdictFromScan } from '../src/core/blindPidLogScan.js'

const L = (pid, obj) => JSON.stringify({ level: 30, time: 1_790_000_000_000, pid, hostname: 'h', ...obj })

test('conta só as linhas do pid pedido e separa cada rastro', () => {
  const text = [
    L(10, { msg: 'mensagem recebida', jid: 'a@g.us' }),
    L(11, { msg: 'mensagem recebida', jid: 'a@g.us' }),
    L(11, { msg: 'messages.upsert recebido', type: 'notify', count: 1 }),
    L(11, { msg: 'messages.upsert recebido', type: 'append', count: 1 }),
    L(11, { msg: 'failed to decrypt message', key: { remoteJid: 'b@g.us' } }),
    L(11, { msg: 'failed to decrypt message', key: { remoteJid: 'c@lid' } }),
    L(11, { msg: 'sent retry receipt' }),
    L(11, { msg: 'wabot: mensagem de outro aparelho da conta chegou ao socket' }),
    L(11, { msg: 'wabot: DM de outro aparelho da conta fora do escopo confirmada com ack, sem abrir' }),
    L(11, { msg: 'Conversa fora da lista de escolhidos: confirmada e descartada sem tentar abrir' }),
    L(11, { msg: 'stream errored out', node: { tag: 'stream:error', attrs: {}, content: [{ tag: 'ack', attrs: { class: 'message', id: '3EB0', from: 'x@lid' } }] } }),
    L(11, { msg: 'Filtros de recepção deste robô', ignoreUnmonitoredGroups: true, chatScopeMode: 'dm', inboundCensusIntervalMs: 1800000 }),
    L(11, { msg: 'offline preview received {"tag":"ib","attrs":{},"content":[{"tag":"offline_preview","attrs":{"count":"3"}}]}' }),
    L(11, { msg: 'fila offline do WhatsApp: servidor terminou de entregar', phase: 'entregue', offlineCount: 3, appendUpserts: 0, notifyUpserts: 0, acceptedSinceOpen: 0 }),
    L(11, { msg: 'Censo de entrada do socket na janela', arrivals: { dm: 4 }, ignored: { 'dm:escopo': 4 }, decryptFailures: {}, upserts: {}, accepted: {}, conectado: true, cegueira: { kind: 'nada_chega' } }),
    L(11, { msg: 'Sessão conectada e SEM receber mensagens', motivo: 'x', cegueira: { kind: 'nada_chega' }, quedasComMensagemTravada: 25 }),
  ].join('\n')
  const r = scanPidLog(text, 11)
  assert.equal(r.linhas, 15)
  assert.equal(r.aceitas, 1)
  assert.equal(r.upserts, 2)
  assert.equal(r.upsertsNotify, 1)
  assert.equal(r.decryptFails, 2)
  assert.equal(r.decryptFailsGrupo, 1)
  assert.equal(r.retryReceipts, 1)
  assert.equal(r.outroAparelhoChegou, 1)
  assert.equal(r.dmOutroAparelhoDescartada, 1)
  assert.equal(r.escopoDescartes, 1)
  assert.equal(r.streamErrors, 1)
  assert.deepEqual(r.streamErrorAcks, { dm: 1 })
  assert.deepEqual(r.filtros, { ignoreUnmonitoredGroups: true, chatScopeMode: 'dm', inboundCensusIntervalMs: 1800000 })
  assert.equal(r.offlinePreviews.length, 1)
  assert.match(r.offlinePreviews[0].msg, /"count":"3"/)
  assert.equal(r.filaOffline[0].offlineCount, 3)
  assert.equal(r.censoLinhas, 1)
  assert.equal(r.censoGrupoChegou, 0)
  assert.equal(r.censoUltimo.cegueira, 'nada_chega')
  assert.equal(r.cegueiraSinais, 1)
  assert.equal(r.cegueiraUltima.quedasComMensagemTravada, 25)
})

test('veredito: aceitas > 0 não é cegueira; censo sem grupo = nada chega (parear de novo)', () => {
  assert.equal(verdictFromScan(scanPidLog(L(1, { msg: 'mensagem recebida' }), 1)).nivel, 'ok')
  const cega = scanPidLog([
    L(2, { msg: 'Censo de entrada do socket na janela', arrivals: { dm: 9 }, ignored: {}, decryptFailures: {}, upserts: {} }),
    L(2, { msg: 'Censo de entrada do socket na janela', arrivals: {}, ignored: {}, decryptFailures: {}, upserts: {} }),
  ].join('\n'), 2)
  const v = verdictFromScan(cega, { conectado: true })
  assert.equal(v.nivel, 'nada_chega')
  assert.match(v.texto, /parear de novo/)
})

test('veredito: censo com grupo chegando separa descarte, chave ruim e filtro do worker', () => {
  const base = (extra) => scanPidLog(L(3, { msg: 'Censo de entrada do socket na janela', ...extra }), 3)
  assert.equal(verdictFromScan(base({ arrivals: { grupo: 5 }, ignored: { 'grupo:grupo_nao_monitorado': 5 }, decryptFailures: {}, upserts: {} })).nivel, 'descartada')
  assert.equal(verdictFromScan(base({ arrivals: { grupo: 5 }, ignored: {}, decryptFailures: { grupo: 5 }, upserts: {} })).nivel, 'nao_abre')
  assert.equal(verdictFromScan(base({ arrivals: { grupo: 5 }, ignored: {}, decryptFailures: {}, upserts: { grupo: 5 } })).nivel, 'filtro_worker')
})

test('veredito sem censo: usa o que o log antigo permite e diz que o censo falta', () => {
  const antigo = scanPidLog([
    L(4, { msg: 'Filtros de recepção deste robô', ignoreUnmonitoredGroups: true, chatScopeMode: 'dm' }),
    L(4, { msg: 'messages.upsert recebido', type: 'append', count: 1 }),
  ].join('\n'), 4)
  const v = verdictFromScan(antigo, { espelhavaAntes: true })
  assert.equal(v.nivel, 'indeterminado')
  assert.ok(v.linhas.some((l) => /SEM o censo/.test(l)))
  assert.ok(v.linhas.some((l) => /espelhava antes/.test(l)))
  assert.equal(verdictFromScan(scanPidLog(L(4, { msg: 'failed to decrypt message', key: { remoteJid: 'g@g.us' } }), 4)).nivel, 'nao_abre')
  assert.equal(verdictFromScan(scanPidLog('', 4)).nivel, 'sem_dado')
})

test('veredito: cópias de outro aparelho sem fim de fila offline e sem upsert = fila presa (caso Meta AI)', () => {
  const linhas = []
  for (let i = 0; i < 6; i++) linhas.push(L(5, { msg: 'wabot: mensagem de outro aparelho da conta chegou ao socket', id: `3A0${i}`, recipient: '867051314767696@bot', offline: '9' }))
  const r = scanPidLog(linhas.join('\n'), 5)
  assert.deepEqual(r.outroAparelhoRecipients, { '867051314767696@bot': 6 })
  assert.equal(r.offlineHandled, 0)
  const v = verdictFromScan(r, { conectado: true })
  assert.equal(v.nivel, 'fila_offline_presa')
  assert.match(v.texto, /867051314767696@bot ×6/)
  // Com a fila encerrada pelo servidor, o veredito volta ao indeterminado.
  const ok = scanPidLog([...linhas, L(5, { msg: 'handled 7 offline messages/notifications' })].join('\n'), 5)
  assert.equal(ok.offlineHandled, 1)
  assert.notEqual(verdictFromScan(ok).nivel, 'fila_offline_presa')
})
