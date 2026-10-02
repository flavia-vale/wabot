// Feature 017, Fatia 3 — PURO. Converte o texto da oferta (escrito com a
// formatação do WhatsApp: *negrito*, _itálico_, ~riscado~, ```mono```) para o
// HTML aceito pelo Telegram. Sem isso, os asteriscos apareceriam crus no
// grupo. Se o Telegram recusar a marcação, o adaptador reenvia em texto puro.

export const TELEGRAM_TEXT_LIMIT = 4096
export const TELEGRAM_CAPTION_LIMIT = 1024

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const RULES = [
  [/```([\s\S]+?)```/g, '<code>$1</code>'],
  [/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=$|[\s).,!?:;])/gm, '$1<b>$2</b>'],
  [/(^|[\s(])_(?!\s)([^_\n]+?)_(?=$|[\s).,!?:;])/gm, '$1<i>$2</i>'],
  [/(^|[\s(])~(?!\s)([^~\n]+?)~(?=$|[\s).,!?:;])/gm, '$1<s>$2</s>'],
]

export function whatsappTextToTelegramHtml(text) {
  let out = escapeHtml(String(text ?? ''))
  for (const [re, replacement] of RULES) out = out.replace(re, replacement)
  return out
}

// Corta sem quebrar no meio de uma palavra quando possível.
export function clampText(text, limit) {
  const value = String(text ?? '')
  if (value.length <= limit) return value
  const cut = value.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.8 ? cut.slice(0, lastSpace) : cut)}…`
}
