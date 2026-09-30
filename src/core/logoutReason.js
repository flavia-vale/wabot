// Motivo que o WhatsApp informa junto com um 401 (sessão deslogada).
//
// Medido em produção (2026-09-30): 38 contas deslogadas em 7 dias, algumas 8 a
// 13 vezes, e o registro da queda só dizia "401" — sem separar "a cliente
// removeu o aparelho" (`device_removed`) de "o WhatsApp invalidou a sessão".
// O Baileys já carrega o motivo: em `stream:error` a mensagem do erro é
// `Stream Errored (<motivo>)`; em `failure` os atributos vêm em `error.data`.
//
// Puro e defensivo: devolve só strings curtas (nunca o nó inteiro, que pode
// trazer identificadores), para ir ao log e ao metadata do evento sem risco.
const MAX = 60

function short(value) {
  if (value == null) return ''
  const text = String(value).replace(/[\r\n\t]+/g, ' ').trim()
  return text.length > MAX ? `${text.slice(0, MAX)}…` : text
}

export function describeLogoutReason(error) {
  const data = error?.data
  const attrs = data?.attrs && typeof data.attrs === 'object' ? data.attrs : (data && typeof data === 'object' ? data : {})
  const content = Array.isArray(data?.content) ? data.content : []
  const conflict = content.find((child) => child?.tag === 'conflict')
  return {
    message: short(error?.message),
    failureReason: short(attrs?.reason),
    conflictType: short(conflict?.attrs?.type),
  }
}
