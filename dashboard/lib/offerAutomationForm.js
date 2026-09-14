const DAILY_INTERVAL_MINUTES = 1440
const DAILY_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateOfferAutomationForm(form = {}) {
  if (!String(form.keyword || '').trim()) return 'Escreva o que você quer vender.'
  const instagramIds = Array.isArray(form.instagramDestinationIds) ? form.instagramDestinationIds : []
  if (!form.destGroupJid && instagramIds.length === 0) return 'Escolha pelo menos um grupo ou destino do Instagram.'
  if (Number(form.intervalMinutes) === DAILY_INTERVAL_MINUTES && !DAILY_TIME_RE.test(String(form.dailyRunTime || ''))) return 'Escolha um horário válido para o envio diário.'
  if (form.publicationMode === 'review') {
    const size = Number(form.reviewTargetSize)
    if (!Number.isInteger(size) || size < 5 || size > 30) return 'Escolha quantas ofertas quer guardar para revisão.'
  }
  return null
}
