// RCA 2026-09-28 (docs/rca/whatsapp-sessao.md, "Aguardando mensagem" — parte 5):
// em conta hosted (WhatsApp Business hospedado) a 6.7.23 assinava a carteirinha
// do aparelho com o prefixo [6,6]; whatsmeow e Baileys 7.x assinam sempre com
// [6,1]. Celulares de fora rejeitavam o aparelho e todas as mensagens do robô
// ficavam em "Aguardando mensagem". Em prod, 5 de 150 contas estavam assim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import libsignal from 'libsignal'
import { initAuthCreds, proto } from '@whiskeysockets/baileys'
import { Curve } from '@whiskeysockets/baileys/lib/Utils/crypto.js'

const verificar = (pub, msg, sig) => libsignal.curve.verifySignature(Buffer.concat([Buffer.from([5]), pub]), msg, sig) === true

test('patch: pareamento assina a carteirinha do aparelho sempre com [6,1], também em conta hosted', () => {
  const src = readFileSync(new URL('../node_modules/@whiskeysockets/baileys/lib/Utils/validate-connection.js', import.meta.url), 'utf8')
  assert.match(src, /const devicePrefix = Buffer\.from\(\[6, 1\]\);/)
  assert.doesNotMatch(src, /isHostedAccount \? Buffer\.from\(\[6, 6\]\)/)
})

test('assinatura feita com [6,6] não confere com [6,1] (é o que o celular de fora verifica); recalculada com [6,1] confere', () => {
  const creds = initAuthCreds()
  const details = proto.ADVDeviceIdentity.encode({ rawId: 1, timestamp: 1, keyIndex: 3, accountType: 2 }).finish()
  const accountKey = Curve.generateKeyPair()
  const msg = (prefix) => Buffer.concat([Buffer.from(prefix), details, creds.signedIdentityKey.public, accountKey.public])
  const errada = Buffer.from(libsignal.curve.calculateSignature(creds.signedIdentityKey.private, msg([6, 6])))
  assert.equal(verificar(creds.signedIdentityKey.public, msg([6, 1]), errada), false)
  const certa = Buffer.from(libsignal.curve.calculateSignature(creds.signedIdentityKey.private, msg([6, 1])))
  assert.equal(verificar(creds.signedIdentityKey.public, msg([6, 1]), certa), true)
})

test('Curve.verify do Baileys 6.7.23 aceita qualquer assinatura (por isso os diagnósticos usam o libsignal direto)', () => {
  const creds = initAuthCreds()
  assert.equal(Curve.verify(creds.signedIdentityKey.public, Buffer.from('x'), Buffer.alloc(64)), true)
})
