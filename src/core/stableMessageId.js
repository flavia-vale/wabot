import { createHash } from 'crypto'

// Gera um messageId ESTÁVEL (determinístico) a partir de uma semente — o
// `logId` da linha em MessageLog. O MESMO id é reutilizado em todas as
// tentativas/rotas de um único envio (primária, fallbacks e retries do
// processSendJob).
//
// Por quê: `withSendTimeout` é um `Promise.race` que NÃO aborta o
// `sock.sendMessage` subjacente; um timeout ou `Connection Closed` pode
// disparar depois que a mensagem JÁ foi entregue ao WhatsApp. O retry/fallback
// então reenvia e vira DUPLICATA. Passando um `messageId` fixo, o WhatsApp
// deduplica no servidor pela key.id: um reenvio com o mesmo id é tratado como a
// mesma mensagem e ignorado. Idempotência de ponta a ponta, sem custo de RAM.
//
// Formato: uppercase-hex com prefixo `3EB0` (mesmo shape dos ids que o próprio
// WhatsApp/Baileys geram), 32 chars. Determinístico via SHA-256 da semente.
export function buildStableSendMessageId(seed) {
  const normalized = String(seed ?? '').trim()
  if (!normalized) return null
  const hex = createHash('sha256').update(normalized).digest('hex').toUpperCase()
  return `3EB0${hex.slice(0, 28)}`
}
