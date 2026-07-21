// 009-affiliate-improvements-r1 (US3): valida o FORMATO da chave PIX
// declarada contra o tipo escolhido, ANTES de qualquer cifragem/persistência
// (FR-021). Módulo puro — sem acesso a DB/env — conforme contracts/pix-validation.md.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_E164_BR_RE = /^\+55\d{2}9\d{8}$/
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVP_HEX32_RE = /^[0-9a-f]{32}$/i

function stripCpfPhoneNoise(value) {
  return String(value ?? '').replace(/[\s.\-()]/g, '')
}

// Validação de dígito verificador de CPF (algoritmo padrão da Receita Federal).
function isValidCpfChecksum(cpf) {
  if (!/^\d{11}$/.test(cpf)) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false // sequências tipo 111.111.111-11

  const digits = cpf.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i)
  let checkDigit1 = (sum * 10) % 11
  if (checkDigit1 === 10) checkDigit1 = 0
  if (checkDigit1 !== digits[9]) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i)
  let checkDigit2 = (sum * 10) % 11
  if (checkDigit2 === 10) checkDigit2 = 0
  if (checkDigit2 !== digits[10]) return false

  return true
}

export function validatePixKey({ pixKey, pixKeyType }) {
  const key = String(pixKey ?? '').trim()
  if (!key) return { ok: false, error: 'Chave PIX é obrigatória' }

  if (pixKeyType === 'cpf') {
    const digits = stripCpfPhoneNoise(key)
    if (!isValidCpfChecksum(digits)) return { ok: false, error: 'CPF inválido' }
    return { ok: true }
  }

  if (pixKeyType === 'phone') {
    const normalized = stripCpfPhoneNoise(key)
    if (!PHONE_E164_BR_RE.test(normalized)) {
      return { ok: false, error: 'Telefone deve estar no formato brasileiro com DDD (ex.: +5511987654321)' }
    }
    return { ok: true }
  }

  if (pixKeyType === 'email') {
    if (!EMAIL_RE.test(key)) return { ok: false, error: 'E-mail inválido' }
    return { ok: true }
  }

  if (pixKeyType === 'random') {
    if (!UUID_V4_RE.test(key) && !EVP_HEX32_RE.test(key)) {
      return { ok: false, error: 'Chave aleatória deve ser um UUID v4 ou uma chave EVP de 32 caracteres hexadecimais' }
    }
    return { ok: true }
  }

  return { ok: false, error: 'pixKeyType inválido' }
}
