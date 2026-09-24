// Resumo em texto de um PreservationPreset (Ritmo por grupo) — compartilhado
// entre a aba "Ritmo por grupo" do Anti-banimento (RitmoPart.js) e o resumo
// somente-leitura da tela de Conexão WhatsApp (RhythmCard.js), para as duas
// telas nunca descreverem o mesmo preset com textos diferentes.
//
// "Máximo de envios na janela"/"Janela de rajada" não entram no resumo:
// viraram campos fixos (piso anti-banimento), não são mais informação que a
// cliente escolheu — mostrar o valor herdado confundiria com "isto é
// ajustável".
export function summarizePreset(p) {
  const parts = []
  if (p.operatingHoursEnabled) {
    try { const h = JSON.parse(p.operatingHoursJson); parts.push(`envia ${h.startHour}h–${h.endHour}h`) }
    catch { /* ignore */ }
  } else parts.push('envia 24h')
  parts.push(`espera pelo menos ${p.minIntervalSec}s entre envios${p.dailyCap ? ` · até ${p.dailyCap}/dia` : ''}`)
  if (Number(p.queueMaxAgeMin) > 0) parts.push(`descarta após ${Math.round(Number(p.queueMaxAgeMin) / 60)}h na fila`)
  return parts.join(' · ')
}
