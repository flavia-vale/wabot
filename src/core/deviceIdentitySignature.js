// RCA 2026-09-28 ("Aguardando mensagem", parte 5): a carteirinha do aparelho
// (`account.deviceSignature`) precisa ser assinada com o prefixo [6,1] — sempre,
// também em conta hosted. A 6.7.23 assinava com [6,6] nessas contas e todo
// celular de fora rejeitava o aparelho: cada oferta do robô ficava em
// "Aguardando mensagem" para quem não é da conta.
//
// Este módulo é a rede de segurança: confere a assinatura guardada e, se ela
// foi feita com [6,6] (ou não confere), refaz com a chave privada atual e
// [6,1]. Puro: recebe o `creds`, devolve o diagnóstico e altera só o campo
// `account.deviceSignature` quando `apply` é true. Sem rede, sem disco.
import libsignal from 'libsignal'

export const DEVICE_SIG_PREFIX = Buffer.from([6, 1])
export const HOSTED_DEVICE_SIG_PREFIX_LEGACY = Buffer.from([6, 6])

function toBuffer(value) {
  if (!value) return null
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') return Buffer.from(value, 'base64')
  if (value.type === 'Buffer' && typeof value.data === 'string') return Buffer.from(value.data, 'base64')
  if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)
  return null
}

const withKeyType = (pub) => (pub.length === 33 ? pub : Buffer.concat([Buffer.from([5]), pub]))

// `Curve.verify` do Baileys 6.7.23 devolve true para qualquer assinatura;
// aqui a resposta é a do libsignal.
export function verifySignature(pubKey, message, signature) {
  try {
    return libsignal.curve.verifySignature(withKeyType(pubKey), message, signature) === true
  } catch {
    return false
  }
}

function deviceMessage(prefix, details, identityPub, accountSignatureKey) {
  return Buffer.concat([prefix, details, identityPub, accountSignatureKey])
}

// Devolve { status, changed }:
//   status 'unpaired'  — sem account/identidade (conta ainda não pareada)
//   status 'ok'        — assinatura já confere com [6,1]
//   status 'fixed'     — estava com [6,6] (ou inválida) e foi refeita (changed=true quando apply)
//   status 'needs-fix' — mesma coisa, mas apply=false (nada alterado)
//   status 'unfixable' — refazer não conferiu com a pública (par de chaves quebrado)
export function ensureDeviceSignaturePrefix(creds, { apply = true } = {}) {
  const account = creds?.account
  const identityPub = toBuffer(creds?.signedIdentityKey?.public)
  const identityPriv = toBuffer(creds?.signedIdentityKey?.private)
  const details = toBuffer(account?.details)
  const accountSignatureKey = toBuffer(account?.accountSignatureKey)
  if (!account || !identityPub || !identityPriv || !details || !accountSignatureKey) {
    return { status: 'unpaired', changed: false }
  }
  const current = toBuffer(account.deviceSignature)
  const goodMessage = deviceMessage(DEVICE_SIG_PREFIX, details, identityPub, accountSignatureKey)
  if (current && verifySignature(identityPub, goodMessage, current)) {
    return { status: 'ok', changed: false }
  }
  const wasLegacyHosted = Boolean(current) && verifySignature(identityPub, deviceMessage(HOSTED_DEVICE_SIG_PREFIX_LEGACY, details, identityPub, accountSignatureKey), current)
  let recomputed
  try {
    recomputed = Buffer.from(libsignal.curve.calculateSignature(identityPriv, goodMessage))
  } catch {
    return { status: 'unfixable', changed: false, wasLegacyHosted }
  }
  if (!verifySignature(identityPub, goodMessage, recomputed)) {
    return { status: 'unfixable', changed: false, wasLegacyHosted }
  }
  if (!apply) return { status: 'needs-fix', changed: false, wasLegacyHosted }
  account.deviceSignature = recomputed
  return { status: 'fixed', changed: true, wasLegacyHosted }
}
