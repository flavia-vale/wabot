// RCA 2026-09-28 ("Aguardando mensagem", parte 5): rede de segurança que refaz
// a carteirinha do aparelho assinada com o prefixo errado ([6,6]) a cada start.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import libsignal from 'libsignal'
import { initAuthCreds, proto } from '@whiskeysockets/baileys'
import { Curve } from '@whiskeysockets/baileys/lib/Utils/crypto.js'
import { ensureDeviceSignaturePrefix, verifySignature, DEVICE_SIG_PREFIX } from '../src/core/deviceIdentitySignature.js'

function pairedCreds(prefix) {
  const creds = initAuthCreds()
  const details = proto.ADVDeviceIdentity.encode({ rawId: 1, timestamp: 1, keyIndex: 3, accountType: 2 }).finish()
  const accountKey = Curve.generateKeyPair()
  const accountSignature = Curve.sign(accountKey.private, Buffer.concat([Buffer.from([6, 0]), details, creds.signedIdentityKey.public]))
  const deviceSignature = Buffer.from(libsignal.curve.calculateSignature(creds.signedIdentityKey.private, Buffer.concat([Buffer.from(prefix), details, creds.signedIdentityKey.public, accountKey.public])))
  creds.account = { details, accountSignatureKey: accountKey.public, accountSignature, deviceSignature }
  return creds
}

const goodMessage = (creds) => Buffer.concat([DEVICE_SIG_PREFIX, creds.account.details, creds.signedIdentityKey.public, creds.account.accountSignatureKey])

test('conta assinada com [6,6] (hosted na 6.7.23) é refeita com [6,1] e passa a conferir', () => {
  const creds = pairedCreds([6, 6])
  assert.equal(verifySignature(creds.signedIdentityKey.public, goodMessage(creds), creds.account.deviceSignature), false)
  const r = ensureDeviceSignaturePrefix(creds)
  assert.deepEqual({ status: r.status, changed: r.changed, wasLegacyHosted: r.wasLegacyHosted }, { status: 'fixed', changed: true, wasLegacyHosted: true })
  assert.equal(verifySignature(creds.signedIdentityKey.public, goodMessage(creds), creds.account.deviceSignature), true)
  assert.equal(ensureDeviceSignaturePrefix(creds).status, 'ok')
})

test('conta já certa não é tocada; apply=false só diagnostica; conta não pareada é ignorada', () => {
  const ok = pairedCreds([6, 1])
  const before = Buffer.from(ok.account.deviceSignature)
  assert.equal(ensureDeviceSignaturePrefix(ok).status, 'ok')
  assert.equal(Buffer.compare(before, ok.account.deviceSignature), 0)

  const legacy = pairedCreds([6, 6])
  const r = ensureDeviceSignaturePrefix(legacy, { apply: false })
  assert.deepEqual({ status: r.status, changed: r.changed }, { status: 'needs-fix', changed: false })
  assert.equal(verifySignature(legacy.signedIdentityKey.public, goodMessage(legacy), legacy.account.deviceSignature), false)

  assert.equal(ensureDeviceSignaturePrefix(initAuthCreds()).status, 'unpaired')
  assert.equal(ensureDeviceSignaturePrefix(null).status, 'unpaired')
})

test('aceita o formato gravado em disco (BufferJSON) e refaz do mesmo jeito', () => {
  const creds = pairedCreds([6, 6])
  const toJson = (b) => ({ type: 'Buffer', data: Buffer.from(b).toString('base64') })
  const onDisk = {
    signedIdentityKey: { public: toJson(creds.signedIdentityKey.public), private: toJson(creds.signedIdentityKey.private) },
    account: { details: toJson(creds.account.details), accountSignatureKey: toJson(creds.account.accountSignatureKey), accountSignature: toJson(creds.account.accountSignature), deviceSignature: toJson(creds.account.deviceSignature) },
  }
  assert.equal(ensureDeviceSignaturePrefix(onDisk).status, 'fixed')
  assert.equal(verifySignature(creds.signedIdentityKey.public, goodMessage(creds), onDisk.account.deviceSignature), true)
})

test('par de chaves quebrado (pública de outra identidade) vira "unfixable", sem alterar nada', () => {
  const creds = pairedCreds([6, 6])
  creds.signedIdentityKey.public = initAuthCreds().signedIdentityKey.public
  const before = Buffer.from(creds.account.deviceSignature)
  const r = ensureDeviceSignaturePrefix(creds)
  assert.equal(r.status, 'unfixable')
  assert.equal(Buffer.compare(before, creds.account.deviceSignature), 0)
})

test('bot-worker confere a assinatura logo depois de carregar o auth_info e grava se refez', () => {
  const src = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  assert.match(src, /import \{ ensureDeviceSignaturePrefix \} from '\.\/core\/deviceIdentitySignature\.js'/)
  const loadAt = src.indexOf('await useMultiFileAuthState(AUTH_DIR)')
  const checkAt = src.indexOf('ensureDeviceSignaturePrefix(state.creds)')
  const socketAt = src.indexOf('const sock = makeWASocket({')
  assert.ok(loadAt > 0 && checkAt > loadAt && checkAt < socketAt, 'a conferência fica entre carregar o auth_info e criar o socket')
  assert.match(src.slice(checkAt, socketAt), /if \(deviceSig\.changed\) \{\s*await saveCreds\(\)/)
})
