// Criptografia de credenciais em repouso (D-3).
//
// As credenciais de afiliado (cookie de sessão ML/Amazon, tokens OAuth, secret
// da Shopee) ficavam em texto puro no campo `Credential.data` do SQLite. Quem
// tivesse acesso ao arquivo `.db` (backup vazado, disco apreendido) lia tudo.
//
// Aqui ciframos esse campo com AES-256-GCM (autenticado — detecta adulteração)
// na camada de aplicação. O formato armazenado é texto puro compatível com o
// campo String do Prisma, sem migration de schema:
//
//     v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
//
// O prefixo de versão (`v1`) permite rotação de algoritmo/chave no futuro.
//
// Migração graciosa: `decryptCredential` devolve a string original quando ela
// NÃO tem o prefixo `v1:`. Assim, durante (e antes de) a migração das linhas
// existentes, as leituras continuam funcionando com dados em texto puro. E sem
// a env `CREDENTIAL_ENCRYPTION_KEY` configurada, encrypt/decrypt viram no-ops —
// mantém os testes unitários db-free e sem necessidade de chave. A exigência de
// chave em produção é feita por `validateEncryptionKey()` no boot da API.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION_PREFIX = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

function resolveKey() {
  const raw = String(process.env.CREDENTIAL_ENCRYPTION_KEY ?? '').trim()
  if (!raw) return null
  // 64 chars hex = 32 bytes. É o formato gerado por
  // `crypto.randomBytes(32).toString('hex')`.
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) return null
  return Buffer.from(raw, 'hex')
}

export function isEncryptionConfigured() {
  return resolveKey() !== null
}

// Valida a chave no boot. Lança erro com mensagem acionável quando ausente ou
// malformada. Chamada por src/api/server.js logo após validar o JWT_SECRET.
export function validateEncryptionKey() {
  const raw = String(process.env.CREDENTIAL_ENCRYPTION_KEY ?? '').trim()
  if (!raw) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY ausente. Gere uma com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" e configure no .env')
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY inválida. Deve ser uma string hexadecimal de 64 caracteres (32 bytes).')
  }
  return true
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${VERSION_PREFIX}:`)
}

// Cifra uma string. No-op (devolve o input) quando não há chave configurada —
// o boot da API em produção exige a chave, então isso só ocorre em testes/dev.
export function encryptCredential(plaintext) {
  if (typeof plaintext !== 'string') plaintext = String(plaintext ?? '')
  const key = resolveKey()
  if (!key) return plaintext
  if (isEncrypted(plaintext)) return plaintext // idempotente: não recifra
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${VERSION_PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

// Decifra uma string. Devolve o input inalterado quando ele não está cifrado
// (dado legado em texto puro) ou quando não há chave — leitura nunca quebra.
export function decryptCredential(stored) {
  if (!isEncrypted(stored)) return stored
  const key = resolveKey()
  if (!key) return stored // sem chave não há como decifrar; devolve cru (não quebra leitura)
  const parts = stored.split(':')
  if (parts.length !== 4) return stored
  const [, ivHex, tagHex, ctHex] = parts
  try {
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(tagHex, 'hex')
    const ciphertext = Buffer.from(ctHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    // Chave errada/dado corrompido: GCM lança no final(). Não vaza o ciphertext
    // nem derruba o fluxo — devolve o armazenado e deixa o parse a jusante falhar
    // graciosamente (credencial tratada como inválida).
    return stored
  }
}

export const __testing = { KEY_BYTES, IV_BYTES, VERSION_PREFIX, isEncrypted }
