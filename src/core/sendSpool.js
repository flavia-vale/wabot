// Spool de envio entre os números da conta (vários números, Fase 2b —
// docs/rca/multi-numero.md). O número ativo monta o envio do ESPELHAMENTO
// (que tem Buffer de mídia e o proto da mensagem original — nada disso
// atravessa o Redis) e grava em disco; o outro número lê e envia. Os dois
// processos da conta moram no mesmo nó (Fase 1), então o disco é o mesmo.
//
// Regra: o que vai para o Redis é só texto (nomes de arquivo). Buffer vira
// arquivo; proto do WhatsApp vira bytes (encode) em arquivo; função = recusa.
import { mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'

const SPOOL_FILE = /^[A-Za-z0-9._-]+\.bin$/

function safeName(raw) {
  return String(raw ?? '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
}

// `encodeProto(message) → Uint8Array` e `isProtoMessage(value)` são injetados
// (bot-worker passa o proto do Baileys) — o módulo fica testável sem Baileys.
export async function spoolPayload(payload, { dir, jobId, encodeProto, isProtoMessage = () => false }) {
  await mkdir(dir, { recursive: true })
  const files = []
  let n = 0
  const store = async bytes => {
    const name = `${safeName(jobId)}-${n++}.bin`
    await writeFile(join(dir, name), bytes)
    files.push(name)
    return name
  }
  const walk = async value => {
    if (value === null || value === undefined) return value
    if (typeof value === 'function') throw new Error('spool: função não atravessa processo')
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __spool: await store(Buffer.from(value)) }
    if (isProtoMessage(value)) return { __proto: await store(Buffer.from(encodeProto(value))) }
    if (Array.isArray(value)) return Promise.all(value.map(walk))
    if (typeof value === 'object') {
      if (typeof value.toNumber === 'function' && 'low' in value && 'high' in value) return { __long: String(value) }
      const out = {}
      for (const [k, v] of Object.entries(value)) out[k] = await walk(v)
      return out
    }
    return value
  }
  try {
    return { payload: await walk(payload), files }
  } catch (err) {
    await removeSpoolFiles({ dir, files })
    throw err
  }
}

export async function unspoolPayload(serialized, { dir, decodeProto }) {
  const read = async name => {
    if (!SPOOL_FILE.test(String(name)) || basename(name) !== name) throw new Error('spool: nome de arquivo inválido')
    return readFile(join(dir, name))
  }
  const walk = async value => {
    if (value === null || value === undefined || typeof value !== 'object') return value
    if (Array.isArray(value)) return Promise.all(value.map(walk))
    if (typeof value.__spool === 'string') return read(value.__spool)
    if (typeof value.__proto === 'string') return decodeProto(await read(value.__proto))
    if (typeof value.__long === 'string') return Number(value.__long)
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = await walk(v)
    return out
  }
  return walk(serialized)
}

export async function removeSpoolFiles({ dir, files = [] }) {
  await Promise.all(files.filter(f => SPOOL_FILE.test(String(f))).map(f => rm(join(dir, f), { force: true }).catch(() => {})))
}

// Limpeza: apaga o que passou da idade e, se ainda passar do teto, os mais
// velhos primeiro. Nunca lança.
export async function sweepSpool({ dir, maxAgeMs = 24 * 3600_000, maxBytes = 512 * 1024 * 1024, now = Date.now() } = {}) {
  let entries = []
  try {
    entries = await Promise.all((await readdir(dir)).filter(f => SPOOL_FILE.test(f)).map(async f => ({ f, s: await stat(join(dir, f)) })))
  } catch {
    return { removed: 0 }
  }
  let removed = 0
  const keep = []
  for (const e of entries) {
    if (now - e.s.mtimeMs > maxAgeMs) { await rm(join(dir, e.f), { force: true }).catch(() => {}); removed++ } else keep.push(e)
  }
  keep.sort((a, b) => a.s.mtimeMs - b.s.mtimeMs)
  let total = keep.reduce((acc, e) => acc + e.s.size, 0)
  for (const e of keep) {
    if (total <= maxBytes) break
    await rm(join(dir, e.f), { force: true }).catch(() => {})
    total -= e.s.size
    removed++
  }
  return { removed }
}
