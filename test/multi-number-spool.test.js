import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, utimes, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spoolPayload, unspoolPayload, removeSpoolFiles, sweepSpool } from '../src/core/sendSpool.js'
import { proto } from '@whiskeysockets/baileys'

const codec = {
  encodeProto: m => proto.Message.encode(m).finish(),
  decodeProto: b => proto.Message.decode(b),
  isProtoMessage: v => v instanceof proto.Message,
}

test('ida e volta: Buffer de imagem e proto da mensagem original atravessam como arquivo', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spool-'))
  const original = proto.Message.fromObject({ imageMessage: { caption: 'oferta', mimetype: 'image/jpeg' } })
  const payload = { image: Buffer.from('JPEGDATA'), caption: 'Oferta!', relay: { type: 'imageMessage', proto: original }, fallbacks: [{ text: 'só texto' }] }
  const spooled = await spoolPayload(payload, { dir, jobId: 'log/1', ...codec })
  assert.equal(spooled.files.length, 2)
  const json = JSON.parse(JSON.stringify(spooled.payload)) // o que passa pelo Redis
  assert.ok(json.image.__spool && json.relay.proto.__proto)
  const back = await unspoolPayload(json, { dir, decodeProto: codec.decodeProto })
  assert.equal(back.image.toString(), 'JPEGDATA')
  assert.equal(back.caption, 'Oferta!')
  assert.equal(back.relay.proto.imageMessage.caption, 'oferta')
  assert.deepEqual(back.fallbacks, [{ text: 'só texto' }])
  await removeSpoolFiles({ dir, files: spooled.files })
  assert.deepEqual(await readdir(dir), [])
})

test('função não atravessa: recusa e não deixa arquivo para trás', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spool-'))
  await assert.rejects(spoolPayload({ image: Buffer.from('x'), build: () => 1 }, { dir, jobId: 'l2', ...codec }))
  assert.deepEqual(await readdir(dir), [])
})

test('nome de arquivo vindo do Redis não escapa da pasta', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spool-'))
  await assert.rejects(unspoolPayload({ image: { __spool: '../segredo.bin' } }, { dir, decodeProto: codec.decodeProto }))
  await assert.rejects(unspoolPayload({ image: { __spool: 'x.txt' } }, { dir, decodeProto: codec.decodeProto }))
})

test('limpeza: apaga por idade e depois os mais velhos até caber no teto', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spool-'))
  const now = Date.now()
  const mk = async (name, ageMs, size) => {
    await writeFile(join(dir, name), Buffer.alloc(size))
    const t = new Date(now - ageMs)
    await utimes(join(dir, name), t, t)
  }
  await mk('velho.bin', 25 * 3600_000, 10)
  await mk('a.bin', 3000, 100)
  await mk('b.bin', 2000, 100)
  await mk('c.bin', 1000, 100)
  const r = await sweepSpool({ dir, maxBytes: 150, now })
  assert.equal(r.removed, 3)
  assert.deepEqual(await readdir(dir), ['c.bin'])
})

test('estrutural: espelhamento no rodízio só com a flag própria; outro número lê do spool; limpa no fim', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /const MIRROR_ROTATION_ON = ROTATION_ON && String\(process\.env\.MULTI_NUMBER_ROTATION_RELAY/)
  assert.match(src, /else if \(job\.preparedPayload\) payload = await unspoolPayload\(/)
  assert.match(src, /if \(Array\.isArray\(job\?\.spoolFiles\) && job\.spoolFiles\.length\) await removeSpoolFiles/)
  // Montado uma vez só: se não der para rotear, o envio local reaproveita.
  assert.match(src, /normalizedJob\.buildPayload = async \(\) => payload/)
})
